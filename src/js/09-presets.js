/* ================= Presets & share codes ================= */
const KEY = 'resonance-presets-v2';
function loadAll(){ try { return JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('resonance-presets-v1')) || []; } catch { return []; } }
function saveAll(list){ try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }
let presets = loadAll();
const SAVED_KEYS = ['sym','mirror','fade','brush','width','palette','c1','c2','c3','drift','spread','bright','bg','bgCustom','stars','bgfx','trail',
  'kal','spin','viz','react','beatFx','inst','scale','key','tuning','oct','verb','echo','bpm','quant','loop',
  'bars','grid','swing','countIn','holdMode','glide','glideTime','timeline','rings','chord','strum','arp','metro','metroVol','mix','tracks','cur','zones',
  ];

function snapshot(name){
  const o = { name, v:5 };
  SAVED_KEYS.forEach(k => o[k] = k === 'mix' ? JSON.parse(JSON.stringify(S.mix)) : S[k]);
  o.strokes = strokes.filter(s => s.pts.length > 1).map(s => ({
    t0: +s.t0.toFixed(3), roll: s.roll ? 1 : undefined, stamp: s.brush === 'stamp' ? s.stamp : undefined, pal: s.pal, cs: s.cs, ch: s.ch, brush: s.brush, width: s.width, inst: instOf(s), track: s.track, seed: s.seed,
    pts: s.pts.map(p => [Math.round(p[0]), Math.round(p[1])]),
    notes: s.notes.map(n => ({ b: +n.b.toFixed(3), i: n.i, pi: n.pi, pan: n.pan, d: n.d ? +n.d.toFixed(3) : undefined, ch: n.ch && n.ch !== 'single' ? n.ch : undefined, ak: n.ak, v: n.v ? +n.v.toFixed(2) : undefined }))
  }));
  return o;
}
function syncUI(){
  $('sym').value = S.sym; $('symVal').textContent = S.sym; setP($('mirror'), S.mirror);
  $('fade').value = S.fade; $('tZone').value = S.zone || 'all'; syncFx(); setP($('focusBtn'), !!S.focus); $('mirror').textContent = S.mirror ? 'On' : 'Off'; $('tAlpha').value = S.alpha ?? 100; $('tAlphaVal').textContent = (S.alpha ?? 100) + '%'; $('width').value = S.width; $('widthVal').textContent = S.width;
  $('c1').value = S.c1; $('c2').value = S.c2; $('c3').value = S.c3; $('bgCustom').value = S.bgCustom;
  setP($('drift'), S.drift); $('drift').textContent = S.drift ? 'On' : 'Off'; $('bgfx').value = S.bgfx || (S.stars === false ? 'none' : 'stars'); setP($('beatFx'), S.beatFx);
  $('spread').value = S.spread; $('bright').value = S.bright; $('spreadVal').textContent = S.spread; $('brightVal').textContent = S.bright + '%'; $('trailVal').textContent = S.trail; $('trail').value = S.trail; $('spin').value = S.spin; $('spinVal').textContent = S.spin;
  $('react').value = S.react; $('reactVal').textContent = S.react + '%';
  $('scale').value = S.scale; $('key').value = S.key; $('tuning').value = S.tuning;
  $('oct').value = S.oct; $('octVal').textContent = (S.oct > 0 ? '+' : '') + S.oct;
  { const t = curT(); if (t){ $('tvol').value = t.v; $('tvolVal').textContent = t.v; } } updateMix();
  $('bpm').value = S.bpm; $('bpmVal').textContent = S.bpm;
  setP($('quant'), S.quant); setP($('countIn'), S.countIn); setP($('glide'), S.glide); $('glide').textContent = S.glide ? 'On' : 'Off';
  $('glideTime').value = S.glideTime; $('glideVal').textContent = S.glideTime + ' MS'; $('glideRow').hidden = !S.glide;
  S.timeline = $('tRoll').getAttribute('aria-pressed') === 'true'; $('timeline').hidden = !S.timeline;   // the timeline shows only while its button is on
  $('swing').value = S.swing; $('metroVol').value = S.metroVol;
  syncSelects(); syncTransport();
  syncTrackTools();
  syncBrush();
  setP($('tRings'), S.rings); $('strum').value = S.strum; $('strumVal').textContent = S.strum + ' MS';
  renderPalSw(); renderBgSw(); applyBg(); updateMeta(); syncExtras();
}
function applyPreset(p){
  dropSel();
  SAVED_KEYS.forEach(k => { if (p[k] !== undefined) S[k] = (k === 'mix' || k === 'tracks') ? JSON.parse(JSON.stringify(p[k])) : p[k]; });
  S.tracks.forEach(t => { for (const k of ['loopB','duck','pitchCol','stamp','stampImg']) if (t[k] === undefined) t[k] = S_DEFAULTS[k]; });
  let legacyMap = null;
  if (!Array.isArray(p.tracks) || !p.tracks.length){ const lg = tracksFromLegacy(p); S.tracks = lg.tracks; legacyMap = lg.map; S.cur = S.tracks[0].id; }
  if (!trk(S.cur)) S.cur = S.tracks[0].id;
  S.tracks.forEach(t => { for (const k of ['verb','echo','fade']) if (t[k] === undefined) t[k] = S[k]; if (t.alpha === undefined) t.alpha = 100; if (RETIRED[t.inst]) t.inst = RETIRED[t.inst];
    if (t.sym === undefined) t.sym = t.tsym || S.sym; if (t.kal === undefined) t.kal = (t.tkal && MODES[t.tkal]) ? t.tkal : S.kal; if (t.mirror === undefined) t.mirror = S.mirror; delete t.tsym; delete t.tkal;
    if (!Array.isArray(t.afxList)) t.afxList = t.afx && t.afx !== 'none' ? [{ type: t.afx, amt: t.afxAmt ?? 60 }] : [];
    if (!Array.isArray(t.vfxList)) t.vfxList = t.vfx && t.vfx !== 'none' ? [{ type: t.vfx, amt: t.vfxAmt ?? 60 }] : [];
    delete t.afx; delete t.afxAmt; delete t.vfx; delete t.vfxAmt;
    if (!t.sendsMoved){ const vb = t.verb ?? S.verb ?? 45, ec = t.echo ?? S.echo ?? 20;
      if (vb > 0 && !t.afxList.some(x => x.type === 'reverb')) t.afxList.push({ type:'reverb', amt: vb });
      if (ec > 0 && !t.afxList.some(x => x.type === 'echo')) t.afxList.push({ type:'echo', amt: ec });
      t.sendsMoved = true; }
    if (!p.zones && t.zone === 'auto') t.zone = 'all';
    if (t.spin === undefined) t.spin = S.spin; for (const k of ['spread','bright','drift','trail']) if (t[k] === undefined) t[k] = S[k]; });
  if (RETIRED[S.inst]) S.inst = RETIRED[S.inst];
  updateMix();
  if (!PALETTES[S.palette]) S.palette = 'rainbow';
  if (S.bg !== 'custom'){ S.bgCustom = (BGS[S.bg] || BGS.black).c; S.bg = 'custom'; }   // older presets used named backgrounds
  if (!BRUSHES[S.brush]) S.brush = 'line';
  if (!MODES[S.kal]) S.kal = 'radial';
  if (!INST_NAMES[S.inst]) S.inst = 'bell';
  if (!SCALES[S.scale]) S.scale = 'penta';
  if (ac){ const b = beatsAt(ac.currentTime); clock0 = ac.currentTime - b*beatLen(); }
  strokes.length = 0; sparks.length = 0;
  (p.strokes||[]).forEach(s => strokes.push({
    t0: s.t0 ?? ((s.hue||0)/360), pal: PALETTES[s.pal] ? s.pal : 'rainbow', cs: s.cs || null,
    brush: BRUSHES[s.brush] ? s.brush : 'line', width:s.width||2, inst: INST_NAMES[s.inst] ? s.inst : S.inst, seed: s.seed || 1, ch: s.ch,
    track: legacyMap ? legacyMap.get(INST_NAMES[s.inst] ? s.inst : 'bell') : (trk(s.track) ? s.track : S.tracks[0].id),
    pts:s.pts, roll: !!s.roll, stamp: s.stamp, notes:(s.notes||[]).map(n => ({...n, cyc:-1})), pulse:1, pinned:true, dirty:true, born:performance.now(), band:1
  }));
  presetName = p.name; loadTrack(curT()); syncUI(); renderPresets(); renderTracks(); lanesAt = 0;
}
const say = msg => { $('status').textContent = msg; clearTimeout(say.t); say.t = setTimeout(()=> $('status').textContent = '', 3500); };
$('save').onclick = () => {
  const name = ($('pname').value.trim() || presetName || 'Project ' + (presets.length+1)).slice(0,30);
  const snap = snapshot(name), at = presets.findIndex(p => p.name === name);
  if (at >= 0) presets[at] = snap; else presets.push(snap);
  const btn = $('save');
  if (saveAll(presets)){ presetName = name; updateMeta(); btn.textContent = 'Saved ✓'; $('pname').value = ''; strokes.forEach(s => s.pinned = true); }
  else btn.textContent = "Couldn't Save In This Browser";
  renderPresets(); setTimeout(() => btn.textContent = 'Save Project', 1600);
};
$('pname').addEventListener('keydown', e => { if (e.key === 'Enter') $('save').click(); });

function encode(obj){ return 'RM2:' + btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
function decode(code){ code = code.trim(); if (code.startsWith('RM2:')) code = code.slice(4); return JSON.parse(decodeURIComponent(escape(atob(code)))); }
$('copyCode').onclick = () => {
  const snp = snapshot(presetName || 'Shared Mandala'); let dropped = false;
  snp.tracks = snp.tracks.map(t => { if (!t.sampleData) return t; dropped = true; const c = { ...t }; delete c.sampleData; if (c.inst === 'sampler') c.inst = 'bell'; return c; });
  const code = encode(snp); if (dropped) setTimeout(() => toast('Custom samples are left out of share codes'), 1500);
  const fallback = () => { $('codeIn').value = code; $('codeIn').select(); say('Code is selected below. Copy it with Ctrl/Cmd+C.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => say('Share code copied. Paste it to your friend.'), fallback);
  else fallback();
};
$('importCode').onclick = () => {
  try {
    const p = decode($('codeIn').value);
    if (!p || !Array.isArray(p.strokes)) throw 0;
    let name = p.name || 'Shared Mandala'; while (presets.some(x => x.name === name)) name += ' ·';
    p.name = name; presets.push(p); saveAll(presets); applyPreset(p);
    $('codeIn').value = ''; say('Loaded "' + name + '" and added it to your projects.');
  } catch { say("That code didn't work. Check that the whole code was pasted."); }
};
function renderPresets(){
  const box = $('plist'); box.innerHTML = '';
  if (!presets.length){ box.innerHTML = '<span class="empty">No saved projects yet</span>'; return; }
  presets.forEach((p, i) => {
    const chip = document.createElement('span'); chip.className = 'chip' + (p.name === presetName ? ' active' : '');
    const load = document.createElement('button'); load.textContent = p.name; load.title = 'Load ' + p.name; load.onclick = () => { ensureAudio(); pushHistory(); applyPreset(p); toast('Loaded ' + p.name); };
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Delete ' + p.name);
    x.onclick = () => {
      if (!x.classList.contains('armed')){ x.classList.add('armed'); x.textContent = 'Delete?'; setTimeout(() => { x.classList.remove('armed'); x.textContent = '×'; }, 2500); return; }
      presets.splice(i, 1); saveAll(presets); if (presetName === p.name){ presetName = null; updateMeta(); } renderPresets();
    };
    chip.append(load, x); box.append(chip);
  });
}

/* ================= Note rings overlay ================= */
const NN = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
function noteName(i){ const m = 45 + noteAt(i) + S.key + S.oct*12; return NN[((m%12)+12)%12] + (Math.floor(m/12) - 1); }
let hoverXY = null;
addEventListener('pointermove', e => { hoverXY = e.target === cv ? [e.clientX, e.clientY] : null; }, { passive:true });
cv.addEventListener('pointerleave', () => { hoverXY = null; });
cv.addEventListener('pointermove', e => { cv.style.cursor = outside(e.clientX, e.clientY) ? 'not-allowed' : 'crosshair'; }, { passive:true });
function drawRings(now){
  const R = maxR(), len = SCALES[S.scale].length, n = len*3, step = R/n;
  const ink = LIGHT ? '30,28,38' : '235,225,205', pc = rgbStr(paletteRGB(colorShift));
  ctx.save(); ctx.translate(W/2, CY()); ctx.globalCompositeOperation = 'source-over';
  for (let i=0;i<n;i++){   // bands of notes that just played light up
    const age = now - (ringHits[i] || -1e9);
    if (age < 0 || age > 450) continue;
    ctx.strokeStyle = `rgba(${pc},${(1 - age/450)*.45})`; ctx.lineWidth = step*.92;
    ctx.beginPath(); ctx.arc(0,0,R*(1 - (i+.5)/n),0,TAU); ctx.stroke();
  }
  let hov = -1;            // band under the pointer
  if (hoverXY){ const d = Math.hypot(hoverXY[0] - W/2, hoverXY[1] - CY()); if (d <= R) hov = Math.max(0, Math.min(n-1, Math.floor((1 - d/R)*n))); }
  if (hov >= 0){ ctx.strokeStyle = `rgba(${ink},.09)`; ctx.lineWidth = step; ctx.beginPath(); ctx.arc(0,0,R*(1 - (hov+.5)/n),0,TAU); ctx.stroke(); }
  for (let i=0;i<=n;i++){  // band edges; each octave's root is brighter
    const r = R*(1 - i/n), root = i % len === 0;
    ctx.strokeStyle = `rgba(${ink},${root ? .32 : .1})`; ctx.lineWidth = root ? 1.1 : .6;
    ctx.beginPath(); ctx.arc(0,0,Math.max(.5,r),0,TAU); ctx.stroke();
  }
  ctx.font = `600 ${Math.max(7, Math.min(10, step*.8))}px "IBM Plex Mono", monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (let i=0;i<n;i++){
    const root = i % len === 0; if (step < 7 && !root && i !== hov) continue;
    const r = R*(1 - (i+.5)/n), lit = i === hov || now - (ringHits[i] || -1e9) < 300;
    const label = noteName(i), tw = ctx.measureText(label).width, fs = Math.max(7, Math.min(10, step*.8));
    ctx.fillStyle = LIGHT ? 'rgba(255,255,255,.78)' : 'rgba(8,7,12,.72)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(2, -r - fs*.75, tw + 7, fs*1.5, 3) : ctx.rect(2, -r - fs*.75, tw + 7, fs*1.5); ctx.fill();
    ctx.fillStyle = lit ? `rgba(${pc},1)` : `rgba(${ink},${root ? 1 : .78})`;
    ctx.fillText(label, 5.5, -r + .5);
  }
  ctx.restore();
}

/* ================= Toast ================= */
function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1400); }

