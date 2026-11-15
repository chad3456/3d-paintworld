# Credits

**Ramayana: The Painted Epic.** Code MIT. Art CC0 1.0 or public domain, as listed.

## Built on

- **Oil paint**, a block by Patch (`blendi/oil-paint` on [patch.gg](https://patch.gg)): the painter in `src/oilpaint/`, the
  starter man and his controller in `src/figure/`, the aurora scene in `src/night/` and the wood in `src/world/`.
  Code MIT, art CC0 1.0. The Dronagiri chapter is its aurora scene almost untouched; the Panchavati chapter is its
  autumn wood, repainted green.
- **three.js** 0.186.1 (MIT). **Rapier** 0.21.0 by Dimforge (Apache-2.0), see `RAPIER-LICENSE.txt`.

## Characters and movement

- **The men** (Rama, Lakshmana, Hanuman, Ravana, the rakshasas): Patch's starter man, a MakeHuman figure (CC0 1.0) on the
  skeleton of Quaternius' Universal Animation Library.
- **Sita**: "Young woman with a braid in a knit sweater and a long skirt" (`mpfb:human-0027`) from Patch's asset
  library, made with MPFB from CC0 MakeHuman parts by the MakeHuman team and MargaretToigo. CC0 1.0. Her pictures are
  taken out (`tools/make-assets.mjs`) and she is put on the starter man's skeleton when the page loads
  (`src/game/rigs.js`).
- **Walking, running, jumping, turning**: Quaternius' Universal Animation Library 1 and 2 (CC0 1.0) and Patch's own
  clips (CC0 1.0), as shipped with the starter man.
- **Fighting, falling, the rakshasas' gait**: Quaternius' Universal Animation Library 2 (CC0 1.0), cut down to thirteen
  clips by `tools/make-assets.mjs`. <https://quaternius.com> · <https://opengameart.org/content/universal-animation-library-2>
- Crowns, bows, the mace, the tail, Ravana's nine other heads, the golden deer: made in code for this game.

## Paintings

Shown on the chapter cards, and the reference for how each hero and the palace are painted. All are in the public
domain (the artist died in 1906; the prints are from before 1930), from Wikimedia Commons.

| File | Work |
|---|---|
| `public/art/ramapanchayan.jpg` | Raja Ravi Varma, *Rama Panchayatana* (Rama, Sita, Lakshmana, Bharata, Shatrughna and Hanuman), lithograph, before 1906 |
| `public/art/golden-deer.jpg` | Ravi Varma Press, *Sita longs for the golden deer*, c. 1910 |
| `public/art/hanuman-mountain.jpg` | Ravi Varma Press, *Hanuman fetches the herb-bearing mountain*, 1910s |
| `public/art/ravana-sita-jatayu.jpg` | Raja Ravi Varma, *Jatayu Vadham* (Ravana, Sita and Jatayu), oil on canvas, 1895 |
| `public/art/rama-breaking-bow.jpg` | Raja Ravi Varma, *Rama breaking the bow of Shiva* |

## The tale

The Ramayana is Valmiki's. This game retells a few of its scenes freely and briefly, with respect for the people who
hold it sacred; any mistakes in the retelling are this game's own.
