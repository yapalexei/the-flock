import addFlockLayer from './layer/addFlockLayer';
import './polyfills';

mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN;
const style = process.env.MAPBOX_STYLE;
const origCenter = [-122.67118367793355, 45.520579458294915];
// const origCenter = [-74.0210715263351, 40.727543577399416];

const SOCKET_HOST = process.env.SOCKET_HOST || '192.168.1.115';
const SOCKET_PORT = process.env.SOCKET_PORT || 3001;

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
  addFlockLayer(map, {
    defaultCenter: origCenter,
    SOCKET_HOST,
    SOCKET_PORT,
  });
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
});


