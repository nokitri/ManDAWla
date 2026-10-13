# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ManDAWla is a symmetry-drawing music toy: dragging on the canvas draws a mirrored pattern and plays notes (centre high, corners low). The look is a one-colour phosphor CRT skin with a colour picker and seven interface languages. Originally a single-file claude.ai artifact. No package manager, linter, or test suite.

**Build:** `node build.js` concatenates `src/` into the single-file app `dist/index.html` (gitignored). **Run:** open `dist/index.html` in a browser. Audio only starts after a user gesture. Edit `src/`, never `dist/`, and rebuild after changes.

## Source layout

`build.js` glues these together in order: `src/head.html` (page skeleton + fonts) → `src/style.css` (wrapped in `<style>`) → `src/body.html` (all markup: top bar, bottom deck, pop-up panels, settings, dialogs) → `src/js/*.js` in filename order (wrapped in one `<script>`) → `src/tail.html`.

- **The JS files are fragments of one IIFE**, not modules: `01-core.js` opens `(() => {` and `11-init.js` closes it and runs startup. Everything shares one scope, so any file can use any other file's functions/consts. Don't add imports/exports or IIFE wrappers per file. New files sort by their number prefix.
- Each JS file holds one or more banner sections like `/* ================= Audio ================= */`. Grep `/\* =+` across `src/js` for the full section map.
- No external JS libraries; only Google Fonts (VT323). Audio is hand-built Web Audio (`voice()` synthesizes every instrument from oscillators/noise/envelopes); rendering is Canvas 2D on three stacked canvases (`#bgc` background pattern, `#c` strokes and their trails, `#fx` glow, ripples and cursor).
- `$ = id => document.getElementById(id)`; code style is dense, one-liner-heavy, plain-English comments. Match it.

## Core architecture

- **Global state `S`** (`02-catalogs-state.js`) holds every setting. Nothing is saved between visits except the interface colour (`mandawla-theme`, `mandawla-custom`), language (`mandawla-lang`) and whether the tutorial was seen (`mandawla-tour`). All localStorage access is wrapped in try/catch — keep it that way.
- **Controls** (`04-controls.js`): sliders and dropdowns are declared in the `SLIDERS` / `SELECTS` tables, On/Off buttons through `onOff()`. Each control gets a `.sync()` (or is set from `SELECTS`), and `syncUI()` (`09-ui.js`) pushes all of `S` back into the controls. A new setting usually means: a default in `S`, a row in one of those tables, and markup in `body.html`.
- **Strokes** (`strokes[]`) are point lists in the rotating mandala's local space, plus brush/width/chord. A stroke has an `id` while its pointer (or key) is down; once released it fades after `S.stay` seconds (0 = forever). Pitch comes from distance to the centre (`idxAt`).
- **Sound:** every note goes `voice()` → `play()` → the shared effect chain (`buildFx()`, rebuilt by `updateFx()`) → master → analyser. `beatsAt()` is a free-running beat clock used by the arpeggiator, "repeat when held", echo timing and the strobe effect.
- **Visuals** run in `frame(now)` via `requestAnimationFrame`. `copies()` (`06-brushes-symmetry.js`) turns the symmetry mode into a list of transforms; `drawStrokes()` draws every stroke once per copy. Stroke colours are shades of the interface colour (`UI_STOPS`, set by `applyTheme`).
- **Undo** snapshots the stroke list (`pushHistory()` / `undo()`).
- **Languages:** `i18n(en)` looks up the English string in `TR_KEYS` / `TR` (`10-theme-i18n.js`). Elements with `data-i18n` and top-bar labels set through `setLbl()` are translated by `applyLang()`.
