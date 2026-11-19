# Licence notes

Code MIT. Art CC0 1.0 or public domain. Checked 2026-11-15.

| Part | Where it came from | Licence |
|---|---|---|
| `src/oilpaint/`, `src/figure/`, `src/night/`, `src/world/`, `lib/patch-block.js`, `tools/serve.mjs` | Patch's oil-paint block (`blendi/oil-paint`, release 1.1.3), cloned from git.patch.gg. Changed here: the cloak takes its size as arguments; `paint` is exported; the wood's palettes are green; `src/night/main.js` and the block's own page are replaced by this game's | MIT; what it draws CC0 1.0 |
| `src/game/`, `src/realms/`, `src/boot.js`, `index.html`, `tools/` (the rest) | Written for this game | MIT; what it draws CC0 1.0 |
| `public/figure/starter-man.glb`, `starter-man-clips.glb` | Patch's starter man and his clips, as shipped in the oil-paint block (MakeHuman CC0 parts; Quaternius' Universal Animation Library 1 and 2; Patch's own clips) | CC0 1.0 |
| `public/figure/epic-clips.glb` | Thirteen clips from Quaternius' Universal Animation Library 2, Standard (`UAL2_Standard.glb`, from opengameart.org), joint turns and the hips' travel only, made by `tools/make-assets.mjs` | CC0 1.0 |
| `public/figure/woman.glb` | Patch asset `mpfb:human-0027` (sha256 `b82effbc…17e54`), made with MPFB from CC0 MakeHuman parts; pictures removed by `tools/make-assets.mjs` | CC0 1.0 |
| `public/art/*.jpg` | Five works by Raja Ravi Varma and the Ravi Varma Press, from Wikimedia Commons, scaled down (see `CREDITS.md`) | Public domain |
| `src/figure/rapier/` | Rapier 0.21.0, `@dimforge/rapier3d-compat`, as vendored in the oil-paint block | Apache-2.0 |
| three.js 0.186.1 | npm | MIT; its notice ships as `THIRD-PARTY-NOTICES.md` |
| `models/rama/` (`rama.blend`, `rama.glb`, stills) | Built by `tools/blender/build_rama.py` from MakeHuman's base mesh, targets and game rig (as shipped in MPFB2, github.com/makehumancommunity/mpfb2) and MakeHuman's system assets pack (skin, eyes, brows, lashes, teeth, tongue, hair); clothes, beads, bow and quiver made in code | CC0 1.0 |
| `kokeshi/` (the page, and the 48 models in `kokeshi/public/models`) | Written and made in code for this repository; no picture, model or scan of anyone is used | Code MIT; models CC0 1.0 |
| `shots/` | Stills of this game | CC0 1.0 |

There is no sound. Nothing here has no stated source.
