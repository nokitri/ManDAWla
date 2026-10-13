/* ================= Autosave ================= */
const AUTO = 'resonance-autosave-v1';
let dirtySession = false, userActed = false;
['pointerdown','keydown'].forEach(ev => addEventListener(ev, () => { userActed = true; }, { capture:true, once:false }));
function autosave(){
  if (!userActed || !$('restore').hidden) return;
  try { localStorage.setItem(AUTO, JSON.stringify(snapshot(presetName || 'Last Session'))); } catch {}
}
setInterval(autosave, 5000);
addEventListener('pagehide', autosave);
let pendingRestore = null;
try { const raw = localStorage.getItem(AUTO); if (raw){ const p = JSON.parse(raw); if (p && Array.isArray(p.strokes) && p.strokes.length) pendingRestore = p; } } catch {}
if (pendingRestore){
  $('restore').hidden = false;
  $('restoreYes').onclick = () => { ensureAudio(); $('restore').hidden = true; applyPreset(pendingRestore); presetName = pendingRestore.name === 'Last Session' ? null : pendingRestore.name; updateMeta(); toast('Session restored'); };
  $('restoreNo').onclick = () => { $('restore').hidden = true; toast('Fresh start'); };
}

/* ================= Tooltips ================= */
const TIPS = {
  tPlay:['Play / Stop','Play the loop.','Space'],
  rec:['Record','Save notes into the loop as you draw.','R'],
  tMetro:['Metronome','Click on every beat.','M'],
  tRings:['Notes','Show which ring plays which note.','O'],
  pos:['Position','Current bar and beat.'],
  tUndo:['Undo','Undo the last change.','Ctrl/Cmd+Z'],
  tRedo:['Redo','Redo what you undid.','Ctrl/Cmd+Shift+Z'],
  tClear:['Clear','Erase everything. Click twice.','C'],
  snap:['Snapshot','Save an image.','P'],
  fs:['Fullscreen','Fill the screen.'],
  't-modes':['Visuals','Motion, color and background.'],
  't-sound':['Key','Scale, key and tuning.'],
  't-loop':['Loop','Tempo, length and timing.'],
  't-proj':['Save / Load','Save, load, share and export.'],
  gsBtn:['Settings','Settings for the whole project.'],
  sideClose:['Close','Close settings.','Esc'],
  hideDeck:['Hide','Hide this menu. Hover the bottom to peek.','Esc'],
  showDeck:['Show','Show the menu.','Esc'],
  helpBtn:['Help','Shortcuts and gestures.','?'],
  tabNotes:['Sound','Instrument, octave, chord, rhythm, glide and sound effects.'],
  tabLook:['Visuals','Brush, line, fading, colors, effects and symmetry.'],
  tRoll:['Timeline','Show the timeline; the selected track opens as a note grid.','T'],
  prLen:['New Notes','Length of notes you click in.'],
  prSnap:['Snap','Snap notes to the grid.'],
  prGhost:['Others','Show other tracks\' notes faintly.'],
  addTrack:['Add Track','New track.'],
  instSel:['Instrument','This track\'s sound.'],
  chordSel:['Chord','Notes per touch.','N'],
  brushBtn:['Brush','This track\'s stroke style.'],
  width:['Size','Stroke thickness.','[ ]'],
  tName:['Name','Rename this track.'],
  tMute:['Mute','Silence this track.'],
  tSolo:['Solo','Hear only soloed tracks.'],
  tClrNotes:['Clear Notes','Remove notes, keep the drawing.'],
  tDel:['Delete Track','Delete this track. Click twice.'],
  tvol:['Volume','Track loudness.'],
  tZone:['Ring','Which ring of the mandala this track draws in.'],
  focusBtn:['Focus','Fade other tracks back.'],
  aFxAdd:['Add Effect','Stack sound effects; they run top to bottom.'],
  vFxAdd:['Add Effect','Stack visual effects on this track.'],
  tAlpha:['Opacity','How see-through this track\'s drawing is.'],
  verb:['Reverb','Room sound.'],
  echo:['Echo','Tempo-synced repeats.'],
  oct:['Octave','Shift this track up or down by octaves.'],
  strum:['Strum','Spread chord notes.'],
  arpSel:['Arpeggiator','Play chords note by note.'],
  holdSel:['When Held','Holding still: sustain the note, or repeat it on the grid.'],
  glide:['Glide','Slide between pitches.','B'],
  glideTime:['Glide Time','Slide length.'],
  fade:['Disappear','When strokes fade away.'],
  c1:['From','First custom color.'], c2:['To','Second custom color.'], c3:['Then','Third custom color.'],
  kalSel:['Pattern','How this track\'s copies are arranged.'],
  sym:['Copies','How many mirrored copies this track draws.','- ='],
  mirror:['Mirror','Reflect this track\'s copies.'],
  spin:['Spin','How fast this track turns (left = backward).'],
  vizSel:['Audio Visual Mode','Visual that reacts to sound.'],
  react:['Reactivity','How much visuals react.'],
  beatFx:['Beat Flashes','Flash on each hit.'],
  drift:['Color Drift','Slowly shift this track\'s colors.'],
  spread:['Color Spread','How much color changes between this track\'s copies.'],
  bright:['Brightness','This track\'s brightness.'],
  bgCustom:['Background','Background color.'],
  bgfx:['Background Style','What sits behind the mandala.'],
  trail:['Trails','How long this track\'s motion lingers.'],
  scale:['Scale','Which notes play.'],
  key:['Key','Transpose everything.'],
  tuning:['Tuning','A = 432 or 440 Hz.'],
  bpm:['Tempo','Beats per minute.'],
  tap:['Tap Tempo','Tap to set the tempo.'],
  barsSel:['Length','Loop length in bars.'],
  gridSel:['Grid','Note step size.'],
  quant:['Snap To Grid','Align recorded notes.'],
  swing:['Swing','Shuffle the rhythm.'],
  countIn:['Count-In','Four clicks before playing.'],
  metroVol:['Click Volume','Metronome loudness.'],
  pname:['Project Name','Name your project.'],
  save:['Save Project','Save in this browser.','Ctrl/Cmd+S'],
  copyCode:['Copy Share Code','Copy a code for a friend.'],
  codeIn:['Share Code','Paste a code here.'],
  importCode:['Load Code','Load the pasted code.'],
  instBtn:['Instrument','Pick this track\'s sound, or upload your own.'],
  tl:['Timeline','Drag notes to move · edge to resize · empty space to select · ruler to seek. Stretch the bottom edge down for pitch view. The Timeline button opens the selected track as a note grid: click to add, right-click to delete.'],
  dblLoop:['Double Loop','Doubles the length and copies every note.'],
  quantNow:['Quantize Notes','Snap notes to the grid (selected, or all).'],
  exportVid:['Export Video','Record one loop with sound.'],
  exportImg:['Save Image','Save a picture of the mandala.'],
  tlDup:['Duplicate','Copy right after.','Ctrl/Cmd+D'],
  tlDel:['Delete','Delete selected notes.','Delete'],
  tlIn:['Zoom In','Stretch the timeline.'],
  tlOut:['Zoom Out','Shrink the timeline.'],
  tlFit:['Fit','Show the whole loop.'],
  tlFull:['Full Screen','Fill the screen with the timeline.','Esc'],
  composeBtn:['Compose','Write a new song with options (replaces your tracks).'],
  tDup:['Duplicate','Copy this track, notes and all.'],
  surpriseSound:['Surprise Me','Random instrument and sound.'], surpriseLook:['Surprise Me','Random brush, colors and symmetry.'],
  loopB:['Loop Length','Loop this track on its own length for polyrhythms.'], duck:['Duck On Kick','Dip this track on every kick.'],
  pitchCol:['By Pitch','Color each ring differently.'], stampTxt:['Stamp','Emoji or letters for the Stamp brush.'], stampUp:['Stamp Image','Use your own picture as the stamp.'],
  toolDraw:['Draw','Draw and play.'], toolErase:['Eraser','Erase this track\'s strokes.','E'], toolMove:['Move','Drag a stroke of this track.','V'],
  tlSteps:['Steps','Drum step grid or note grid.'], tlEuclid:['Fill Evenly','Spread hits evenly over the steps.'], tlAuto:['Automate','Draw volume or filter over the loop.'],
 
  exportGif:['Looping GIF','One loop as an animated GIF.'], exportAudio:['Audio + Stems','WAV of the mix plus one per track (zip).'], exportMidi:['MIDI','Notes for other music apps (zip).'],
  offlineCopy:['Offline App','Download the app as one file that works offline.']
};
const BRUSH_TIPS = { line:'A clean, smooth line.', neon:'Bright core with a soft glow.', ribbon:'Thick when slow, thin when fast.', calligraphy:'Angled nib like a pen.', comet:'Thin tail that grows into a round head.',
  dashed:'Moving dashes.', double:'Two parallel lines.', rope:'Two twisting strands.', wave:'A wavy line.', zigzag:'Sharp zigzags.', lace:'Little loops along the path.', lightning:'Jagged bolt with branches.',
  dots:'Round dots of varying size.', beads:'Alternating big and small beads.', rings:'Hollow circles.', chain:'Linked rings.', sparkle:'Twinkling four-point stars.', stars:'Twinkling five-point stars.',
  petals:'Petals on alternating sides.', leaves:'A vine with leaves.', diamonds:'Diamonds along the path.', triangles:'Outlined triangles.', hearts:'Little hearts.', spray:'Airbrush speckles.',
  feather:'A feather with fine barbs.', fur:'Strands pointing outward.', scales:'Overlapping scales.', ladder:'Two rails with rungs.' };
const tipEl = $('tip'); let tipTarget = null, tipTimer = 0;
function tipFor(el){
  if (el.id && TIPS[el.id]){ const [t, d, k] = TIPS[el.id]; return `<b>${t}</b>${k ? `<kbd>${k}</kbd>` : ''}<br>${d}`; }
  if (el.classList.contains('tile') && el.dataset.v) return `<b>${BRUSHES[el.dataset.v].name}</b><br>${BRUSH_TIPS[el.dataset.v] || ''}`;
  if (el.classList.contains('sw')) return `<b>${el.dataset.nm || el.textContent.trim()}</b><br>${el.closest('#themeSw') ? 'Interface theme.' : el.dataset.nm === 'Custom' ? 'Your own colors.' : 'Stroke colors.'}`;
  if (el.dataset.tip) return el.dataset.tip;
  return null;
}
function placeTip(el){
  const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
  let x = r.left + r.width/2 - t.width/2, y = r.top - t.height - 8;
  if (y < 8) y = r.bottom + 8;
  x = Math.max(8, Math.min(innerWidth - t.width - 8, x));
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
function hideTip(){ clearTimeout(tipTimer); tipTarget = null; tipEl.classList.remove('on'); }
document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest('button, select, input, canvas#tl, .pos');
  if (!el || el === tipTarget) return;
  // titles become our tooltips so the browser's plain one doesn't double up
  if (el.title){ if (!el.dataset.tip && !(el.id && TIPS[el.id])) el.dataset.tip = el.title; el.removeAttribute('title'); }
  const html = tipFor(el); if (!html){ hideTip(); return; }
  hideTip(); tipTarget = el;
  tipTimer = setTimeout(() => { if (tipTarget !== el) return; tipEl.innerHTML = html; placeTip(el); tipEl.classList.add('on'); }, 380);
});
document.addEventListener('pointerout', e => { if (tipTarget && !tipTarget.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('pointerdown', hideTip, true);
addEventListener('scroll', hideTip, true);
for (const id in TIPS){ const el = $(id); if (el) el.removeAttribute('title'); }

/* ================= Helpers for making tracks and laying out notes ================= */
const pickR = a => a[Math.random()*a.length | 0];
const makeTrackId = () => Math.max(0, ...S.tracks.map(t => t.id)) + 1;
function makeTrack(inst, over = {}){
  const base = {}; for (const k of TRACK_KEYS) base[k] = JSON.parse(JSON.stringify(S_DEFAULTS[k] ?? null));
  const t = Object.assign(base, { id: makeTrackId(), name:'', inst, chord:'single', arp:'off', v:80, m:false, s:false, alpha:100, zone:'all', afxList:[{ type:'reverb', amt:40 }], vfxList:[], sendsMoved:true }, over);
  S.tracks.push(t); return t;
}
// lays notes out as a stroke: each note on its own pitch ring, in time order across one wedge
function layStroke(t, notes, wedgeOffset = 0, brush, width){
  if (!notes.length) return null;
  const n3 = scaleN(), L = LB(), R = maxR(), wedge = TAU/symOf(t);
  const st = newStroke(); st.track = t.id; st.inst = t.inst; st.brush = brush || t.brush || 'line'; st.width = width || t.width || 1.5; st.pinned = true;
  st.pal = t.palette || 'rainbow'; st.cs = st.pal === 'custom' ? [t.c1, t.c2, t.c3] : null; st.ch = notes.find(n => n.ch && n.ch !== 'single')?.ch || 'single'; st.stamp = t.stamp;
  notes.sort((a, b) => a.b - b.b);
  const ptAt = nn => { const a = wedgeOffset*wedge + (nn.b/L)*wedge*.9, r = R*(1 - (Math.min(n3 - 1, nn.i) + .5)/n3); return [Math.cos(a)*r, Math.sin(a)*r]; };
  notes.forEach((nn, k) => {
    const q = ptAt(nn);
    if (k){ const pq = st.pts[st.pts.length - 1]; for (let s = 1; s < 4; s++) st.pts.push([pq[0] + (q[0] - pq[0])*s/4, pq[1] + (q[1] - pq[1])*s/4]); }
    st.pts.push(q); nn.pi = st.pts.length - 1; nn.cyc = -1; if (nn.pan === undefined) nn.pan = +(Math.random()*.8 - .4).toFixed(2);
  });
  if (st.pts.length < 2) st.pts.push([st.pts[0][0] + .5, st.pts[0][1] + .5]);
  st.notes = notes; strokes.push(st); return st;
}

