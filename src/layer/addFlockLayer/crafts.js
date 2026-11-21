import xWing1 from './assets/xWing1.png';
import xWing2 from './assets/xWing.png';
import yWing from './assets/yWing.png';
import aWing from './assets/aWing.png';
import jWing from './assets/jWing.png';

/**
 * Flyable craft.
 *
 * - `id` is the map icon name and the `icon` the server whitelists.
 * - `speed` and `agility` are 1-10 and drive handling (see `handling`).
 * - `shield` is hit points. The server owns the authoritative value
 *   (CRAFT_HIT_CAPACITY in the-flock-network), keep both in sync.
 * - `cannons` are muzzle positions in source-image pixels relative to the image
 *   centre (x: right, y: toward the nose). Shots rotate through them in order.
 */
export const MAX_SHIELD = 150;

export const crafts = [
  {
    id: 'xWing1',
    name: 'X-Wing 1',
    role: 'All-rounder',
    image: xWing1,
    iconSize: 0.4,
    speed: 7,
    agility: 6,
    shield: 100,
    weapons: 'Wingtip cannons, alternating left and right',
    cannons: [{ x: -119, y: 36 }, { x: 119, y: 36 }],
  },
  {
    id: 'xWing2',
    name: 'X-Wing 2',
    role: 'All-rounder',
    image: xWing2,
    iconSize: 0.4,
    speed: 8,
    agility: 6,
    shield: 100,
    weapons: 'Wingtip cannons, alternating left and right',
    cannons: [{ x: -119, y: 36 }, { x: 119, y: 36 }],
  },

  {
    id: 'yWing',
    name: 'Y-Wing',
    role: 'Heavy bomber',
    image: yWing,
    iconSize: 0.4,
    speed: 6,
    agility: 3,
    shield: 150,
    weapons: 'Twin nose cannons, alternating',
    cannons: [{ x: -9, y: 140 }, { x: 9, y: 140 }],
  },
  {
    id: 'aWing',
    name: 'A-Wing',
    role: 'Interceptor',
    image: aWing,
    iconSize: 0.5,
    speed: 10,
    agility: 8,
    shield: 60,
    weapons: 'Wingtip cannons, alternating left and right',
    cannons: [{ x: -29, y: 8 }, { x: 29, y: 8 }],
  },
  {
    id: 'jWing',
    name: 'J-Wing',
    role: 'Striker',
    image: jWing,
    iconSize: 0.5,
    speed: 8,
    agility: 5,
    shield: 80,
    weapons: 'Wing cannons, alternating left and right',
    cannons: [{ x: -31, y: -12 }, { x: 31, y: -12 }],
  },
];

// Top speed (degrees per frame) per speed point. 5 matches the original fixed handling.
const TOP_SPEED_PER_POINT = 0.00002;

/**
 * Friction is how fast the craft sheds velocity: high agility stops and turns
 * quickly. Thrust is scaled by friction so speed alone sets the top speed.
 */
export function handling({ speed, agility }) {
  const friction = 0.02 + agility * 0.008;
  return { friction, thrust: speed * TOP_SPEED_PER_POINT * friction };
}

// Source image heights, to size things drawn around a craft.
const IMAGE_HEIGHT = {
  xWing: 286, xWing1: 250, xWing2: 252, yWing: 320, aWing: 108, jWing: 175,
  tieFighter: 169, tie1: 148, tie2: 202, tie3: 146, tie4: 151,
};

/** Radius in screen px of the health arc that sits just above the nose of a craft drawn at `iconSize`. */
export function arcRadiusPx(icon, iconSize = 0.4) {
  return Math.round((IMAGE_HEIGHT[icon] || 250) * iconSize / 2 + 16);
}

// Side cannons are toed in so each shot's line crosses the craft's centreline this many
// ground pixels ahead. Parallel shots from wide cannons (X-Wing wingtips are ~40m off-axis)
// can never hit anything dead ahead because the server hit radius is only ~17m.
const CONVERGENCE_PX = 600;

/**
 * Muzzle and heading of the cannon firing shot number `shotIndex` (alternates through `craft.cannons`).
 * `bearing` is degrees clockwise from north, the same angle the icon is drawn at.
 * Returns lng/lat `x`/`y` and the shot's own `bearing`.
 */
export function muzzlePosition(craft, shotIndex, { pos, bearing, zoom }) {
  const cannon = craft.cannons[shotIndex % craft.cannons.length];
  // Icons are pitch-aligned to the map, so source pixels * icon-size are ground pixels.
  // One screen pixel is this many degrees of longitude at any latitude (512px tiles).
  const degPerPx = 360 / (512 * 2 ** zoom);
  const right = cannon.x * craft.iconSize * degPerPx;
  const forward = cannon.y * craft.iconSize * degPerPx;
  const b = bearing * Math.PI / 180;
  // Mercator stretches latitude by 1/cos(lat), so latitude degrees shrink by cos(lat).
  const cosLat = Math.cos(pos[1] * Math.PI / 180);
  // A cannon on the right turns left, and vice versa.
  const toeIn = Math.atan2(cannon.x * craft.iconSize, CONVERGENCE_PX) * 180 / Math.PI;
  return {
    x: pos[0] + right * Math.cos(b) + forward * Math.sin(b),
    y: pos[1] + cosLat * (forward * Math.cos(b) - right * Math.sin(b)),
    bearing: bearing - toeIn,
  };
}
