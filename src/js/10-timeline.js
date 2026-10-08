/* ================= Loop timeline ================= */
const tl = $('tl'), tlx = tl.getContext('2d'), TL_LABEL = 126, RULER = 20, LANE_MIN = 18, LANE_MAX = 160, PITCH_AT = 40, TL_KEY = 'mandawla-tl-lane';
// lane height: the user's stretch preference, squeezed if the screen can't fit it. Lanes this tall or taller show each note at its pitch.
let tlLanePref = 26, LANE = 26, tlMaxH = 400;
try { const v = +localStorage.getItem(TL_KEY); if (v >= LANE_MIN && v <= LANE_MAX) tlLanePref = v; } catch {}
const tlRanges = new Map();   // per-track pitch window, frozen while a note is being dragged
const scaleN = () => SCALES[S.scale].length*3;
let lanes = [], lanesAt = 0, tlDrag = false, tlBoxes = [], tlEdit = null;
let tlZoom = 1, tlOff = 0, tlSel = new Set(), tlClip = null, tlHover = null, tlBox = null, tlCue = 0;
const tlSpan = () => LB()/tlZoom;
function tlClamp(){ const L = LB(); tlZoom = Math.max(1, Math.min(32, tlZoom)); tlOff = Math.max(0, Math.min(L - L/tlZoom, tlOff)); $('tlFit').textContent = (tlZoom < 10 ? tlZoom.toFixed(tlZoom % 1 ? 1 : 0) : Math.round(tlZoom)) + '×'; }
function computeLanes(){
  const lanesNow = S.tracks.map(t => ({ t, items: [] }));
  for (const st of strokes){
    if (!st.notes.length) continue;
    const lane = lanesNow.find(l => l.t.id === st.track); if (!lane) continue;
    const col = rgbStr(strokeRGB(st, 0, .3)); for (const n of st.notes) lane.items.push([n, col]);
  }
  return lanesNow;
}
let tlFull = false;
function placeTimeline(){ try {
  if (tlFull){ $('timeline').style.top = ''; tlMaxH = innerHeight - 52; $('tlWrap').style.maxHeight = tlMaxH + 'px'; return; }
  const top = document.querySelector('.top').getBoundingClientRect().bottom + 8; $('timeline').style.top = top + 'px';
  tlMaxH = Math.max(RULER + LANE_MIN + 6, innerHeight - top - 120);   // leave room for the control deck
  $('tlWrap').style.maxHeight = tlMaxH + 'px';
} catch {} }
function laneRange(lane){
  const N = scaleN(); let lo = Infinity, hi = -Infinity;
  for (const [n] of lane.items){ if (n.b >= LB()) continue; lo = Math.min(lo, n.i); hi = Math.max(hi, n.i); }
  const frozen = tlEdit && tlRanges.get(lane.t.id);
  if (frozen){ const r = { lo: Math.min(frozen.lo, lo), hi: Math.max(frozen.hi, hi) }; tlRanges.set(lane.t.id, r); return r; }
  if (lo === Infinity){ lo = 0; hi = N - 1; }
  const span = Math.min(N - 1, Math.max(hi - lo + 2, 8));   // a little headroom, at least ~an octave
  lo = Math.max(0, Math.round((lo + hi)/2 - span/2)); hi = Math.min(N - 1, lo + span); lo = Math.max(0, hi - span);
  const r = { lo, hi }; tlRanges.set(lane.t.id, r); return r;
}
addEventListener('resize', placeTimeline);
/* ---- piano roll: the selected track's lane opens into a full note grid, right inside the timeline ---- */
const ROLL_HEAD = 24, ROLL_KEYX = 60, ROLL_KEY = TL_KEY + '-roll';
let tlSteps = true, tlAuto = 'off', autoEdit = null;
let tlRoll = false, tlGhost = true, rollRowPref = 12, ROWH = 12, tlHoverRow = -1, tlAddedAt = 0, tlAddedX = -99, TL_LAY = [], rollSeen = null;
try { const v = +localStorage.getItem(ROLL_KEY); if (v >= 9 && v <= 24) rollRowPref = v; } catch {}
const newLen = () => { const v = $('prLen').value; return v === 'grid' ? 1/S.grid : +v; };
// every lane's place on the canvas: y, height, and where its name row sits
function tlLayout(){
  const rows = Math.max(1, lanes.length), N = scaleN(), ri = tlRoll ? lanes.findIndex(l => l.t.id === S.cur) : -1;
  if (ri >= 0){
    LANE = Math.round(Math.max(LANE_MIN, Math.min(tlLanePref, 26)));
    ROWH = rollRowPref;   // rows keep their size; the timeline scrolls if they don't all fit
    if (tlFull){ const ah = tlAuto !== 'off' ? 54 : 0, fit = Math.floor((tlMaxH - RULER - 10 - (rows - 1)*LANE - ROLL_HEAD - ah)/N); ROWH = Math.max(rollRowPref, Math.min(28, fit)); }   // full screen: the grid grows to fill it
  } else LANE = Math.round(Math.max(LANE_MIN, Math.min(tlLanePref, (tlMaxH - RULER - 4)/rows)));
  let y = RULER;
  TL_LAY = lanes.map((l, li) => {
    const roll = li === ri, steps = roll && tlSteps && DRUM_INSTS.has(l.t.inst), core = steps ? 30 : N*ROWH, ah = roll && tlAuto !== 'off' ? 54 : 0;
    const h = roll ? ROLL_HEAD + core + 3 + ah : LANE, tall = roll || LANE >= PITCH_AT, bh = roll ? 16 : Math.min(LANE - 8, 16);
    const o = { y, h, roll, steps, tall, bh, ty: tall ? y + 4 + bh/2 : y + LANE/2, ry: y + ROLL_HEAD, ay: y + ROLL_HEAD + core + 3, ah };
    y += h; return o;
  });
  return y - RULER;
}
const laneAtY = y => TL_LAY.findIndex(o => y >= o.y && y < o.y + o.h);
const rollRowY = (lo, i) => lo.ry + (scaleN() - 1 - i)*ROWH;
const rollRowAt = (lo, y) => scaleN() - 1 - Math.floor((y - lo.ry)/ROWH);
const tlBeatAt = x => { const w = tl.getBoundingClientRect().width; return tlOff + (x - TL_LABEL)/(w - 4 - TL_LABEL)*tlSpan(); };
function drawTimeline(now){
  if (now - lanesAt > 350){ lanes = computeLanes(); lanesAt = now; }
  const rows = Math.max(1, lanes.length), HL = tlLayout();
  const dpr = Math.min(devicePixelRatio || 1, 2), w = tl.clientWidth, h = RULER + HL + 4;
  if (tl.style.height !== h + 'px') tl.style.height = h + 'px';
  if (tl.width !== Math.round(w*dpr) || tl.height !== Math.round(h*dpr)){ tl.width = Math.round(w*dpr); tl.height = Math.round(h*dpr); }
  // a newly opened (or newly picked) roll lane scrolls into view
  const rl = TL_LAY.find(o => o.roll), rid = rl ? S.cur : null;
  if (rid !== rollSeen){ rollSeen = rid; if (rl){ const wr = $('tlWrap'); if (rl.y - RULER < wr.scrollTop || rl.y + rl.h > wr.scrollTop + wr.clientHeight) wr.scrollTop = Math.max(0, rl.y - RULER); } }
  if (tlRoll && $('prSnap').getAttribute('aria-pressed') !== String(!!S.quant)) setP($('prSnap'), S.quant);
  { const dr = tlRoll && DRUM_INSTS.has(curT().inst); if ($('tlSteps').hidden === dr){ $('tlSteps').hidden = !dr; } const se = dr && tlSteps; if ($('tlEuclid').hidden === se) $('tlEuclid').hidden = !se; }
  const g = tlx; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  const L = LB(); tlClamp();
  // when zoomed in, keep the playhead on screen while the loop plays
  if (ac && S.loop && tlZoom > 1 && !tlEdit && !tlPinch){ const pb = ((beatsAt(ac.currentTime) % L) + L) % L, V = tlSpan(); if (pb < tlOff || pb > tlOff + V) { tlOff = Math.floor(pb/V)*V; tlClamp(); } }
  const V = tlSpan(), x0 = TL_LABEL, x1 = w - 4, X = b => x0 + ((b - tlOff)/V)*(x1 - x0);
  g.font = '500 9.5px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
  // ruler
  for (let k=Math.floor(tlOff*S.grid);k<=Math.ceil((tlOff+V)*S.grid);k++){
    const b = k/S.grid, x = X(b), bar = b % 4 === 0, bt = Number.isInteger(b);
    if (x < x0 - .5 || x > x1 + .5) continue;
    if (!bt && (x1-x0)/(V*S.grid) < 4) continue;
    if (bt && !bar && (x1-x0)/V < 3) continue;
    g.fillStyle = bar ? `rgba(${ACC},.55)` : bt ? 'rgba(235,225,205,.22)' : 'rgba(235,225,205,.08)';
    g.fillRect(x, bar ? 2 : bt ? 9 : 12, 1, bar ? h-4 : bt ? 6 : 3);
    if (rl && !bar){ g.fillStyle = bt ? 'rgba(235,225,205,.08)' : 'rgba(235,225,205,.035)'; g.fillRect(x, rl.ry, 1, scaleN()*ROWH); }   // the grid inside the roll
    const every = Math.max(1, Math.ceil(22/((x1-x0)/(V/4))));   // label fewer bars when they get tight
    if (bar && b < L && (b/4) % every === 0){ g.fillStyle = `rgba(${ACC},.85)`; g.fillText(String(b/4 + 1), x + 4, 8); }
    else if (bt && !bar && b < L && (x1-x0)/V >= 34 && x < x1 - (tlRoll ? 260 : 92)){ g.fillStyle = 'rgba(154,150,166,.75)'; g.fillText(Math.floor(b/4) + 1 + '.' + (b % 4 + 1), x + 3, 8); }   // beat numbers once there's room
  }
  g.fillStyle = 'rgba(154,150,166,.9)'; g.fillText((tlRoll ? (w < 600 ? 'NOTES' : 'NOTE GRID · ' + S.bars + (S.bars > 1 ? ' BARS' : ' BAR')) : 'LOOP · ' + S.bars + (S.bars > 1 ? ' BARS' : ' BAR')), 4, 8);
  // alternate bars get a faint band so bars read at a glance
  for (let k = Math.floor(tlOff/4); k*4 < Math.min(L, tlOff + V); k++){
    if (k % 2 === 0) continue;
    const a = Math.max(x0, X(k*4)), z = Math.min(x1, X(Math.min(L, k*4 + 4)));
    if (z > a){ g.fillStyle = `rgba(${ACC},.035)`; g.fillRect(a, RULER, z - a, HL); }
  }
  // lanes
  const solo = Object.values(S.mix).some(x => x.s), sl = SCALES[S.scale].length, N = scaleN();
  tlBoxes = [];
  lanes.forEach((lane, li) => {
    const t = lane.t, lo = TL_LAY[li], y = lo.y, H = lo.h, m = t, off = m.m || (solo && !m.s), isCur = t.id === S.cur, Lt = trackLoopLen(t);
    const ty = lo.ty, bh = lo.bh, tall = lo.tall;
    if (isCur){ g.fillStyle = `rgba(${ACC},.12)`; g.fillRect(0, y, w, lo.roll ? ROLL_HEAD : H - 1); }
    g.fillStyle = li % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.05)'; g.fillRect(x0, y, x1 - x0, H - 1);
    g.fillStyle = `rgba(${ACC},.14)`; g.fillRect(0, y + H - 1, w, 1);   // lane divider
    g.fillStyle = off ? 'rgba(154,150,166,.45)' : `rgb(${rgbStr(trackRGB(t))})`; g.fillRect(4, ty - 3, 6, 6);
    g.fillStyle = off ? 'rgba(154,150,166,.55)' : isCur ? `rgba(${ACC},1)` : 'rgba(239,234,224,.92)';
    g.fillText((li + 1 + ' ' + (t.name || instLabel(t))).toUpperCase().slice(0, 12), 13, ty);
    if (tall && !lo.roll && H >= 48){   // room for a second line: the instrument and how many notes
      const k = lane.items.filter(([n]) => n.b < L).length;
      g.fillStyle = 'rgba(154,150,166,.75)'; g.font = '400 9px "IBM Plex Mono", monospace';
      g.fillText((t.name ? instLabel(t) + ' · ' : '') + k + (k === 1 ? ' NOTE' : ' NOTES'), 13, ty + 15, TL_LABEL - 18);
      g.font = '500 9.5px "IBM Plex Mono", monospace';
    }
    // mute / solo boxes
    [['M', 96, m.m, '227,93,106'], ['S', 110, m.s, '127,216,205']].forEach(([lbl, bx, on, c]) => {
      g.fillStyle = on ? `rgba(${c},.95)` : 'rgba(255,255,255,.08)'; g.fillRect(bx, ty - bh/2, 12, bh);
      g.fillStyle = on ? '#141217' : 'rgba(239,234,224,.7)'; g.textAlign = 'center'; g.fillText(lbl, bx + 6, ty + .5); g.textAlign = 'left';
    });
    if (lo.ah){ g.fillStyle = 'rgba(127,216,205,.9)'; g.font = '500 9px "IBM Plex Mono", monospace'; g.fillText(tlAuto === 'vol' ? 'VOLUME' : 'FILTER', 13, lo.ay + 12); g.fillStyle = 'rgba(154,150,166,.7)'; g.font = '400 8.5px "IBM Plex Mono", monospace'; g.fillText('DRAG TO SHAPE', 13, lo.ay + 26); g.fillText('RIGHT-CLICK: CLEAR', 13, lo.ay + 38); g.font = '500 9.5px "IBM Plex Mono", monospace'; }
    if (lo.steps){ g.fillStyle = 'rgba(154,150,166,.75)'; g.font = '400 8.5px "IBM Plex Mono", monospace'; g.fillText('STEPS · CLICK', 13, lo.ry + 16); g.font = '500 9.5px "IBM Plex Mono", monospace'; }
    if (lo.roll && !lo.steps){
      // the keyboard: one key per scale note, high at the top; a key lights while its note sounds
      const lit = new Set(); for (const [n] of lane.items) if (n.hit && now - n.hit < 160) lit.add(n.i);
      g.font = (ROWH >= 12 ? '500 9px' : '500 8px') + ' "IBM Plex Mono", monospace';
      for (let i = 0; i < N; i++){
        const ry = rollRowY(lo, i), root = i % sl === 0;
        g.fillStyle = root ? `rgba(${ACC},.07)` : i % 2 ? 'rgba(255,255,255,.018)' : 'rgba(255,255,255,.04)'; g.fillRect(x0, ry, x1 - x0, ROWH - 1);
        if (i === tlHoverRow){ g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x0, ry, x1 - x0, ROWH - 1); }
        g.fillStyle = lit.has(i) ? `rgba(${rgbStr(trackRGB(t))},.95)` : root ? `rgba(${ACC},.22)` : i === tlHoverRow ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.08)';
        g.fillRect(ROLL_KEYX, ry, x0 - ROLL_KEYX - 6, ROWH - 1);
        if (ROWH >= 10 || root){ g.fillStyle = root ? `rgba(${ACC},.95)` : 'rgba(239,234,224,.62)'; g.fillText(noteName(i), ROLL_KEYX + 5, ry + ROWH/2); }
      }
      g.font = '500 9.5px "IBM Plex Mono", monospace';
      if (H > ROLL_HEAD + 40){ g.fillStyle = 'rgba(154,150,166,.7)'; g.font = '400 8.5px "IBM Plex Mono", monospace'; g.fillText('KEYS ▸', 13, lo.ry + 7); g.font = '500 9.5px "IBM Plex Mono", monospace'; }
    }
    g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, H - 1); g.clip();
    let rng = null, rh = 0;
    if (lo.steps) drawSteps(g, lo, lane, t, X, x0, x1, now, Lt);
    else if (lo.roll){
      rh = ROWH;
      if (tlGhost) for (const other of lanes){   // other tracks' notes, faintly, for reference
        if (other === lane || offTrack(other.t)) continue;
        g.fillStyle = `rgba(${rgbStr(trackRGB(other.t))},.16)`;
        for (const [n] of other.items){ if (n.b >= L || n.i >= N) continue; const x = X(n.b), wd = Math.max(4, X(Math.min(L, n.b + (n.d || 1/S.grid))) - x - 1); if (x > x1 || x + wd < x0) continue; g.fillRect(x, rollRowY(lo, n.i) + 3, wd, ROWH - 7); }
      }
    } else if (tall){
      // pitch view: each note sits at its scale step; faint lines mark the octaves
      rng = laneRange(lane); rh = (H - 7)/(rng.hi - rng.lo + 1);
      for (let s = rng.lo + 1; s <= rng.hi; s++) if (s % sl === 0){ g.fillStyle = 'rgba(239,234,224,.07)'; g.fillRect(x0, y + 3 + (rng.hi - s + 1)*rh, x1 - x0, 1); }
    }
    for (const [n, col] of lane.items){
      if (lo.steps) break;
      if (n.b >= L) continue;
      const x = X(n.b), wd = Math.max(lo.roll ? 6 : 8, X(Math.min(L, n.b + (n.d || 1/S.grid))) - x - 1), hot = n.hit && now - n.hit < 160;
      if (x > x1 || x + wd < x0) continue;
      const sel = tlSel.has(n);
      let ny, nh;
      if (lo.roll){
        const ii = Math.min(N - 1, n.i); ny = rollRowY(lo, ii) + 1; nh = ROWH - 3;
        if (n.ch && n.ch !== 'single') for (const ci of chordIdx(ii, n.ch).slice(1)) if (ci < N){ g.fillStyle = `rgba(${col},.26)`; g.fillRect(x, rollRowY(lo, ci) + 3, wd, ROWH - 7); }   // chord tones
      }
      else if (tall){ nh = Math.max(4, rh - 1); ny = y + 3 + (rng.hi - n.i)*rh + (rh - nh)/2; }
      else { ny = y + 4; nh = H - 9; }
      g.fillStyle = `rgba(${col},${off ? .25 : hot || sel ? 1 : lo.roll ? .88 : .8})`;
      if (hot) g.fillRect(x, ny - (lo.roll ? 1 : 2), wd, nh + (lo.roll ? 2 : 4)); else g.fillRect(x, ny, wd, nh);
      if (sel || n === tlHover){ g.strokeStyle = sel ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.5)'; g.lineWidth = sel ? 1.5 : 1; g.strokeRect(x + .5, ny + .5, wd - 1, nh - 1); }
      if (wd > 12 && nh >= 8 && (lo.roll || n === tlHover || sel || n.d)){ g.fillStyle = 'rgba(0,0,0,.4)'; const gy = ny + Math.min(3, nh*.2), gh = nh - 2*Math.min(3, nh*.2); g.fillRect(x + wd - 4, gy, 1.5, gh); g.fillRect(x + wd - 7, gy, 1.5, gh); }   // resize grip
      tlBoxes.push({ x, y: ny, w: wd, h: nh, n, rh, roll: lo.roll });
      if (Lt < L && n.b < Lt) for (let r = 1; n.b + r*Lt < L; r++){ const gx = X(n.b + r*Lt); if (gx > x1) break; g.fillStyle = `rgba(${col},.22)`; g.fillRect(gx, ny, wd, nh); }   // where a short loop repeats
    }
    if (Lt < L){ const xs = Math.max(x0, X(Lt)); if (xs < x1){ g.fillStyle = 'rgba(8,7,12,.42)'; g.fillRect(xs, y, x1 - xs, H - 1); g.fillStyle = `rgba(${ACC},.75)`; g.fillRect(xs, y, 1.5, H - 1); g.font = '500 8.5px "IBM Plex Mono", monospace'; g.fillText('↻ ' + Lt + (Lt === 1 ? ' BEAT' : ' BEATS'), xs + 5, y + 9); g.font = '500 9.5px "IBM Plex Mono", monospace'; } }
    if (lo.ah) drawAutoLane(g, lo, t, X, x0, x1, V);
    g.restore();
  });
  if (tlZoom > 1){   // scroll bar showing which part of the loop is in view
    const sx = x0 + (tlOff/L)*(x1 - x0), sw = Math.max(12, (V/L)*(x1 - x0));
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x0, h - 3, x1 - x0, 2); g.fillStyle = `rgba(${ACC},.7)`; g.fillRect(sx, h - 3, sw, 2);
  }
  // playhead
  if (ac && S.loop){
    const b = beatsAt(ac.currentTime), counting = ac.currentTime < countEnd, pos = ((b % L) + L) % L;
    if (!counting){ const x = X(pos); if (x >= x0 - 1 && x <= x1 + 1){ g.fillStyle = 'rgba(227,143,182,.95)'; g.fillRect(x - 1, 0, 2, h); } }
  }
  else if (tlCue > 0){   // stopped: Play starts here
    const x = X(tlCue); if (x >= x0 - 1 && x <= x1 + 1){ g.fillStyle = 'rgba(227,143,182,.55)'; g.fillRect(x - .5, RULER - 2, 1, h - RULER + 2);
      g.beginPath(); g.moveTo(x - 5, 3); g.lineTo(x + 5, 3); g.lineTo(x, 11); g.closePath(); g.fillStyle = 'rgba(227,143,182,.95)'; g.fill(); }
  }
  if (tlBox){ const bx = Math.min(tlBox.x0, tlBox.x1), by = Math.min(tlBox.y0, tlBox.y1), bw = Math.abs(tlBox.x1 - tlBox.x0), bh = Math.abs(tlBox.y1 - tlBox.y0);
    g.fillStyle = `rgba(${ACC},.12)`; g.fillRect(bx, by, bw, bh); g.strokeStyle = `rgba(${ACC},.8)`; g.lineWidth = 1; g.strokeRect(bx + .5, by + .5, bw, bh); }
  if (tlEdit && tlEdit.moved){   // where the note is landing
    const n = tlEdit.n, bx = tlBoxes.find(b => b.n === n);
    if (bx){ const txt = bx.roll ? noteName(n.i) + ' · ' + (tlEdit.mode === 'move' ? posLabel(n.b) : fmtBeats(n.d || 1/S.grid))
        : tlEdit.mode === 'move' ? posLabel(n.b) + (tlEdit.di ? ' · ' + (tlEdit.di > 0 ? '+' : '') + tlEdit.di + (Math.abs(tlEdit.di) === 1 ? ' step' : ' steps') : '') : 'Length ' + fmtBeats(n.d || 1/S.grid);
      g.font = '600 10px "IBM Plex Mono", monospace'; const tw = g.measureText(txt).width + 10, tx = Math.max(x0, Math.min(x1 - tw, bx.x)), ty = Math.max(1, bx.y - 15);
      g.fillStyle = 'rgba(20,18,24,.95)'; g.fillRect(tx, ty, tw, 14); g.fillStyle = `rgba(${ACC},1)`; g.fillText(txt, tx + 5, ty + 7.5); }
  }
}
function fmtBeats(d){ return (Math.round(d*100)/100) + (Math.abs(d - 1) < 1e-6 ? ' beat' : ' beats'); }
function posLabel(b){ const bar = Math.floor(b/4) + 1, beat = b - (bar - 1)*4 + 1; return 'Bar ' + bar + ' · Beat ' + (Math.round(beat*100)/100); }
function tlSeek(e){
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, w = r.width, L = LB();
  const b = Math.max(0, Math.min(L - 1e-3, tlOff + (x - TL_LABEL)/(w - 4 - TL_LABEL)*tlSpan()));
  ensureAudio(); const cyc = Math.floor(beatsAt(ac.currentTime)/L);
  clock0 = ac.currentTime - (cyc*L + b)*beatLen(); countEnd = 0; tlCue = snapB(b) < 1e-6 ? 0 : b;
  strokes.forEach(st => st.notes.forEach(n => n.cyc = -1));
}
function tlHit(x, y){
  for (let i=tlBoxes.length-1;i>=0;i--){ const bx = tlBoxes[i]; const pad = bx.h < 10 ? 3 : 1; if (x >= bx.x - 3 && x <= bx.x + bx.w + 4 && y >= bx.y - pad && y <= bx.y + bx.h + pad) return bx; }
  return null;
}
const onEdge = (hit, x) => hit.w > 12 && x > hit.x + hit.w - Math.max(8, Math.min(12, hit.w*.3));
const tlBeatsPerPx = () => tlSpan()/(tl.getBoundingClientRect().width - 4 - TL_LABEL);
const snapB = b => S.quant ? Math.round(b*S.grid)/S.grid : b;
// a note added in the roll gets its own little dot on its pitch ring, placed around the circle by time
function prAddNote(t, b, i, d){
  const L = LB(), R = maxR(), a = (b/L)*TAU - Math.PI/2, r = R*(1 - (i + .5)/scaleN()), x = Math.cos(a)*r, y = Math.sin(a)*r;
  const st = newStroke(); st.track = t.id; st.inst = t.inst; st.ch = 'single'; st.pinned = true;
  st.pts = [[x, y], [x + .5, y + .5]]; st.roll = true;
  const n = { b, i, d: Math.max(1/S.grid, Math.min(L, d)), cyc: -1, pi: 0, pan: +Math.max(-.7, Math.min(.7, x/R)).toFixed(2), ch: 'single' };
  st.notes.push(n); strokes.push(st); rollArc(st); lanesAt = 0; mixSig = ''; return n;
}
// a grid note's drawing: an arc on its pitch ring that starts at the note's time and runs as long as it lasts
function rollArc(st){
  const n = st.notes[0] || st.rollN; if (!n) return;
  const L = LB(), R = maxR(), N = scaleN(), d = n.d || 1/S.grid, ns = symOf(trackOf(st)), wedge = TAU/ns, sig = [n.b, n.i, d, L, Math.round(R), N, ns].join('|');
  if (st.rollSig === sig) return; st.rollSig = sig;
  const r = R*(1 - (Math.min(N - 1, n.i) + .5)/N), a0 = (n.b/L)*wedge*.96 - Math.PI/2, span = Math.min(wedge*.96, Math.max(.03, (d/L)*wedge*.96));
  const steps = Math.max(2, Math.min(400, Math.ceil(span*r/3)));
  st.pts = []; for (let k = 0; k <= steps; k++){ const a = a0 + span*k/steps; st.pts.push([Math.cos(a)*r, Math.sin(a)*r]); }
  n.pi = 0; n.pan = +Math.max(-.7, Math.min(.7, Math.cos(a0)*r/R)).toFixed(2); st.dirty = true; st.segs = null; st._vp = null;
}
function rollPreview(t, i){ ensureAudio(); voice(t.inst, i, .32, ac.currentTime + .01, 0, .3, 'single', t.id); }
function tlDeleteNote(n){
  pushHistory();
  for (const st of strokes){ const j = st.notes.indexOf(n); if (j >= 0){ st.notes.splice(j, 1); if (!st.notes.length && st.pinned && (st.roll || st.pts.length <= 2)) strokes.splice(strokes.indexOf(st), 1); break; } }
  tlSel.delete(n); syncTlBtns(); lanesAt = 0; mixSig = ''; tlHover = null; toast('Note deleted');
}
tl.addEventListener('pointerdown', e => {
  if (e.button === 2) return;   // right-click deletes (contextmenu below)
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const hit = x >= TL_LABEL ? tlHit(x, y) : null;
  if (tlPointers.size > 1) return;
  if (hit){
    // grab a note: drag its middle to move it (with any other selected notes), drag its right edge to change its length.
    // Shift-click adds to the selection; Alt/Option-drag drags a copy.
    if (e.shiftKey){ tlSel.has(hit.n) ? tlSel.delete(hit.n) : tlSel.add(hit.n); syncTlBtns(); return; }
    if (!tlSel.has(hit.n)){ tlSel = new Set([hit.n]); }
    pushHistory();
    const edge = onEdge(hit, x);
    let copied = false, lead = hit.n;
    if (e.altKey && !edge){ const map = copyNotes([...tlSel], 0); lead = map.get(hit.n); tlSel = new Set(map.values()); copied = true; }
    const items = (edge ? [lead] : [...tlSel]).map(n => ({ n, b0: n.b, d0: n.d || 1/S.grid, i0: n.i }));
    tlEdit = { n: lead, items, mode: edge ? 'len' : 'move', x0: x, y0: y, rh: hit.rh, di: 0, moved: false, copied };
    tl.setPointerCapture(e.pointerId); tl.style.cursor = edge ? 'ew-resize' : copied ? 'copy' : 'grabbing';
    if (hit.roll && !edge){ const st = ownerOf(lead); if (st) rollPreview(trackOf(st) || curT(), lead.i); }
    syncTlBtns(); lanesAt = 0;
    return;
  }
  const li = y > RULER ? laneAtY(y) : -1, lo = TL_LAY[li];
  if (x < TL_LABEL && lo){
    const lane = lanes[li]; if (!lane) return;
    if (lo.roll && lo.ah && y >= lo.ay) return;
    if (lo.steps && y >= lo.ry){ rollPreview(lane.t, stepPitch(lane.t)); return; }
    if (lo.roll && y >= lo.ry){ if (x >= ROLL_KEYX){ const row = rollRowAt(lo, y); if (row >= 0 && row < scaleN()) rollPreview(lane.t, row); } return; }   // the keys
    const t = lane.t, nm = trackName(t), onBox = Math.abs(y - lo.ty) <= lo.bh/2 + 2;
    if (onBox && x >= 96 && x < 108){ t.m = !t.m; toast(nm + (t.m ? ' muted' : ' unmuted')); }
    else if ((onBox && x >= 110 && x < 122) || e.shiftKey){ t.s = !t.s; toast(nm + (t.s ? ' solo' : ' unsolo')); }
    else { selectTrack(t.id); return; }
    updateMix(); renderTracks(); mixSig = ''; return;
  }
  tl.setPointerCapture(e.pointerId);
  // the ruler scrubs the playhead
  if (y <= RULER){ tlDrag = true; tlSeek(e); return; }
  if (lo && lo.roll && lo.ah && y >= lo.ay){ autoEdit = { t: lanes[li].t, lo, lb: null }; autoPaint(x, y); return; }
  if (lo && lo.steps && y >= lo.ry && y < lo.ay){ toggleStep(lanes[li].t, x); return; }
  // piano roll: a click on an empty cell adds a note as long as "New Notes"; keep dragging right to stretch it
  if (lo && lo.roll && y >= lo.ry && !e.shiftKey){
    const row = rollRowAt(lo, y), L = LB(); if (row < 0 || row >= scaleN()) return;
    if (performance.now() - tlAddedAt < 450 && Math.abs(x - tlAddedX) < 40) return;   // second click of a double-click
    pushHistory();
    const raw = tlBeatAt(x), b = Math.max(0, Math.min(L - 1/S.grid, S.quant ? Math.floor(raw*S.grid)/S.grid : raw));
    const t = lanes[li].t, n = prAddNote(t, b, row, newLen());
    tlSel = new Set([n]); syncTlBtns(); rollPreview(t, row); tlAddedAt = performance.now(); tlAddedX = x;
    tlEdit = { n, items: [{ n, b0: b, d0: n.d, i0: row }], mode: 'len', x0: x, y0: y, rh: 0, di: 0, moved: false, added: true };
    tl.style.cursor = 'ew-resize'; return;
  }
  // empty lanes drag a box to select notes (a plain click moves the playhead)
  tlBox = { x0: x, y0: y, x1: x, y1: y, base: e.shiftKey ? new Set(tlSel) : new Set(), ev: e };
});
tl.addEventListener('pointermove', e => {
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (autoEdit){ autoPaint(x, y); return; }
  if (tlEdit){
    const L = LB(), db = (x - tlEdit.x0)*tlBeatsPerPx();
    if (Math.abs(x - tlEdit.x0) > 2 || (tlEdit.rh && Math.abs(y - tlEdit.y0) > 3)) tlEdit.moved = true;
    if (tlEdit.mode === 'move'){
      const lead = tlEdit.items.find(it => it.n === tlEdit.n) || tlEdit.items[0], shift = snapB(lead.b0 + db) - lead.b0;
      for (const it of tlEdit.items){ let b = ((it.b0 + shift) % L + L) % L; it.n.b = Math.min(b, L - 1e-3); it.n.cyc = -1; }
      if (tlEdit.rh){   // pitch view and piano roll: dragging up or down changes the note's pitch, one scale step at a time
        const N = scaleN(); let lo = Infinity, hi = -Infinity; for (const it of tlEdit.items){ lo = Math.min(lo, it.i0); hi = Math.max(hi, it.i0); }
        const di = Math.max(-lo, Math.min(N - 1 - hi, Math.round(-(y - tlEdit.y0)/tlEdit.rh)));
        if (di !== tlEdit.di){
          tlEdit.di = di; for (const it of tlEdit.items) it.n.i = it.i0 + di;
          const st = ownerOf(tlEdit.n); if (st){ ensureAudio(); voice(instOf(st), tlEdit.n.i, .3, ac.currentTime + .01, tlEdit.n.pan || 0, .3, tlEdit.n.ch || 'single', st.track); }
        }
      }
    }
    else { const it = tlEdit.items[0]; it.n.d = Math.max(1/S.grid, Math.min(L, snapB(it.d0 + db))); }
    return;
  }
  if (tlDrag){ tlSeek(e); return; }
  if (tlBox){
    tlBox.x1 = Math.max(TL_LABEL, x); tlBox.y1 = y;
    const bx = Math.min(tlBox.x0, tlBox.x1), by = Math.min(tlBox.y0, tlBox.y1), bw = Math.abs(tlBox.x1 - tlBox.x0), bh = Math.abs(tlBox.y1 - tlBox.y0);
    if (bw > 3 || bh > 3){
      tlSel = new Set(tlBox.base);
      for (const b of tlBoxes) if (b.x < bx + bw && b.x + b.w > bx && b.y < by + bh && b.y + b.h > by) tlSel.add(b.n);
      syncTlBtns();
    }
    return;
  }
  const hit = x >= TL_LABEL ? tlHit(x, y) : null, lo = y > RULER ? TL_LAY[laneAtY(y)] : null, inRoll = lo && lo.roll && y >= lo.ry;
  tlHover = hit ? hit.n : null; tlHoverRow = inRoll ? rollRowAt(lo, y) : -1;
  tl.style.cursor = hit ? (onEdge(hit, x) ? 'ew-resize' : 'grab') : x < TL_LABEL ? 'pointer' : y <= RULER ? 'col-resize' : inRoll ? 'cell' : 'crosshair';
});
tl.addEventListener('pointerleave', () => { tlHover = null; tlHoverRow = -1; });
tl.addEventListener('pointerup', () => {
  if (autoEdit){ autoEdit = null; return; }
  if (tlEdit){
    const n = tlEdit.n;
    const many = tlEdit.items.length > 1 ? tlEdit.items.length + ' notes' : 'Note';
    if (tlEdit.added){ if (tlEdit.moved) toast('Note length ' + fmtBeats(n.d)); }
    else if (tlEdit.copied) toast(many + ' copied');
    else if (!tlEdit.moved) undoStack.pop();          // a plain click on a note just selects it
    else toast(tlEdit.mode === 'move' ? many + (tlEdit.di ? ' moved · ' + (tlEdit.di > 0 ? '+' : '') + tlEdit.di + (Math.abs(tlEdit.di) === 1 ? ' step' : ' steps') : ' moved') : 'Note length ' + (+n.d.toFixed(2)) + ' beats');
    tlEdit = null; tl.style.cursor = 'grab'; lanesAt = 0; return;
  }
  if (tlBox){
    const moved = Math.abs(tlBox.x1 - tlBox.x0) > 3 || Math.abs(tlBox.y1 - tlBox.y0) > 3;
    if (!moved){ if (!tlBox.base.size){ tlSel.clear(); syncTlBtns(); } if (tlBox.x0 >= TL_LABEL) tlSeek(tlBox.ev); }
    else if (tlSel.size) toast(tlSel.size + (tlSel.size > 1 ? ' notes' : ' note') + ' selected');
    tlBox = null; return;
  }
  tlDrag = false;
});
tl.addEventListener('dblclick', e => {
  if (performance.now() - tlAddedAt < 500) return;   // the second click of a double-click that just made this note
  const r = tl.getBoundingClientRect(), hit = tlHit(e.clientX - r.left, e.clientY - r.top);
  if (hit) tlDeleteNote(hit.n);
});
tl.addEventListener('contextmenu', e => {
  { const r = tl.getBoundingClientRect(), y = e.clientY - r.top, lo = TL_LAY[laneAtY(y)];
    if (lo && lo.ah && y >= lo.ay && e.clientX - r.left >= TL_LABEL){ e.preventDefault(); const t = curT(); if (t.auto) t.auto[tlAuto] = []; toast('Automation cleared'); return; } }
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, hit = x >= TL_LABEL ? tlHit(x, e.clientY - r.top) : null;
  if (!hit) return; e.preventDefault(); tlDeleteNote(hit.n);
});
/* ---- drum steps and automation ---- */
function stepPitch(t){
  const cnt = {}; for (const st of strokes) if (st.track === t.id) for (const n of st.notes) cnt[n.i] = (cnt[n.i] || 0) + 1;
  const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; return best !== undefined ? +best : Math.round(scaleN()*.4);
}
function stepNotes(t, Lt){
  const G = S.grid, steps = Math.max(1, Math.min(128, Math.round(Lt*G))), map = new Map();
  for (const st of strokes) if (st.track === t.id) for (const n of st.notes){ if (n.b >= Lt) continue; const s = Math.round(n.b*G) % steps; if (!map.has(s)) map.set(s, []); map.get(s).push(n); }
  return { steps, map };
}
function drawSteps(g, lo, lane, t, X, x0, x1, now, Lt){
  const G = S.grid, { steps, map } = stepNotes(t, Lt), sy = lo.ry + 3, sh = 24, col = rgbStr(trackRGB(t));
  for (let s = 0; s < steps; s++){
    const xa = X(s/G), xb = X((s + 1)/G); if (xb < x0 || xa > x1) continue;
    const has = map.get(s), hot = has && has.some(n => n.hit && now - n.hit < 160), beat = s % G === 0;
    g.fillStyle = has ? `rgba(${col},${hot ? 1 : .85})` : beat ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.045)';
    g.fillRect(xa + 1, sy - (hot ? 2 : 0), Math.max(2, xb - xa - 2), sh + (hot ? 4 : 0));
  }
}
function toggleStep(t, x){
  const G = S.grid, Lt = trackLoopLen(t), b = Math.floor(tlBeatAt(x)*G)/G; if (b < 0 || b >= Lt) return;
  const { steps, map } = stepNotes(t, Lt), s = Math.round(b*G) % steps, has = map.get(s);
  pushHistory();
  if (has){ for (const n of has){ const st = ownerOf(n); if (!st) continue; st.notes.splice(st.notes.indexOf(n), 1); if (!st.notes.length && st.roll) strokes.splice(strokes.indexOf(st), 1); tlSel.delete(n); } }
  else { const p = stepPitch(t); prAddNote(t, s/G, p, 1/G); rollPreview(t, p); }
  lanesAt = 0; mixSig = ''; syncTlBtns();
}
// spread k hits as evenly as possible over the track's steps
function euclidFill(k){
  const t = curT(), G = S.grid, Lt = trackLoopLen(t), steps = Math.max(1, Math.min(128, Math.round(Lt*G))), p = stepPitch(t);
  pushHistory();
  for (let i = strokes.length - 1; i >= 0; i--){ const st = strokes[i]; if (st.track !== t.id) continue; st.notes = st.notes.filter(n => n.b >= Lt); if (!st.notes.length && st.roll) strokes.splice(i, 1); }
  for (let s = 0; s < steps; s++) if ((s*k) % steps < k) prAddNote(t, s/G, p, 1/G);
  tlSel.clear(); syncTlBtns(); lanesAt = 0; mixSig = ''; toast(k ? k + ' hits spread evenly' : 'Steps cleared');
}
function drawAutoLane(g, lo, t, X, x0, x1, V){
  const ay = lo.ay, ah = lo.ah - 5, pts = (t.auto || {})[tlAuto] || [], L = LB();
  g.fillStyle = 'rgba(127,216,205,.06)'; g.fillRect(x0, ay, x1 - x0, ah); g.fillStyle = 'rgba(127,216,205,.25)'; g.fillRect(x0, ay, x1 - x0, 1);
  g.strokeStyle = pts.length ? 'rgba(127,216,205,.95)' : 'rgba(127,216,205,.35)'; g.lineWidth = 1.5; g.beginPath();
  for (let px = x0; px <= x1; px += 3){ const b = Math.min(L - 1e-6, tlOff + (px - x0)/(x1 - x0)*V), v = autoVal(pts, b); const yy = ay + ah - (v == null ? 1 : v)*(ah - 2) - 1; px === x0 ? g.moveTo(px, yy) : g.lineTo(px, yy); }
  g.stroke(); g.fillStyle = 'rgba(127,216,205,.95)';
  for (const p of pts){ const px = X(p.b); if (px < x0 || px > x1) continue; g.fillRect(px - 1.5, ay + ah - p.v*(ah - 2) - 2.5, 3, 3); }
}
function autoPaint(x, y){
  const { t, lo } = autoEdit, G = S.grid, L = LB(), ah = lo.ah - 5;
  const b = Math.max(0, Math.min(L - 1/G, Math.round(tlBeatAt(x)*G)/G)), v = Math.max(0, Math.min(1, (lo.ay + ah - y)/(ah - 2)));
  if (!t.auto) t.auto = {}; if (!t.auto[tlAuto]) t.auto[tlAuto] = [];
  const pts = t.auto[tlAuto], set = (bb, vv) => { const k = pts.findIndex(p => Math.abs(p.b - bb) < .5/G); if (k >= 0) pts[k].v = vv; else pts.push({ b: bb, v: vv }); };
  if (autoEdit.lb != null && Math.abs(b - autoEdit.lb) > 1/G){   // fast drags fill the steps in between
    const a = autoEdit.lb, av = autoEdit.lv, n = Math.round(Math.abs(b - a)*G);
    for (let k = 1; k < n; k++){ const f = k/n; set(Math.round((a + (b - a)*f)*G)/G, av + (v - av)*f); }
  }
  set(b, +v.toFixed(3)); pts.sort((p, q) => p.b - q.b); autoEdit.lb = b; autoEdit.lv = v;
}
$('tlSteps').onclick = () => { tlSteps = !tlSteps; setP($('tlSteps'), tlSteps); lanesAt = 0; };
$('tlEuclid').onchange = e => { const v = e.target.value; e.target.value = ''; if (v !== '') euclidFill(+v); };
$('tlAuto').onchange = e => { tlAuto = e.target.value; lanesAt = 0; if (tlAuto !== 'off') toast((tlAuto === 'vol' ? 'Volume' : 'Filter') + ' automation · drag in the strip under the grid'); };
/* ---- interface themes (remembered in this browser) ---- */
const THEMES = {
  gold:   { name:'Night Gold', ink:'#121117', ink2:'#1b1a22', acc:'#e8c77e', rose:'#e38fb6', aqua:'#7fd8cd', text:'#efeae0', muted:'#9a96a6' },
  ocean:  { name:'Deep Ocean', ink:'#0c141c', ink2:'#14202d', acc:'#72c4ff', rose:'#ff8fb1', aqua:'#7fe0c8', text:'#e6f0f7', muted:'#8ea2b4' },
  rose:   { name:'Rose',       ink:'#1a1016', ink2:'#25171f', acc:'#f29bbd', rose:'#ffb38a', aqua:'#8fd8e0', text:'#f6e9ef', muted:'#ad93a2' },
  forest: { name:'Forest',     ink:'#0e1611', ink2:'#16221a', acc:'#a2dc8c', rose:'#f0a07a', aqua:'#7fd8b8', text:'#e8f1e4', muted:'#8fa392' },
  violet: { name:'Violet',     ink:'#130f1c', ink2:'#1d1729', acc:'#b9a2ff', rose:'#ff8fc7', aqua:'#7fd0ff', text:'#ece8f7', muted:'#9c96b2' },
  ember:  { name:'Ember',      ink:'#170f0b', ink2:'#221711', acc:'#ff9f5a', rose:'#ff7a8a', aqua:'#7fd8cd', text:'#f6ece4', muted:'#a8978a' },
  mono:   { name:'Graphite',   ink:'#111111', ink2:'#1c1c1c', acc:'#d6d6d6', rose:'#e0a0a0', aqua:'#a0d8d0', text:'#f0f0f0', muted:'#999999' }
};
let theme = 'gold';
function applyTheme(k){
  const T = THEMES[k] || THEMES.gold, st = document.documentElement.style; theme = THEMES[k] ? k : 'gold';
  for (const [v, c] of [['--ink', T.ink], ['--ink2', T.ink2], ['--gold', T.acc], ['--rose', T.rose], ['--aqua', T.aqua], ['--text', T.text], ['--muted', T.muted]]) st.setProperty(v, c);
  ACC = hexRGB(T.acc).join(','); st.setProperty('--line', `rgba(${ACC},.24)`);
  try { localStorage.setItem('mandawla-theme', theme); } catch {}
  const box = $('themeSw'); box.innerHTML = '';
  for (const key in THEMES){ const t = THEMES[key], b = document.createElement('button'); b.className = 'sw round'; b.setAttribute('aria-pressed', key === theme); b.setAttribute('aria-label', t.name); b.dataset.nm = t.name;
    b.innerHTML = `<i style="background:linear-gradient(135deg,${t.acc} 0 50%,${t.ink2} 50% 100%)"></i>`; b.onclick = () => applyTheme(key); box.append(b); }
}
try { theme = localStorage.getItem('mandawla-theme') || 'gold'; } catch {}
applyTheme(theme);
function setTlFull(on){
  tlFull = on; $('timeline').classList.toggle('full', on); setP($('tlFull'), on); $('tlFull').textContent = on ? '⤡' : '⤢';
  if (on && !tlRoll) setRoll(true);
  placeTimeline(); lanesAt = 0; hideTip();
}
$('tlFull').onclick = () => setTlFull(!tlFull);
function setRoll(open){
  tlRoll = open; S.timeline = open; setP($('tRoll'), open); $('tlRollOpts').hidden = !open; $('timeline').hidden = !open; lanesAt = 0;
  if (open){
    placeTimeline(); setP($('prSnap'), S.quant); setP($('prGhost'), tlGhost); hideTip();
    toast('Timeline · click the grid to add a note');
  } else { tlHoverRow = -1; tlSel.clear(); syncTlBtns(); if (tlFull) setTlFull(false); toast('Timeline hidden'); }
}
$('tRoll').onclick = () => setRoll(!tlRoll);
$('prSnap').onclick = () => { S.quant = !S.quant; setP($('prSnap'), S.quant); setP($('quant'), S.quant); toast(S.quant ? 'Snap to grid on' : 'Snap to grid off'); };
$('prGhost').onclick = () => { tlGhost = !tlGhost; setP($('prGhost'), tlGhost); };
/* ---- stretch the timeline down (in the piano roll: make its rows taller) ---- */
{
  const grip = $('tlGrip'); let gd = null;
  const setLane = v => { const was = LANE >= PITCH_AT; tlLanePref = Math.round(Math.max(LANE_MIN, Math.min(LANE_MAX, v))); LANE = tlLanePref; return was; };
  const setRow = v => { rollRowPref = Math.round(Math.max(9, Math.min(24, v))); };
  const save = () => { try { localStorage.setItem(TL_KEY, tlLanePref); localStorage.setItem(ROLL_KEY, rollRowPref); } catch {} };
  grip.addEventListener('pointerdown', e => { e.preventDefault(); grip.setPointerCapture(e.pointerId); gd = { y0: e.clientY, l0: LANE, r0: ROWH, roll: TL_LAY.some(o => o.roll), rows: Math.max(1, lanes.length), was: LANE >= PITCH_AT }; grip.classList.add('on'); });
  grip.addEventListener('pointermove', e => { if (!gd) return; if (gd.roll){ setRow(gd.r0 + (e.clientY - gd.y0)/scaleN()); } else setLane(gd.l0 + (e.clientY - gd.y0)/gd.rows); });
  ['pointerup','pointercancel'].forEach(ev => grip.addEventListener(ev, () => {
    if (!gd) return; const was = gd.was, roll = gd.roll; gd = null; grip.classList.remove('on'); save(); placeTimeline();
    if (roll) return;
    const now = Math.min(tlLanePref, (tlMaxH - RULER - 4)/Math.max(1, lanes.length)) >= PITCH_AT;
    if (now !== was) toast(now ? 'Pitch view · drag notes up/down to change pitch' : 'Compact timeline');
  }));
  grip.addEventListener('dblclick', () => { if (TL_LAY.some(o => o.roll)){ setRoll(false); return; } const was = setLane(LANE >= PITCH_AT ? 26 : 72); save(); toast(was ? 'Compact timeline' : 'Pitch view · drag notes up/down to change pitch'); });
  grip.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); const s = e.key === 'ArrowDown' ? 1 : -1; if (TL_LAY.some(o => o.roll)) setRow(rollRowPref + s*2); else setLane(LANE + s*6); save(); } });
  grip.tabIndex = 0;
}
/* ---- copy, paste, duplicate, zoom ---- */
const ownerOf = n => strokes.find(st => st.notes.includes(n));
// copies stay linked to the same drawing, so the copied piece lights up again at its new time
function copyNotes(list, shift){
  const L = LB(), map = new Map();
  for (const n of list){ const st = ownerOf(n); if (!st) continue;
    const c = { ...n, b: (((n.b + shift) % L) + L) % L, cyc: -1, hit: undefined, vis: undefined, visHold: undefined };
    st.notes.push(c); map.set(n, c); }
  lanesAt = 0; mixSig = ''; return map;
}
function selSpan(list){ let a = Infinity, z = -Infinity; for (const n of list){ a = Math.min(a, n.b); z = Math.max(z, n.b + (n.d || 1/S.grid)); } return [a, z]; }
function duplicateSel(){
  if (!tlSel.size) return; pushHistory();
  const list = [...tlSel], [a, z] = selSpan(list), map = copyNotes(list, snapB(z - a) || 1/S.grid);
  tlSel = new Set(map.values()); syncTlBtns(); toast((list.length > 1 ? list.length + ' notes' : 'Note') + ' duplicated');
}
function deleteSel(){
  if (!tlSel.size) return; pushHistory(); const k = tlSel.size;
  for (const st of strokes) st.notes = st.notes.filter(n => !tlSel.has(n));
  tlSel.clear(); syncTlBtns(); lanesAt = 0; mixSig = ''; toast((k > 1 ? k + ' notes' : 'Note') + ' deleted');
}
function copySel(){ if (!tlSel.size) return; const list = [...tlSel], [a] = selSpan(list); tlClip = list.map(n => ({ n, rel: n.b - a })); toast((list.length > 1 ? list.length + ' notes' : 'Note') + ' copied'); }
function pasteClip(){
  if (!tlClip || !tlClip.length) return;
  const live = tlClip.filter(c => ownerOf(c.n)); if (!live.length){ toast('Nothing to paste'); return; }
  pushHistory();
  let at; if (ac && S.loop) at = snapB(((beatsAt(ac.currentTime) % LB()) + LB()) % LB());
  else { const [a, z] = selSpan(live.map(c => c.n)); at = snapB(z) ; }
  const L = LB(), out = new Set();
  for (const c of live){ const st = ownerOf(c.n); const nn = { ...c.n, b: (((at + c.rel) % L) + L) % L, cyc: -1, hit: undefined, vis: undefined, visHold: undefined }; st.notes.push(nn); out.add(nn); }
  tlSel = out; syncTlBtns(); lanesAt = 0; mixSig = ''; toast((out.size > 1 ? out.size + ' notes' : 'Note') + ' pasted');
}
function syncTlBtns(){ const on = tlSel.size > 0; $('tlDup').hidden = !on; $('tlDel').hidden = !on; }
$('tlDup').onclick = duplicateSel; $('tlDel').onclick = deleteSel;
function zoomAt(f, px){
  const r = tl.getBoundingClientRect(), x = px ?? (TL_LABEL + (r.width - 4 - TL_LABEL)/2), frac = Math.max(0, Math.min(1, (x - TL_LABEL)/(r.width - 4 - TL_LABEL)));
  const anchor = tlOff + frac*tlSpan(); tlZoom *= f; tlClamp(); tlOff = anchor - frac*tlSpan(); tlClamp();
}
$('tlIn').onclick = () => zoomAt(1.6); $('tlOut').onclick = () => zoomAt(1/1.6);
$('tlFit').onclick = () => { tlZoom = 1; tlOff = 0; tlClamp(); };
tl.addEventListener('wheel', e => {
  const r = tl.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey){ e.preventDefault(); zoomAt(Math.exp(-e.deltaY*.01), e.clientX - r.left); return; }
  const w = $('tlWrap'), canScrollY = w.scrollHeight > w.clientHeight + 1, vertical = Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey;
  if (canScrollY && vertical) return;   // lanes overflow: let the wheel scroll them (shift-wheel still scrolls time)
  if (tlZoom > 1){ e.preventDefault(); tlOff += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)*tlBeatsPerPx(); tlClamp(); }
}, { passive:false });
// two fingers on the timeline: pinch to zoom, slide to scroll
const tlPointers = new Map(); let tlPinch = null;
tl.addEventListener('pointerdown', e => {
  tlPointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (tlPointers.size === 2){
    if (tlEdit){ tlEdit.items.forEach(it => { it.n.b = it.b0; it.n.i = it.i0; }); tlEdit = null; }
    tlBox = null;
    tlDrag = false;
    const [a, b] = [...tlPointers.values()], r = tl.getBoundingClientRect(), mid = (a[0] + b[0])/2 - r.left;
    tlPinch = { d0: Math.abs(a[0] - b[0]) || 1, z0: tlZoom, frac: Math.max(0, Math.min(1, (mid - TL_LABEL)/(r.width - 4 - TL_LABEL))) };
    tlPinch.anchor = tlOff + tlPinch.frac*tlSpan();
  }
}, true);
tl.addEventListener('pointermove', e => {
  if (!tlPointers.has(e.pointerId)) return;
  tlPointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (!tlPinch || tlPointers.size < 2) return;
  e.stopImmediatePropagation();
  const [a, b] = [...tlPointers.values()], r = tl.getBoundingClientRect(), mid = (a[0] + b[0])/2 - r.left;
  const frac = Math.max(0, Math.min(1, (mid - TL_LABEL)/(r.width - 4 - TL_LABEL)));
  tlZoom = tlPinch.z0 * (Math.abs(a[0] - b[0]) || 1)/tlPinch.d0; tlClamp(); tlOff = tlPinch.anchor - frac*tlSpan(); tlClamp();
}, true);
['pointerup','pointercancel'].forEach(ev => tl.addEventListener(ev, e => { tlPointers.delete(e.pointerId); if (tlPointers.size < 2) tlPinch = null; }, true));

