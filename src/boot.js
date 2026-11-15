// Starts what the address asks for: a realm of the tale with the chosen hero (?realm=forest&hero=sita), or, with
// neither, the terrace where a hero is chosen. Each realm is a world of its own and is loaded only when wanted.
import './game/ui.css';
import { story, CHAPTERS, ENDING } from './game/story.js';
import { showCard } from './game/hud.js';
import { HEROES } from './game/cast.js';

const REALMS = {
  studio: () => import('./realms/studio.js'),
};

const q = new URLSearchParams(location.search);
const capture = q.has('capture');
const realmId = story.realm;
document.getElementById('loading')?.remove();

if (realmId === 'ending') {
  const card = showCard({ art: ENDING.art, credit: ENDING.credit, sub: 'The return', heading: 'Ayodhya rejoices', text: ENDING.text, button: 'Tell it again' });
  await card.pressed;
  story.go(null);
} else if (realmId && REALMS[realmId]) {
  const heroId = HEROES[story.hero] ? story.hero : 'rama';
  const chapter = story.chapter(realmId);
  const card = chapter && !capture ? showCard({ art: chapter.art, credit: chapter.credit, sub: chapter.subtitle, heading: chapter.name, text: chapter.text, button: 'Mixing paint', onProgress: true }) : null;
  const [realm, { play }] = await Promise.all([REALMS[realmId](), import('./game/stage.js')]);
  const stage = await play(realm, heroId, card);
  if (card) { card.ready(`Enter as ${HEROES[heroId].name}`); await card.pressed; }
  stage.begin();
} else {
  const { chooseHero } = await import('./game/menu.js');
  await chooseHero();
}
