/* ================= Rendering ================= */
function copyMatrices(C){
  const base = ctx.getTransform(), D = 180/Math.PI;
  return C.map(c => {
    let m = base;
    if (c.px || c.py) m = m.translate(c.px, c.py);
    m = m.rotate(c.r*D); if (c.tx) m = m.translate(c.tx, 0); if (c.r2) m = m.rotate(c.r2*D);
    if (c.f < 0) m = m.scale(1,-1); if (c.fx < 0) m = m.scale(-1,1);
    return m.scale(c.s, c.s*c.sy);
  });
}
const CORE = 'rgba(255,252,245,.08)';   // a faint hot core, so strokes keep their colour instead of going white
function drawStrokes(C, M, now){
  const re = S.react/100, nSym = S.sym, breathe = 1 + bass*.02*re, lv = [bass, mid, high];
  const cols = new Array(16), mains = new Array(16);
  // crowded screens get gentler strokes so the glow doesn't wash out to white
  const dens = Math.max(.42, Math.min(1, 1.12 - strokes.length*C.length/900));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let si = strokes.length-1; si >= 0; si--){
    const st = strokes[si];
    let life = 1;
    // strokes fade away S.stay seconds after you lift the pointer (0: they stay for good)
    if (!st.id && S.stay !== 0){
      if (st.endT === undefined) st.endT = now;
      const age = now - st.endT, hold = S.stay*1000 - 1000;
      if (age > hold + 1000){ strokes.splice(si,1); continue; }
      if (age > hold) life = 1 - (age - hold)/1000;
    }
    if (st.pts.length < 2) continue;
    // a stroke being drawn rebuilds at most every 45 ms instead of every frame
    if (st.dirty && (!st.path || !st.id || st.builtFor !== st.brush || now - (st.builtAt||0) > 45)){ build(st); st.builtAt = now; }
    st.pulse *= .95;
    const e = lv[st.band]*re, glow = st.pulse + e*.9 + beat*.4*re;
    const lw = st.width*(1 + e*.3) + st.pulse*.6, sc = breathe;
    const al = Math.min(1, .7 + glow*.15), twinkle = st.brush === 'stars';
    cols.fill(undefined); mains.fill(undefined);
    const TF = st.tone && st.chordPaths && now - st.toneAt < 2000 ? [0, ...st.chordPaths.map((_, j) => j + 1)].map(k => toneF(st, k, now)) : null;
    for (let ci=0; ci<C.length; ci++){
      const c = C[ci], m = M[ci], k = c.k % nSym;
      ctx.setTransform(m.a*sc, m.b*sc, m.c*sc, m.d*sc, m.e, m.f);
      let a = life * c.a * dens;
      if (twinkle) a *= .4 + .6*Math.abs(Math.sin(now*.005 + ci*1.7 + high*3));
      a = a > 1 ? 1 : a < 0 ? 0 : a;
      if (cols[k] === undefined){
        cols[k] = rgbStr(strokeRGB(st, k, glow, nSym)); mains[k] = `rgba(${cols[k]},${al})`;
      }
      ctx.globalAlpha = TF ? Math.min(1, a*TF[0]) : a;
      drawBrush(ctx, st, cols[k], al, lw, e, glow, now, CORE, mains[k]);
      if (st.chordPaths){   // chord strokes: one thinner line per extra chord note
        ctx.strokeStyle = mains[k]; ctx.lineWidth = Math.max(.8, lw*.6);
        st.chordPaths.forEach((cp, j) => { ctx.globalAlpha = TF ? Math.min(1, a*TF[j + 1]) : a; ctx.stroke(cp); });
      }
    }
  }
  ctx.globalAlpha = 1;
}
let hoverXY = null;
cv.addEventListener('pointermove', e => { hoverXY = [e.clientX, e.clientY]; }, { passive:true });
cv.addEventListener('pointerleave', () => { hoverXY = null; });
// cursor echo: a ring where every mirrored copy of the brush will land, plus dots for chord notes
function drawCursor(M){
  const [lx, ly] = toLocal(hoverXY[0], hoverXY[1]);
  const c = rgbStr(paletteRGB(.2)), d0 = Math.hypot(lx, ly) || 1, step = maxR()/scaleN();
  const extra = S.chord !== 'single' ? chordIdx(0, S.chord).filter(o => o).map(o => Math.max(2, d0 - o*step)/d0) : [];
  const k = new DOMMatrix([FXDPR/DPR,0,0,FXDPR/DPR,0,0]);
  ctx.strokeStyle = `rgba(${c},.9)`; ctx.fillStyle = `rgba(${c},.9)`;
  for (const m of M){
    const sc = Math.hypot(m.a, m.b)/DPR || 1; ctx.setTransform(k.multiply(m));
    ctx.lineWidth = 1.4/sc; ctx.beginPath(); ctx.arc(lx, ly, 5/sc, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx, ly, 1.6/sc, 0, TAU);
    for (const f of extra){ ctx.moveTo(lx*f + 2.4/sc, ly*f); ctx.arc(lx*f, ly*f, 2.4/sc, 0, TAU); }
    ctx.fill();
  }
}
let t0 = performance.now(), frameN = 0, ema = 16, lastQ = 0;
function frame(now){
  requestAnimationFrame(frame);   // queued first, so one bad frame can't stop the animation
  const raw = now - t0, dt = Math.min(50, raw); t0 = now; frameNow = now; frameN++;
  // adaptive quality: watch the average frame time and trade resolution for smoothness
  if (raw < 200) ema = ema*.94 + raw*.06;
  if (now - lastQ > 2500 && !document.hidden){
    if (ema > 24 && QUALITY > .5){ QUALITY = Math.max(.5, QUALITY - .15); lastQ = now; resize(); }
    else if (ema < 15 && QUALITY < 1){ QUALITY = Math.min(1, QUALITY + .1); lastQ = now; resize(); }
  }
  bands(now, dt);
  rot += (reduce ? .00004 : .00007)*dt;   // a slow, steady turn
  tunnelPhase = (tunnelPhase + dt*.00007) % 1;

  // the drawing layer fades a little every frame, which leaves the trails
  ctx = mainCtx;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${reduce ? .5 : .42 - S.trail/100*.38})`; ctx.fillRect(0,0,W,H);
  if (frameN % 12 === 0){ ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0,0,W,H); }   // clears the faint residue a slow fade leaves behind
  ctx.save(); ctx.translate(W/2, CY()); ctx.rotate(rot);
  ctx.globalCompositeOperation = 'screen';   // screen, not lighter: overlaps glow without burning to white
  const C = copies(now), M = copyMatrices(C);
  drawStrokes(C, M, now);
  ctx.restore();

  // FX layer: redrawn from scratch every frame, so glows never pile up
  ctx = fxCtx;
  ctx.setTransform(FXDPR,0,0,FXDPR,0,0); ctx.clearRect(0,0,W,H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i=ripples.length-1;i>=0;i--){
    const p = ripples[i]; p.r += dt*.35; p.life -= dt*.0009;
    if (p.life<=0){ ripples.splice(i,1); continue; }
    ctx.strokeStyle = `rgba(${rgbStr(paletteRGB(p.t))},${p.life*.8})`; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k=0;k<=S.sym;k++){ const a = k*TAU/S.sym + p.r*.004; ctx.lineTo(p.x+Math.cos(a)*p.r, p.y+Math.sin(a)*p.r); }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  if (hoverXY && !active.size) drawCursor(M);
  ctx = mainCtx;
}
