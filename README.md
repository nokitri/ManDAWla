# mandawla ✌︎('ω')✌︎

**Draw a mandala, hear it play.** Drag anywhere on the screen. Every stroke is mirrored into a symmetric pattern, and its distance from the centre sets the note: the corners are low and the middle is high.

▶ **Try it: [nokitri.github.io/mandawla](https://nokitri.github.io/mandawla/)**

![mandawla: a pink phosphor mandala drawn across the screen](docs/screenshot.png)

## What you can change

- **Sound:** 60 instruments (bells, plucked strings, keys, winds, bass, drums and more), or load your own sample. ♪ Sound adds chords, an arpeggiator, glide and effects.
- **Style:** 29 brushes. ✦ Visuals sets size, opacity, symmetry pattern, copies, mirror, spin and visual effects.
- **Stays:** how long a pattern lasts before it fades: 1 to 30 seconds, or forever.
- **Colour:** six phosphor colours or your own. The strokes and the interface both use it.
- **Language:** EN · 中文 · 日本語 · ES · FR · РУ · DE.
- ▣ **Screenshot:** saves the drawing as an image.
- ⚙ **Settings:** background pattern (always on black), scale, key and tuning.

## Keys

| Key | Does |
|---|---|
| `A`–`L` | play the scale (hold to sustain) |
| `[` `]` | brush size |
| `-` `=` | symmetry |
| `Z` / `Ctrl+Z` | undo |
| `C` `C` | clear (undo brings it back) |
| `P` | screenshot |
| `Esc` | hide / show the bottom menu |
| `?` | help |

## Build

There are no dependencies. `node build.js` glues `src/` into a single file, `dist/index.html`; open that in a browser. Every push to `master` builds and deploys to GitHub Pages (`.github/workflows/pages.yml`). See `CLAUDE.md` for how the source is laid out.
