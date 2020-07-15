import io from 'socket.io-client';
import Animator from './animator';
import Movement from './movement';
import { initSource, initLayerStyles, initStatLayers, initAssets, playerCraft } from './utils';
import PlayerObject from './player-object';
import tieFireSound from './assets/tie-fire-1.mp3';
const TIME_BETWEEN_FIRE = 150;

const addFlockLayer = (map, {
  layerId = 'flock',
  defaultCenter = [-74.0210715263351, 40.727543577399416],
  SOCKET_HOST,
  SOCKET_PORT,
}) => {
  const gameState = {
    fireCount: 0,
    playersById: {},
  }

  initAssets(map);

  const init = ({ id: playerUuid, fps, gameCenter, }) => {
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
    const speed = 0.000005;
    const random = Math.random();
    const craftNames = Object.keys(playerCraft);
    const fighterIndex = random * craftNames.length === craftNames.length ? 1 : ~~(random * craftNames.length);
    const craftName = craftNames[fighterIndex];
    const playerObject = new PlayerObject(playerUuid, {
      isPlayer: true,
      pos: {x: center[0], y: center[1]},
      icon: craftName,
      'icon-size': craftName.indexOf('xWing') > -1 ? 0.4 : 0.5,
      hitCapacity: 100,
      hitCount: 10,
    });
    // gameState.playerObject = playerObject;

    gameState.source = gameState.source || initSource(map, { id: layerId, initFeatures: objectsToFeatures([playerObject], playerObject.id) });
    gameState.statsMapLayer = gameState.statsMapLayer || initStatLayers(map, { id: layerId });
    gameState.mainMapLayer = gameState.mainMapLayer || initLayerStyles(map, { id: layerId });
    // init pos and state
    websocket.binary(true).send({ [playerObject.id]: playerObject.getState() });
    gameState.animator = gameState.animator || new Animator({
      fps: fps || 25,
      callback: () => {
        const playerState = playerObject.getState();
        /**
         * keep animation flowing if updates are happening
         * otherwise pause the updates so we aren't
         * needlessly sending empty data.
         */

        if (Date.now() - gameState.lastMessage < 1000) {
          const features = objectsToFeatures(Object.values(gameState.playersById), playerObject.id);
          gameState.source && gameState.source.self.setData({
            type: 'FeatureCollection',
            features,
          });
        }


        if (!playerState.isIdle) {
          websocket.binary(true).send({ [playerObject.id]: playerObject.getState() });
          playerObject.next();
        }
        removeExpiredObjects();
      },
    });
    gameState.cameraAnimator = gameState.cameraAnimator || new Animator({
      fps: 5,
      callback: () => {
        const playerState = playerObject.getState();
        if (!playerState.isIdle) {
          map.panTo(playerObject.getPos(), {duration: 1500});
        }
      },
    });

    gameState.movement = gameState.movement || new Movement({
      fps: fps || 30,
      callback: (states) => {
        const tSpeed = states.T ? speed*3 : speed;
        if (states.UP) playerObject.addY(tSpeed);
        if (states.DOWN) playerObject.addY(-tSpeed);
        if (states.LEFT) playerObject.addX(-tSpeed);
        if (states.RIGHT) playerObject.addX(tSpeed);
        if (states.SPACE) fireProjectile(playerObject, gameState, websocket);
        if (states.g && states.o && states.d) resetGame();
      },
    });

    function removeExpiredObjects() {
      gameState.playersById = Object.values(gameState.playersById).reduce((sum, item) => {
        const props = item.getState();
        if (Date.now() - props.time < 1000) {
          sum[item.id] = item;
          return sum;
        }

        if (props.expired) {
          return sum;
        }

        if (props.time === -1) {
          sum[item.id] = item;
          return sum;
        }

        if (!props.isProjectile) {
          sum[item.id] = item;
          return sum;
        }
        return sum;
      }, {});
    }

    function resetGame() {
      if (!gameState.resetAt || Date.now() - gameState.resetAt > 5000) {
        gameState.resetAt = Date.now();
        websocket.binary(true).emit('reset game');
      }
    }

    websocket.on('message-all', function(props) {
      gameState.lastMessage = Date.now();
      gameState.playersById = {};

      // if (gameState.playerObject) {
      //   gameState.playerObject = new PlayerObject(gameState.playerObject.id, props[gameState.playerObject.id]);
      //   gameState.playersById[gameState.playerObject.id] = gameState.playerObject;
      // }

      const objects = Object.entries(props);
      objects.map(([key, obj]) => {
        gameState.playersById[obj.id] = new PlayerObject( key, obj );
      });
    });

    gameState.movement.enable();
    gameState.animator.start();
    gameState.cameraAnimator.start();
  };

  const websocket = io(`ws://${SOCKET_HOST}:${SOCKET_PORT}`);

  function unmount() {
    gameState.animator.stop();
    gameState.cameraAnimator.stop();
    gameState.movement.disable();
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

  const handleServerDisconnection = () => {
    unmount();
  };

  websocket.on('connected', init);
  websocket.on('disconnect', handleServerDisconnection);
  websocket.on('object removed', function(id) {
    gameState.lastMessage = Date.now();
    delete gameState.playersById[id];
  });

  return {
    unmount,
  };
};

function fireProjectile(playerObject, gameState, websocket) {
  const now = Date.now();
  const playerState = playerObject.getState();
  if (
    !playerState.statistics.roundShotAt ||
    playerState.statistics.roundShotAt &&
    (now - playerState.statistics.roundShotAt) > TIME_BETWEEN_FIRE
  ) {
    playerObject.fire();
    playerObject.updateStats({ roundShotAt: now });
    const playerPos = playerObject.getPos();
    gameState.fireCount += 1;
    const projectile = new PlayerObject(playerObject.id + gameState.fireCount, {
      pos: { x: playerPos[0], y: playerPos[1] },
      icon: 'dot-11',
      isProjectile: 'true',
      bearing: playerObject.getBearing() || 0,
      hitValue: 1,
      ownerId: playerObject.id,
    });
    const audio = new Audio();
    audio.src = tieFireSound;
    audio.volume = 0.25;
    audio.play();
    websocket.binary(true).send({ [projectile.id]: projectile.getState() });
  }
}

function objectsToFeatures(points, mainPlayerId) {
  return points.map(obj => {
    const props = obj.getState();
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
    if (p2props.isProjectile) return lines;
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
