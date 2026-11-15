// What is written over the picture: the hero's name and strength, what there is to do, what is said, and the two
// things the hero can do with how soon each can be done again. Plain page elements; the picture itself is untouched.
const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

export function createHud(hero) {
  const root = el('div', 'hud', document.body);
  const who = el('div', 'hud-who', root);
  el('div', 'hud-name', who, hero.name);
  const bar = el('div', 'hud-bar', who);
  const fill = el('div', 'hud-fill', bar);
  const goal = el('div', 'hud-goal', root);
  const line = el('div', 'hud-line', root);
  const title = el('div', 'hud-title', root);
  const titleName = el('div', 'hud-title-name', title);
  const titleSub = el('div', 'hud-title-sub', title);
  const boss = el('div', 'hud-boss', root);
  const bossName = el('div', 'hud-boss-name', boss);
  const bossFill = el('div', 'hud-fill', el('div', 'hud-bar', boss));
  const moves = el('div', 'hud-moves', root);
  const move = (key, name) => {
    const m = el('div', 'hud-move', moves);
    const veil = el('div', 'hud-veil', m);
    el('div', 'hud-key', m, key);
    el('div', 'hud-move-name', m, name);
    return { m, veil };
  };
  const primary = move('Click', hero.primary.name), special = move('E', hero.special.name);
  const hurt = el('div', 'hud-hurt', root);
  const dark = el('div', 'hud-dark', root);
  const dot = el('div', 'hud-dot', root);
  let lineTimer = 0;

  return {
    root,
    health(v, max) { fill.style.width = `${Math.max(0, Math.min(1, v / max)) * 100}%`; fill.classList.toggle('low', v / max < 0.3); },
    objective(text) { if (goal.textContent === text) return; goal.textContent = text ?? ''; goal.classList.remove('new'); void goal.offsetWidth; goal.classList.add('new'); },
    /** A line of the telling, shown for a few seconds. */
    say(text, seconds = 5) {
      line.textContent = text; line.classList.add('on');
      clearTimeout(lineTimer);
      lineTimer = setTimeout(() => line.classList.remove('on'), seconds * 1000);
    },
    title(name, sub) {
      titleName.textContent = name; titleSub.textContent = sub ?? '';
      title.classList.add('on');
      setTimeout(() => title.classList.remove('on'), 5200);
    },
    cooldowns(a, b) {
      primary.veil.style.height = `${Math.max(0, Math.min(1, a)) * 100}%`;
      special.veil.style.height = `${Math.max(0, Math.min(1, b)) * 100}%`;
      special.m.classList.toggle('ready', b <= 0);
    },
    boss(name, v, max) {
      boss.classList.toggle('on', name != null);
      if (name == null) return;
      bossName.textContent = name;
      bossFill.style.width = `${Math.max(0, v / max) * 100}%`;
    },
    flash() { hurt.classList.remove('on'); void hurt.offsetWidth; hurt.classList.add('on'); },
    aim(on) { dot.classList.toggle('on', on); },
    /** Brings the dark over the picture (to 1) or takes it away (to 0), in `seconds`. */
    fade(to, seconds = 1) {
      dark.style.transition = `opacity ${seconds}s`;
      dark.style.opacity = to;
      return new Promise((r) => setTimeout(r, seconds * 1000));
    },
    hide(hidden) { root.style.display = hidden ? 'none' : ''; },
  };
}

/** A card over the whole page: a painting, a heading, some words and one button. Resolves when the button is pressed. */
export function showCard({ art, credit, heading, sub, text, button, onProgress = false }) {
  const card = el('div', 'card', document.body);
  const frame = el('div', 'card-frame', card);
  if (art) {
    const pic = el('div', 'card-art', frame);
    const img = el('img', null, pic);
    img.src = `./art/${art}.jpg`; img.alt = credit ?? '';
    if (credit) el('div', 'card-credit', pic, credit);
  }
  const words = el('div', 'card-words', frame);
  if (sub) el('div', 'card-sub', words, sub);
  el('h1', null, words, heading);
  el('p', null, words, text);
  const go = el('button', 'card-go', words, button);
  const meter = onProgress ? el('div', 'card-meter', words) : null;
  const meterFill = meter ? el('div', 'card-meter-fill', meter) : null;
  const note = meter ? el('div', 'card-note', words, '') : null;
  if (onProgress) go.disabled = true;
  let done;
  const pressed = new Promise((r) => { done = r; });
  const press = () => { if (go.disabled) return; removeEventListener('keydown', key); card.classList.add('gone'); setTimeout(() => card.remove(), 700); done(); };
  const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); press(); } };
  go.addEventListener('click', press);
  addEventListener('keydown', key);
  return {
    pressed,
    progress(value, label) { if (meterFill) meterFill.style.width = `${Math.round(value * 100)}%`; if (note && label) note.textContent = label; },
    ready(label) { go.disabled = false; if (label) go.textContent = label; meter?.remove(); note?.remove(); go.focus(); },
    remove() { card.remove(); removeEventListener('keydown', key); },
  };
}
