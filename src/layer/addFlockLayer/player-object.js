import { bearing } from './utils';

const PlayerObject = (id, initState = {}, { friction = 0.05 } = {}) => {
  const PRECISION = 0.000005;
  const FRICTION = friction;
  const x = initState.pos && initState.pos.x || 0;
  const y = initState.pos && initState.pos.y || 0;
  const xV = initState.velocity && initState.velocity.x || 0;
  const yV = initState.velocity && initState.velocity.y || 0;
  const now = Date.now();
  const state = {
    hitCapacity: 50,
    id,
    pos: { x, y },
    prevPos: {
      x: initState.prevPos && initState.prevPos.x || x,
      y: initState.prevPos && initState.prevPos.y || y,
    },
    velocity: initState.velocity || { x: xV, y: yV },
    time: now,
    statistics: {
      roundShotAt: now,
      hitCount: 0,
      kills: 0,
      fireCount: 0,
    },
    ...initState,
  };
  const addX = (vel) => {
    state.velocity.x += vel;
  };
  const addY = (vel) => {
    state.velocity.y += vel;
  };
  /**
   * Advances the craft by `steps` physics ticks (1 = the original fixed tick; pass elapsed time
   * divided by the tick length so movement is the same at any frame rate).
   */
  const next = (steps = 1) => {
    state.time = Date.now();
    state.prevPos.x = state.pos.x;
    state.prevPos.y = state.pos.y;
    state.pos.x += state.velocity.x * steps;
    state.pos.y += state.velocity.y * steps;
    // Friction compounds per tick, so over `steps` ticks the velocity keeps (1 - FRICTION) ^ steps of itself.
    const keep = Math.pow(1 - FRICTION, steps);

    // In other parts of the world the Y axis is backwards (NYC). Not sure why.
    state.bearing = state.prevPos ? -bearing(state.prevPos.x, state.prevPos.y, state.pos.x, state.pos.y) + 90 : null;
    if (
      state.velocity.x > 0 && state.velocity.x < PRECISION
      || state.velocity.x < 0 && state.velocity.x > -PRECISION
    ) state.velocity.x = 0;
    else state.velocity.x = state.velocity.x * keep;

    if (
      state.velocity.y > 0 && state.velocity.y < PRECISION
      || state.velocity.y < 0 && state.velocity.y > -PRECISION
    ) state.velocity.y = 0;
    else state.velocity.y = state.velocity.y * keep;
  };
  const getPos = () => {
    const pos = [state.pos.x, state.pos.y];
    return pos;
  };

  const getState = () => ({
    ...state,
    isIdle: state.velocity.x === 0 && state.velocity.y === 0,
  });

  const isMoving = () => {
    return state.velocity.x !== 0 || state.velocity.y !== 0;
  };

  const getTime = () => state.time;
  const updateStats = (props) => {
    state.statistics = {
      ...state.statistics,
      ...props,
    };
  };

  const fire = () => updateStats({ fireCount: state.statistics.fireCount + 1 });

  return {
    id,
    addX,
    addY,
    next,
    getPos,
    getState,
    getTime,
    updateStats,
    fire,
    getBearing: () => state.bearing,
    isMoving,
  };
};

export default PlayerObject;
