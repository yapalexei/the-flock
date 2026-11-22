// A frame that arrives a hair early (16.6ms against a 16.67ms target) still counts as on time.
const FRAME_SLACK_MS = 2;
// After a stall (hidden tab, long task) report a bounded step instead of the whole gap.
const MAX_ELAPSED_MS = 100;

/**
 * Calls `callback(animator, elapsedMs)` up to `fps` times a second, from requestAnimationFrame.
 * `elapsedMs` is the real time since the previous call, for callers that move things by time.
 *
 * The schedule keeps its leftover time: asking for 60 fps on a 60 Hz display runs every frame
 * instead of skipping every other one because a frame was 0.05ms short of the interval.
 */
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
    this.requestedFrame = null;
    this.startTime = null;
    this.lastTick = null;
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
      this.startTime = null;
      this.lastTick = null;
      window.cancelAnimationFrame(this.requestedFrame);
      this.requestedFrame = window.requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.setProps({
      isAnimating: false,
    });
    window.cancelAnimationFrame(this.requestedFrame);
    this.requestedFrame = null;
  }

  loop(timestamp) {
    if (!this.props.isAnimating) return;
    const interval = 1000 / this.props.fps;
    // The first frame runs straight away.
    if (this.startTime === null) this.startTime = timestamp - interval;

    const delta = timestamp - this.startTime;
    if (delta >= interval - FRAME_SLACK_MS) {
      // Carry the leftover into the next interval; after a long gap just restart the clock.
      this.startTime = delta > interval * 2 ? timestamp : this.startTime + interval;
      const elapsedMs = this.lastTick === null ? interval : Math.min(timestamp - this.lastTick, MAX_ELAPSED_MS);
      this.lastTick = timestamp;
      this.props.callback(this, elapsedMs);
    }
    this.requestedFrame = window.requestAnimationFrame(this.loop);
  }
}

export default Animator;
