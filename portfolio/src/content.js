// Everything the page says, in one place. Swap the name, the projects and the links for your own: the scenes,
// the cards and the drawer all read from here. The projects below are SAMPLES, invented to show the layout.
export const ME = {
  name: 'kiki',
  full: 'kiki (your name here)',
  role: 'brand designer',
  line: 'identity, packaging & a little motion. currently freelance, from somewhere with good light.',
  email: 'hello@yourname.studio',
  status: 'open for work · summer ’27',
  stickers: ['✦ type nerd', 'certified moodboarder', 'kerning is self care', '↗ ex-agency, now indie'],
  links: [['instagram', 'https://instagram.com/'], ['are.na', 'https://www.are.na/'], ['behance', 'https://www.behance.net/'], ['linkedin', 'https://www.linkedin.com/']],
};

// [name, colours (background, ink, accent, extra), what it is, what I did, year, tags, the case in a few paragraphs]
export const WORK = [
  {
    name: 'fizz & fern', kind: 'botanical soda', year: '2026', role: 'identity · packaging · launch',
    bg: '#f6e7c8', ink: '#1f3d2b', accent: '#ff7a4f', extra: '#9bd37a', mark: 'leaf',
    tags: ['identity', 'packaging', 'illustration'],
    case: ['A soda made from garden herbs needed to feel grown-up without losing the fizz. The idea: every can is a pressed-flower page from a botanist’s notebook.', 'A custom wordmark with an ampersand that curls like a fern frond; five flavour illustrations painted in gouache and scanned; a can system where the flower changes and the grid never does.', 'Launched in 40 shops; the herb-of-the-month can sold out in a week.'],
  },
  {
    name: 'mothlight', kind: 'candle studio', year: '2025', role: 'identity · web · photography direction',
    bg: '#1d1630', ink: '#f2e9ff', accent: '#ffcf5a', extra: '#8a6cff', mark: 'moon',
    tags: ['identity', 'web', 'art direction'],
    case: ['Two siblings pouring candles in a garage. They wanted the brand to feel like the hour after midnight when the house is finally quiet.', 'A soft-serif logotype with a moth hidden in the "o", a palette of dusk purples, and a photo rule: only ever shot by the light of the product.', 'The site doubled its conversion in the first month after relaunch.'],
  },
  {
    name: 'gloopy', kind: 'kids’ paint kits', year: '2025', role: 'naming · identity · toy-box packaging',
    bg: '#ffd8ea', ink: '#2a1a5e', accent: '#2fd0c1', extra: '#ff5a3c', mark: 'blob',
    tags: ['naming', 'identity', 'packaging'],
    case: ['Paint for kids under seven, sold to the adults who have to clean up after it.', 'A name that sounds like what it does. Letters that drip and pool, built as a variable font with a "goo" axis; boxes that unfold into a painting smock.', 'Shortlisted for a packaging award; parents mostly mention the smock.'],
  },
  {
    name: 'nightbus', kind: 'late-night transit app', year: '2024', role: 'brand system · icon · motion',
    bg: '#0f2a4a', ink: '#e9f6ff', accent: '#ff4fa3', extra: '#3de3ff', mark: 'stripes',
    tags: ['brand system', 'motion', 'product'],
    case: ['A city’s night routes, finally in one app. It had to read at 2am, half asleep, in the rain.', 'High-contrast type, route colours borrowed from old bus blinds, and a loading animation of headlights sweeping past a stop.', 'Rolled out on 120 shelters and every bus in the night fleet.'],
  },
];

export const MANIFESTO = ['taste is', 'a verb.'];

export const ABOUT = {
  title: 'notes from the studio',
  date: 'a brand designer, mostly online',
  paragraphs: [
    'I design brands that people can feel before they can explain: identities, packaging and the small moving bits in between.',
    'Five years in agencies, two on my own. I like small teams, big ideas, early sketches and a proper moodboard before anything else.',
    'Services: naming, identity systems, packaging, art direction, motion. Tools: pencils, Figma, Glyphs, After Effects, a printer that jams.',
  ],
};

export const PROCESS = `
  <p class="kicker">how i work</p>
  <h2>taste is a verb</h2>
  <p>Good brands are not picked from a shelf. They are made by doing, looking, and doing again. This is roughly how a project goes:</p>
  <ol class="steps">
    <li><b>listen</b> One long call, no slides. What do you love, what do you hate, who is it for.</li>
    <li><b>moodboard</b> A wall of references, not a deck of logos. We agree on a feeling first.</li>
    <li><b>three routes</b> Three honest directions, each one sketched far enough to judge.</li>
    <li><b>build</b> One route, made into a system: logo, type, colour, layouts, motion, rules.</li>
    <li><b>hand over</b> Files, a guide you will actually open, and a call a month later.</li>
  </ol>
  <p class="hint">Move across the water: it ripples, and the words under it move with it.</p>`;

export const CONTACT = `
  <p class="kicker">say hi</p>
  <h2>let’s make something</h2>
  <p>Booking projects from summer ’27. Tell me what you’re making, roughly when, and roughly how much you want to spend: a range is fine.</p>
  <p class="big-mail">${ME.email}</p>
  <p>Or find me at ${ME.links.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join(', ')}.</p>`;
