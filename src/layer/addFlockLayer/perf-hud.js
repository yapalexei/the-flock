const REFRESH_MS = 500;

/**
 * Top-left performance box: browser FPS, how many world updates per second arrive, and how many
 * craft / projectiles are inside the viewport (not merely within the server's broadcast range).
 * The server only sends what changed, so a calm scene shows few or zero updates per second.
 *
 * `getObjects()` returns the objects the client currently knows ({ id: { pos, prevPos, isProjectile, ... } });
 * `getMessageCount()` returns a running count of server updates received.
 * Mapbox GL JS v1 has no built-in FPS readout, so FPS is measured from requestAnimationFrame:
 * if the map (or anything else) is slow to draw, frames are late and the number drops.
 */
export default function createPerfHud(map, { getObjects, getMessageCount }) {
  const element = document.createElement('div');
  element.className = 'perf-hud';
  document.body.appendChild(element);

  let frames = 0;
  let rafId = null;
  let lastRefresh = performance.now();
  let lastMessages = getMessageCount();

  const countFrame = () => {
    frames += 1;
    rafId = requestAnimationFrame(countFrame);
  };
  rafId = requestAnimationFrame(countFrame);

  function countOnScreen() {
    const canvas = map.getCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const visible = (point) => {
      const { x, y } = map.project([point.x, point.y]);
      return x >= 0 && x <= width && y >= 0 && y <= height;
    };
    let craft = 0;
    let projectiles = 0;
    Object.values(getObjects()).forEach((obj) => {
      if (obj.expired || obj.isDrop || obj.isBlast) return;
      if (obj.isProjectile) {
        // Drawn as a line from prevPos to pos: on screen if either end is.
        if (visible(obj.pos) || (obj.prevPos && visible(obj.prevPos))) projectiles += 1;
      } else if (visible(obj.pos)) {
        craft += 1;
      }
    });
    return { craft, projectiles };
  }

  function refresh() {
    const now = performance.now();
    const seconds = (now - lastRefresh) / 1000;
    const fps = frames / seconds;
    const messages = getMessageCount();
    const serverRate = (messages - lastMessages) / seconds;
    frames = 0;
    lastRefresh = now;
    lastMessages = messages;

    const { craft, projectiles } = countOnScreen();
    element.innerHTML = `
      <div><b>FPS</b> ${Math.round(fps)}</div>
      <div><b>Updates</b> ${Math.round(serverRate)}/s</div>
      <div><b>Craft</b> ${craft}</div>
      <div><b>Projectiles</b> ${projectiles}</div>
      <div><b>Total</b> ${craft + projectiles}</div>`;
  }
  const timer = setInterval(refresh, REFRESH_MS);
  refresh();

  return {
    remove() {
      cancelAnimationFrame(rafId);
      clearInterval(timer);
      element.remove();
    },
  };
}
