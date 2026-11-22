const SIZE = 160;
const REDRAW_MS = 50;
const METERS_PER_DEGREE = 111195;

/**
 * Top-right radar: you are the blue dot in the middle, every enemy the server has told you about is a
 * red dot, north is up. The rings are half and full `rangeM`; an enemy beyond the range (the server only
 * sends enemies within about a kilometre of you) is pinned to the rim, dimmer, so you still know which way it is.
 *
 * `getPlayerPos()` returns [lng, lat]; `getObjects()` returns the objects the client knows
 * ({ id: { pos: {x, y}, isRobot, expired } }). Redraws at most every REDRAW_MS.
 */
export default function createRadar({ getPlayerPos, getObjects, rangeM = 1200 }) {
  const element = document.createElement('div');
  element.className = 'radar';
  const canvas = document.createElement('canvas');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = SIZE * ratio;
  canvas.height = SIZE * ratio;
  canvas.style.width = `${SIZE}px`;
  canvas.style.height = `${SIZE}px`;
  element.appendChild(canvas);
  document.body.appendChild(element);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  const centre = SIZE / 2;
  const radius = centre - 6;
  const label = rangeM >= 1000 ? `${(rangeM / 1000).toFixed(1)} km` : `${rangeM} m`;
  let lastDraw = 0;

  const dot = (x, y, r, color) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  function update() {
    const now = performance.now();
    if (now - lastDraw < REDRAW_MS) return;
    lastDraw = now;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    [radius, radius / 2].forEach((r) => {
      ctx.beginPath();
      ctx.arc(centre, centre, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(centre - radius, centre);
    ctx.lineTo(centre + radius, centre);
    ctx.moveTo(centre, centre - radius);
    ctx.lineTo(centre, centre + radius);
    ctx.stroke();

    const [lng, lat] = getPlayerPos();
    const metersPerDegreeLng = METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180);
    Object.values(getObjects()).forEach((obj) => {
      if (!obj.isRobot || obj.expired) return;
      const east = (obj.pos.x - lng) * metersPerDegreeLng;
      const north = (obj.pos.y - lat) * METERS_PER_DEGREE;
      const distance = Math.hypot(east, north);
      const inRange = distance <= rangeM;
      // Beyond the range: same bearing, on the rim.
      const scale = (inRange ? distance : rangeM) / (distance || 1) * (radius / rangeM);
      dot(centre + east * scale, centre - north * scale, 2.5, inRange ? '#ff4d4d' : 'rgba(255,77,77,0.45)');
    });

    dot(centre, centre, 3.5, '#4fc3f7');
    ctx.fillStyle = 'rgba(238,238,238,0.55)';
    ctx.font = '9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, centre, SIZE - 10);
  }
  update();

  return { update, remove: () => element.remove() };
}
