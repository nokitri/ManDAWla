/* ================= Rendering ================= */
// each track can use its own symmetry; 0 means "same as the project"
let SYMSETS = {};
// mode, copies and mirror are each track's own (the selected track's live values are in S)
const trackVal = (t, k) => t ? (t.id === S.cur ? S[k] : (t[k] ?? S[k])) : S[k];
function kalOf(t){ const v = trackVal(t, 'kal'); return MODES[v] ? v : 'radial'; }
const mirOf = t => !!trackVal(t, 'mirror');
const setKey = t => kalOf(t) + '|' + symOf(t) + '|' + (mirOf(t) ? 1 : 0);
function symOf(t){ return Math.max(1, Math.min(16, +trackVal(t, 'sym') || 8)); }
const offTrack = t => t && (t.m || (S.tracks.some(x => x.s) && !t.s));
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
// Each note owns the piece of the stroke drawn while it sounded, so a note moved on the timeline
// lights up its own piece of the drawing at its new time.
function segsOf(st){
  const sig = st.pts.length + '|' + st.width + '|' + st.ch + '|' + (st.zs || '') + '|' + st.notes.map(n => n.pi).join(',');
  if (st.segs && st.segSig === sig) return st.segs;
  const pis = [...new Set(st.notes.map(n => Math.max(0, Math.min(st.pts.length-1, n.pi|0))))].sort((a,b) => a-b);
  const offs = st.ch && st.ch !== 'single' && CHORDS[st.ch] ? chordIdx(0, st.ch).filter(o => o) : [];
  const stepR = maxR()/(SCALES[S.scale].length*3)*zoneW(st), Rr = st.width*4 + 16, vp = visPts(st);
  st.segs = pis.map((pi, k) => {
    const a = k === 0 ? 0 : Math.ceil((pis[k-1] + pi)/2), b = k === pis.length-1 ? st.pts.length-1 : Math.floor((pi + pis[k+1])/2);
    const clip = new Path2D(); let lx = 1e9, ly = 1e9;
    const dot = (x, y) => { clip.moveTo(x + Rr, y); clip.arc(x, y, Rr, 0, TAU); };
    for (let i=a; i<=b; i++){
      const [x, y] = vp[i]; if (i !== b && Math.hypot(x-lx, y-ly) < Rr*.45) continue; lx = x; ly = y;
      dot(x, y);
      if (offs.length){ const d = Math.hypot(x, y) || 1; for (const o of offs){ const nd = Math.max(2, d - o*stepR); dot(x*nd/d, y*nd/d); } }
    }
    return { pi, clip, notes: st.notes.filter(n => Math.max(0, Math.min(st.pts.length-1, n.pi|0)) === pi), v: 0 };
  });
  st.segSig = sig; return st.segs;
}
function noteVis(n, now){
  if (n.vis === undefined) return 0;
  if (now > (n.visHold || 0)) n.vis = Math.max(0, n.vis - lastDt/650);
  return n.vis;
}
let TRAIL_IDX = new Map(), DRAW_LAYER = -1;
var TRAIL_LAYERS = [null];   // layer 0 is the main drawing canvas
function strokeLayer(st){ const t = trackOf(st); return TRAIL_IDX.get(Math.round(+trackVal(t, 'trail') || 0)) ?? 0; }
function ensureTrailLayers(n){
  while (TRAIL_LAYERS.length < n){
    const c = document.createElement('canvas'); c.className = 'trailLayer'; c.setAttribute('aria-hidden', 'true');
    const prev = TRAIL_LAYERS[TRAIL_LAYERS.length - 1]; (prev ? prev.cv : cv).after(c);
    c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.setTransform(DPR,0,0,DPR,0,0);
    TRAIL_LAYERS.push({ cv: c, ctx: x, idle: true });
  }
}
const drawLayers = (g, w, h) => { for (let i = 1; i < TRAIL_LAYERS.length; i++) g.drawImage(TRAIL_LAYERS[i].cv, 0, 0, w, h); };
function drawStrokes(C0, M0, now){
  const re = S.react/100;
  const breathe = 1 + (bass*.05 + beat*.08)*re, lv = [bass, mid, high];
  const core = LIGHT ? 'rgba(20,18,24,.6)' : 'rgba(255,252,245,.8)';
  const base = ctx.getTransform(), cols = new Array(16), mains = new Array(16);
  // crowded screens get gentler strokes so additive glow doesn't wash out to white
  const dens = LIGHT ? 1 : Math.max(.42, Math.min(1, 1.12 - strokes.length*C0.length/900));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let si = strokes.length-1; si >= 0; si--){
    const st = strokes[si];
    if (DRAW_LAYER >= 0 && strokeLayer(st) !== DRAW_LAYER) continue;
    const tk = trackOf(st), fd = tk && tk.fade !== undefined ? tk.fade : (tk && tk.id === S.cur ? S.fade : -1), hold = fd*1000;
    if (tk && (tk.m || (S.tracks.some(x => x.s) && !tk.s)) && !isActive(st)){ st.pulse *= .95; continue; }
    let op = (tk && tk.alpha !== undefined ? tk.alpha : tk && tk.id === S.cur ? S.alpha : 100)/100;
    // the track's visual effects, all applied together
    const V = { strobe:0, pulse:0, shimmer:0, rainbow:0, glow:0, spin:0, jitter:0, breathe:0 };
    for (const fx of (trackVal(tk, 'vfxList') || [])) if (fx.type in V) V[fx.type] = Math.min(1.5, V[fx.type] + (fx.amt ?? 60)/100);
    if (V.strobe){   // on and off on every grid step while playing, a fast flicker when stopped
      const ph = ac && S.loop ? (beatsAt(ac.currentTime)*S.grid) % 1 : (now/90) % 1; if (ph > .5) op *= Math.max(0, 1 - V.strobe); }
    if (S.focus && tk && tk.id !== S.cur) op *= .12;   // focus: other tracks fade into the background
    const set = (tk && SYMSETS[tk.id]) || { C: C0, M: M0, n: S.sym }, C = set.C, M = set.M, nSym = set.n;
    let life = 1, segs = null; const hs = st.autoFade || (hold > 0 ? hold : 0);
    // strokes drawn without recording fade away shortly after you lift the pointer
    if (!st.notes.length && !isActive(st) && !st.autoFade && !st.keyHeld){
      if (st.endT === undefined) st.endT = now;
      const age = now - st.endT;
      if (age > 2200){ strokes.splice(si,1); continue; }
      if (age > 1200) life = 1 - (age - 1200)/1000;
    }
    else if (fd < 0 && !st.autoFade && !isActive(st)){
      // fade with notes: a stroke shows after you draw it, then lights up only while its notes sound
      // strokes without notes just stay; with the loop stopped, recorded strokes stay softly visible too
      if (!st.notes.length || !S.loop){ if (st.notes.length) life = Math.max(.45, st.vis ?? 1); }
      else {
        const intro = Math.max(0, Math.min(1, (st.born + 2450 - now)/650));
        segs = segsOf(st); let mx = 0, mn = 1;
        for (const g of segs){ let v = 0; for (const n of g.notes) v = Math.max(v, noteVis(n, now)); g.v = Math.max(v, intro); if (g.v > mx) mx = g.v; if (g.v < mn) mn = g.v; }
        if (mx < .02){ st.pulse *= .95; continue; }
        if (mx - mn < .04){ life = mx; segs = null; } else life = 1;
      }
    }
    else if (hs && !st.pinned && !isActive(st)){
      const age = now - st.born, FD = Math.min(2500, hs*.5);
      if (age > hs){
        if (!st.notes.length){ strokes.splice(si,1); continue; }
        // faded but still in the loop: each piece shows only while its own note plays
        segs = segsOf(st); let mx = 0;
        for (const g of segs){ let v = 0; for (const n of g.notes) v = Math.max(v, noteVis(n, now)); g.v = Math.min(.6, v*.7); if (g.v > mx) mx = g.v; }
        if (mx < .03){ st.pulse *= .95; continue; }
        life = 1;
      }
      else if (age > hs - FD) life = (hs - age)/FD;
    }
    if (st.pts.length < 2) continue;
    // a stroke being drawn rebuilds at most every 45 ms instead of every frame
    const zs = zoneSig(tk); if (st.zs !== zs){ st.zs = zs; st.dirty = true; st.segs = null; }
    if (st.dirty && (!st.path || !isActive(st) || now - (st.builtAt||0) > 45)){ build(st); st.builtAt = now; }
    st.pulse *= .95;
    const e = lv[st.band]*re, glow = st.pulse + e*.9 + beat*.4*re;
    let lw = st.width*(1 + e*1.1) + beat*1.6*re + st.pulse*2, sc = breathe*(1 + e*.05);
    if (V.pulse){ const ph = ac && S.loop ? beatsAt(ac.currentTime) % 1 : (now/600) % 1; sc *= 1 + V.pulse*.16*Math.pow(1 - ph, 3); }
    if (V.breathe) sc *= 1 + V.breathe*.12*Math.sin(now*.0018 + st.t0*9);
    if (V.glow) lw *= 1 + V.glow*.5;
    const al = Math.min(1, .62 + glow*.3), twinkle = st.brush === 'sparkle' || st.brush === 'stars';
    cols.fill(undefined); mains.fill(undefined);
    const TF = st.tone && st.chordPaths && now - st.toneAt < 2000 ? [0, ...st.chordPaths.map((_, j) => j + 1)].map(k => toneF(st, k, now)) : null;
    const chordLines = (ga) => { ctx.strokeStyle = mains[k0]; ctx.lineWidth = Math.max(.8, lw*.6);
      st.chordPaths.forEach((cp, j) => { if (TF){ const v = ga*TF[j + 1]; ctx.globalAlpha = v > 1 ? 1 : v; } ctx.stroke(cp); }); };
    let k0 = 0;
    for (let ci=0; ci<C.length; ci++){
      const c = C[ci], m = M[ci], k = c.k % nSym; k0 = k;
      ctx.setTransform(m.a*sc, m.b*sc, m.c*sc, m.d*sc, m.e, m.f);
      if (V.spin) ctx.rotate(now*.0009*V.spin*(c.f < 0 ? -1 : 1));
      if (V.jitter) ctx.translate((Math.random() - .5)*10*V.jitter, (Math.random() - .5)*10*V.jitter);
      let a = life * c.a * dens * op;
      if (V.shimmer) a *= 1 - Math.min(1, V.shimmer)*.75*(.5 + .5*Math.sin(now*.013 + ci*1.9 + st.t0*20));
      if (twinkle) a *= .4 + .6*Math.abs(Math.sin(now*.005 + ci*1.7 + high*3));
      ctx.globalAlpha = a > 1 ? 1 : a < 0 ? 0 : a;
      if (cols[k] === undefined){ cols[k] = rgbStr(strokeRGB(st, k, glow, nSym)); mains[k] = `rgba(${cols[k]},${al})`; }
      if (V.rainbow && cols[k] && !cols[k].rb){ const vr = Math.min(1, V.rainbow), c2 = hsl2rgb(((now*.00012*(1 + vr*3) + k/nSym) % 1)*360, 85, LIGHT ? 45 : 62), base = cols[k].split(',').map(Number);
        cols[k] = new String(rgbStr(base.map((v, i) => Math.round(v*(1 - vr) + c2[i]*vr)))); cols[k].rb = true; mains[k] = `rgba(${cols[k]},${al})`; }
      if (V.glow){ const ga = ctx.globalAlpha; ctx.globalAlpha = ga*.22*Math.min(1, V.glow); ctx.strokeStyle = mains[k]; ctx.lineWidth = lw*4; ctx.stroke(st.path); ctx.globalAlpha = ga; }
      if (segs){
        for (const g of segs){
          if (g.v < .02) continue;
          ctx.save(); ctx.clip(g.clip); const ga = a*g.v, g0 = TF ? ga*TF[0] : ga; ctx.globalAlpha = g0 > 1 ? 1 : g0;
          drawBrush(ctx, st, cols[k], al, lw, e, glow, now, core, mains[k]);
          if (st.chordPaths) chordLines(ga);
          ctx.restore();
        }
        continue;
      }
      if (TF){ const v = a*TF[0]; ctx.globalAlpha = v > 1 ? 1 : v < 0 ? 0 : v; }
      drawBrush(ctx, st, cols[k], al, lw, e, glow, now, core, mains[k]);
      if (st.chordPaths) chordLines(a > 1 ? 1 : a < 0 ? 0 : a);
    }
  }
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}
function drawSparks(C, M, dt){
  if (!sparks.length) return;
  for (let i=sparks.length-1;i>=0;i--){ const p=sparks[i]; p.x+=p.vx*dt*.06; p.y+=p.vy*dt*.06; p.vx*=.97; p.vy*=.97; p.life-=dt*.0012; if (p.life<=0) sparks.splice(i,1); }
  const base = ctx.getTransform(), step = Math.max(1, Math.ceil(C.length/24));
  for (const p of sparks) p.fs = p.fs || `rgb(${p.col})`;
  for (let ci=0; ci<C.length; ci+=step){
    const m = M[ci]; ctx.setTransform(m);
    for (const p of sparks){ ctx.globalAlpha = p.life*C[ci].a; ctx.fillStyle = p.fs; ctx.fillRect(p.x-1, p.y-1, 2.2, 2.2); }
  }
  ctx.setTransform(base); ctx.globalAlpha = 1;
}
function drawViz(R, now, dt){
  const re = S.react/100;
  if (S.viz === 'off' || !analyser) return;
  const n = S.sym, wedge = TAU/n;
  if (S.viz === 'spectrum'){
    const N = n*16;
    for (let i=0;i<N;i++){
      const w = i % 16, m = Math.floor(i/16)%2 && S.mirror ? 15 - w : w;
      const v = Math.pow(freqData[2 + m*7]/255, 1.4) * (0.6 + re*.6), a = i*TAU/N;
      if (v < .04) continue;
      const c = rgbStr(paletteRGB(m/16 + colorShift));
      ctx.strokeStyle = `rgba(${c},${.25 + v*.6})`; ctx.lineWidth = 1.5 + v*2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*R*1.02, Math.sin(a)*R*1.02);
      ctx.lineTo(Math.cos(a)*R*(1.02+v*.2), Math.sin(a)*R*(1.02+v*.2)); ctx.stroke();
    }
  } else if (S.viz === 'wave'){
    const M = 240, step = Math.max(1, Math.floor(timeData.length/(M/n)/2));
    for (let layer=0; layer<2; layer++){
      const rr = R*(layer ? .55 : 1.0);
      ctx.beginPath();
      for (let i=0;i<=M;i++){
        const a = i/M*TAU, local = (a % wedge)/wedge, u = S.mirror ? (local < .5 ? local*2 : 2-local*2) : local;
        const v = (timeData[Math.floor(u*(M/n))*step] - 128)/128;
        const r = rr*(1 + v*.35*re*(layer ? .7 : 1));
        i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      const c = rgbStr(paletteRGB(.2 + layer*.4 + colorShift));
      ctx.strokeStyle = `rgba(${c},${.45 + mid*.4})`; ctx.lineWidth = 1.4 + bass*2*re; ctx.stroke();
    }
  } else if (S.viz === 'rays'){
    const N = n*6;
    for (let i=0;i<N;i++){
      const w = i % 6, v = Math.pow(freqData[3 + w*9]/255, 1.6)*(0.5+re*.7), a = i*TAU/N + rot*.5;
      if (v < .05) continue;
      const c = rgbStr(paletteRGB(w/6 + colorShift)), g = ctx.createLinearGradient(0,0,Math.cos(a)*R*1.5,Math.sin(a)*R*1.5);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(.3, `rgba(${c},${v*.35})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = 2 + v*10;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*R*(.6+v*.9), Math.sin(a)*R*(.6+v*.9)); ctx.stroke();
    }
  } else if (S.viz === 'pulse'){
    for (let i=pulses.length-1;i>=0;i--){
      const p = pulses[i]; p.r += dt*.5*(1+re*.5); p.life -= dt*.0011;
      if (p.life <= 0){ pulses.splice(i,1); continue; }
      const c = rgbStr(paletteRGB(p.r/R*.5 + colorShift));
      ctx.strokeStyle = `rgba(${c},${p.life*.8})`; ctx.lineWidth = 1 + p.life*3;
      ctx.beginPath();
      for (let k=0;k<=n*2;k++){ const a = k*Math.PI/n, r = p.r*(k%2 ? .86 : 1); k ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
      ctx.closePath(); ctx.stroke();
    }
  } else if (S.viz === 'bars'){        // bars hanging inward from the edge
    const N = Math.max(48, n*8);
    for (let i=0;i<N;i++){
      const w = i % 24, m = Math.floor(i/24)%2 ? 23 - w : w, v = Math.pow(freqData[2 + m*5]/255, 1.5)*(.5 + re*.6), a = i*TAU/N + rot*.3;
      if (v < .05) continue;
      const c = rgbStr(paletteRGB(m/24 + colorShift));
      ctx.strokeStyle = `rgba(${c},${.18 + v*.45})`; ctx.lineWidth = Math.max(2, R*TAU/N*.5);
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*R, Math.sin(a)*R); ctx.lineTo(Math.cos(a)*R*(1 - v*.22), Math.sin(a)*R*(1 - v*.22)); ctx.stroke();
    }
  } else if (S.viz === 'dots'){        // a ring of dots that swell with their band
    const N = Math.max(24, n*6);
    for (let i=0;i<N;i++){
      const w = i % 12, m = Math.floor(i/12)%2 ? 11 - w : w, v = Math.pow(freqData[3 + m*8]/255, 1.3)*(.5 + re*.6), a = i*TAU/N - rot*.4;
      const c = rgbStr(paletteRGB(m/12 + colorShift));
      ctx.fillStyle = `rgba(${c},${.25 + v*.7})`; ctx.beginPath(); ctx.arc(Math.cos(a)*R*1.06, Math.sin(a)*R*1.06, 1.5 + v*7, 0, TAU); ctx.fill();
    }
  } else if (S.viz === 'aura'){        // a soft glowing halo that breathes with the bass
    const c = rgbStr(paletteRGB(colorShift + .3)), th = R*(.06 + bass*.16*re + beat*.06*re);
    const g = ctx.createRadialGradient(0,0,R*.98,0,0,R + th*2.2);
    g.addColorStop(0, `rgba(${c},${.35 + bass*.4})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,R + th*2.2,0,TAU); ctx.arc(0,0,R*.98,0,TAU,true); ctx.fill();
  } else if (S.viz === 'petals'){      // the spectrum as one flowing shape around the edge
    const N = 180, c = rgbStr(paletteRGB(colorShift + .15));
    ctx.beginPath();
    for (let i=0;i<=N;i++){
      const a = i/N*TAU, local = (a % wedge)/wedge, u = local < .5 ? local*2 : 2 - local*2, v = Math.pow(freqData[2 + Math.floor(u*60)]/255, 1.4)*(.5 + re*.6);
      const r = R*(1.02 + v*.18); i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath(); ctx.fillStyle = `rgba(${c},.12)`; ctx.fill(); ctx.strokeStyle = `rgba(${c},.6)`; ctx.lineWidth = 1.4; ctx.stroke();
  } else if (S.viz === 'scope'){       // an oscilloscope loop in the middle
    const M = 256, rr = R*.18, c = rgbStr(paletteRGB(colorShift + .6));
    ctx.beginPath();
    for (let i=0;i<=M;i++){ const a = i/M*TAU, v = (timeData[Math.floor(i/M*(timeData.length - 1))] - 128)/128, r = rr*(1 + v*1.6*(.5 + re*.5)); i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
    ctx.strokeStyle = `rgba(${c},${.5 + mid*.4})`; ctx.lineWidth = 1.2 + bass*1.5; ctx.stroke();
  } else if (S.viz === 'comets'){      // little comets circling the edge, faster when it's loud
    const N = Math.max(6, n), sp = now*(.0004 + (bass + mid)*.0012*re);
    for (let i=0;i<N;i++){
      const a0 = sp + i*TAU/N, c = rgbStr(paletteRGB(i/N + colorShift));
      for (let j=0;j<10;j++){ const a = a0 - j*.035, r = R*(1.04 + Math.sin(now*.002 + i)*.02); ctx.fillStyle = `rgba(${c},${(1 - j/10)*(.35 + high*.6)})`; ctx.beginPath(); ctx.arc(Math.cos(a)*r, Math.sin(a)*r, (1 - j/10)*(2 + beat*3*re), 0, TAU); ctx.fill(); }
    }
  }
}
const mb=$('mb'), mm=$('mm'), mh=$('mh'), mbeat=$('mbeat');
let t0 = performance.now();
let frameN = 0, ema = 16, lastQ = 0, lastDt = 16;
function frame(now){
  const raw = now - t0, dt = Math.min(50, raw); t0 = now; frameNow = now; frameN++; lastDt = dt;
  // adaptive quality: watch the average frame time and trade resolution for smoothness
  if (raw < 200) ema = ema*.94 + raw*.06;
  if (now - lastQ > 2500 && !document.hidden){
    if (ema > 24 && QUALITY > .5){ QUALITY = Math.max(.5, QUALITY - .15); lastQ = now; resize(); }
    else if (ema < 15 && QUALITY < 1){ QUALITY = Math.min(1, QUALITY + .1); lastQ = now; resize(); }
  }
  bands(now, dt);
  const re = S.react/100;
  if (frameN % 2 === 0 && !$('deck').hidden){
    mb.style.transform = `scaleY(${(.1+bass*.9).toFixed(2)})`; mm.style.transform = `scaleY(${(.1+mid*.9).toFixed(2)})`;
    mh.style.transform = `scaleY(${(.1+high*.9).toFixed(2)})`; mbeat.style.transform = `scaleY(${(.1+beat*.9).toFixed(2)})`;
  }
  // every track turns at its own speed; the selected track's angle is the one you draw in
  for (const t of S.tracks){ const sp = (+trackVal(t, 'spin') || 0)/100, sg = Math.sign(sp || 1);
    ANG[t.id] = (ANG[t.id] || 0) + (reduce ? .00004*sg : (.00022*sp + (sp ? (mid*.0012*re + beat*.0016*re)*sg : 0)))*dt; }
  rot = ANG[S.cur] || 0;
  if (frameN % 20 === 0) placeTools();
  tunnelPhase = (tunnelPhase + dt*.00007*(1 + bass*2.5*re)) % 1;
  if (!reduce) animBg(now, dt);

  if (ac) for (let i=flashes.length-1;i>=0;i--){ const f = flashes[i]; if (ac.currentTime >= f.when){ const ft = f.st && trackOf(f.st); if (f.st && !(ft && (ft.m || (S.tracks.some(x => x.s) && !ft.s)))){ f.st.pulse = 1; spark(f.st, f.pi, 4); f.st.vis = 1; const hd = f.n && f.n.d ? f.n.d*beatLen()*1000 : 260; f.st.visHold = Math.max(f.st.visHold || 0, now + hd); if (f.n){ f.n.vis = 1; f.n.visHold = now + Math.max(hd, 320); if (f.n.ak !== undefined) lightTones(f.st, [f.n.ak]); else if (f.n.ch && f.n.ch !== 'single') lightTones(f.st, null, trackStrum(ft)); } } if (f.n) f.n.hit = now; flashes.splice(i,1); } }

  // trails: tracks that share a trail length share a layer; each layer fades at its own speed
  const trails = [...new Set(S.tracks.map(t => Math.round(+trackVal(t, 'trail') || 0)))];
  if (!trails.length) trails.push(Math.round(S.trail));
  TRAIL_IDX = new Map(trails.map((v, i) => [v, i])); ensureTrailLayers(trails.length);
  const R = maxR()*(1 + (bass*.05 + beat*.05)*re);
  for (let li = trails.length; li < TRAIL_LAYERS.length; li++){ const L = TRAIL_LAYERS[li]; if (!L.idle){ L.ctx.setTransform(1,0,0,1,0,0); L.ctx.clearRect(0,0,L.cv.width,L.cv.height); L.ctx.setTransform(DPR,0,0,DPR,0,0); L.idle = true; } }
  let C, M;
  for (let li = 0; li < trails.length; li++){
  DRAW_LAYER = li; if (li) TRAIL_LAYERS[li].idle = false;
  const fadeA = reduce ? .5 : .42 - (trails[li]/100)*.38;
  ctx = li ? TRAIL_LAYERS[li].ctx : mainCtx;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${fadeA})`; ctx.fillRect(0,0,W,H);
  if (frameN % 12 === 0){ ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0,0,W,H); }   // clears the faint residue a slow fade leaves behind

  ctx.save(); ctx.translate(W/2, CY()); ctx.globalCompositeOperation = LIGHT ? 'source-over' : 'lighter';
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R*1.01, 0, TAU); ctx.clip(); ctx.rotate(rot);
  if (!li){
  C = copies(now); M = copyMatrices(C);
  SYMSETS = { [S.kal + '|' + S.sym + '|' + (S.mirror ? 1 : 0)]: { C, M, n: S.sym } };
  const shapes = {};
  for (const t of S.tracks){ const key = setKey(t), sh = shapes[key] || (shapes[key] = copies(now, symOf(t), kalOf(t), mirOf(t)));
    ctx.save(); ctx.rotate((ANG[t.id] || 0) - rot); SYMSETS[t.id] = { C: sh, M: copyMatrices(sh), n: symOf(t) }; ctx.restore(); }
  }
  drawStrokes(C, M, now);
  if (!li) drawSparks(C, M, dt);
  ctx.restore(); ctx.restore();
  }
  DRAW_LAYER = -1;

  // FX layer: redrawn from scratch every frame, so glows and visuals never pile up on the background
  ctx = fxCtx;
  ctx.setTransform(FXDPR,0,0,FXDPR,0,0); ctx.clearRect(0,0,W,H);
  ctx.save(); ctx.translate(W/2, CY()); ctx.globalCompositeOperation = LIGHT ? 'source-over' : 'lighter';
  const gc = rgbStr(paletteRGB(colorShift + .1));
  const g = ctx.createRadialGradient(0,0,0,0,0,R*.65);
  g.addColorStop(0, `rgba(${gc},${(.03 + bass*.12*re + beat*.08*re) * (LIGHT ? .5 : 1)})`); g.addColorStop(1, `rgba(${gc},0)`);
  ctx.fillStyle = g; ctx.fillRect(-R, -R, R*2, R*2);

  if (ac && S.loop){
    const L = LB(), b = beatsAt(ac.currentTime), pos = ((b % L) + L) % L, cur = Math.floor(pos);
    const rr = Math.min(W,H)*.485, mc = LIGHT ? '40,36,48' : '235,225,205';
    const stp = L > 32 ? 4 : 1;   // long loops show one dot per bar
    for (let k=0;k<L;k+=stp){
      const a = k/L*TAU - Math.PI/2, on = cur >= k && cur < k + stp, down = k%(stp > 1 ? 16 : 4) === 0;
      ctx.fillStyle = on ? `rgba(${rgbStr(paletteRGB(colorShift))},1)` : `rgba(${mc},${down ? .35 : .15})`;
      ctx.beginPath(); ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, on ? 3.5 : down ? 2.2 : 1.4, 0, TAU); ctx.fill();
    }
  }
  ctx.rotate(-rot*.6);
  { const ink = LIGHT ? '30,28,38' : '235,225,205';   // the edge of the playable circle
    ctx.strokeStyle = `rgba(${ink},${.1 + bass*.12*re})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R*1.01, 0, TAU); ctx.stroke(); }
  drawViz(R, now, dt);
  ctx.restore();

  if (ripples.length){
    ctx.save(); ctx.globalCompositeOperation = LIGHT ? 'source-over' : 'lighter';
    for (let i=ripples.length-1;i>=0;i--){
      const p = ripples[i]; p.r += dt*.35; p.life -= dt*.0009;
      if (p.life<=0){ ripples.splice(i,1); continue; }
      ctx.strokeStyle = `rgba(${rgbStr(paletteRGB(p.t))},${p.life*.8})`; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k=0;k<=S.sym;k++){ const a = k*TAU/S.sym + p.r*.004; ctx.lineTo(p.x+Math.cos(a)*p.r, p.y+Math.sin(a)*p.r); }
      ctx.stroke();
    }
    ctx.restore();
  }
  let ptxt = 'STOPPED';
  if (ac && S.loop && ac.currentTime < countEnd){
    const rem = (countEnd - ac.currentTime)/beatLen(), num = Math.max(1, Math.ceil(rem)), f = rem - (num - 1);
    ptxt = 'COUNT-IN · ' + num;
    if (countEl.hidden) countEl.hidden = false;
    if (countEl.textContent !== String(num)) countEl.textContent = num;
    countEl.style.opacity = (.6 + f*.4).toFixed(2); countEl.style.transform = `translate(-50%,-50%) scale(${(1 + (1-f)*.35).toFixed(3)})`;
    countEl.style.color = `rgb(${rgbStr(paletteRGB(colorShift))})`;
  } else if (ac && S.loop){ const L = LB(), b = beatsAt(ac.currentTime), pos = ((b % L) + L) % L; ptxt = 'BAR ' + (Math.floor(pos/4)+1) + ' · BEAT ' + (Math.floor(pos%4)+1); }
  if (!(ac && S.loop && ac.currentTime < countEnd) && !countEl.hidden) countEl.hidden = true;
  if (ptxt !== posEl.textContent) posEl.textContent = ptxt;
  if (hoverXY && S.draw && !active.size && !outside(hoverXY[0], hoverXY[1])){
    // cursor echo: a ring where every mirrored copy of the brush will land, plus dots for chord notes
    const cz = zoneOf(curT()); let [lx, ly] = toLocal(hoverXY[0], hoverXY[1]); if (cz) [lx, ly] = zoneMap(cz, lx, ly);
    const c = rgbStr(paletteRGB(colorShift + .2));
    const d0 = Math.hypot(lx, ly) || 1, n3 = SCALES[S.scale].length*3, step = maxR()/n3;
    const extra = S.chord !== 'single' ? chordIdx(0, S.chord).filter(o => o).map(o => Math.max(2, d0 - o*step)/d0) : [];
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    const k = new DOMMatrix([FXDPR/DPR,0,0,FXDPR/DPR,0,0]);
    for (const m of ((SYMSETS[S.cur] || {}).M || M)){
      const mm = k.multiply(m), sc = Math.hypot(m.a, m.b)/DPR || 1;
      ctx.setTransform(mm);
      ctx.strokeStyle = `rgba(${c},.9)`; ctx.lineWidth = 1.4/sc; ctx.beginPath(); ctx.arc(lx, ly, 5/sc, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(${c},.9)`; ctx.beginPath(); ctx.arc(lx, ly, 1.6/sc, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${c},.6)`;
      for (const f of extra){ ctx.beginPath(); ctx.arc(lx*f, ly*f, 2.4/sc, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  if (S.rings) drawRings(now);
  ctx = mainCtx;
  if (ac) for (const k in keyRec){ const r = keyRec[k]; r.n.d = Math.max(r.n.d || 0, keyLen(r)); }
  for (const st of strokes) if (st.roll) rollArc(st);
  if (S.timeline && frameN % 2 === 0) drawTimeline(now);
  if (recCtx) recFrame();
  requestAnimationFrame(frame);
}
const posEl = $('pos'), countEl = $('count');
/* ---- Track tools (name, mute, solo, clear, delete) ---- */
let mixSig = '';
function syncTrackTools(){
  const t = curT(); if (!t) return;
  const ti = S.tracks.indexOf(t);
  if (document.activeElement !== $('tName')) $('tName').value = t.name || '';
  $('tName').placeholder = (ti+1) + ' · ' + instLabel(t);
  setP($('tMute'), !!t.m); setP($('tSolo'), !!t.s);
  $('tvol').value = t.v; $('tvolVal').textContent = t.v;
  $('tDel').disabled = S.tracks.length < 2;
}

$('focusBtn').onclick = () => { S.focus = !S.focus; setP($('focusBtn'), S.focus); toast(S.focus ? 'Focus on ' + trackName(curT()) : 'Focus off'); };
$('tZone').onchange = e => { S.zone = e.target.value; stashTrack(); };
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
  function changed(redraw){ stashTrack(); if (kind === 'a') updateMix(); if (redraw) fxListUI(kind); }
}
function syncFx(){ fxListUI('a'); fxListUI('v'); }
for (const kind of ['a','v']) $(kind + 'FxAdd').onchange = e => {
  const v = e.target.value; e.target.value = ''; if (!v) return;
  const key = kind === 'a' ? 'afxList' : 'vfxList'; if (!Array.isArray(S[key])) S[key] = [];
  S[key].push({ type: v, amt: 60 }); stashTrack(); if (kind === 'a') updateMix(); fxListUI(kind);
  toast((kind === 'a' ? AFX_NAMES : VFX_NAMES)[v] + ' added');
};
$('tAlpha').oninput = e => { S.alpha = +e.target.value; $('tAlphaVal').textContent = S.alpha + '%'; stashTrack(); };
$('tName').oninput = () => { curT().name = $('tName').value.trim(); renderTracks(); lanesAt = 0; trackHead(); updateMeta(); };
$('tMute').onclick = () => { const t = curT(); t.m = !t.m; updateMix(); renderTracks(); lanesAt = 0; syncTrackTools(); };
$('tSolo').onclick = () => { const t = curT(); t.s = !t.s; updateMix(); renderTracks(); lanesAt = 0; syncTrackTools(); };
$('tClrNotes').onclick = () => { const t = curT(); pushHistory(); strokes.forEach(st => { if (st.track === t.id) st.notes = []; }); toast(trackName(t) + ' notes cleared'); };
let delArmed = 0, chipDelArm = 0, chipDelT = 0;
// deleting asks once (click again within a moment); Undo brings the track back
function deleteTrack(t, confirmed){
  if (S.tracks.length < 2){ toast('Keep at least one track'); return; }
  if (!confirmed){
    chipDelArm = t.id; clearTimeout(chipDelT); chipDelT = setTimeout(() => { chipDelArm = 0; renderTracks(); }, 2500); renderTracks();
    const bd = $('tDel'); bd.classList.add('armed'); bd.textContent = 'Delete Track?'; clearTimeout(delArmed);
    delArmed = setTimeout(() => { delArmed = 0; bd.classList.remove('armed'); bd.textContent = 'Delete Track'; }, 2500);
    toast('Click again to delete ' + trackName(t)); return;
  }
  clearTimeout(chipDelT); chipDelArm = 0; clearTimeout(delArmed); delArmed = 0; $('tDel').classList.remove('armed'); $('tDel').textContent = 'Delete Track';
  stashTrack(); pushHistory();
  const ti = S.tracks.indexOf(t), nm = trackName(t);
  for (let k=strokes.length-1;k>=0;k--) if (strokes[k].track === t.id) strokes.splice(k,1);
  S.tracks.splice(ti, 1); if (S.cur === t.id || !trk(S.cur)) S.cur = S.tracks[Math.max(0, ti-1)].id;
  loadTrack(curT()); syncUI(); syncInst(); renderTracks(); updateMix(); lanesAt = 0; updateMeta(); trackHead(); syncTrackTools();
  toast(nm + ' deleted · Undo brings it back');
}
$('tDel').onclick = () => deleteTrack(curT(), !!delArmed);
setInterval(() => { if (openPop) syncTrackTools(); }, 700);

