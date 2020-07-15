class Animator {
  constructor(props) {
    if (!props) throw new Error('Must have a properties object present in the constructor');
    if (!props.callback) throw new Error('Must have a callback present in the constructor object.');
    this.props = {
      fps: props.fps || 15,
      callback: props.callback,
      isAnimating: false,
    };
    this.loop = this.loop.bind(this);
    this.timeDeltaBetweenFrames = 0;
    this.requestedFrame = null;
    this.startTime = null;
  }
  setProps(props) {
    this.props = {
      ...this.props,
      ...props,
    };
  }
  start(callback) {
    if (!this.props.isAnimating) {
      this.setProps({
        isAnimating: true,
        callback: callback || this.props.callback,
      });
      window.cancelAnimationFrame(this.requestedFrame);
      this.requestedFrame = window.requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.setProps({
      isAnimating: false,
    });
    window.cancelAnimationFrame(this.loop);
    this.requestedFrame = null;
  }

  loop(timestamp) {
    if (this.startTime === undefined) this.startTime = timestamp;

    this.timeDeltaBetweenFrames = timestamp - this.startTime;

    if (this.props.isAnimating) {
      if (this.timeDeltaBetweenFrames > (1000 / this.props.fps)) {
        this.startTime = timestamp;
        this.props.callback(this);
      }
      this.requestedFrame = window.requestAnimationFrame(this.loop);
    }
  }
}

export default Animator;
