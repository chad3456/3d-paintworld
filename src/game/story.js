// The order of the tale and where the player is in it. Each realm is a page of its own (a whole world is made for
// it), so going on means loading the page again with the next realm in its address; what has been chosen and done
// is kept in the browser between them.
export const CHAPTERS = [
  {
    id: 'ayodhya', name: 'Ayodhya', subtitle: 'The city on the Sarayu', art: 'ramapanchayan',
    credit: 'Raja Ravi Varma, Rama Panchayatana, lithograph, before 1906',
    text: 'On the morning the prince was to be crowned, he is sent into the forest for fourteen years instead. He does not argue. Before the gate closes behind you, light the lamps of the palace court, so the city keeps a light for your return.',
  },
  {
    id: 'forest', name: 'Panchavati', subtitle: 'The forest of Dandaka', art: 'golden-deer',
    credit: 'Ravi Varma Press, Sita longs for the golden deer, c. 1910',
    text: 'Thirteen years pass under the trees. Then one morning a deer of beaten gold steps out of the mist and looks back, as if it wanted to be followed. Nothing in this forest is only what it seems.',
  },
  {
    id: 'himalaya', name: 'Dronagiri', subtitle: 'The mountain of herbs', art: 'hanuman-mountain',
    credit: 'Ravi Varma Press, Hanuman fetches the herb-bearing mountain, 1910s',
    text: 'War has come to Lanka, and its bravest lie still as stone, struck by a serpent arrow. Only Sanjeevani can wake them, the herb that glows by night on a ridge of the Himalaya. It must be found before the sun rises.',
  },
  {
    id: 'lanka', name: 'Lanka', subtitle: 'The city of gold', art: 'ravana-sita-jatayu',
    credit: 'Raja Ravi Varma, Jatayu Vadham, oil on canvas, 1895',
    text: 'Across the sea stands Lanka, walled in gold and burning. Its gate is kept by rakshasas, and in the court beyond it waits Ravana of the ten heads, who has never been beaten.',
  },
];
export const ENDING = {
  art: 'rama-breaking-bow', credit: 'Raja Ravi Varma, Rama breaking the bow of Shiva',
  text: 'Ravana has fallen, and the fourteen years are over. In Ayodhya every doorstep carries a lamp tonight, as it has on this night ever since.',
};

const KEY = 'ramayana-paintworld';
const q = new URLSearchParams(location.search);

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}
function write(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* a private window: nothing is kept */ }
}

export const story = {
  save: read(),
  /** What the address asks for, else what was last being played. */
  get realm() { return q.get('realm'); },
  get hero() { return q.get('hero') ?? this.save.hero ?? null; },
  chapter(id) { return CHAPTERS.find((c) => c.id === id); },
  next(id) { const i = CHAPTERS.findIndex((c) => c.id === id); return CHAPTERS[i + 1]?.id ?? null; },
  choose(hero) { this.save.hero = hero; write(this.save); },
  finish(id) {
    this.save.done = [...new Set([...(this.save.done ?? []), id])];
    this.save.at = this.next(id) ?? 'ayodhya';
    write(this.save);
  },
  /** Loads the page for a realm (or, with none, the choosing of a hero). */
  go(realm, hero = this.hero) {
    const next = new URLSearchParams();
    for (const key of ['quality', 'nopad']) if (q.has(key)) next.set(key, q.get(key));
    if (realm) { next.set('realm', realm); if (hero) next.set('hero', hero); this.save.at = realm; write(this.save); }
    location.search = next.toString();
  },
};
