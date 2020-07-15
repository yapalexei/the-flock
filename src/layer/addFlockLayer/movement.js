import Animator from './animator';

function Movement({
  fps,
  callback = () => console.log('callback'),
} = {}) {
  const KEY = {
    LEFT:   37,
    UP:     38,
    RIGHT:  39,
    DOWN:   40,
    T:      84,
    SPACE:  32,
    g: 71,
    o: 79,
    d: 68
  };
  const states = {};
  const state = {};

  function disable() {
    window.removeEventListener('keydown', keyDownHandler);
    state.keydownListener = null;
    window.removeEventListener('keyup', keyUpHandler);
    state.keyupListener = null;
    window.removeEventListener('blur', blurHandler);
    state.windowBlurListener = null;
    state.animator.stop();
  }

  function keyUpHandler(e) {
    const keycode = e.keyCode || e.which;
    states[keycode] = 0;
    if (
      !states[KEY.UP] &&
      !states[KEY.RIGHT] &&
      !states[KEY.DOWN] &&
      !states[KEY.LEFT] &&
      !states[KEY.T] &&
      !states[KEY.SPACE] &&
      !states[KEY.g] &&
      !states[KEY.o] &&
      !states[KEY.d]
    ) {
      window.removeEventListener('keyup', keyUpHandler);
    }
  }

  function blurHandler() {
    Object.keys(states).map((key) => {
      states[key] = 0;
    });
  }

  function keyDownHandler(e) {
    if (!state.keyupListener) {
      state.keyupListener = window.addEventListener('keyup', keyUpHandler);
    }
    if (!state.windowBlurListener) {
      state.windowBlurListener = window.addEventListener('blur', blurHandler);
    }
    const keycode = e.keyCode || e.which;
    states[keycode] = window.performance.now();
  }

  function enable() {
    state.keydownListener = window.addEventListener('keydown', keyDownHandler);

    state.animator = state.animator || new Animator({
      fps: fps,
      callback: () => {
        if (
          states[KEY.UP] ||
          states[KEY.RIGHT] ||
          states[KEY.DOWN] ||
          states[KEY.LEFT] ||
          states[KEY.T] ||
          states[KEY.SPACE] ||
          states[KEY.g] ||
          states[KEY.o] ||
          states[KEY.d]
        ) {
          callback({
            UP: states[KEY.UP] || 0,
            RIGHT: states[KEY.RIGHT] || 0,
            DOWN: states[KEY.DOWN] || 0,
            LEFT: states[KEY.LEFT] || 0,
            T: states[KEY.T] || 0,
            SPACE: states[KEY.SPACE] || 0,
            g: states[KEY.g] || 0,
            o: states[KEY.o] || 0,
            d: states[KEY.d] || 0,
          });
        }
      },
    });
    state.animator.start();
  };
  return {
    enable,
    disable,
  }
};

export default Movement;
