// Who is in the game: the four heroes to choose from, and those they meet. Each is a body (src/game/rigs.js), the
// paint it is given, what it wears and carries, and what it can do.
//
// The look of each follows the way they have been painted for centuries, taken here from Raja Ravi Varma's prints
// (public domain; see CREDITS.md): Rama dark blue as a rain cloud in a yellow dhoti under a tall gold crown, with
// his bow; Sita in red silk bordered with gold; Lakshmana fair, in a blue tunic, also with a bow; Hanuman with his
// red face, his crown, his mace and his tail; Ravana dark and moustached under ten crowned heads.
//
// A palette is [light, half-tone, shade], as paint: chosen as it should look on the canvas in daylight.

const GOLD = [[1.0, 0.84, 0.36], [0.84, 0.56, 0.15], [0.46, 0.27, 0.12]];
const JEWEL = [[1.0, 0.22, 0.16], [0.86, 0.12, 0.12], [0.55, 0.06, 0.1]];
const EMERALD = [[0.25, 0.85, 0.5], [0.12, 0.6, 0.36], [0.05, 0.3, 0.22]];
const WHITE = [[1.0, 0.97, 0.88], [0.76, 0.72, 0.7], [0.42, 0.4, 0.5]];
const BLACK_HAIR = [[0.22, 0.18, 0.22], [0.1, 0.085, 0.12], [0.045, 0.04, 0.065]];
const EYES = [[0.16, 0.12, 0.12], [0.1, 0.08, 0.09], [0.05, 0.04, 0.06]];
const FAIR = [[1.0, 0.8, 0.58], [0.82, 0.55, 0.38], [0.45, 0.27, 0.26]];
const WOOD = [[0.62, 0.42, 0.22], [0.37, 0.23, 0.14], [0.17, 0.1, 0.1]];
const STEEL = [[0.9, 0.94, 0.98], [0.52, 0.58, 0.68], [0.22, 0.26, 0.36]];
const IVORY = [[0.97, 0.92, 0.76], [0.72, 0.64, 0.5], [0.36, 0.3, 0.3]];
const FLOWER = [[1.0, 0.96, 0.9], [1.0, 0.72, 0.5], [0.7, 0.42, 0.4]];
const RED_SILK = [[0.94, 0.2, 0.13], [0.64, 0.09, 0.1], [0.3, 0.04, 0.1]];
const YELLOW_SILK = [[1.0, 0.86, 0.28], [0.88, 0.6, 0.1], [0.52, 0.3, 0.1]];

export const HEROES = {
  rama: {
    name: 'Rama', title: 'Prince of Ayodhya', body: 'man', scale: 1,
    lore: 'The seventh avatar of Vishnu, dark as a rain cloud and steady as the earth. He carries the bow Kodanda and never looses an arrow in anger.',
    palettes: {
      skin: [[0.4, 0.6, 0.9], [0.2, 0.35, 0.7], [0.1, 0.16, 0.42]], upper: 'skin', lower: YELLOW_SILK, feet: 'skin',
      hair: BLACK_HAIR, eyes: EYES, gold: GOLD, jewel: JEWEL, cloth: WHITE, flower: FLOWER, wood: WOOD,
    },
    gear: ['crown', 'tilak', 'necklace', 'garland', 'armlets', 'bracelets', 'anklets', 'belt', 'pleat', 'sash', 'quiver', 'bow'],
    crown: 'kirita',
    cloth: { pal: 'cloth', rows: 9, wrap: 1.15, cols: 13 },
    stats: { health: 110, pace: 1, jump: 0.85 },
    primary: { kind: 'arrow', name: 'Kodanda', damage: 34, cooldown: 0.55, speed: 46 },
    special: { kind: 'astra', name: 'Brahmastra', damage: 120, cooldown: 9, speed: 38 },
    hint: 'Arrows fly true and far',
  },
  sita: {
    name: 'Sita', title: 'Daughter of the Earth', body: 'woman', scale: 1,
    lore: 'Found in a furrow of the ploughed field, she is the earth\'s own child. Flowers open where she walks, and what is false cannot bear her light.',
    palettes: {
      skin: FAIR, blouse: RED_SILK, skirt: RED_SILK, hem: GOLD, feet: 'skin',
      hair: BLACK_HAIR, eyes: EYES, gold: GOLD, jewel: EMERALD, cloth: [[0.98, 0.3, 0.16], [0.72, 0.13, 0.1], [0.36, 0.05, 0.1]], flower: FLOWER,
    },
    gear: ['crown', 'tilak', 'necklace', 'garland', 'bracelets', 'belt', 'hairflowers'],
    crown: 'tiara',
    cloth: { pal: 'cloth', rows: 12, wrap: 1.5, cols: 15 },
    stats: { health: 90, pace: 0.96, jump: 0.8 },
    primary: { kind: 'lotus', name: 'Lotus of light', damage: 26, cooldown: 0.7, speed: 20 },
    special: { kind: 'bloom', name: 'Blessing of Bhumi', damage: 60, cooldown: 10, radius: 9, heal: 40 },
    hint: 'Her blessing heals and holds foes fast',
  },
  lakshmana: {
    name: 'Lakshmana', title: 'The Unsleeping Guard', body: 'man', scale: 0.98,
    lore: 'Rama\'s younger brother, who followed him into exile without being asked and kept watch through fourteen years of nights.',
    palettes: {
      skin: FAIR, upper: [[0.24, 0.36, 0.78], [0.12, 0.19, 0.52], [0.05, 0.08, 0.28]], lower: WHITE, feet: 'skin',
      hair: BLACK_HAIR, eyes: EYES, gold: GOLD, jewel: JEWEL, cloth: [[1.0, 0.6, 0.16], [0.82, 0.36, 0.08], [0.45, 0.17, 0.1]], steel: STEEL, wood: WOOD, flower: FLOWER,
    },
    gear: ['crown', 'tilak', 'necklace', 'armlets', 'bracelets', 'belt', 'pleat', 'sword'],
    crown: 'kirita',
    cloth: { pal: 'cloth', rows: 8, wrap: 1.1, cols: 13 },
    stats: { health: 120, pace: 1.05, jump: 0.85 },
    primary: { kind: 'blade', name: 'Sword', damage: 40, cooldown: 0.42, reach: 2.3 },
    special: { kind: 'whirl', name: 'Wheel of steel', damage: 60, cooldown: 7, radius: 4 },
    hint: 'Swift with the sword at close quarters',
  },
  hanuman: {
    name: 'Hanuman', title: 'Son of the Wind', body: 'man', scale: 1, broad: 1.12,
    lore: 'The vanara whose strength has no measure and whose heart holds only Rama. He crossed the sea in one leap and carried a mountain home.',
    palettes: {
      skin: [[0.98, 0.66, 0.32], [0.74, 0.42, 0.2], [0.38, 0.2, 0.15]], upper: 'skin', lower: RED_SILK, feet: 'skin',
      hair: [[0.9, 0.56, 0.26], [0.62, 0.34, 0.17], [0.3, 0.16, 0.13]], eyes: EYES, gold: GOLD, jewel: JEWEL,
      face: [[1.0, 0.45, 0.36], [0.76, 0.26, 0.23], [0.4, 0.12, 0.15]], cloth: [[0.98, 0.26, 0.15], [0.7, 0.12, 0.1], [0.35, 0.05, 0.1]], flower: FLOWER,
    },
    gear: ['crown', 'tilak', 'muzzle', 'necklace', 'garland', 'armlets', 'bracelets', 'anklets', 'belt', 'pleat', 'gada', 'tail'],
    crown: 'low',
    cloth: { pal: 'cloth', rows: 7, wrap: 1.2, cols: 13 },
    stats: { health: 140, pace: 1.12, jump: 3.4 },
    primary: { kind: 'mace', name: 'Gada', damage: 48, cooldown: 0.6, reach: 2.6 },
    special: { kind: 'slam', name: 'Mountain-shaker', damage: 85, cooldown: 8, radius: 7.5 },
    hint: 'Leaps over walls; his landing shakes the ground',
  },
};
export const HERO_ORDER = ['rama', 'sita', 'lakshmana', 'hanuman'];

const RAKSHASA_SKINS = [
  [[0.38, 0.54, 0.56], [0.2, 0.32, 0.38], [0.09, 0.15, 0.22]], // teal grey
  [[0.56, 0.4, 0.62], [0.34, 0.22, 0.42], [0.15, 0.09, 0.22]], // violet
  [[0.52, 0.56, 0.3], [0.32, 0.36, 0.18], [0.14, 0.17, 0.11]], // olive
  [[0.66, 0.34, 0.26], [0.42, 0.18, 0.16], [0.2, 0.08, 0.1]], // brick red
];

export const FOES = {
  rakshasa: (variant = 0) => ({
    name: 'Rakshasa', body: 'man', scale: 1.08 + 0.05 * (variant % 3), broad: 1.1,
    palettes: {
      skin: RAKSHASA_SKINS[variant % RAKSHASA_SKINS.length], upper: 'skin', lower: [[0.5, 0.16, 0.14], [0.3, 0.08, 0.1], [0.14, 0.04, 0.08]], feet: 'skin',
      hair: BLACK_HAIR, eyes: [[1.0, 0.5, 0.1], [1.0, 0.4, 0.08], [0.9, 0.3, 0.06]], ivory: IVORY, wood: WOOD, gold: GOLD,
    },
    gear: ['horns', 'tusks', 'belt', 'pleat', 'club'],
    stats: { health: 80, pace: 0.8 },
    attack: { damage: 12, reach: 1.9, cooldown: 2.0 },
  }),
  ravana: {
    name: 'Ravana', title: 'Ten-headed King of Lanka', body: 'man', scale: 1.34, broad: 1.08,
    palettes: {
      skin: [[0.56, 0.38, 0.32], [0.34, 0.21, 0.21], [0.15, 0.09, 0.13]], upper: 'skin', lower: [[0.84, 0.3, 0.52], [0.54, 0.14, 0.33], [0.26, 0.06, 0.19]], feet: 'skin',
      hair: BLACK_HAIR, eyes: [[1.0, 0.55, 0.12], [1.0, 0.42, 0.08], [0.9, 0.3, 0.06]], gold: GOLD, jewel: JEWEL, steel: STEEL,
      cloth: [[0.2, 0.56, 0.32], [0.1, 0.34, 0.2], [0.04, 0.15, 0.12]],
    },
    gear: ['crown', 'heads', 'moustache', 'necklace', 'armlets', 'bracelets', 'anklets', 'belt', 'pleat', 'sash', 'sword'],
    crown: 'kirita',
    cloth: { pal: 'cloth', rows: 12, wrap: 1.5, cols: 15 },
    stats: { health: 900, pace: 0.9 },
    attack: { damage: 22, reach: 3.2, cooldown: 2.4 },
  },
};

/** The same paint by moonlight: cooler and deeper, with its daylight colour kept for whatever lamp falls on it. */
export function byNight([L, M, S, own]) {
  const mul = (c, k) => c.map((v, i) => +(v * k[i]).toFixed(3));
  return [mul(L, [0.6, 0.68, 0.86]), mul(M, [0.4, 0.5, 0.7]), mul(S, [0.3, 0.38, 0.5]), own ?? L];
}
/** By firelight: warm lights, deep red shades. */
export function byFire([L, M, S, own]) {
  const mul = (c, k) => c.map((v, i) => +(v * k[i]).toFixed(3));
  return [mul(L, [0.86, 0.66, 0.56]), mul(M, [0.55, 0.36, 0.38]), mul(S, [0.32, 0.18, 0.26]), own ?? L];
}
