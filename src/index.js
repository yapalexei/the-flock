import addFlockLayer from './layer/addFlockLayer';
import selectCraft from './craft-select';
import './polyfills';

mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN;
const style = process.env.MAPBOX_STYLE;
const origCenter = [-122.67118367793355, 45.520579458294915];
// const origCenter = [-74.0210715263351, 40.727543577399416];

/**
 * `localhost` and `0.0.0.0` only mean "this machine" on the machine running the server. A phone or
 * laptop that opened the page at http://192.168.1.118:9000 must reach the game server on that same host,
 * so when SOCKET_URL points at the local machine, use the host the page was loaded from instead.
 */
function resolveSocketUrl(url) {
  const target = new URL(url);
  const thisMachine = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
  if (thisMachine.includes(target.hostname) && !thisMachine.includes(window.location.hostname)) {
    target.hostname = window.location.hostname;
  }
  return target.toString().replace(/\/$/, '');
}

const SOCKET_URL = resolveSocketUrl(process.env.SOCKET_URL);

var map = new mapboxgl.Map({
  container: "map",
  style: style || 'mapbox://styles/mapbox/dark-v9',
  center: origCenter,
  zoom: 16,
  pitch: 50,
  antialias: false,
  renderWorldCopies: false,
  fadeDuration: 0,
});
// map.showTileBoundaries = true;

map.on("load", function () {
  window.mapbox = map;
  map.addLayer(
    {
      'id': '3d-buildings',
      'source': 'composite',
      'source-layer': 'building',
      'filter': ['==', 'extrude', 'true'],
      'type': 'fill-extrusion',
      'minzoom': 13,
      'paint': {
        'fill-extrusion-color': '#aaa',

        // use an 'interpolate' expression to add a smooth transition effect to the
        // buildings as the user zooms in
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13, 0,
          13.05,
          ['get', 'height']
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          15.05,
          ['get', 'min_height']
        ],
        'fill-extrusion-opacity': 0.6
      }
    });

  let lastCraft = null;
  const chooseCraft = (title) => selectCraft({
    blur: map.getContainer(),
    initialId: lastCraft && lastCraft.id,
    title,
  }).then((craft) => {
    lastCraft = craft;
    return craft;
  });

  chooseCraft().then((craft) => {
    addFlockLayer(map, {
      defaultCenter: origCenter,
      SOCKET_URL,
      craft,
      chooseCraft: () => chooseCraft('You were destroyed. Choose another craft'),
    });
  });
});


