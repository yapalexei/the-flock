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

const allCraft = {
  tieFighter,
  xWing,
  xWing1,
  xWing2,
  tie1,
  tie2,
  tie3,
  tie4,
  // yWing,
  jWing,
  aWing,
};

export const playerCraft = {
  xWing,
  xWing1,
  xWing2,
  // yWing,
  jWing,
  aWing,
};

const loadAssets = (map) => {
  Object.entries(allCraft).map(([key, path]) => {
    const img = new Image();
    img.onload = () => map.addImage(key, img);
    img.src = path;
  });
};

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
}

export function initLayerStyles(map, { id }) {
  const layers = [];
  map.addLayer({
    id: `${id}-projectile`,
    type: 'line',
    source: 'flock',
    filter: ['all', ['has', 'isProjectile']],
    layout: {},
    paint: {
      'line-width': 4,
      'line-opacity': [
        'case', ['has', 'expired'],
        0,
        1,
      ],
      'line-color': [
        'case', ['has', 'robotProjectile'],
        'rgb(0,255,0)',
        'red'
      ]
      // 'line-gradient': [
      //   'case', ['has', 'robotProjectile'],
      //   'green',
      //   [
      //     'interpolate',
      //     ['linear'],
      //     ['line-progress'],
      //     0, 'rgba(255, 0, 0, 0)',
      //     0.5, 'rgba(255, 0, 0, 1)',
      //     1, 'rgba(255, 0, 0, 0)',
      //   ]
      // ],
    },
  });

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

      'text-field': ['case', ['get', 'isPlayer'],
        [
          'format',
          [
            'concat',
            'Health: ', ['ceil', ['-', 100, ['*', 100, ['/', ['to-number', ['get', 'hitCount']], ['to-number', ['get', 'hitCapacity']]]]]],
            '\n',
            'Kills: ', ['get', 'kills'],
          ],
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
    filter: ['==', '$type', 'Point'],
    layout: {

    },
    paint: {
      'circle-color': 'transparent',
      'circle-stroke-color': ["interpolate-hcl",
        ["linear"],
        ['-', 100, ['*', 100, ['/', ['to-number', ['get', 'hitCount']], ['to-number', ['get', 'hitCapacity']]]]],
        0, 'rgba(255,0,0,0.9)',
        90, 'rgba(250,200,155,0.3)',
        100, 'rgba(100,100,255,0.2)',
      ],
      'circle-stroke-width': 2,
      'circle-radius': ['-', 100, ['*', 100, ['/', ['to-number', ['get', 'hitCount']], ['to-number', ['get', 'hitCapacity']]]]],
    }
  });

  layers.push(`${id}-main`);
  layers.push(`${id}-projectile`);
  layers.push(`${id}-health`);
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