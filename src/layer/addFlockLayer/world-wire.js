/**
 * Decodes objects from the server's `world` event into the object shape the rest of the game uses.
 * The format is described in the-flock-network `src/server/wire.js`; keep the two in sync:
 *   n id   t type   x, y position   b bearing   i icon   z icon size   h hitCount   c hitCapacity
 *   k kills   e 1 when exploding   p, q previous position (shots are drawn from there)
 */
const ROBOT = 0;
const PLAYER = 1;
const SHOT = 2;
const TORPEDO = 3;
const ENEMY_SHOT = 4;
const DROP = 5;
const BLAST = 6;

export default function decodeWire(w) {
  const state = { id: w.n, pos: { x: w.x, y: w.y } };
  switch (w.t) {
    case ROBOT:
    case PLAYER:
      if (w.t === ROBOT) state.isRobot = true;
      else state.isPlayer = true;
      state.bearing = w.b;
      state.icon = w.i;
      state['icon-size'] = w.z;
      state.hitCapacity = w.c;
      state.statistics = { hitCount: w.h, kills: w.k || 0 };
      break;
    case DROP:
      state.isDrop = true;
      state.icon = w.i;
      state['icon-size'] = w.z;
      break;
    case BLAST:
      state.isBlast = true;
      state.icon = w.i;
      state['icon-size'] = w.z;
      break;
    case SHOT:
    case TORPEDO:
    case ENEMY_SHOT:
      state.isProjectile = 'true';
      state.prevPos = { x: w.p, y: w.q };
      if (w.t === TORPEDO) state.isTorpedo = true;
      if (w.t === ENEMY_SHOT) state.robotProjectile = 'true';
      break;
    default:
      break;
  }
  if (w.e) state.expired = 1;
  return state;
}
