/* ================= Brush geometry ================= */
function resample(p, step){
  const out = []; let need = 0, s = 0;
  for (let i=1;i<p.length;i++){
    const ax=p[i-1][0], ay=p[i-1][1], dx=p[i][0]-ax, dy=p[i][1]-ay, d=Math.hypot(dx,dy) || 1e-6;
    while (need <= s + d){ const t = (need - s)/d; out.push({ x:ax+dx*t, y:ay+dy*t, tx:dx/d, ty:dy/d, s:need }); need += step; }
    s += d;
  }
  if (!out.length) out.push({ x:p[0][0], y:p[0][1], tx:1, ty:0, s:0 });
  out.L = s; return out;
}
function polyFill(L, R){ const f = new Path2D(); f.moveTo(L[0][0], L[0][1]); for (const q of L) f.lineTo(q[0],q[1]); for (let i=R.length-1;i>=0;i--) f.lineTo(R[i][0],R[i][1]); f.closePath(); return f; }
function offsetPath(q, fn){ const a = new Path2D(); q.forEach((o,i) => { const d = fn(o,i), x = o.x - o.ty*d, y = o.y + o.tx*d; i ? a.lineTo(x,y) : a.moveTo(x,y); }); return a; }
function star(f, x, y, ro, ri, n, ang){ for (let k=0;k<n*2;k++){ const r = k%2 ? ri : ro, a = ang + k*Math.PI/n; const px = x + Math.cos(a)*r, py = y + Math.sin(a)*r; k ? f.lineTo(px,py) : f.moveTo(px,py); } f.closePath(); }

const BUILD = {
  stamp(st,p,w){ st.stampQ = resample(p, Math.max(10, w*9)); },
  ribbon(st,p,w){ const L=[], R=[], n=p.length;
    for (let i=0;i<n;i++){ const a=p[Math.max(0,i-1)], b=p[Math.min(n-1,i+1)]; let dx=b[0]-a[0], dy=b[1]-a[1]; const len=Math.hypot(dx,dy)||1; dx/=len; dy/=len;
      const ww = w*2.4*Math.max(.25, Math.min(1.8, 1.9 - len/18))*Math.pow(Math.sin(Math.PI*(i+.5)/n), .6);
      L.push([p[i][0]-dy*ww, p[i][1]+dx*ww]); R.push([p[i][0]+dy*ww, p[i][1]-dx*ww]); }
    st.fill = polyFill(L,R); },
  calligraphy(st,p,w){ const ox = Math.cos(-Math.PI/4)*w*2.6, oy = Math.sin(-Math.PI/4)*w*2.6, n=p.length, L=[], R=[];
    p.forEach((q,i)=>{ const t = Math.pow(Math.sin(Math.PI*(i+.5)/n), .35); L.push([q[0]+ox*t, q[1]+oy*t]); R.push([q[0]-ox*t, q[1]-oy*t]); });
    st.fill = polyFill(L,R); },
  comet(st,p,w){ const q = resample(p, 2), n = q.length, L=[], R=[];
    q.forEach((o,i)=>{ const ww = w*3*Math.pow((i+1)/n, 1.3); L.push([o.x - o.ty*ww, o.y + o.tx*ww]); R.push([o.x + o.ty*ww, o.y - o.tx*ww]); });
    const f = polyFill(L,R); const e = q[n-1]; f.moveTo(e.x + w*3, e.y); f.arc(e.x, e.y, w*3, 0, TAU); st.fill = f; },
  double(st,p,w){ const q = resample(p, 3), a = new Path2D();
    [1,-1].forEach(sd => q.forEach((o,i)=>{ const x=o.x - o.ty*w*1.8*sd, y=o.y + o.tx*w*1.8*sd; i ? a.lineTo(x,y) : a.moveTo(x,y); }));
    st.alt = a; },
  rope(st,p,w){ const q = resample(p, 2), a = new Path2D();
    [1,-1].forEach(sd => q.forEach((o,i)=>{ const d = Math.sin(o.s/(w*2.4))*w*2*sd, x=o.x - o.ty*d, y=o.y + o.tx*d; i ? a.lineTo(x,y) : a.moveTo(x,y); }));
    st.alt = a; },
  wave(st,p,w){ st.alt = offsetPath(resample(p, 2), o => Math.sin(o.s/(w*3))*w*3); },
  zigzag(st,p,w){ st.alt = offsetPath(resample(p, w*2.5+2), (o,i) => (i%2 ? 1 : -1)*w*2.5); },
  ladder(st,p,w){ const q = resample(p, w*3+3), a = new Path2D(), r = w*2.2;
    [1,-1].forEach(sd => q.forEach((o,i)=>{ const x=o.x - o.ty*r*sd, y=o.y + o.tx*r*sd; i ? a.lineTo(x,y) : a.moveTo(x,y); }));
    q.forEach(o => { a.moveTo(o.x - o.ty*r, o.y + o.tx*r); a.lineTo(o.x + o.ty*r, o.y - o.tx*r); });
    st.alt = a; },
  lace(st,p,w){ const q = resample(p, 1.5), a = new Path2D(), R = w*2.6;
    q.forEach((o,i)=>{ const th = o.s/(w*1.1), c = Math.cos(th)*R, s = Math.sin(th)*R, x = o.x + o.tx*c - o.ty*s, y = o.y + o.ty*c + o.tx*s; i ? a.lineTo(x,y) : a.moveTo(x,y); });
    st.alt = a; },
  lightning(st,p,w){ const q = resample(p, w*3+5), a = new Path2D();
    q.forEach((o,i)=>{ const d = (rnd(st.seed+i)*2-1)*w*3.2, x=o.x - o.ty*d, y=o.y + o.tx*d; i ? a.lineTo(x,y) : a.moveTo(x,y); });
    q.forEach((o,i)=>{ if (i%5===2){ let x=o.x, y=o.y; a.moveTo(x,y); const ang = Math.atan2(o.ty,o.tx) + (rnd(st.seed+i*3)>.5?1:-1)*(.5+rnd(i)*.8);
      for (let k=0;k<3;k++){ x += Math.cos(ang + (rnd(st.seed+i+k)-.5))*w*3; y += Math.sin(ang + (rnd(st.seed+i+k)-.5))*w*3; a.lineTo(x,y); } } });
    st.alt = a; },
  dots(st,p,w){ const f = new Path2D(); for (let i=0;i<p.length;i+=3){ const r = w*(.7 + (i%9)/9); f.moveTo(p[i][0]+r, p[i][1]); f.arc(p[i][0], p[i][1], r, 0, TAU); } st.fill = f; },
  beads(st,p,w){ const f = new Path2D(); resample(p, w*3.2).forEach((o,i)=>{ const r = i%2 ? w*.7 : w*1.5; f.moveTo(o.x+r, o.y); f.arc(o.x, o.y, r, 0, TAU); }); st.fill = f; },
  rings(st,p,w){ const f = new Path2D(); resample(p, w*3.6).forEach(o=>{ const r = w*1.9; f.moveTo(o.x+r, o.y); f.arc(o.x, o.y, r, 0, TAU); }); st.fill = f; },
  chain(st,p,w){ const f = new Path2D(); resample(p, w*5).forEach(o=>{ const r = w*2.2; f.moveTo(o.x+r, o.y); f.arc(o.x, o.y, r, 0, TAU); }); st.fill = f; },
  sparkle(st,p,w){ const f = new Path2D(); for (let i=0;i<p.length;i+=5){ const s = w*(1.6 + (i%15)/6); star(f, p[i][0], p[i][1], s, s*.25, 4, 0); } st.fill = f; },
  stars(st,p,w){ const f = new Path2D(); resample(p, w*7).forEach(o=>star(f, o.x, o.y, w*2.6, w*1.1, 5, Math.atan2(o.ty,o.tx))); st.fill = f; },
  petals(st,p,w){ const f = new Path2D(); resample(p, w*4.5).forEach((o,i)=>{ const sd = i%2 ? 1 : -1, nx = -o.ty*sd, ny = o.tx*sd, L = w*5;
      const tx = o.x + nx*L + o.tx*w*1.5, ty = o.y + ny*L + o.ty*w*1.5;
      f.moveTo(o.x, o.y); f.quadraticCurveTo(o.x + nx*L*.5 - o.tx*w*1.8, o.y + ny*L*.5 - o.ty*w*1.8, tx, ty);
      f.quadraticCurveTo(o.x + nx*L*.5 + o.tx*w*2.6, o.y + ny*L*.5 + o.ty*w*2.6, o.x, o.y); }); st.fill = f; },
  leaves(st,p,w){ const f = new Path2D(); resample(p, w*6).forEach((o,i)=>{ if (!i) return; const sd = i%2 ? 1 : -1, nx = -o.ty*sd, ny = o.tx*sd, L = w*4;
      const tx = o.x + nx*L + o.tx*L*.8, ty = o.y + ny*L + o.ty*L*.8, mx = (o.x+tx)/2, my = (o.y+ty)/2;
      f.moveTo(o.x,o.y); f.quadraticCurveTo(mx - ny*w*1.4*sd, my + nx*w*1.4*sd, tx, ty); f.quadraticCurveTo(mx + ny*w*1.4*sd, my - nx*w*1.4*sd, o.x, o.y); }); st.fill = f; },
  diamonds(st,p,w){ const f = new Path2D(); resample(p, w*5).forEach(o=>{ const a = w*2.6, b = w*1.3;
      f.moveTo(o.x + o.tx*a, o.y + o.ty*a); f.lineTo(o.x - o.ty*b, o.y + o.tx*b); f.lineTo(o.x - o.tx*a, o.y - o.ty*a); f.lineTo(o.x + o.ty*b, o.y - o.tx*b); f.closePath(); }); st.fill = f; },
  triangles(st,p,w){ const f = new Path2D(); resample(p, w*4.5).forEach((o,i)=>{ const sd = i%2 ? 1 : -1, s = w*2.2;
      f.moveTo(o.x - o.tx*s, o.y - o.ty*s); f.lineTo(o.x + o.tx*s, o.y + o.ty*s); f.lineTo(o.x - o.ty*s*1.6*sd, o.y + o.tx*s*1.6*sd); f.closePath(); }); st.fill = f; },
  hearts(st,p,w){ const f = new Path2D(); resample(p, w*7).forEach(o=>{ const s = w*1.3, a = Math.atan2(o.ty,o.tx) + Math.PI/2, c = Math.cos(a), sn = Math.sin(a);
      const P = (x,y) => [o.x + (x*c - y*sn)*s, o.y + (x*sn + y*c)*s];
      f.moveTo(...P(0,1.6)); f.bezierCurveTo(...P(-2.4,-.2), ...P(-1.2,-2.2), ...P(0,-.9)); f.bezierCurveTo(...P(1.2,-2.2), ...P(2.4,-.2), ...P(0,1.6)); f.closePath(); }); st.fill = f; },
  scales(st,p,w){ const f = new Path2D(); resample(p, w*3).forEach(o=>{ const r = w*2.2, a = Math.atan2(o.ty,o.tx); f.moveTo(o.x + Math.cos(a+Math.PI/2)*r, o.y + Math.sin(a+Math.PI/2)*r); f.arc(o.x, o.y, r, a+Math.PI/2, a-Math.PI/2, true); }); st.fill = f; },
  spray(st,p,w){ const f = new Path2D(); p.forEach((q,i)=>{ for (let k=0;k<3;k++){ const s = st.seed+i*7+k, r = Math.pow(rnd(s),1.5)*w*5, a = rnd(s+.5)*TAU, d = .5 + rnd(s+.3)*w*.35;
      const x = q[0] + Math.cos(a)*r, y = q[1] + Math.sin(a)*r; f.moveTo(x+d, y); f.arc(x, y, d, 0, TAU); } }); st.fill = f; },
  feather(st,p,w){ const q = resample(p, 2.5), a = new Path2D(), L = q.L || 1;
    q.forEach(o=>{ const len = w*(1.5 + 3.5*Math.sin(Math.PI*o.s/L)); [1,-1].forEach(sd=>{ a.moveTo(o.x, o.y); a.lineTo(o.x - o.ty*len*sd - o.tx*len*.5, o.y + o.tx*len*sd - o.ty*len*.5); }); });
    a.moveTo(q[0].x, q[0].y); q.forEach(o => a.lineTo(o.x, o.y)); st.alt = a; },
  fur(st,p,w){ const a = new Path2D(); resample(p, 2.5).forEach((o,i)=>{ const d = Math.hypot(o.x,o.y) || 1, j = (rnd(st.seed+i)-.5)*.9, ux = o.x/d, uy = o.y/d,
      c = Math.cos(j), s = Math.sin(j), dx = ux*c - uy*s, dy = ux*s + uy*c, len = w*(2 + 3*rnd(st.seed+i*2));
      a.moveTo(o.x, o.y); a.lineTo(o.x + dx*len, o.y + dy*len); }); st.alt = a; }
};
// Ramer–Douglas–Peucker: drop points that don't change the shape, so each redraw is far cheaper
function simplify(p, tol){
  if (p.length < 4) return p;
  const keep = new Uint8Array(p.length); keep[0] = keep[p.length-1] = 1;
  const stack = [[0, p.length-1]], t2 = tol*tol;
  while (stack.length){
    const [a, b] = stack.pop(); const ax=p[a][0], ay=p[a][1], dx=p[b][0]-ax, dy=p[b][1]-ay, L=dx*dx+dy*dy || 1e-9;
    let best = -1, bi = -1;
    for (let i=a+1;i<b;i++){ let t=((p[i][0]-ax)*dx+(p[i][1]-ay)*dy)/L; t=t<0?0:t>1?1:t; const ex=ax+dx*t-p[i][0], ey=ay+dy*t-p[i][1], d=ex*ex+ey*ey; if (d>best){ best=d; bi=i; } }
    if (best > t2){ keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return p.filter((_, i) => keep[i]);
}
/* ---- Track zones: each track's drawing is drawn inside its own ring of the mandala (the sound still follows where you drew) ---- */
const ZONES = { center:[0,.2], inner:[.2,.4], middle:[.4,.6], outer:[.6,.8], edge:[.8,1] };
function zoneOf(t){
  if (!t) return null;
  const z = (t.id === S.cur ? S.zone : t.zone) || 'all';
  if (z === 'all') return null;
  if (ZONES[z]) return ZONES[z];
  const i = S.tracks.indexOf(t), N = S.tracks.length;   // auto: track 1 in the middle, later tracks further out
  return N < 2 ? null : [i/N, (i+1)/N];
}
const zoneSig = t => { const z = zoneOf(t); return z ? z[0].toFixed(3) + ',' + z[1].toFixed(3) + '|' + Math.round(maxR()) : ''; };
function zoneMap(z, x, y){
  const R = maxR(), d = Math.hypot(x, y) || 1e-6, a = z[0] + (z[0] > 0 ? .015 : 0), b = z[1] - .015, nd = R*(a + Math.min(1, d/R)*(b - a));
  return [x*nd/d, y*nd/d];
}
function visPts(st){
  const t = trackOf(st), z = zoneOf(t); if (!z) return st.pts;
  const sig = zoneSig(t) + '|' + st.pts.length;
  if (st._vp && st._vpSig === sig) return st._vp;
  st._vp = st.pts.map(([x, y]) => zoneMap(z, x, y)); st._vpSig = sig; return st._vp;
}
const zoneW = st => { const z = zoneOf(trackOf(st)); return z ? z[1] - z[0] : 1; };
function build(st){
  const p = visPts(st), w = st.width, path = new Path2D(), q = simplify(p, .7);
  path.moveTo(q[0][0], q[0][1]);
  for (let i=1;i<q.length-1;i++) path.quadraticCurveTo(q[i][0], q[i][1], (q[i][0]+q[i+1][0])/2, (q[i][1]+q[i+1][1])/2);
  path.lineTo(q[q.length-1][0], q[q.length-1][1]);
  st.path = path; st.fill = null; st.alt = null;
  let rs = 0; for (const q of p) rs += Math.hypot(q[0], q[1]); const mr = rs/p.length/maxR();
  st.band = mr > .62 ? 0 : mr > .32 ? 1 : 2;
  if (BUILD[st.brush]) BUILD[st.brush](st, p, w);
  // chord strokes: one extra line per chord note, pushed inward onto that note's pitch ring
  st.chordPaths = null;
  if (st.ch && st.ch !== 'single' && CHORDS[st.ch]){
    const n = SCALES[S.scale].length, step = maxR()/(n*3)*zoneW(st), offs = chordIdx(0, st.ch).filter(o => o);
    st.chordPaths = offs.map(o => {
      const cp = new Path2D(); let first = true;
      for (const pt of q){ const d = Math.hypot(pt[0], pt[1]) || 1, nd = Math.max(2, d - o*step), x = pt[0]*nd/d, y = pt[1]*nd/d; first ? cp.moveTo(x, y) : cp.lineTo(x, y); first = false; }
      return cp;
    });
  }
  st.dirty = false;
}
function drawBrush(g, st, col, al, lw, e, glow, now, core, main){
  const D = (BRUSHES[st.brush] || BRUSHES.line).draw, MS = main || `rgba(${col},${al})`;
  switch (D){
    case 'neon':
      g.strokeStyle = `rgba(${col},${.16 + glow*.16})`; g.lineWidth = lw*4.5; g.stroke(st.path);
      g.strokeStyle = core; g.lineWidth = Math.max(.9, lw*.7); g.stroke(st.path); break;
    case 'bolt':
      g.strokeStyle = `rgba(${col},${.15 + glow*.15})`; g.lineWidth = lw*3.5; g.stroke(st.alt);
      g.strokeStyle = MS; g.lineWidth = lw*.9; g.stroke(st.alt);
      g.strokeStyle = core; g.lineWidth = Math.max(.6, lw*.3); g.stroke(st.alt); break;
    case 'stamp': {   // emoji, letters or your own picture along the line
      const q = st.stampQ || [], sz = Math.max(9, st.width*8), img = stampImgOf(st), txt = st.stamp || S.stamp || '✿';
      g.fillStyle = MS; g.font = `${sz}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const o of q){ g.save(); g.translate(o.x, o.y); g.rotate(Math.atan2(o.ty, o.tx)); if (img) g.drawImage(img, -sz/2, -sz/2, sz, sz); else g.fillText(txt, 0, 0); g.restore(); }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; break; }
    case 'fill': g.fillStyle = MS; g.fill(st.fill); break;
    case 'vine': g.strokeStyle = `rgba(${col},${al*.8})`; g.lineWidth = Math.max(.8, lw*.5); g.stroke(st.path); g.fillStyle = MS; g.fill(st.fill); break;
    case 'chain': g.strokeStyle = MS; g.lineWidth = .8 + e; g.stroke(st.path); g.lineWidth = 1 + lw*.35; g.stroke(st.fill); break;
    case 'outline': g.strokeStyle = MS; g.lineWidth = .9 + lw*.35; g.stroke(st.fill); break;
    case 'alt': g.strokeStyle = MS; g.lineWidth = Math.max(.8, lw*.75); g.stroke(st.alt); break;
    case 'hair': g.strokeStyle = `rgba(${col},${al*.85})`; g.lineWidth = .6 + lw*.22; g.stroke(st.alt); break;
    case 'dash': g.setLineDash([st.width*3.2, st.width*2.6]); g.lineDashOffset = -now*.02; g.strokeStyle = MS; g.lineWidth = lw; g.stroke(st.path); g.setLineDash([]); break;
    default: g.strokeStyle = MS; g.lineWidth = lw; g.stroke(st.path);
  }
}

// brush picker with live previews
const STAMP_IMGS = new Map();
function stampImgOf(st){
  const t = st.track !== undefined ? trackOf(st) : null, src = t ? trackVal(t, 'stampImg') : S.stampImg; if (!src) return null;
  let im = STAMP_IMGS.get(src); if (!im){ im = new Image(); im.src = src; STAMP_IMGS.set(src, im); }
  return im.complete && im.naturalWidth ? im : null;
}
function previewOn(c, brush){
  const g = c.getContext('2d'); g.setTransform(2,0,0,2,0,0); g.clearRect(0,0,88,28); g.lineCap = g.lineJoin = 'round';
  const st = { brush, width:1.4, seed:7, pts:[] };
  for (let i=0;i<=40;i++){ st.pts.push([8 + i*1.8, 14 + Math.sin(i/40*TAU)*6]); }
  build(st); drawBrush(g, st, '232,199,126', 1, 1.6, .2, .3, 0, 'rgba(255,250,240,.9)');
}
function renderBrushGrid(){
  const pop = $('brushPop'); pop.innerHTML = '';
  for (const k in BRUSHES){
    const b = document.createElement('button'); b.className = 'tile'; b.dataset.v = k; b.setAttribute('role','menuitemradio'); b.setAttribute('aria-label', BRUSHES[k].name);
    const c = document.createElement('canvas'); c.width = 176; c.height = 56; b.append(c); pop.append(b); previewOn(c, k);
    b.onclick = () => { S.brush = k; stashTrack(); syncBrush(); setBrushPop(false); };
  }
}
function setBrushPop(open){
  const pop = $('brushPop'), btn = $('brushBtn'); pop.hidden = !open; btn.setAttribute('aria-expanded', open);
  if (!open) return;
  const r = btn.getBoundingClientRect(), w = Math.min(420, innerWidth - 24);
  pop.style.width = w + 'px'; pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width/2 - w/2)) + 'px';
  placeMenu(pop, r);
  pop.querySelector(`[data-v="${S.brush}"]`)?.focus({ preventScroll:true });
}
$('brushBtn').onclick = e => { e.stopPropagation(); setBrushPop($('brushPop').hidden); };
document.addEventListener('pointerdown', e => { if (!$('brushPop').hidden && !e.target.closest('#brushPop, #brushBtn')) setBrushPop(false); });
addEventListener('resize', () => setBrushPop(false));
function drawBrushPreview(){ previewOn($('brushPrev'), S.brush); }
function syncBrush(){ drawBrushPreview(); $('stampRow').hidden = S.brush !== 'stamp'; document.querySelectorAll('#brushPop .tile').forEach(t => t.setAttribute('aria-pressed', t.dataset.v === S.brush)); }

/* ================= Symmetry modes ================= */
function copies(now, n = S.sym, kal = S.kal, mir = S.mirror){
  const out = [], flips = mir ? [1,-1] : [1], R = maxR(), re = S.react/100;
  let ki = 0;
  const push = (o) => { for (const f of flips) out.push(Object.assign({ r:0, f, s:1, a:1, tx:0, r2:0, px:0, py:0, sy:1, fx:1, k: ki }, o)); ki++; };
  const radial = (o={}) => { for (let k=0;k<n;k++) push(Object.assign({}, o, { r: (o.r||0) + k*TAU/n })); };
  switch (kal){
    case 'spiral': for (let k=0;k<n;k++) push({ r:k*TAU/n + k*.18, s:Math.pow(.86,k), a:Math.max(.25, 1-k*.05) }); break;
    case 'echo': for (let j=0;j<3;j++) radial({ r:j*GA, s:Math.pow(.618,j), a:Math.pow(.6,j) }); break;
    case 'rings': for (let j=0;j<3;j++) radial({ r:j*Math.PI/n + (j%2?-1:1)*now*.00007*(j+1), s:[1,.62,.38][j], a:[1,.8,.6][j] }); break;
    case 'bloom': radial({ s:.55, tx:R*(.32 + bass*.12*re + beat*.06*re) }); break;
    case 'flower': radial({ s:.7 }); radial({ r:Math.PI/n, s:.4, tx:R*.55, a:.8 }); break;
    case 'mandala': radial({}); radial({ r:Math.PI/n, s:.5, a:.75 }); for (let k=0;k<n*2;k++) push({ r:k*Math.PI/n, tx:R*.88, s:.2, r2:now*.0006, a:.7 }); break;
    case 'lotus': for (let j=0;j<3;j++) radial({ r:j*Math.PI/n/1.5, s:[1,.72,.46][j], sy:[.55,.75,1][j], a:[.75,.85,1][j] }); break;
    case 'fractal': radial({}); for (let k=0;k<n;k++) for (let j=0;j<3;j++) push({ r:k*TAU/n, tx:R*.62, r2:j*TAU/3 + now*.0003, s:.3, a:.7 }); break;
    case 'tunnel': for (let j=0;j<5;j++){ const u = (j + tunnelPhase)/5; radial({ r:j*.35, s:.12 + 1.25*Math.pow(u,1.6), a:Math.sin(Math.PI*u) }); } break;
    case 'vortex': { const tw = .35 + bass*.9*re; for (let j=0;j<4;j++) radial({ r:j*tw, s:Math.pow(.76,j), a:Math.pow(.75,j) }); } break;
    case 'galaxy': { const tw = Math.sin(now*.00025)*1.4; for (let j=0;j<5;j++) radial({ r:j*tw*.5, s:Math.pow(.8,j), a:Math.pow(.8,j), sy:.85 + .15*Math.cos(j) }); } break;
    case 'sway': for (let k=0;k<n;k++) push({ r:k*TAU/n + Math.sin(now*.0015 + k*1.3)*(.07 + mid*.3*re) }); break;
    case 'ripple': for (let k=0;k<n;k++) push({ r:k*TAU/n, s:1 + .14*Math.sin(now*.004 - k*.9)*(1 + bass*re) }); break;
    case 'breathe': for (let k=0;k<n;k++) push({ r:k*TAU/n, s:.85 + .2*Math.sin(now*.0016)*(k%2 ? 1 : -1) + beat*.08*re }); break;
    case 'starburst': for (let k=0;k<n;k++) push({ r:k*TAU/n, s:k%2 ? .55 : 1, sy:k%2 ? 1 : 1.35, a:k%2 ? .8 : 1 }); break;
    case 'wheel': for (let k=0;k<n;k++) push({ r:k*TAU/n, r2:k%2 ? Math.PI : 0, s:.62, tx:R*.3 }); break;
    case 'orbit': for (let k=0;k<n;k++){ const r = k*TAU/n + now*.0004; push({ r, tx:R*.42, r2:-r*2 + now*.001, s:.4 }); } radial({ s:.35, a:.6 }); break;
    case 'twin': for (const sd of [-1,1]) for (let k=0;k<n;k++) push({ px:sd*R*.42, r:k*TAU/n*sd + now*.0003*sd, s:.48, fx:sd }); break;
    case 'infinity': for (let k=0;k<n*2;k++){ const th = (k/(n*2) + now*.00008)*TAU, d = 1 + Math.sin(th)**2, x = R*.75*Math.cos(th)/d, y = R*.75*Math.sin(th)*Math.cos(th)/d;
        push({ px:x, py:y, r:th, s:.26 }); } break;
    case 'hextile': { const m = Math.min(n, 6), D = R*.82, cells = [[0,0]]; for (let k=0;k<6;k++) cells.push([Math.cos(k*Math.PI/3)*D, Math.sin(k*Math.PI/3)*D]);
        cells.forEach(([x,y],ci) => { for (let k=0;k<m;k++) push({ px:x, py:y, r:k*TAU/m, s:.42, a:ci ? .8 : 1 }); }); } break;
    case 'quilt': { const D = R*.62; for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) for (let k=0;k<4;k++)
        push({ px:i*D, py:j*D, r:k*Math.PI/2, s:.3, fx:(i+j)%2 ? -1 : 1, a:(i||j) ? .8 : 1 }); } break;
    case 'double': radial({ r: now*.00015 }); radial({ r: -now*.00015 + Math.PI/n, s:.68, a:.85 }); break;
    case 'cascade': for (let j=0;j<5;j++) radial({ r:j*Math.PI/n, s:1 - j*.17, a:1 - j*.15 }); break;
    case 'pinwheel': for (let k=0;k<n;k++) push({ r:k*TAU/n, tx:R*.16, r2:Math.PI/3, s:.82 }); break;
    case 'ellipse': for (let k=0;k<n;k++) push({ r:k*TAU/n, sy:.5 }); break;
    case 'wobble': for (let k=0;k<n;k++) push({ r:k*TAU/n + Math.sin(now*.003 + k)*.22, s:1 + .08*Math.sin(now*.002 + k*2) }); break;
    case 'kaleido': radial({}); radial({ r:Math.PI/n, tx:R*.5, s:.36, fx:-1, a:.85 }); radial({ tx:R*.8, s:.18, r2:now*.0005, a:.65 }); break;
    case 'heartbeat': radial({ s:.82 + bass*.35*re + beat*.25*re }); break;
    case 'clock': radial({ s:.55 }); for (let k=0;k<n;k++) push({ r:k*TAU/n, tx:R*.72, s:.24, r2:now*.002 }); break;
    case 'snowflake': radial({}); for (let k=0;k<n;k++){ push({ r:k*TAU/n, tx:R*.45, s:.34, r2:Math.PI/5 }); push({ r:k*TAU/n, tx:R*.45, s:.34, r2:-Math.PI/5 }); } break;
    case 'corners': { const D = R*.5; for (const [x,y] of [[-D,-D],[D,-D],[-D,D],[D,D]]) for (let k=0;k<n;k++) push({ px:x, py:y, r:k*TAU/n + now*.0002, s:.4 }); } break;
    case 'helix': for (let j=0;j<2;j++) for (let k=0;k<n;k++){ const r = k*TAU/n + j*Math.PI/n; push({ r, s:.75 + .25*Math.sin(now*.002 + k + j*Math.PI), a:.6 + .4*Math.cos(now*.002 + k + j*Math.PI)*.5 + .2 }); } break;
    case 'bounce': for (let k=0;k<n;k++) push({ r:k*TAU/n, tx:R*.12*Math.abs(Math.sin(now*.003 + k*.7)), s:.9 }); break;
    default: radial({});
  }
  return out;
}

