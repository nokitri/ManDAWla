/* ================= Syncing the controls with the settings ================= */
function syncUI(){
  for (const [id, key] of SELECTS) $(id).value = String(S[key]);
  for (const [id] of SLIDERS) $(id).sync();
  for (const id of ['mirror','drift','glide']) $(id).sync();
  $('glideRow').hidden = !S.glide; syncFx(); syncInst(); syncBrush(); syncStamp(); drawStars();
}
function syncStamp(){
  if (document.activeElement !== $('stampTxt')) $('stampTxt').value = S.stamp || '✿';
  $('stampClr').hidden = !S.stampImg; $('stampUp').textContent = S.stampImg ? 'Change…' : 'Image…';
}
$('stampTxt').oninput = e => { S.stamp = [...e.target.value.trim()].slice(0, 3).join('') || '✿'; drawBrushPreview(); renderBrushGrid(); syncBrush(); };
$('stampUp').onclick = () => $('stampFile').click();
$('stampClr').onclick = () => { S.stampImg = null; syncStamp(); drawBrushPreview(); renderBrushGrid(); syncBrush(); };
$('stampFile').onchange = e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => {   // shrink to a small square so projects stay light
    const c = document.createElement('canvas'), s = 96; c.width = c.height = s; const g = c.getContext('2d'), k = Math.min(s/im.width, s/im.height);
    g.drawImage(im, (s - im.width*k)/2, (s - im.height*k)/2, im.width*k, im.height*k); URL.revokeObjectURL(url);
    S.stampImg = c.toDataURL('image/png'); if (S.brush !== 'stamp') S.brush = 'stamp';
    const im2 = new Image(); im2.onload = () => { drawBrushPreview(); renderBrushGrid(); syncBrush(); }; im2.src = S.stampImg; STAMP_IMGS.set(S.stampImg, im2);
    syncStamp(); toast('Stamp image ready');
  };
  im.onerror = () => toast("Couldn't read that image"); im.src = url;
};
$('surpriseSound').onclick = surpriseSound;
$('surpriseLook').onclick = surpriseLook;

/* ================= Surprise me ================= */
const pickR = a => a[Math.random()*a.length | 0];
function surpriseSound(){
  const drum = DRUM_INSTS.has(S.inst), pool = Object.keys(INST_NAMES).filter(k => k !== 'sampler' && DRUM_INSTS.has(k) === drum && k !== S.inst);
  pickInst(pickR(pool));
  if (!drum){ S.chord = pickR(['single','single','triad','seventh','sus2','power','ninth']); S.strum = pickR([0,0,20,45,80]); S.arp = Math.random() < .25 ? pickR(['up','down','updown']) : 'off'; S.oct = pickR([-1,0,0,1]); S.glide = Math.random() < .15; }
  S.afxList = [{ type:'reverb', amt: 20 + Math.random()*50 | 0 }];
  if (Math.random() < .65) S.afxList.push({ type: pickR(['echo','chorus','flanger','phaser','tremolo','wah','lofi','drive','crush']), amt: 25 + Math.random()*50 | 0 });
  syncUI(); updateFx(); toast('🎲 ' + instLabel() + (S.chord !== 'single' ? ' · ' + CHORD_NAMES[S.chord] : ''));
}
function surpriseLook(){
  S.brush = pickR(Object.keys(BRUSHES).filter(k => k !== 'stamp'));
  S.kal = pickR(Object.keys(MODES)); S.sym = pickR([3,4,5,6,6,8,8,10,12]); S.mirror = Math.random() < .6; S.spin = Math.round(Math.random()*120 - 40);
  S.width = pickR([.5,.75,1,1,1.5,2]); S.spread = Math.random()*90 | 0; S.trail = 20 + Math.random()*70 | 0; S.bright = 85 + Math.random()*35 | 0;
  S.vfxList = Math.random() < .45 ? [{ type: pickR(Object.keys(VFX_NAMES)), amt: 30 + Math.random()*50 | 0 }] : [];
  syncUI(); strokes.forEach(st => { st.brush = S.brush; st.dirty = true; });
  toast('🎲 ' + MODES[S.kal] + ' · ' + BRUSHES[S.brush].name);
}


/* ================= Toast ================= */
function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1400); }

/* ================= Tooltips ================= */
const TIPS = {
  tUndo:['Undo','Undo the last change.','Ctrl/Cmd+Z'],
  tClear:['Clear','Erase everything. Click twice.','C'],
  snap:['Snapshot','Save an image.','P'],
  fs:['Fullscreen','Fill the screen.'],
  't-modes':['Visuals','Motion, color and background.'],
  't-sound':['Key','Scale, key and tuning.'],
  gsBtn:['Settings','Settings for the whole project.'],
  sideClose:['Close','Close settings.','Esc'],
  hideDeck:['Hide','Hide this menu. Hover the bottom to peek.','Esc'],
  showDeck:['Show','Show the menu.','Esc'],
  helpBtn:['Help','Shortcuts and gestures.','?'],
  tabNotes:['Sound','Instrument, octave, chord, rhythm, glide and sound effects.'],
  tabLook:['Visuals','Brush, line, fading, colors, effects and symmetry.'],
  chordSel:['Chord','Notes per touch.','N'],
  brushBtn:['Brush','This track\'s stroke style.'],
  width:['Size','Stroke thickness.','[ ]'],
  tvol:['Volume','Track loudness.'],
  tZone:['Ring','Which ring of the mandala this track draws in.'],
  aFxAdd:['Add Effect','Stack sound effects; they run top to bottom.'],
  vFxAdd:['Add Effect','Stack visual effects on this track.'],
  tAlpha:['Opacity','How see-through this track\'s drawing is.'],
  oct:['Octave','Shift this track up or down by octaves.'],
  strum:['Strum','Spread chord notes.'],
  arpSel:['Arpeggiator','Play chords note by note.'],
  holdSel:['When Held','Holding still: sustain the note, or repeat it on the grid.'],
  glide:['Glide','Slide between pitches.','B'],
  glideTime:['Glide Time','Slide length.'],
  kalSel:['Pattern','How this track\'s copies are arranged.'],
  sym:['Copies','How many mirrored copies this track draws.','- ='],
  mirror:['Mirror','Reflect this track\'s copies.'],
  spin:['Spin','How fast this track turns (left = backward).'],
  drift:['Color Drift','Slowly shift this track\'s colors.'],
  spread:['Color Spread','How much color changes between this track\'s copies.'],
  bright:['Brightness','This track\'s brightness.'],
  bgfx:['Background Style','What sits behind the mandala.'],
  scale:['Scale','Which notes play.'],
  key:['Key','Transpose everything.'],
  tuning:['Tuning','A = 432 or 440 Hz.'],
  instBtn:['Instrument','Pick this track\'s sound, or upload your own.'],
  surpriseSound:['Surprise Me','Random instrument and sound.'], surpriseLook:['Surprise Me','Random brush, colors and symmetry.'],
  stampTxt:['Stamp','Emoji or letters for the Stamp brush.'], stampUp:['Stamp Image','Use your own picture as the stamp.'],
 
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
  const el = e.target.closest('button, select, input');
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

/* ================= Tutorial ================= */
const TOUR = [
  ['Draw', 'Drag inside the circle. Every ring is a note: the outside is low, the middle is high. Pick a sound, a style and how long your pattern stays below.']
];
let tourI = -1;
function showTour(i){
  tourI = i;
  if (i < 0 || i >= TOUR.length){ $('tour').hidden = true; try { localStorage.setItem('mandawla-tour', '1'); } catch {} return; }
  $('tour').hidden = false; $('tourStep').textContent = (i + 1) + ' / ' + TOUR.length; $('tourTitle').textContent = i18n(TOUR[i][0]); $('tourBody').textContent = i18n(TOUR[i][1]);
  $('tourNext').textContent = i18n(i === TOUR.length - 1 ? 'Done' : 'Next'); $('tourSkip').textContent = i18n('Skip');
}
$('tourNext').onclick = () => showTour(tourI + 1); $('tourSkip').onclick = () => showTour(-1);
