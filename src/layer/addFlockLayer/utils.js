import tie1 from './assets/tie1.png';
import tie2 from './assets/tie2.png';
import tie3 from './assets/tie3.png';
import tie4 from './assets/tie4.png';
import tieFighter from './assets/tieFighter.png';
import xWing from './assets/xWing.png';
import xWing1 from './assets/xWing1.png';
import xWing2 from './assets/xWing2.png';
import jWing from './assets/jWing.png';
import aWing from './assets/aWing.png';
import yWing from './assets/yWing.png';
import explosion3 from './assets/explosion3.png';
import rechargeBox from './assets/rechargeBox.png';

const allImages = {
  tieFighter,
  xWing,
  xWing1,
  xWing2,
  tie1,
  tie2,
  tie3,
  tie4,
  yWing,
  jWing,
  aWing,
  rechargeBox,
};

const loadAssets = (map) => {
  Object.entries(allImages).map(([key, path]) => {
    const img = new Image();
    img.onload = () => map.addImage(key, img);
    img.src = path;
  });
};

// Player health bar: an arc centred over the top of the craft, drawn into one image per step
// (red = capacity, green = health left) and picked per feature by the layer.
// The base radius is in css px at icon-size 1; features scale it with `arcRadius`.
const HEALTH_ARC_STEPS = 40;
const HEALTH_ARC_RADIUS = 180;
// How much of a circle the bar covers, in degrees: 180 is a semicircle, 90 a quarter, 360 a full ring.
const HEALTH_ARC_SPAN_DEG = 90;

function initHealthArcs(map) {
  const pixelRatio = 1;
  const centre = HEALTH_ARC_RADIUS + 8;
  const size = centre * 2 * pixelRatio;
  for (let step = 0; step <= HEALTH_ARC_STEPS; step++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    ctx.lineCap = 'round';
    // Canvas angles run clockwise from east, so the top is 270 degrees. The bar is centred there
    // and green fills from its left end.
    const startAngle = (270 - HEALTH_ARC_SPAN_DEG / 2) * Math.PI / 180;
    const arc = (fraction, color, width) => {
      ctx.beginPath();
      ctx.arc(centre, centre, HEALTH_ARC_RADIUS, startAngle, startAngle + fraction * HEALTH_ARC_SPAN_DEG * Math.PI / 180);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    arc(1, 'rgba(0,0,0,0.55)', 9);
    arc(1, '#d62d2d', 5);
    if (step > 0) arc(step / HEALTH_ARC_STEPS, '#3ddc6a', 5);
    map.addImage(`hp-${step}`, ctx.getImageData(0, 0, size, size), { pixelRatio });
  }
}

export function initAssets(map) {
  const size = 600;

  const explosionImg = new Image(size, size);
  explosionImg.src = explosion3;
  var explosion = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    // get rendering context for the map canvas when layer is added to the map
    onAdd: function () {
      var canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      this.context = canvas.getContext('2d');
    },

    // called once before every frame where the icon will be used
    render: function () {
      var duration = 200;
      var t = ((performance.now() % duration) / duration);
      var ctx = this.context;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = 'destination-over';

      const widthOffset = (this.width/2)*t;
      const heightOffset = (this.height/2)*t;

      ctx.drawImage(explosionImg, (this.width/2) - widthOffset, (this.height/2) - heightOffset, this.width*t, this.height*t);

      this.data = ctx.getImageData(0, 0, this.width, this.height).data;

      map.triggerRepaint();
      return true;
    }
  };

  map.addImage('explosion-point', explosion, { pixelRatio: 2 });

  loadAssets(map);
  initHealthArcs(map);
}

export function initLayerStyles(map, { id }) {
  const layers = [];
  // Shots are lines from their position back to where they just were, drawn as streaks that fade at both
  // tips. line-gradient cannot depend on feature properties, so each kind of shot gets its own layer.
  const addStreakLayer = (name, filter, width, [r, g, b]) => {
    const color = (alpha) => `rgba(${r},${g},${b},${alpha})`;
    map.addLayer({
      id: `${id}-${name}`,
      type: 'line',
      source: 'flock',
      filter,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-width': width,
        'line-opacity': ['case', ['has', 'expired'], 0, 1],
        'line-gradient': [
          'interpolate',
          ['linear'],
          ['line-progress'],
          0, color(0.2),
          0.3, color(1),
          0.7, color(1),
          1, color(0.2),
        ],
      },
    });
    layers.push(`${id}-${name}`);
  };
  addStreakLayer('projectile', ['all', ['has', 'isProjectile'], ['!', ['has', 'isTorpedo']], ['!', ['has', 'robotProjectile']]], 4, [255, 0, 0]);
  addStreakLayer('projectile-torpedo', ['all', ['has', 'isProjectile'], ['has', 'isTorpedo']], 9, [40, 140, 255]);
  addStreakLayer('projectile-enemy', ['all', ['has', 'isProjectile'], ['has', 'robotProjectile']], 4, [0, 255, 0]);

  map.addLayer({
    id: `${id}-main`,
    type: 'symbol',
    source: 'flock',
    filter: ['==', '$type', 'Point'],
    layout: {
      'icon-image': [
        'case', ['has', 'expired'],
        'explosion-point',
        ['get', 'icon'],
      ],
      'icon-size': ['coalesce', ['get', 'icon-size'], 4],
      'icon-allow-overlap': true,
      'icon-rotate': ['get', 'bearing'],
      'icon-pitch-alignment': 'map',

      'text-field': ['case', ['any', ['has', 'isDrop'], ['has', 'isBlast']], '', ['get', 'isPlayer'],
        [
          'format',
          ['concat', 'Kills: ', ['get', 'kills']],
          { 'font-size': 14 },
        ], 'true',
      ],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-variable-anchor': ['left', 'bottom', 'top', 'right'],
      'text-radial-offset': 3,
      'text-justify': 'auto',
    },
    paint: {
      'text-color': 'white'
    }
  });

  map.addLayer({
    id: `${id}-health`,
    type: 'circle',
    source: 'flock',
    // Expression syntax throughout: mixing the legacy ['==', '$type', ...] form with expressions
    // makes Mapbox read the whole filter as legacy, and then it matches nothing.
    // Enemies show the health arc instead of the ring.
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'isBlast']], ['!', ['has', 'isRobot']]],
    layout: {},
    paint: {
      'circle-color': 'transparent',
      'circle-stroke-color': ['case', ['has', 'isDrop'],
        'rgba(60,255,130,0.2)',
        ['interpolate-hcl',
          ['linear'],
          ['-', 100, ['*', 100, ['/', ['to-number', ['get', 'hitCount']], ['to-number', ['get', 'hitCapacity']]]]],
          0, 'rgba(255,0,0,0.9)',
          90, 'rgba(250,200,155,0.3)',
          100, 'rgba(100,100,255,0.2)',
        ],
      ],
      'circle-stroke-width': 2,
      // Recharge boxes get a small fixed green ring; craft get a shield ring that shrinks as health drops.
      'circle-radius': ['case', ['has', 'isDrop'],
        22,
        ['-', 100, ['*', 100, ['/', ['to-number', ['get', 'hitCount']], ['to-number', ['get', 'hitCapacity']]]]],
      ],
    }
  });

  map.addLayer({
    id: `${id}-health-arc`,
    type: 'symbol',
    source: 'flock',
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['any', ['has', 'isPlayer'], ['has', 'isRobot']], ['!', ['has', 'expired']]],
    layout: {
      // ceil, so a craft with any health left always shows at least one green step.
      'icon-image': ['concat', 'hp-', ['to-string',
        ['max', 0, ['min', HEALTH_ARC_STEPS, ['ceil', ['*', HEALTH_ARC_STEPS,
          ['-', 1, ['/', ['to-number', ['get', 'hitCount']], ['to-number', ['get', 'hitCapacity']]]]]]]],
      ]],
      'icon-size': ['/', ['get', 'arcRadius'], HEALTH_ARC_RADIUS],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      // Stays upright over the craft however the map is tilted or the craft is turned.
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
    },
  });

  layers.push(`${id}-main`);
  layers.push(`${id}-health`);
  layers.push(`${id}-health-arc`);
  return {
    remove: () => layers.forEach((layerId) => {
      map.removeLayer(layerId)
    }),
  };
}

export function initStatLayers(map, { id }) {
  const layerId = `${id}-stat-line`;
  map.addLayer({
    id: layerId,
    type: 'line',
    source: 'flock',
    filter: ['all', ['!', ['has', 'isProjectile']]],
    paint: {
      'line-color': 'rgba(255,255,255,0.1)',
      'line-width': 2,
      // 'line-gradient': [
      //   'interpolate',
      //   ['linear'],
      //   ['line-progress'],
      //   0, 'rgba(255, 255, 0, 0)',
      //   1, 'rgba(255, 255, 0, 0.5)',
      // ],
    }
  });
  return {
    self: map.getLayer(layerId),
    remove: () => map.removeLayer(layerId),
  };
}

export function initSource(map, { id, initFeatures = [] }) {
  map.addSource(id, {
    type: 'geojson',
    lineMetrics: true,
    data: {
      type: "FeatureCollection",
      features: initFeatures,
    }
  });
  return {
    self: map.getSource(id),
    remove: () => map.removeSource(id),
  };
}

function toDeg(rad) {
  return rad * 180 / Math.PI;
}

export function bearing(lat1, lng1, lat2, lng2) {
  const dLon = (lng2 - lng1);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return 360 - ((brng + 360) % 360);
};