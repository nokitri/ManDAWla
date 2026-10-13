/* ================= Strokes ================= */
const strokes = [], active = new Map(), sparks = [], ripples = [];
let rot = 0, lastNote = 0, lastIdx = -1, tunnelPhase = 0, colorShift = 0, frameNow = 0;
const CY = () => H/2 - Math.min(30, H*.03);
const maxR = () => Math.min(W,H)*.46;
const fieldR = () => Math.hypot(W, H)*.5;   // the whole screen is drawable, out to the corners
const scaleN = () => SCALES[S.scale].length*3;
function toLocal(x, y){
  const dx = x - W/2, dy = y - CY(), c = Math.cos(-rot), s = Math.sin(-rot);
  return [dx*c - dy*s, dx*s + dy*c];
}
// pitch spans the whole screen: corners low, centre high
const idxAt = (lx, ly) => Math.max(0, Math.min(scaleN() - 1, Math.floor((1 - Math.min(1, Math.hypot(lx, ly)/fieldR()))*scaleN())));
const panAt = lx => Math.max(-.7, Math.min(.7, lx/maxR()));
let strokeCount = 0;
function newStroke(){
  strokeCount++;
  return { pts:[], t0: (strokeCount*.137 + Math.random()*.08) % 1, brush:S.brush, width:S.width, stamp:S.stamp,
    ch: S.arp !== 'off' && S.chord === 'single' ? 'triad' : S.chord, pulse:1, dirty:true, band:1, seed: Math.random()*1000|0 };
}
function addPoint(st, lx, ly, now, silent){
  const p = st.pts, last = p[p.length-1];
  if (p.length > 900) return;
  if (last && Math.hypot(lx-last[0], ly-last[1]) < 3) return;
  p.push([lx, ly]); st.dirty = true;
  if (silent) return;
  if (p.length === 1){ noteHere(st, lx, ly, now); return; }   // a new click always sounds
  if (now - lastNote > 110){
    const i = idxAt(lx, ly);
    if (i !== lastIdx || (S.holdMode === 'repeat' && now - lastNote > 400)) noteHere(st, lx, ly, now);
  }
}
function noteHere(st, lx, ly, now){
  const i = idxAt(lx, ly), pn = panAt(lx), live = !!st.id;   // id is set while the pointer is still down
  lastIdx = i; lastNote = now; st.pulse = 1; st.noteAt = now;
  if (S.arp !== 'off' && live){ st.arpBase = i; st.arpPan = pn; return; }   // the arpeggiator plays it on the beat
  const sustain = S.holdMode === 'sustain' && live;
  if (sustain && S.glide && !DRUM_INSTS.has(S.inst) && st.held && !st.held.done){ glideHeld(st.held, i); spark(st, st.pts.length-1, 3); return; }   // bend the note that is already sounding
  finishHeld(st);
  const h = voice(S.inst, i, .34, undefined, pn, sustain ? Infinity : undefined);
  if (sustain) st.held = h;
  lightTones(st, null, S.strum); spark(st, st.pts.length-1, 5);
}
// each chord tone of a stroke (0 = the line itself, 1.. = its chord lines) lights when that tone sounds
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
function finishHeld(st){ if (st.held){ release(st.held); st.held = null; } }
/* Holding still: a spiral grows around the held point, and the arpeggiator or "repeat" steps on the beat grid */
setInterval(() => {
  if (!ac || !active.size) return;
  const now = performance.now(), g = Math.floor(beatsAt(ac.currentTime)*S.grid);
  for (const st of active.values()){
    const p = st.pts, still = now - st.movedAt;
    if (still < 180) st.spinR = 0;
    else {
      st.spinA = (st.spinA || Math.random()*TAU) + .085; st.spinR = Math.min(46, (st.spinR || 2) + .32);
      addPoint(st, ...toLocal(st.sx + Math.cos(st.spinA)*st.spinR, st.sy + Math.sin(st.spinA)*st.spinR), now, true);
    }
    if (st.held){ st.pulse = Math.max(st.pulse, .55); continue; }
    if (S.arp !== 'off'){
      if (st.arpBase == null || st.arpStep === g) continue;
      st.arpStep = g; const list = chordIdx(st.arpBase, S.chord === 'single' ? 'triad' : S.chord), ak = arpIndex(st.arpN = (st.arpN ?? -1) + 1, list.length);
      voice(S.inst, list[ak], .34, undefined, st.arpPan, undefined, 'single'); lightTones(st, [ak]); st.pulse = 1; spark(st, p.length-1, 3);
    }
    else if (S.holdMode === 'repeat' && still >= 160 && now - (st.noteAt||0) >= 90 && st.holdStep !== g){
      st.holdStep = g; const q = p[p.length-1]; noteHere(st, q[0], q[1], now);
      st.width = Math.min(st.width*1.03, 14); st.dirty = true;   // the dot swells while you hold
    }
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


let strokeId = 0;
cv.addEventListener('pointerdown', e => {
  ensureAudio(); try { cv.setPointerCapture(e.pointerId); } catch {}
  pushHistory();
  const st = newStroke(); st.id = ++strokeId; strokes.push(st); active.set(e.pointerId, st);
  st.sx = e.clientX; st.sy = e.clientY; st.movedAt = performance.now();
  if (strokes.length > 60) strokes.splice(0, strokes.length - 60);
  addPoint(st, ...toLocal(e.clientX, e.clientY), performance.now());
});
cv.addEventListener('pointermove', e => {
  const st = active.get(e.pointerId); if (!st) return;
  for (const ev of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]){
    if (Math.hypot(ev.clientX - st.sx, ev.clientY - st.sy) > 2){ st.sx = ev.clientX; st.sy = ev.clientY; st.movedAt = performance.now(); }
    addPoint(st, ...toLocal(ev.clientX, ev.clientY), performance.now());
  }
});
function endStroke(e){
  const st = active.get(e.pointerId); if (!st) return;
  finishHeld(st); active.delete(e.pointerId); st.id = 0;
  if (st.pts.length < 2){ st.pts.push([st.pts[0][0]+.5, st.pts[0][1]+.5]); st.dirty = true; }
}
cv.addEventListener('pointerup', endStroke); cv.addEventListener('pointercancel', endStroke);
/* ---- Undo: snapshots of the stroke list ---- */
const undoStack = [];
function pushHistory(){ undoStack.push(strokes.slice()); if (undoStack.length > 60) undoStack.shift(); }
function undo(){
  if (!undoStack.length){ toast('Nothing to undo'); return; }
  strokes.length = 0; strokes.push(...undoStack.pop()); strokes.forEach(s => s.endT = undefined); toast('Undo');
}
$('tUndo').onclick = undo;
let clearArmed = 0;
function disarmClear(){ clearArmed = 0; $('tClear').classList.remove('armed'); setLbl($('tClear'), '✕ Clear'); }
$('tClear').onclick = () => {
  if (!strokes.length){ toast('Nothing to clear'); return; }
  if (!clearArmed){ clearArmed = setTimeout(disarmClear, 3000); $('tClear').classList.add('armed'); setLbl($('tClear'), '✕ Clear All?'); fitTop(); toast('Click Clear again to erase everything'); return; }
  clearTimeout(clearArmed); disarmClear(); pushHistory(); strokes.length = 0; sparks.length = 0; toast('Cleared · Undo to bring it back'); };

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
let bass=0, mid=0, high=0, beat=0, lastBeat=0, slowB=0, pk={b:.15,m:.12,h:.08};
function bands(now, dt){
  if (!analyser){ bass*=.95; mid*=.95; high*=.95; beat*=.9; return; }
  analyser.getByteFrequencyData(freqData);
  const avg=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=freqData[i];return s/((b-a)*255)};
  const rb = avg(1,12), rm = avg(12,90), rh = avg(90,400);
  pk.b = Math.max(rb, pk.b*.996, .06); pk.m = Math.max(rm, pk.m*.996, .05); pk.h = Math.max(rh, pk.h*.996, .03);
  const nb = rb < .02 ? 0 : Math.pow(rb/pk.b, 1.6), nm = rm < .015 ? 0 : Math.pow(rm/pk.m, 1.4), nh = rh < .01 ? 0 : Math.pow(rh/pk.h, 1.3);
  bass += (nb - bass)*(nb > bass ? .6 : .18); mid += (nm - mid)*.3; high += (nh - high)*.35;
  const energy = rb + rm*.6, flux = energy - slowB; slowB = slowB*.9 + energy*.1;
  if (flux > Math.max(.03, pk.b*.1) && now - lastBeat > 150){ beat = 1; lastBeat = now; onBeat(); }
  beat *= Math.pow(.86, dt/16.7);
}
function onBeat(){
  const r = S.react/100; if (!r) return;
  colorShift += .045*r;
  const live = strokes.filter(s => s.pts.length > 4);
  for (let k=0;k<Math.min(3, live.length);k++){ const st = live[Math.random()*live.length|0]; st.pulse = Math.max(st.pulse, .8); spark(st, Math.random()*st.pts.length|0, 3, 1.6); }
}

/* ================= Stroke color ================= */
// every stroke is a shade of the interface colour, shifting along its copies, with the music and over time
function paletteRGB(t, k = 0, glow = .2, n = S.sym){
  t += (k/n)*S.spread/100*.6 + (S.drift ? frameNow*.00003 : 0) + colorShift + mid*.08*(S.react/100);
  const w = Math.min(.6, glow*.3), b = S.bright/100;
  return sample(UI_STOPS, t).map(v => Math.min(255, (v + (255-v)*w)*b));
}
const strokeRGB = (st, k, glow, n) => paletteRGB(st.t0, k, glow, n);
