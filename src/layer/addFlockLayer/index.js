import io from 'socket.io-client';
import Animator from './animator';
import Movement from './movement';
import { initSource, initLayerStyles, initStatLayers, initAssets } from './utils';
import { handling, muzzlePosition, arcRadiusPx } from './crafts';
import PlayerObject from './player-object';
import createSounds from './sounds';
import createWeaponIndicator from './weapon-indicator';
import createPerfHud from './perf-hud';
import createRadar from './radar';
import decodeWire from './world-wire';
const TIME_BETWEEN_FIRE = 90;
// "s" arms torpedoes: half the firing rate, 10x the damage (the server decides the damage; this is what we claim).
const TIME_BETWEEN_TORPEDOES = TIME_BETWEEN_FIRE * 2;
const TORPEDO_HIT_VALUE = 10;
// Enemy sounds fade out with distance from the player (squared falloff) and are silent beyond this.
const AUDIBLE_RADIUS_M = 1000;

const DEATH_DELAY = 500;
// Length of one movement "tick", the unit craft speed and handling are tuned in (about 38 per second,
// what the game effectively ran at). Movement scales by real elapsed time over this, so it feels the same at any frame rate.
const PHYSICS_TICK_MS = 26;
// How far the radar reaches. The server sends enemies within about a kilometre, so this covers all of them.
const RADAR_RANGE_M = 1200;

/**
 * `craft` is the first craft to fly. After it is destroyed the layer is torn down
 * and `chooseCraft()` (resolves with a craft) is asked for the next one; the socket stays connected.
 */
const addFlockLayer = (map, {
  layerId = 'flock',
  defaultCenter = [-74.0210715263351, 40.727543577399416],
  SOCKET_URL,
  craft,
  chooseCraft,
}) => {
  const gameState = {
    fireCount: 0,
    playersById: {},
    craft,
    map,
    connection: null,
    playerObject: null,
    selecting: false,
    heard: new Set(),
    soundsPrimed: false,
    sounds: createSounds(),
    torpedoesArmed: false,
    weaponIndicator: null,
    keyListener: null,
    perfHud: null,
    radar: null,
    world: {},
    messageCount: 0,
  }
  const { sounds } = gameState;

  initAssets(map);

  const startGame = (craft) => {
    gameState.craft = craft;
    gameState.selecting = false;
    // Without a connection the 'connected' handler starts the game.
    if (!gameState.connection) return;
    const { id: playerUuid, fps, gameCenter } = gameState.connection;
    console.log({ fps, playerUuid, gameCenter });
    const center = gameCenter && gameCenter.length === 2 ? gameCenter : defaultCenter;
    /**
     * disable the keyboard controls that move the camera from mapbox b/c it messes with
     * the player follow cam mechanism.
     */
    if (map.keyboard.isEnabled()) {
      map.keyboard.disable();
    }

    console.log('connected', playerUuid);
    const { friction, thrust } = handling(craft);
    const playerObject = PlayerObject(playerUuid, {
      isPlayer: true,
      pos: {x: center[0], y: center[1]},
      icon: craft.id,
      'icon-size': craft.iconSize,
      hitCapacity: craft.shield,
      hitCount: 10,
    }, { friction });
    gameState.playerObject = playerObject;
    gameState.playersById = {};
    // Start from an empty world; the server answers with a full snapshot.
    gameState.world = {};
    websocket.emit('resync');
    // Don't make noise for everything that is already happening when a round starts.
    gameState.heard = new Set();
    gameState.soundsPrimed = false;
    sounds.unlock();
    // "s" toggles between lasers and torpedoes.
    gameState.torpedoesArmed = false;
    gameState.weaponIndicator = createWeaponIndicator();
    gameState.keyListener = (e) => {
      if (e.repeat || (e.key || '').toLowerCase() !== 's') return;
      gameState.torpedoesArmed = !gameState.torpedoesArmed;
      gameState.weaponIndicator.update(gameState.torpedoesArmed);
    };
    window.addEventListener('keydown', gameState.keyListener);
    gameState.perfHud = createPerfHud(map, {
      getObjects: () => gameState.world,
      getMessageCount: () => gameState.messageCount,
    });
    gameState.radar = createRadar({
      getPlayerPos: () => playerObject.getPos(),
      getObjects: () => gameState.world,
      rangeM: RADAR_RANGE_M,
    });
    // The map is wherever the previous craft was destroyed; the new one spawns at the game center.
    map.jumpTo({ center });

    gameState.source = initSource(map, { id: layerId, initFeatures: objectsToFeatures([playerObject], playerObject.id) });
    gameState.statsMapLayer = initStatLayers(map, { id: layerId });
    gameState.mainMapLayer = initLayerStyles(map, { id: layerId });
    // init pos and state
    websocket.send({ [playerObject.id]: playerObject.getState() });
    gameState.animator = new Animator({
      fps: fps || 25,
      callback: (_, elapsedMs) => {
        const playerState = playerObject.getState();
        /**
         * keep animation flowing if updates are happening
         * otherwise pause the updates so we aren't
         * needlessly sending empty data.
         */

        if (Date.now() - gameState.lastMessage < 1000) {
          const features = objectsToFeatures(Object.values(gameState.playersById), playerObject.id, playerObject);
          gameState.source && gameState.source.self.setData({
            type: 'FeatureCollection',
            features,
          });
        }
        gameState.radar.update();
        // Engine hum while thrusting in any direction (arrow keys); fades in and out.
        sounds.setLoop('engine', gameState.playerObject === playerObject && gameState.movement.isThrusting());


        if (!playerState.isIdle && gameState.playerObject === playerObject) {
          websocket.send({ [playerObject.id]: playerObject.getState() });
          playerObject.next(elapsedMs / PHYSICS_TICK_MS);
          // The camera follows the craft every frame; easing a new pan each time made it lurch.
          map.jumpTo({ center: playerObject.getPos() });
        }
      },
    });

    gameState.movement = new Movement({
      fps: fps || 30,
      callback: (states, elapsedMs) => {
        const tSpeed = (states.T ? thrust*3 : thrust) * (elapsedMs / PHYSICS_TICK_MS);
        if (states.UP) playerObject.addY(tSpeed);
        if (states.DOWN) playerObject.addY(-tSpeed);
        if (states.LEFT) playerObject.addX(-tSpeed);
        if (states.RIGHT) playerObject.addX(tSpeed);
        if (states.SPACE) fireProjectile(playerObject, gameState, websocket);
        if (states.g && states.o && states.d) resetGame();
      },
    });

    function resetGame() {
      if (!gameState.resetAt || Date.now() - gameState.resetAt > 5000) {
        gameState.resetAt = Date.now();
        websocket.emit('reset game');
      }
    }

    gameState.movement.enable();
    gameState.animator.start();
  };

  const websocket = io(SOCKET_URL);

  function unmount() {
    gameState.playerObject = null;
    sounds.setLoop('engine', false);
    if (!gameState.source) return;
    gameState.animator.stop();
    gameState.movement.disable();
    window.removeEventListener('keydown', gameState.keyListener);
    gameState.weaponIndicator.remove();
    gameState.perfHud.remove();
    gameState.radar.remove();
    gameState.statsMapLayer.remove();
    gameState.statsMapLayer = null;
    gameState.mainMapLayer.remove();
    gameState.mainMapLayer = null;
    gameState.source.remove();
    gameState.source = null;
    if (!map.keyboard.isEnabled()) {
      map.keyboard.enable();
    }
  }

  function handleDestroyed() {
    gameState.selecting = true;
    // Stops state updates being sent for the dead craft; the server ignores them anyway.
    gameState.playerObject = null;
    gameState.movement.disable();
    // Let the explosion play, and give the server time to remove the craft before a new one is sent.
    setTimeout(() => {
      unmount();
      chooseCraft().then(startGame);
    }, DEATH_DELAY);
  }

  /**
   * Enemy shots and explosions are detected as new ids in the server updates (no extra
   * network events). The player's own sounds are never attenuated or dropped. Everything else is
   * attenuated by distance and played nearest first, so when the voice caps in sounds.js
   * are hit it is the far-away noise that gets dropped.
   * `updated` are the decoded objects that changed, `removed` the ids that left the world.
   */
  function playWorldSounds(updated, removed, listener) {
    const listenerPos = listener.getPos();
    const events = [];
    updated.forEach((obj) => {
      let name = null;
      if (obj.isProjectile) {
        if (obj.robotProjectile) name = 'enemyFire';
      } else if (obj.isBlast) {
        name = 'explosion';
      } else if (obj.expired && !obj.isDrop) {
        name = 'explosion';
      }
      if (!name) return;
      const key = `${name}:${obj.id}`;
      if (gameState.heard.has(key)) return;
      gameState.heard.add(key);
      if (!gameState.soundsPrimed || (name === 'enemyFire' && obj.expired)) return;
      const isOwn = obj.id === listener.id;
      events.push({ name, isOwn, distance: isOwn ? 0 : distanceMeters(listenerPos, obj.pos) });
    });
    removed.forEach((id) => {
      gameState.heard.delete(`enemyFire:${id}`);
      gameState.heard.delete(`explosion:${id}`);
    });
    gameState.soundsPrimed = true;

    events.sort((a, b) => a.distance - b.distance).forEach(({ name, isOwn, distance }) => {
      sounds.play(name, {
        volume: isOwn ? 1 : Math.max(0, 1 - distance / AUDIBLE_RADIUS_M) ** 2,
        priority: isOwn,
      });
    });
  }

  const handleServerDisconnection = () => {
    gameState.connection = null;
    unmount();
  };

  websocket.on('connected', (connection) => {
    gameState.connection = connection;
    if (!gameState.playerObject && !gameState.selecting) startGame(gameState.craft);
  });
  websocket.on('disconnect', handleServerDisconnection);
  // Server updates: { s?: 1 (full snapshot), u: objects that are new or changed, d: ids that left }.
  websocket.on('world', function({ s: snapshot, u, d }) {
    gameState.lastMessage = Date.now();
    gameState.messageCount += 1;
    if (snapshot) {
      gameState.world = {};
      gameState.playersById = {};
      // Don't make noise for everything that is already happening.
      gameState.heard = new Set();
      gameState.soundsPrimed = false;
    }

    const updated = u.map(decodeWire);
    updated.forEach((state) => {
      gameState.world[state.id] = state;
      gameState.playersById[state.id] = PlayerObject(state.id, state);
    });
    d.forEach((id) => {
      delete gameState.world[id];
      delete gameState.playersById[id];
    });

    if (gameState.playerObject) playWorldSounds(updated, d, gameState.playerObject);
    const own = gameState.playerObject && gameState.world[gameState.playerObject.id];
    if (own && own.expired) handleDestroyed();
  });

  return {
    unmount,
  };
};

const METERS_PER_DEGREE = 111195;

function fireProjectile(playerObject, gameState, websocket) {
  const now = Date.now();
  const playerState = playerObject.getState();
  const torpedo = gameState.torpedoesArmed;
  if (
    !playerState.statistics.roundShotAt ||
    playerState.statistics.roundShotAt &&
    (now - playerState.statistics.roundShotAt) > (torpedo ? TIME_BETWEEN_TORPEDOES : TIME_BETWEEN_FIRE)
  ) {
    playerObject.fire();
    playerObject.updateStats({ roundShotAt: now });
    const bearing = playerObject.getBearing() || 0;
    // Alternate through the craft's cannons, starting with the first.
    const muzzle = muzzlePosition(gameState.craft, gameState.fireCount, {
      pos: playerObject.getPos(),
      bearing,
      zoom: gameState.map.getZoom(),
    });
    gameState.fireCount += 1;
    // The craft's speed right now, in m/s. The server adds it to the shot's own speed so a shot fired
    // while at turbo is still faster than the craft that fired it.
    const metersPerTick = Math.hypot(
      playerState.velocity.x * METERS_PER_DEGREE * Math.cos(muzzle.y * Math.PI / 180),
      playerState.velocity.y * METERS_PER_DEGREE,
    );
    const projectile = PlayerObject(playerObject.id + gameState.fireCount, {
      pos: { x: muzzle.x, y: muzzle.y },
      icon: 'dot-11',
      isProjectile: 'true',
      ...(torpedo && { isTorpedo: true }),
      bearing: muzzle.bearing,
      hitValue: torpedo ? TORPEDO_HIT_VALUE : 1,
      shipSpeed: Math.round(metersPerTick / (PHYSICS_TICK_MS / 1000)),
      ownerId: playerObject.id,
    });
    gameState.sounds.play(torpedo ? 'torpedoFire' : 'playerFire');
    websocket.send({ [projectile.id]: projectile.getState() });
  }
}

// Approximate ground distance between a [lng, lat] and an {x, y} point; fine at audible ranges.
function distanceMeters([lng, lat], { x, y }) {
  const metersPerDegree = METERS_PER_DEGREE;
  const dx = (x - lng) * Math.cos(lat * Math.PI / 180) * metersPerDegree;
  const dy = (y - lat) * metersPerDegree;
  return Math.hypot(dx, dy);
}

/**
 * `localCraft` is the player's own craft: it is drawn where it is locally, not where the last server
 * update put it, so it moves with the camera instead of jittering against it.
 */
function objectsToFeatures(points, mainPlayerId, localCraft) {
  return points.map(obj => {
    let props = obj.getState();
    if (localCraft && obj.id === mainPlayerId) {
      const [x, y] = localCraft.getPos();
      props = { ...props, pos: { x, y }, bearing: localCraft.getBearing() ?? props.bearing };
    }
    const baseFeature = {
      type: 'Feature',
      properties: {
        id: obj.id,
        velX: props.velocity.x,
        velY: props.velocity.y,
        isIdle: props.isIdle ? 'true' : 'false',
        bearing: props.bearing,
        icon: props.icon,
        'icon-size': props['icon-size'],
        expired: props.expired,
        hitCount: props.statistics.hitCount,
        hitCapacity: props.hitCapacity,
        kills: props.statistics.kills || 0,
        isPlayer: props.isPlayer,
        isDrop: props.isDrop,
        isBlast: props.isBlast,
        isTorpedo: props.isTorpedo,
        isRobot: props.isRobot,
        arcRadius: props.isPlayer || props.isRobot ? arcRadiusPx(props.icon, props['icon-size']) : undefined,
        robotProjectile: props.robotProjectile,
      },
      geometry: {
        type: props.isProjectile ? 'LineString' : 'Point',
        coordinates: props.isProjectile ? [[props.pos.x, props.pos.y], [props.prevPos.x, props.prevPos.y]] : [props.pos.x, props.pos.y],
      },
    };
    if (props.isProjectile) {
      baseFeature.properties.isProjectile = props.isProjectile;
    } else {
      baseFeature.properties.isConnected = props.isConnected ? 'true' : 'false';
    }
    return baseFeature;
  })
    .concat(points.reduce((sum, point) => {
      if (mainPlayerId === point.id) return linesToOtherPointsFromPoint(points, point);
      return sum;
    }, []) || []);
}

function linesToOtherPointsFromPoint(points, p1) {
  return points.reduce((lines, p2) => {
    const p2props = p2.getState();
    if (p2props.isProjectile || p2props.isDrop || p2props.isBlast) return lines;
    if (p1.id !== p2.id) {
      const distance = calcDistance(p1.getPos(), p2.getPos());
      if (distance < 0.00001) {
        lines.push({
          type: 'Feature',
          properties: {
            id: `${p1.id}-${p2.id}`,
            fromId: p1.id,
            toId: p2.id,
            distance,
          },
          geometry: {
            type: 'LineString',
            coordinates: [p2.getPos(), p1.getPos()],
          },
        });
      }
    }
    return lines;
  }, []);
}

function calcDistance(p1, p2) {
  const x = p2[0] - p1[0];
  const y = p2[1] - p1[1];
  return Math.hypot(x*x, y*y);
}

export default addFlockLayer;
