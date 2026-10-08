# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ManDAWla is a symmetry-drawing music toy and mini DAW: drawing on a canvas plays notes, strokes record into a looping multi-track timeline, and projects export as audio/MIDI/GIF/video. Originally a single-file claude.ai artifact. No package manager, linter, or test suite.

**Build:** `node build.js` concatenates `src/` into the single-file app `dist/index.html` (gitignored). **Run:** open `dist/index.html` in a browser. Audio only starts after a user gesture. Edit `src/`, never `dist/`, and rebuild after changes.

## Source layout

The shipped app must stay one file: the project-zip export copies its own page source (`PAGE_SRC`). So `src/` is just the old file cut at line boundaries, and `build.js` glues it back in order:

- `src/head.html` (artifact page skeleton + fonts) → `src/style.css` (wrapped in `<style>`) → `src/body.html` (all markup: top bar, timeline, tool rail, bottom deck, pop-up panels, dialogs) → `src/js/*.js` in filename order (wrapped in one `<script>`) → `src/tail.html`.
- **The JS files are fragments of one IIFE**, not modules: `01-core.js` opens `(() => {` and `14-tutorial-tracks-init.js` closes it and runs startup. Everything shares one scope, so any file can use any other file's functions/consts. Don't add imports/exports or IIFE wrappers per file. New files sort by their number prefix.
- Each JS file holds one or more banner sections like `/* ================= Audio ================= */` (file names say which). Grep `/\* =+` across `src/js` for the full section map.
- No external JS libraries; only Google Fonts (IBM Plex Mono). Audio is hand-built Web Audio (`voice()` synthesizes every instrument from oscillators/noise/envelopes); rendering is Canvas 2D on three stacked canvases (`#bgc` background, `#c` strokes/trails, `#fx` effects).
- `$ = id => document.getElementById(id)`; code style is dense, one-liner-heavy, plain-English comments. Match it.

## Core architecture

- **Global state `S`** (State section) holds every setting. `S_DEFAULTS` is a deep copy used for new tracks.
- **Per-track settings live in `S` while a track is selected.** `TRACK_KEYS` lists them; `stashTrack()` copies `S` → current track, `loadTrack(t)` copies track → `S`. Any change/input/click in the deck or `#trackPops` triggers `stashTrack()`. A new per-track setting must be added to `TRACK_KEYS` (and given a default in `applyPreset`'s migration loop).
- **Strokes** (`strokes[]`) carry their points, brush/palette, `track`, and recorded `notes` (`{b: beat, i: scale index, pi: point index, pan, d: duration, ch: chord, ...}`). Pitch comes from distance to the canvas center (`idxAt`).
- **Playback:** `scheduler()` is a look-ahead scheduler (~120 ms) over `ac.currentTime`; it walks every stroke's notes per loop cycle and calls `voice()`. Per-track loop length (`loopB`) and automation lanes (`applyAuto`) are applied here. Visuals run in `frame(now)` via `requestAnimationFrame`.
- **Undo/redo** are whole-state snapshots (`snapNow()` / `restoreSnap()`).

## Persistence and compatibility

- `snapshot(name)` serializes `SAVED_KEYS` + strokes (format `v:5`); `applyPreset(p)` loads it **and migrates older formats** (legacy no-track presets via `tracksFromLegacy`, retired instruments via `RETIRED`, old `afx`/`vfx`/`verb`/`echo` fields into `afxList`/`vfxList`). Keep old saves loading when changing the format: add migration in `applyPreset`, don't break existing keys.
- localStorage keys: `resonance-presets-v2` (falls back to `-v1`), autosave (`AUTO`), `mandawla-theme`, `mandawla-tour`, timeline size prefs. All access is wrapped in try/catch — keep it that way.
- Downloads go through the artifact runtime's `claude.use('downloads')` when present, otherwise a normal browser download. `PAGE_SRC` (the page's own HTML) is used by the project-zip export.
