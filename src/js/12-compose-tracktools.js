/* ================= Compose For Me ================= */
// a pop-up of options; composing replaces every track with a new arrangement (Undo brings the old ones back)
const COMPOSE_STYLES = {
  calm:   { name:'Calm',   bpm:[60,76],   swing:0,  scales:['penta','lydian','hira','insen'], progs:[[0,3,4,2],[0,5,3,4],[0,4,5,3]], chords:['sus2','ninth','triad'],
            pads:['pad','strings','choir','crystal'], leads:['bell','celesta','glass','kalimba','handpan','flute'], basses:['subbass','bass','upright'], arps:['kalimba','pluck','musicbox','celesta'],
            brushes:['neon','wave','sparkle','beads','petals','rings'], palettes:['aurora','ocean','mono','forest'], kals:['lotus','mandala','radial','bloom'], bg:'nebula' },
  groovy: { name:'Groovy', bpm:[84,100],  swing:35, scales:['dorian','minpenta','blues','mixo'], progs:[[1,4,0,0],[0,3,0,4],[5,3,0,4]], chords:['seventh','ninth','triad'],
            pads:['epiano','organ','strings'], leads:['epiano','marimba','vibes','guitar','lead'], basses:['bass','synthbass','pluckbass','upright'], arps:['marimba','guitar','harpsichord'],
            brushes:['ribbon','rope','dots','calligraphy','zigzag','chain'], palettes:['ember','sunset','gold','sakura'], kals:['radial','flower','starburst','wheel'], bg:'dust' },
  bright: { name:'Bright', bpm:[104,124], swing:0,  scales:['penta','mixo','lydian'], progs:[[0,4,5,3],[0,5,3,4],[0,3,4,0]], chords:['triad','sus4','power'],
            pads:['supersaw','strings','pad'], leads:['lead','chip','fmbell','marimba','kalimba'], basses:['synthbass','b808','pluckbass'], arps:['chip','pluck','fmbell'],
            brushes:['stars','sparkle','lightning','hearts','diamonds','triangles'], palettes:['rainbow','cyber','ember','forest'], kals:['starburst','pinwheel','orbit','kaleido'], bg:'twinkle' },
  dark:   { name:'Dark',   bpm:[70,90],   swing:10, scales:['minor','phryg','harm','arabic'], progs:[[0,5,3,4],[0,6,5,4],[0,3,0,4]], chords:['triad','seventh','power'],
            pads:['choir','cello','pad','organ'], leads:['bell','glass','sitar','koto','fmbell'], basses:['reese','subbass','b808'], arps:['koto','harpsichord','sitar'],
            brushes:['comet','lightning','feather','fur','scales','lace'], palettes:['cyber','ocean','mono','aurora'], kals:['vortex','tunnel','galaxy','fractal'], bg:'warp' }
};
// each part: an instrument family and how it writes its notes; d = busyness (.55 sparse … 1.5 busy)
const CP_ROLES = {
  bass:    { pool: st => st.basses, brush:['ribbon','calligraphy','line'], gen: (n, B, P, d) => { const o = []; for (let bar = 0; bar < B; bar++){ const c = P[bar % P.length], t = bar*4; o.push({ b:t, i:c % n, d:1.5 }); if (Math.random() < .5*d) o.push({ b:t + 2.5, i:c % n, d:.5 }); if (Math.random() < .4*d) o.push({ b:t + 3, i:(c + 4) % n, d:.75 }); } return o; } },
  chords:  { pool: st => st.pads, brush:['neon','wave','double','rope'], gen: (n, B, P, d, st) => [...Array(B)].map((_, bar) => ({ b:bar*4, i:n + P[bar % P.length], d:4, ch: pickR(st.chords) })) },
  melody:  { pool: st => st.leads, brush:['beads','stars','petals','sparkle','dots','hearts'], gen: (n, B, P, d) => { const o = []; for (let bar = 0; bar < B; bar++){ let cur = n*2 + P[bar % P.length];
              for (let s8 = 0; s8 < 8; s8++){ const strong = s8 % 2 === 0; if (Math.random() > (strong ? .75 : .5)*d) continue; cur += strong ? pickR([0,2,-2]) : pickR([1,-1,2,-1]); cur = Math.max(n + 2, Math.min(n*3 - 1, cur)); o.push({ b:bar*4 + s8/2, i:cur, d: Math.random() < .3 ? 1 : .5 }); } } return o; } },
  arp:     { pool: st => st.arps, brush:['dots','beads','chain'], gen: (n, B, P, d) => { const o = [], step = d < .8 ? 1 : d > 1.2 ? .25 : .5; for (let bar = 0; bar < B; bar++){ const c = P[bar % P.length]; let k = 0;
              for (let b = 0; b < 4; b += step, k++) o.push({ b:bar*4 + b, i: Math.min(n*3 - 1, n + c + [0,2,4,7][k % 4]), d: step }); } return o; } },
  counter: { pool: st => st.leads, brush:['sparkle','stars','petals'], gen: (n, B, P, d) => { const o = []; for (let bar = 0; bar < B; bar++) for (let b = 0; b < 4; b += 2) if (Math.random() < .55*d) o.push({ b:bar*4 + b + pickR([0,.5,1]), i: Math.min(n*3 - 1, n*2 + P[bar % P.length] + pickR([2,4,5])), d:1.5 }); return o; } },
  drone:   { pool: () => ['bowl','gong','subbass','cello'], brush:['rings','neon'], gen: (n, B) => [...Array(Math.max(1, B/2 | 0))].map((_, k) => ({ b:k*8, i:0, d:Math.min(8, B*4) })) },
  sparkle: { pool: () => ['celesta','glass','musicbox','crystal'], brush:['sparkle','stars'], gen: (n, B, P, d) => { const o = []; for (let k = 0; k < B*4; k++) if (Math.random() < .22*d) o.push({ b:k + pickR([0,.5]), i:n*3 - 1 - (Math.random()*4 | 0), d:.5 }); return o; } },
  kick:    { pool: () => ['kick'], brush:['dots','rings'], gen: (n, B, P, d) => { const o = []; for (let bar = 0; bar < B; bar++){ o.push({ b:bar*4, i:4 }, { b:bar*4 + 2, i:4 }); if (d > 1.1) o.push({ b:bar*4 + 2.75, i:4 }); if (d > .9 && Math.random() < .5) o.push({ b:bar*4 + 3.5, i:4 }); } return o; } },
  snare:   { pool: () => ['snare','clap','rimshot','snap'], brush:['rings','triangles'], gen: (n, B, P, d) => { const o = []; for (let bar = 0; bar < B; bar++){ o.push({ b:bar*4 + 1, i:7 }, { b:bar*4 + 3, i:7 }); if (d > 1.1 && Math.random() < .6) o.push({ b:bar*4 + 3.75, i:6 }); } return o; } },
  hats:    { pool: () => ['hihat','shaker','tambourine'], brush:['spray','dots'], gen: (n, B, P, d) => { const o = [], step = d < .8 ? 1 : d > 1.2 ? .25 : .5; for (let b = 0; b < B*4; b += step) if (step > .25 || Math.random() < .75) o.push({ b: b + (step === 1 ? .5 : 0), i:n*2 + ((b/step) % 2) }); return o; } },
  perc:    { pool: () => ['conga','bongo','tabla','woodblock'], brush:['diamonds','dots'], gen: (n, B, P, d) => { const o = []; for (let k = 0; k < B*16; k++) if (k % 4 === 0 ? Math.random() < .5 : Math.random() < .2*d) o.push({ b:k/4, i:n + (k % 3) }); return o; } }
};
const CP_ORDER = { drums: ['bass','chords','melody','kick','hats','snare','arp','perc'], none: ['bass','chords','melody','arp','counter','drone','sparkle','chords'] };
let composeOpt = { style:'calm', tracks:4, drums:true, bars:4, busy:1, key:'style', look:'mix' };
function composeSong(o = composeOpt){
  const ST = COMPOSE_STYLES[o.style] || COMPOSE_STYLES.calm, d = [.55, 1, 1.5][o.busy] ?? 1;
  ensureAudio(); stashTrack(); pushHistory(); dropSel();
  if (S.loop) togglePlay();
  if (o.key === 'style'){ S.bpm = ST.bpm[0] + Math.round(Math.random()*(ST.bpm[1] - ST.bpm[0])); S.scale = pickR(ST.scales); S.key = Math.random()*12 | 0; S.swing = ST.swing; S.bgfx = ST.bg; S.stars = true; }
  S.bars = o.bars; strokes.length = 0; sparks.length = 0; S.tracks = [];
  const n = SCALES[S.scale].length, P = pickR(ST.progs), roles = (o.drums ? CP_ORDER.drums : CP_ORDER.none).slice(0, o.tracks);
  const shared = { palette: pickR(ST.palettes), kal: pickR(ST.kals), sym: pickR([6,8,8,10,12]), mirror: true };
  const used = new Set();
  roles.forEach((role, k) => {
    const R = CP_ROLES[role], pool = R.pool(ST).filter(x => !used.has(x)), inst = pickR(pool.length ? pool : R.pool(ST)); used.add(inst);
    const brush = pickR(o.look === 'match' ? ST.brushes : R.brush.concat(ST.brushes));
    const look = o.look === 'match' ? Object.assign({ brush }, shared) : { brush, palette: pickR(ST.palettes), kal: pickR(ST.kals), sym: pickR([5,6,8,10,12]), mirror: Math.random() < .7, spin: Math.round(Math.random()*60 - 15) };
    if (role === 'bass' || role === 'chords') look.duck = o.drums ? 40 : 0;
    const t = makeTrack(inst, look); layStroke(t, R.gen(n, S.bars, P, d, ST), k*.12, brush);
  });
  S.cur = S.tracks[0].id; loadTrack(S.tracks[0]); presetName = null;
  syncUI(); syncInst(); renderTracks(); updateMix(); drawStars(); lanesAt = 0; mixSig = '';
  togglePlay();
  toast(ST.name + ' · ' + S.tracks.map(t => INST_NAMES[t.inst]).join(' · '));
}
function setComposePop(open){
  const p = $('composePop'); p.hidden = !open; $('composeBtn').setAttribute('aria-expanded', open); if (!open) return;
  if (openPop) setPop(null); hideTip(); syncComposeUI();
  const r = $('composeBtn').getBoundingClientRect(), w = Math.min(400, innerWidth - 24);
  p.style.width = w + 'px'; p.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px'; p.style.top = (r.bottom + 8) + 'px'; p.style.bottom = 'auto';
}
function syncComposeUI(){
  document.querySelectorAll('#cStyle button').forEach(b => setP(b, b.dataset.v === composeOpt.style));
  $('cTracks').value = composeOpt.tracks; $('cTracksVal').textContent = composeOpt.tracks;
  setP($('cDrums'), composeOpt.drums); $('cDrums').textContent = composeOpt.drums ? 'On' : 'Off';
  $('cBars').value = String(composeOpt.bars); $('cBusy').value = composeOpt.busy; $('cBusyVal').textContent = ['Sparse','Medium','Busy'][composeOpt.busy];
  $('cKey').value = composeOpt.key; $('cLook').value = composeOpt.look;
}
document.querySelectorAll('#cStyle button').forEach(b => b.onclick = () => { composeOpt.style = b.dataset.v; syncComposeUI(); });
$('cTracks').oninput = e => { composeOpt.tracks = +e.target.value; syncComposeUI(); };
$('cDrums').onclick = () => { composeOpt.drums = !composeOpt.drums; syncComposeUI(); };
$('cBars').onchange = e => { composeOpt.bars = +e.target.value; };
$('cBusy').oninput = e => { composeOpt.busy = +e.target.value; syncComposeUI(); };
$('cKey').onchange = e => { composeOpt.key = e.target.value; };
$('cLook').onchange = e => { composeOpt.look = e.target.value; };
$('cGo').onclick = () => { setComposePop(false); composeSong(); };
$('cCancel').onclick = () => setComposePop(false);
document.addEventListener('pointerdown', e => { if (!$('composePop').hidden && !e.target.closest('#composePop, #composeBtn')) setComposePop(false); });

/* ================= Track tools: duplicate, reorder, surprise ================= */
function duplicateTrack(){
  if (S.tracks.length >= 12){ toast('12 tracks at most'); return; }
  stashTrack(); pushHistory();
  const t = curT(), c = JSON.parse(JSON.stringify(t)); c.id = makeTrackId(); c.name = (t.name || instLabel(t)).slice(0, 14) + ' 2'; c.s = false;
  S.tracks.splice(S.tracks.indexOf(t) + 1, 0, c);
  for (const st of strokes.filter(s => s.track === t.id)) strokes.push(Object.assign({}, st, { track: c.id, pts: st.pts.map(p => p.slice()), notes: st.notes.map(n => ({ ...n, cyc: -1, hit: undefined, vis: undefined, visHold: undefined })),
    path: null, fill: null, alt: null, chordPaths: null, segs: null, _vp: null, tone: null, held: null, dirty: true, born: performance.now() }));
  ANG[c.id] = ANG[t.id] || 0; selectTrack(c.id, true); lanesAt = 0; mixSig = ''; toast(trackName(t) + ' duplicated');
}
let chipDrag = null, chipDragEnd = 0;
function chipDown(e, t, b){ if (e.button) return; chipDrag = { t, b, x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false }; }
addEventListener('pointermove', e => {
  const d = chipDrag; if (!d || e.pointerId !== d.id) return;
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
  if (!d.on && Math.hypot(dx, dy) > 8){ d.on = true; d.b.classList.add('dragging'); hideTip(); }
  if (d.on) d.b.style.transform = `translate(${dx}px,${dy}px)`;
});
['pointerup','pointercancel'].forEach(ev => addEventListener(ev, e => {
  const d = chipDrag; if (!d || e.pointerId !== d.id) return; chipDrag = null; if (!d.on) return;
  chipDragEnd = performance.now(); d.b.style.transform = '';
  if (ev === 'pointercancel'){ renderTracks(); return; }
  const others = [...$('trackChips').children].filter(c => c !== d.b);
  const to = others.filter(c => { const r = c.getBoundingClientRect(), cy = r.top + r.height/2; return cy < e.clientY - r.height/2 || (Math.abs(cy - e.clientY) <= r.height/2 + 2 && r.left + r.width/2 < e.clientX); }).length;
  const from = S.tracks.indexOf(d.t);
  if (to !== from){ pushHistory(); S.tracks.splice(from, 1); S.tracks.splice(to, 0, d.t); toast(trackName(d.t) + ' moved to ' + (to + 1)); }
  renderTracks(); lanesAt = 0; updateMeta();
}));
function surpriseSound(){
  const t = curT(), drum = DRUM_INSTS.has(t.inst);
  const pool = Object.keys(INST_NAMES).filter(k => k !== 'sampler' && !RETIRED[k] && DRUM_INSTS.has(k) === drum && k !== t.inst);
  pickInst(pickR(pool));
  if (!drum){ S.chord = pickR(['single','single','triad','seventh','sus2','power','ninth']); S.strum = pickR([0,0,20,45,80]); S.arp = Math.random() < .25 ? pickR(['up','down','updown']) : 'off'; S.oct = pickR([-1,0,0,1]); S.glide = Math.random() < .15; }
  S.afxList = [{ type:'reverb', amt: 20 + Math.random()*50 | 0 }];
  if (Math.random() < .65) S.afxList.push({ type: pickR(['echo','chorus','flanger','phaser','tremolo','wah','lofi','drive','crush']), amt: 25 + Math.random()*50 | 0 });
  stashTrack(); syncUI(); syncInst(); updateMix(); renderTracks(); toast('🎲 ' + instLabel(t) + (S.chord !== 'single' ? ' · ' + CHORD_NAMES[S.chord] : ''));
}
function surpriseLook(){
  S.brush = pickR(Object.keys(BRUSHES).filter(k => k !== 'stamp')); S.palette = pickR(SHOWN_PALS.filter(k => k !== 'custom'));
  S.kal = pickR(Object.keys(MODES)); S.sym = pickR([3,4,5,6,6,8,8,10,12]); S.mirror = Math.random() < .6; S.spin = Math.round(Math.random()*120 - 40);
  S.width = pickR([.5,.75,1,1,1.5,2]); S.spread = Math.random()*90 | 0; S.trail = 20 + Math.random()*70 | 0; S.bright = 85 + Math.random()*35 | 0;
  S.vfxList = Math.random() < .45 ? [{ type: pickR(Object.keys(VFX_NAMES)), amt: 30 + Math.random()*50 | 0 }] : [];
  stashTrack(); syncUI(); strokes.forEach(st => { if (st.track === S.cur){ st.brush = S.brush; st.pal = S.palette; st.cs = null; st.dirty = true; } });
  toast('🎲 ' + MODES[S.kal] + ' · ' + BRUSHES[S.brush].name + ' · ' + PALETTES[S.palette].name);
}

const midiOfIdx = (i, t) => 45 + noteAt(i) + S.key + ((t && t.oct !== undefined ? (t.id === S.cur ? S.oct : t.oct) : S.oct))*12;
/* ================= Eraser and move ================= */
let tool = 'draw', toolOp = null;
function setTool(t){
  tool = t; setP($('toolDraw'), t === 'draw'); setP($('toolErase'), t === 'erase'); setP($('toolMove'), t === 'move');
  cv.style.cursor = t === 'erase' ? 'cell' : t === 'move' ? 'move' : 'crosshair';
  if (t === 'erase') toast('Eraser · drag over strokes of this track (E)'); else if (t === 'move') toast('Move · drag a stroke of this track (V)'); else toast('Draw');
}
// which stroke of the selected track is under the pointer, in any of its mirrored copies
function hitStroke(x, y){
  const P = new DOMPoint(x*DPR, y*DPR), set = SYMSETS[S.cur]; if (!set) return null;
  const invs = set.M.map(m => ({ m, inv: m.inverse(), sc: Math.hypot(m.a, m.b)/DPR || 1 }));
  let best = null, bd = Infinity;
  for (const st of strokes){
    if (st.track !== S.cur || !st.pts.length) continue;
    const vp = visPts(st);
    for (const c of invs){
      const q = c.inv.transformPoint(P), thr = (st.width*2.5 + 12)/c.sc;
      for (const p of vp){ const d = Math.hypot(p[0] - q.x, p[1] - q.y); if (d < thr && d*c.sc < bd){ bd = d*c.sc; best = { st, inv: c.inv }; } }
    }
  }
  return best;
}
function eraseAt(x, y){
  const h = hitStroke(x, y); if (!h) return;
  if (!toolOp.pushed){ pushHistory(); toolOp.pushed = true; }
  const i = strokes.indexOf(h.st); if (i >= 0) strokes.splice(i, 1);
  for (const n of h.st.notes) tlSel.delete(n);
  toolOp.n++; ripples.push({ x, y, r: 0, life: .6, t: .9 }); lanesAt = 0; mixSig = '';
}
function toolDown(e){
  if (tool === 'erase'){ toolOp = { kind: 'erase', n: 0, pushed: false }; eraseAt(e.clientX, e.clientY); return; }
  const h = hitStroke(e.clientX, e.clientY); if (!h){ toast('Nothing to move here'); return; }
  pushHistory();
  const c = Object.assign({}, h.st, { pts: h.st.pts.map(p => p.slice()), roll: false, rollN: null, dirty: true, segs: null, _vp: null });   // a copy, so Undo puts the original back
  strokes[strokes.indexOf(h.st)] = c;
  toolOp = { kind: 'move', st: c, inv: h.inv, lx: e.clientX, ly: e.clientY, moved: false };
}
function toolMoveEv(e){
  if (!toolOp) return;
  if (toolOp.kind === 'erase'){ eraseAt(e.clientX, e.clientY); return; }
  const a = toolOp.inv.transformPoint(new DOMPoint(e.clientX*DPR, e.clientY*DPR)), b = toolOp.inv.transformPoint(new DOMPoint(toolOp.lx*DPR, toolOp.ly*DPR));
  const dx = a.x - b.x, dy = a.y - b.y, st = toolOp.st; toolOp.lx = e.clientX; toolOp.ly = e.clientY;
  for (const p of st.pts){ p[0] += dx; p[1] += dy; }
  st.dirty = true; st.segs = null; st._vp = null; st.pulse = 1; st.born = performance.now(); toolOp.moved = true;
}
function toolUp(){
  const op = toolOp; toolOp = null; if (!op) return;
  if (op.kind === 'erase'){ if (op.n) toast(op.n + (op.n > 1 ? ' strokes' : ' stroke') + ' erased · Undo brings them back'); }
  else if (!op.moved) undoStack.pop(); else toast('Stroke moved');
}
$('toolDraw').onclick = () => setTool('draw'); $('toolErase').onclick = () => setTool(tool === 'erase' ? 'draw' : 'erase'); $('toolMove').onclick = () => setTool(tool === 'move' ? 'draw' : 'move');

// the tool buttons step below the timeline when it would cover them
function placeTools(){
  const el = $('tools'), tlEl = $('timeline'); let top = '';
  if (!tlEl.hidden){ const r = tlEl.getBoundingClientRect(); if (r.left < 64) top = Math.min(innerHeight - 160, r.bottom + 10) + 'px'; }
  if (el.style.top !== top){ el.style.top = top; el.style.transform = top ? 'none' : ''; }
}
