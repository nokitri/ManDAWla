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
const CORE = 'rgba(255,252,245,.22)';   // a faint hot core, so strokes keep their colour instead of going white
function drawStrokes(C, M, now){
  const re = S.react/100, nSym = S.sym, breathe = 1 + (bass*.05 + beat*.08)*re, lv = [bass, mid, high];
  const cols = new Array(16), mains = new Array(16), zs = zoneSig();
  // crowded screens get gentler strokes so the glow doesn't wash out to white
  const dens = Math.max(.42, Math.min(1, 1.12 - strokes.length*C.length/900));
  // the visual effects, all applied together
  const V = { strobe:0, pulse:0, shimmer:0, rainbow:0, glow:0, spin:0, jitter:0, breathe:0 };
  for (const fx of S.vfxList) if (fx.type in V) V[fx.type] = Math.min(1.5, V[fx.type] + (fx.amt ?? 60)/100);
  const bt = ac ? beatsAt(ac.currentTime) : now/600;
  let op = S.alpha/100;
  if (V.strobe && (bt*S.grid) % 1 > .5) op *= Math.max(0, 1 - V.strobe);   // off on every other grid step
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
    if (st.zs !== zs){ st.zs = zs; st.dirty = true; }
    if (st.dirty && (!st.path || !st.id || now - (st.builtAt||0) > 45)){ build(st); st.builtAt = now; }
    st.pulse *= .95;
    const e = lv[st.band]*re, glow = st.pulse + e*.9 + beat*.4*re;
    let lw = st.width*(1 + e*1.1) + beat*1.6*re + st.pulse*2, sc = breathe*(1 + e*.05);
    if (V.pulse) sc *= 1 + V.pulse*.16*Math.pow(1 - bt % 1, 3);
    if (V.breathe) sc *= 1 + V.breathe*.12*Math.sin(now*.0018 + st.t0*9);
    if (V.glow) lw *= 1 + V.glow*.5;
    const al = Math.min(1, .62 + glow*.3), twinkle = st.brush === 'sparkle' || st.brush === 'stars';
    cols.fill(undefined); mains.fill(undefined);
    const TF = st.tone && st.chordPaths && now - st.toneAt < 2000 ? [0, ...st.chordPaths.map((_, j) => j + 1)].map(k => toneF(st, k, now)) : null;
    for (let ci=0; ci<C.length; ci++){
      const c = C[ci], m = M[ci], k = c.k % nSym;
      ctx.setTransform(m.a*sc, m.b*sc, m.c*sc, m.d*sc, m.e, m.f);
      if (V.spin) ctx.rotate(now*.0009*V.spin*(c.f < 0 ? -1 : 1));
      if (V.jitter) ctx.translate((Math.random() - .5)*10*V.jitter, (Math.random() - .5)*10*V.jitter);
      let a = life * c.a * dens * op;
      if (V.shimmer) a *= 1 - Math.min(1, V.shimmer)*.75*(.5 + .5*Math.sin(now*.013 + ci*1.9 + st.t0*20));
      if (twinkle) a *= .4 + .6*Math.abs(Math.sin(now*.005 + ci*1.7 + high*3));
      a = a > 1 ? 1 : a < 0 ? 0 : a;
      if (cols[k] === undefined){
        let rgb = strokeRGB(st, k, glow, nSym);
        if (V.rainbow){ const vr = Math.min(1, V.rainbow), c2 = hsl2rgb(((now*.00012*(1 + vr*3) + k/nSym) % 1)*360, 85, 62); rgb = rgb.map((v, i) => v*(1 - vr) + c2[i]*vr); }
        cols[k] = rgbStr(rgb); mains[k] = `rgba(${cols[k]},${al})`;
      }
      if (V.glow){ ctx.globalAlpha = a*.22*Math.min(1, V.glow); ctx.strokeStyle = mains[k]; ctx.lineWidth = lw*4; ctx.stroke(st.path); }
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
function drawSparks(C, M, dt){
  if (!sparks.length) return;
  for (let i=sparks.length-1;i>=0;i--){ const p=sparks[i]; p.x+=p.vx*dt*.06; p.y+=p.vy*dt*.06; p.vx*=.97; p.vy*=.97; p.life-=dt*.0012; if (p.life<=0) sparks.splice(i,1); }
  const step = Math.max(1, Math.ceil(C.length/24));
  for (const p of sparks) p.fs = p.fs || `rgb(${p.col})`;
  for (let ci=0; ci<C.length; ci+=step){
    ctx.setTransform(M[ci]);
    for (const p of sparks){ ctx.globalAlpha = p.life*C[ci].a; ctx.fillStyle = p.fs; ctx.fillRect(p.x-1, p.y-1, 2.2, 2.2); }
  }
  ctx.globalAlpha = 1;
}
let hoverXY = null;
cv.addEventListener('pointermove', e => { hoverXY = [e.clientX, e.clientY]; }, { passive:true });
cv.addEventListener('pointerleave', () => { hoverXY = null; });
// cursor echo: a ring where every mirrored copy of the brush will land, plus dots for chord notes
function drawCursor(M){
  const z = zoneOf(); let [lx, ly] = toLocal(hoverXY[0], hoverXY[1]); if (z) [lx, ly] = zoneMap(z, lx, ly);
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
  const raw = now - t0, dt = Math.min(50, raw); t0 = now; frameNow = now; frameN++;
  // adaptive quality: watch the average frame time and trade resolution for smoothness
  if (raw < 200) ema = ema*.94 + raw*.06;
  if (now - lastQ > 2500 && !document.hidden){
    if (ema > 24 && QUALITY > .5){ QUALITY = Math.max(.5, QUALITY - .15); lastQ = now; resize(); }
    else if (ema < 15 && QUALITY < 1){ QUALITY = Math.min(1, QUALITY + .1); lastQ = now; resize(); }
  }
  bands(now, dt);
  const re = S.react/100, sp = S.spin/100, sg = Math.sign(sp || 1);
  rot += (reduce ? .00004*sg : .00022*sp + (sp ? (mid*.0012 + beat*.0016)*re*sg : 0))*dt;
  tunnelPhase = (tunnelPhase + dt*.00007*(1 + bass*2.5*re)) % 1;
  if (!reduce) animBg(now, dt);

  // the drawing layer fades a little every frame, which leaves the trails
  ctx = mainCtx;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${reduce ? .5 : .42 - S.trail/100*.38})`; ctx.fillRect(0,0,W,H);
  if (frameN % 12 === 0){ ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0,0,W,H); }   // clears the faint residue a slow fade leaves behind
  ctx.save(); ctx.translate(W/2, CY()); ctx.rotate(rot);
  ctx.globalCompositeOperation = 'screen';   // screen, not lighter: overlaps glow without burning to white
  const C = copies(now), M = copyMatrices(C);
  drawStrokes(C, M, now); drawSparks(C, M, dt);
  ctx.restore();

  // FX layer: redrawn from scratch every frame, so glows never pile up
  ctx = fxCtx;
  ctx.setTransform(FXDPR,0,0,FXDPR,0,0); ctx.clearRect(0,0,W,H);
  ctx.globalCompositeOperation = 'lighter';
  const R = maxR()*(1 + (bass*.05 + beat*.05)*re), gc = rgbStr(paletteRGB(.1)), g = ctx.createRadialGradient(W/2,CY(),0,W/2,CY(),R*.65);
  g.addColorStop(0, `rgba(${gc},${.03 + bass*.12*re + beat*.08*re})`); g.addColorStop(1, `rgba(${gc},0)`);
  ctx.fillStyle = g; ctx.fillRect(W/2 - R, CY() - R, R*2, R*2);
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
  requestAnimationFrame(frame);
}
// effect lists: add as many as you like, drag the order with the arrows
function fxListUI(kind){
  const key = kind === 'a' ? 'afxList' : 'vfxList', names = kind === 'a' ? AFX_NAMES : VFX_NAMES, box = $(kind + 'FxList');
  if (!Array.isArray(S[key])) S[key] = [];
  const list = S[key]; box.innerHTML = '';
  list.forEach((fx, i) => {
    const row = document.createElement('div'); row.className = 'fxrow';
    row.innerHTML = `<span class="fxn">${i + 1}. ${(names[fx.type] || fx.type).toUpperCase()}</span>` +
      `<button class="fxb" aria-label="Move up" ${i ? '' : 'disabled'}>▲</button><button class="fxb" aria-label="Move down" ${i < list.length - 1 ? '' : 'disabled'}>▼</button><button class="fxb fxx" aria-label="Remove">✕</button>` +
      `<input type="range" min="0" max="100" value="${fx.amt ?? 60}" aria-label="${names[fx.type]} amount"><span class="val">${fx.amt ?? 60}</span>`;
    const [rg] = row.querySelectorAll('input'), val = row.querySelector('.val'), [up, dn, rm] = row.querySelectorAll('button');
    rg.oninput = () => { fx.amt = +rg.value; val.textContent = fx.amt; changed(); };
    up.onclick = () => { list.splice(i - 1, 0, list.splice(i, 1)[0]); changed(true); };
    dn.onclick = () => { list.splice(i + 1, 0, list.splice(i, 1)[0]); changed(true); };
    rm.onclick = () => { list.splice(i, 1); changed(true); };
    box.append(row);
  });
  function changed(redraw){ if (kind === 'a') updateFx(); if (redraw) fxListUI(kind); }
}
function syncFx(){ fxListUI('a'); fxListUI('v'); }
for (const kind of ['a','v']) $(kind + 'FxAdd').onchange = e => {
  const v = e.target.value; e.target.value = ''; if (!v) return;
  const key = kind === 'a' ? 'afxList' : 'vfxList'; if (!Array.isArray(S[key])) S[key] = [];
  S[key].push({ type: v, amt: 60 }); if (kind === 'a') updateFx(); fxListUI(kind);
  toast((kind === 'a' ? AFX_NAMES : VFX_NAMES)[v] + ' added');
};
