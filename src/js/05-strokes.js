/* ================= Strokes ================= */
const strokes = [], active = new Map(), sparks = [], ripples = [], pulses = [];
let rot = 0, ANG = {}, lastNote = 0, lastIdx = -1, tunnelPhase = 0, colorShift = 0, frameNow = 0;
const CY = () => H/2 - Math.min(30, H*.03);
const maxR = () => Math.min(W,H)*.46;
function toLocal(x, y){
  const dx = x - W/2, dy = y - CY(), c = Math.cos(-rot), s = Math.sin(-rot);
  return [dx*c - dy*s, dx*s + dy*c];
}
function idxAt(lx, ly){
  const n = SCALES[S.scale].length * 3, d = Math.min(1, Math.hypot(lx,ly)/maxR());
  return Math.max(0, Math.min(n-1, Math.floor((1-d)*n)));
}
let strokeCount = 0;
function newStroke(){
  strokeCount++;
  return { pts:[], t0: (strokeCount*.137 + Math.random()*.08) % 1, pal:S.palette, cs: S.palette==='custom' ? [S.c1,S.c2,S.c3] : null,
    brush:S.brush, width:S.width, stamp:S.stamp, inst:S.inst, track:S.cur, ch: S.arp !== 'off' && S.chord === 'single' ? 'triad' : S.chord, notes:[], pulse:1, dirty:true, born:performance.now(), band:1, seed: Math.random()*1000|0 };
}
function addPoint(st, lx, ly, now, silent){
  const p = st.pts, last = p[p.length-1];
  if (p.length > 900) return;
  if (last && Math.hypot(lx-last[0], ly-last[1]) < 3) return;
  if (Math.hypot(lx, ly) > maxR()) return;
  p.push([lx, ly]); st.born = now; st.dirty = true;
  st.movedAt = now;
  if (silent || !S.sing) return;
  if (p.length === 1){ noteHere(st, lx, ly, now); return; }   // a new click always sounds
  if (now - lastNote > 110){
    const i = idxAt(lx, ly);
    if (i !== lastIdx || (S.holdMode === 'repeat' && now - lastNote > 400)) noteHere(st, lx, ly, now);
  }
}
function recordNote(st, i, panPos, b, ch){
  if (!S.rec || st.noRec) return null;
  const L = trackLoopLen(trackOf(st)); if (b === undefined){ b = beatsAt(ac.currentTime); if (S.quant) b = Math.round(b*S.grid)/S.grid; }
  const note = { b: ((b % L) + L) % L, cyc: Math.floor(b/L), i, pi: st.pts.length-1, pan: +panPos.toFixed(2), ch: ch || S.chord };
  st.notes.push(note); return note;
}
function closeHeldNote(st){
  if (!st.heldNote) return;
  let d = beatsAt(ac.currentTime) - st.heldStart;
  if (S.quant) d = Math.round(d*S.grid)/S.grid;
  st.heldNote.d = Math.max(1/S.grid, Math.min(d, LB()));
  st.heldNote = null;
}
function noteHere(st, lx, ly, now, b){
  const p = st.pts, i = idxAt(lx, ly), panPos = Math.max(-.7, Math.min(.7, lx / maxR()));
  if (S.arp !== 'off' && isActive(st)){ st.arpBase = i; st.arpPan = panPos; lastIdx = i; lastNote = now; return; }   // the arpeggiator plays it on the grid
  const sustain = S.holdMode === 'sustain' && isActive(st);
  if (sustain && S.glide && !DRUM_INSTS.has(instOf(st)) && st.held && !st.held.done){
    // glide: bend the note that is already sounding instead of starting a new one
    glideHeld(st.held, i); closeHeldNote(st);
    const note = recordNote(st, i, panPos, b); if (note) note.gl = 1;
    st.heldNote = note; st.heldStart = beatsAt(ac.currentTime);
    lastIdx = i; lastNote = now; st.pulse = 1; st.noteAt = now; spark(st, p.length-1, 3);
    return;
  }
  finishHeld(st);
  const h = voice(instOf(st), i, .34, undefined, panPos, sustain ? Infinity : undefined, undefined, st.track);
  lastIdx = i; lastNote = now; st.pulse = 1; st.noteAt = now; lightTones(st, null, trackStrum(trackOf(st)));
  const note = recordNote(st, i, panPos, b);
  if (sustain){ st.held = h; st.heldNote = note; st.heldStart = beatsAt(ac.currentTime); }
  spark(st, p.length-1, 5);
}
// each chord tone of a stroke (0 = the line itself, 1.. = its chord lines) lights when that tone sounds
const trackStrum = t => t && t.strum !== undefined ? (t.id === S.cur ? S.strum : t.strum) : S.strum;
function lightTones(st, ks, strum = 0){
  if (!st.ch || st.ch === 'single' || !CHORDS[st.ch]) return;
  const now = performance.now(); if (!st.tone) st.tone = [];
  if (!ks) ks = chordIdx(0, st.ch).map((_, k) => k);
  ks.forEach((k, j) => st.tone[k] = now + j*strum); st.toneAt = now + (ks.length - 1)*strum;
}
function toneF(st, k, now){
  const t = st.tone[k], v = t === undefined || now < t ? .22 : .22 + .78*Math.max(0, 1 - (now - t)/520);
  const back = Math.max(0, Math.min(1, (now - st.toneAt - 1400)/600));   // after a quiet moment the whole chord shows again
  return v + (1 - v)*back;
}
function finishHeld(st){
  if (!st.held) return;
  release(st.held); closeHeldNote(st);
  st.held = null;
}
/* Holding still repeats the note on every grid step (1/4, 1/8 or 1/16), so a long press becomes a rhythm */
let tapHold = null;
setInterval(() => {
  if (!ac) return;
  const now = performance.now(), g = Math.floor(beatsAt(ac.currentTime)*S.grid);
  // holding still keeps drawing: a spiral grows around the held point (and turns with the mandala)
  for (const st of active.values()){
    if (st.sx === undefined) continue;
    const still = now - (st.realMovedAt || now);
    if (still < 180){ st.spinR = 0; continue; }
    st.spinA = (st.spinA || Math.random()*TAU) + .085;
    st.spinR = Math.min(46, (st.spinR || 2) + .32);
    const [lx, ly] = toLocal(st.sx + Math.cos(st.spinA)*st.spinR, st.sy + Math.sin(st.spinA)*st.spinR);
    addPoint(st, lx, ly, now, true);
  }
  if (S.sing) for (const st of active.values()){
    const p = st.pts; if (!p.length) continue;
    if (st.held){ st.pulse = Math.max(st.pulse, .55); continue; }
    if (S.arp !== 'off'){
      if (st.arpBase == null || st.arpStep === g) continue;
      st.arpStep = g; const list = chordIdx(st.arpBase, S.chord === 'single' ? 'triad' : S.chord);
      const ak = arpIndex(st.arpN = (st.arpN ?? -1) + 1, list.length), i = list[ak];
      voice(instOf(st), i, .34, undefined, st.arpPan, undefined, 'single', st.track);
      const an = recordNote(st, i, st.arpPan, g/S.grid, 'single'); if (an) an.ak = ak; lightTones(st, [ak]); st.pulse = 1; st.noteAt = now; spark(st, p.length-1, 3);
      continue;
    }
    if (S.holdMode !== 'repeat') continue;
    if (now - (st.realMovedAt||0) < 160 || now - (st.noteAt||0) < 90) continue;
    if (st.holdStep === g) continue;
    st.holdStep = g; const q = p[p.length-1];
    noteHere(st, q[0], q[1], now, g/S.grid);
    st.width = Math.min(st.width*1.03, 14); st.dirty = true;   // the dot swells while you hold
  }
  if (tapHold && S.arp !== 'off' && tapHold.step !== g){
    tapHold.step = g; const list = chordIdx(tapHold.i, S.chord === 'single' ? 'triad' : S.chord);
    const i = list[arpIndex(tapHold.n = (tapHold.n ?? -1) + 1, list.length)];
    voice(S.inst, i, .5, undefined, tapHold.pan, undefined, 'single');
    ripples.push({ x:tapHold.x, y:tapHold.y, r:0, life:.7, t:i/20 });
  } else if (tapHold && !tapHold.h && tapHold.step !== g && now - tapHold.t > 160){
    tapHold.step = g; voice(S.inst, tapHold.i, .5, undefined, tapHold.pan);
    ripples.push({ x:tapHold.x, y:tapHold.y, r:0, life:1, t:tapHold.i/20 });
  }
}, 15);
function arpIndex(n, len){
  if (len < 2) return 0;
  switch (S.arp){
    case 'down': return len - 1 - n % len;
    case 'updown': { const p = n % (2*len - 2); return p < len ? p : 2*len - 2 - p; }
    case 'random': return Math.random()*len | 0;
    default: return n % len;
  }
}
function spark(st, pi, n, speed=1){
  const p = visPts(st)[pi]; if (!p) return;
  const col = rgbStr(strokeRGB(st, 0, .6));
  for (let k=0;k<n;k++){ const a=Math.random()*TAU, v=(.4+Math.random()*1.4)*speed;
    sparks.push({ x:p[0], y:p[1], vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:1, col }); }
  if (sparks.length > 140) sparks.splice(0, sparks.length-140);
}

cv.addEventListener('pointerdown', e => {
  ensureAudio();
  if (tool !== 'draw'){ try { cv.setPointerCapture(e.pointerId); } catch {} toolDown(e); return; }
  if (!S.draw){
    const [lx, ly] = toLocal(e.clientX, e.clientY), i = idxAt(lx, ly);
    const pn = Math.max(-.7, Math.min(.7, lx/maxR()));
    const th = S.arp !== 'off' ? null : voice(S.inst, i, .6, undefined, pn, S.holdMode === 'sustain' ? Infinity : undefined);
    ripples.push({ x:e.clientX, y:e.clientY, r:0, life:1, t:i/20 });
    if (S.holdMode === 'sustain') try { cv.setPointerCapture(e.pointerId); } catch {}
    if (S.arp !== 'off') try { cv.setPointerCapture(e.pointerId); } catch {}
    tapHold = { id:e.pointerId, x:e.clientX, y:e.clientY, i, pan:pn, h:th, t:performance.now(), step: ac ? Math.floor(beatsAt(ac.currentTime)*S.grid) : 0 };
    return;
  }
  try { cv.setPointerCapture(e.pointerId); } catch {}
  // the circle is the instrument: outside it nothing draws, and a stroke picks up again when you come back in
  if (outside(e.clientX, e.clientY)){ waiting.add(e.pointerId); return; }
  startStroke(e.pointerId, e.clientX, e.clientY);
});
const waiting = new Set();
const outside = (x, y) => { const [lx, ly] = toLocal(x, y); return Math.hypot(lx, ly) > maxR(); };
function startStroke(id, x, y){
  pushHistory();
  const st = newStroke(); strokes.push(st); active.set(id, st);
  st.sx = x; st.sy = y; st.realMovedAt = performance.now();
  if (strokes.length > 60){ const j = strokes.findIndex(q => !q.notes.length && q !== st); if (j >= 0) strokes.splice(j, 1); else if (strokes.length > 200) strokes.shift(); }
  addPoint(st, ...toLocal(x, y), performance.now());
  return st;
}
function closeStroke(id){
  const st = active.get(id); if (!st) return;
  finishHeld(st); active.delete(id);
  if (st.pts.length < 2){ st.pts.push([st.pts[0][0]+.5, st.pts[0][1]+.5]); st.dirty = true; }
}
cv.addEventListener('pointermove', e => {
  if (toolOp){ toolMoveEv(e); return; }
  if (tool !== 'draw') return;
  if (tapHold && tapHold.id === e.pointerId && tapHold.h && S.glide && !DRUM_INSTS.has(S.inst)){
    const [lx, ly] = toLocal(e.clientX, e.clientY), i = idxAt(lx, ly);
    if (i !== tapHold.i){ tapHold.i = i; glideHeld(tapHold.h, i); ripples.push({ x:e.clientX, y:e.clientY, r:0, life:.6, t:i/20 }); }
    return;
  }
  if (!active.has(e.pointerId) && !waiting.has(e.pointerId)) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of evs){
    const out = outside(ev.clientX, ev.clientY);
    let st = active.get(e.pointerId);
    if (st && out){ addEdge(st, ev.clientX, ev.clientY); closeStroke(e.pointerId); waiting.add(e.pointerId); continue; }
    if (!st){ if (out) continue; waiting.delete(e.pointerId); st = startStroke(e.pointerId, ev.clientX, ev.clientY); continue; }
    if (Math.hypot(ev.clientX - st.sx, ev.clientY - st.sy) > 2){ st.sx = ev.clientX; st.sy = ev.clientY; st.realMovedAt = performance.now(); }
    addPoint(st, ...toLocal(ev.clientX, ev.clientY), performance.now());
  }
});
// leaving the circle: finish the line exactly on the edge
function addEdge(st, x, y){ const [lx, ly] = toLocal(x, y), d = Math.hypot(lx, ly) || 1, R = maxR()*.999; addPoint(st, lx*R/d, ly*R/d, performance.now(), true); }
function endStroke(e){
  if (toolOp){ toolUp(); return; }
  if (tapHold && tapHold.id === e.pointerId){ release(tapHold.h); tapHold = null; }
  waiting.delete(e.pointerId);
  closeStroke(e.pointerId);
}
cv.addEventListener('pointerup', endStroke); cv.addEventListener('pointercancel', endStroke);
const isActive = st => { for (const v of active.values()) if (v===st) return true; return false; };
/* ---- Undo / redo: snapshots of the drawing and its recorded notes ---- */
const undoStack = [], redoStack = [];
const snapNow = () => ({ list: strokes.slice(), notes: strokes.map(s => s.notes.slice()), tracks: S.tracks.slice(), cur: S.cur, bars: S.bars });
function dropSel(){ if (typeof tlSel !== 'undefined' && tlSel.size){ tlSel.clear(); syncTlBtns(); } }
function pushHistory(){ undoStack.push(snapNow()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; dirtySession = true; }
function restoreSnap(sn){
  const now = performance.now();
  strokes.length = 0; sn.list.forEach((s, i) => { s.notes = sn.notes[i]; s.born = now; s.notes.forEach(n => n.cyc = -1); strokes.push(s); });
  if (sn.tracks && (sn.tracks.length !== S.tracks.length || sn.tracks.some((t, i) => t !== S.tracks[i]))){
    stashTrack(); S.tracks = sn.tracks.slice(); S.cur = trk(sn.cur) ? sn.cur : trk(S.cur) ? S.cur : S.tracks[0].id;
    loadTrack(curT()); syncUI(); syncInst(); renderTracks(); updateMix(); updateMeta(); trackHead(); syncTrackTools();
  }
  if (sn.bars && sn.bars !== S.bars){ S.bars = sn.bars; $('barsSel').value = S.bars; }
  dropSel(); lanesAt = 0; mixSig = ''; dirtySession = true;
}
function undo(){ if (!undoStack.length){ toast('Nothing to undo'); return; } redoStack.push(snapNow()); restoreSnap(undoStack.pop()); toast('Undo'); }
function redo(){ if (!redoStack.length){ toast('Nothing to redo'); return; } undoStack.push(snapNow()); restoreSnap(redoStack.pop()); toast('Redo'); }
$('tUndo').onclick = undo;
$('tRedo').onclick = redo;
let clearArmed = 0;
function disarmClear(){ clearArmed = 0; $('tClear').classList.remove('armed'); setLbl($('tClear'), '✕ Clear'); }
$('tClear').onclick = () => {
  if (!strokes.length){ toast('Nothing to clear'); return; }
  if (!clearArmed){ clearArmed = setTimeout(disarmClear, 3000); $('tClear').classList.add('armed'); setLbl($('tClear'), '✕ Clear All?'); fitTop(); toast('Click Clear again to erase everything'); return; }
  clearTimeout(clearArmed); disarmClear(); pushHistory(); strokes.length = 0; sparks.length = 0; presetName = null; dropSel(); updateMeta(); renderPresets(); toast('Cleared · Undo to bring it back'); };

/* ---- Generative drawing ---- */
const SHAPES = [
  (u,R,r) => [u*TAU/S.sym*1.6, R*(.12 + .85*u)],
  (u,R,r) => [u*TAU/S.sym, R*(.35 + .55*Math.abs(Math.sin(u*Math.PI*r.a)))],
  (u,R,r) => [u*TAU/S.sym, R*(.55 + .22*Math.sin(u*TAU*r.a + r.ph))],
  (u,R,r) => { const x = R*(.2 + .7*u), y = R*.22*Math.sin(u*Math.PI*r.b); return [Math.atan2(y,x), Math.hypot(x,y)]; },
  (u,R,r) => [Math.sin(u*Math.PI)*TAU/S.sym*.5, R*(.1 + .85*Math.sin(u*Math.PI*.5))]
];
function demoStroke(silent, shapeIdx){
  const R = maxR()*(.55 + Math.random()*.4), r = { a: 1+Math.random()*3|0, b: 1+Math.random()*3|0, ph: Math.random()*TAU };
  const f = SHAPES[shapeIdx ?? (Math.random()*SHAPES.length|0)], st = newStroke(); strokes.push(st);
  const N = 80; let i = 0;
  const id = setInterval(() => {
    const [a, rr] = f(i/N, R, r);
    addPoint(st, Math.cos(a)*rr, Math.sin(a)*rr, performance.now(), silent);
    if (++i > N) clearInterval(id);
  }, 14);
  return st;
}

/* ================= Audio analysis ================= */
let bass=0, mid=0, high=0, beat=0, lastBeat=0, slowB=0, pk={b:.15,m:.12,h:.08}, rawB=0;
function bands(now, dt){
  if (!analyser){ bass*=.95; mid*=.95; high*=.95; beat*=.9; return; }
  analyser.getByteFrequencyData(freqData); if (S.viz === 'wave') analyser.getByteTimeDomainData(timeData);
  const avg=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=freqData[i];return s/((b-a)*255)};
  rawB = avg(1,12); const rm = avg(12,90), rh = avg(90,400);
  pk.b = Math.max(rawB, pk.b*.996, .06); pk.m = Math.max(rm, pk.m*.996, .05); pk.h = Math.max(rh, pk.h*.996, .03);
  const nb = rawB < .02 ? 0 : Math.pow(rawB/pk.b, 1.6), nm = rm < .015 ? 0 : Math.pow(rm/pk.m, 1.4), nh = rh < .01 ? 0 : Math.pow(rh/pk.h, 1.3);
  bass += (nb - bass)*(nb > bass ? .6 : .18); mid += (nm - mid)*.3; high += (nh - high)*.35;
  const energy = rawB + rm*.6, flux = energy - slowB; slowB = slowB*.9 + energy*.1;
  if (flux > Math.max(.03, pk.b*.1) && now - lastBeat > 150){ beat = 1; lastBeat = now; onBeat(); }
  beat *= Math.pow(.86, dt/16.7);
}
function onBeat(){
  const r = S.react/100; if (!r) return;
  colorShift += .045*r;
  if (S.viz === 'pulse') pulses.push({ r: maxR()*.15, life: 1 });
  if (!S.beatFx) return;
  const live = strokes.filter(s => s.pts.length > 4);
  for (let k=0;k<Math.min(3, live.length);k++){ const st = live[Math.random()*live.length|0]; st.pulse = Math.max(st.pulse, .8); spark(st, Math.random()*st.pts.length|0, 3, 1.6); }
}

/* ================= Stroke color ================= */
function strokeRGB(st, k, glow, n = S.sym){
  const tk = st.track !== undefined ? trackOf(st) : null;   // spread, drift and brightness belong to the stroke's track
  const spread = (+trackVal(tk, 'spread') || 0)/100, drift = trackVal(tk, 'drift') ? frameNow*.00003 : 0;
  let t = st.t0 + (k/n)*spread*.6 + drift + colorShift + mid*.08*(S.react/100);
  if (tk && trackVal(tk, 'pitchCol')){ const pt = pitchT(st); t = (st.pal === 'rainbow' ? pt*.85 : pt*.5) + (k/n)*spread*.08 + drift*.3; }   // each ring has its own color
  let c;
  if (st.pal === 'rainbow') c = hsl2rgb(t*360, 88, LIGHT ? 45 : 60);
  else if (st.pal === 'custom') c = sample((st.cs || [S.c1,S.c2,S.c3]).map(hexRGB), t);
  else c = sample(STOPS[st.pal] || STOPS.aurora, t);
  const b = (+trackVal(tk, 'bright') || 100)/100;
  if (LIGHT){ const d = .25 + glow*.15; c = c.map(v => v*(1-d)*Math.min(1,b+.2)); }
  else { const w = Math.min(.6, glow*.3); c = c.map(v => Math.min(255, (v + (255-v)*w)*b)); }
  return c;
}
// where a stroke sits in pitch, 0 = lowest ring, 1 = highest
function pitchT(st){
  const sig = st.notes.length + '|' + st.pts.length; if (st._ptSig === sig) return st._pt;
  const N = SCALES[S.scale].length*3; let v;
  if (st.notes.length) v = st.notes.reduce((a, n) => a + n.i, 0)/st.notes.length/(N - 1);
  else { let rs = 0; for (const q of st.pts) rs += Math.hypot(q[0], q[1]); v = 1 - Math.min(1, rs/Math.max(1, st.pts.length)/maxR()); }
  st._ptSig = sig; st._pt = Math.max(0, Math.min(1, v)); return st._pt;
}
function paletteRGB(t){
  const fake = { t0: t, pal: S.palette, cs: [S.c1,S.c2,S.c3] };
  const save = S.spread; S.spread = 0; const c = strokeRGB(fake, 0, .2); S.spread = save; return c;
}

