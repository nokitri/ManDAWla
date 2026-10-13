/* ================= Controls ================= */
const setP = (el, v) => el.setAttribute('aria-pressed', v);
function bindToggle(id, key, after){ $(id).onclick = () => { S[key] = !S[key]; setP($(id), S[key]); after && after(); }; }
$('mirror').onclick = () => { S.mirror = !S.mirror; setP($('mirror'), S.mirror); $('mirror').textContent = S.mirror ? 'On' : 'Off'; stashTrack(); }; bindToggle('quant','quant');
$('drift').onclick = () => { S.drift = !S.drift; setP($('drift'), S.drift); $('drift').textContent = S.drift ? 'On' : 'Off'; stashTrack(); }; $('bgfx').onchange = e => { S.bgfx = e.target.value; S.stars = S.bgfx !== 'none'; drawStars(); }; bindToggle('beatFx','beatFx');

// transport (each control has a twin in the top bar)
function syncTransport(){
  setP($('tPlay'), S.loop); setLbl($('tPlay'), S.loop ? '■ Stop' : '▶ Play');
  setP($('rec'), S.rec); setP($('tMetro'), S.metro);
  updateMeta();
}
function togglePlay(){
  ensureAudio(); S.loop = !S.loop;
  if (S.loop){ // start from the top of the loop, after an optional one-bar count-in
    const start = ac.currentTime + .1 + (S.countIn ? 4*beatLen() : 0);
    clock0 = start - (typeof tlCue !== 'undefined' ? tlCue : 0)*beatLen(); countEnd = start;
    if (S.countIn) countOscs = [0,1,2,3].map(k => click(start - (4-k)*beatLen(), k === 0 ? 2 : 1));
    strokes.forEach(st => st.notes.forEach(n => n.cyc = -1));
  } else {
    countOscs.forEach(o => { try { o.stop(); } catch {} }); countOscs = []; countEnd = 0;
  }
  syncTransport();
}
$('tPlay').onclick = togglePlay;
$('rec').onclick = () => { S.rec = !S.rec; syncTransport(); };
bindToggle('countIn','countIn');
$('tRings').onclick = () => { S.rings = !S.rings; setP($('tRings'), S.rings); };
$('strum').oninput = e => { S.strum = +e.target.value; $('strumVal').textContent = S.strum + ' MS'; };
$('glide').onclick = () => { S.glide = !S.glide; setP($('glide'), S.glide); $('glide').textContent = S.glide ? 'On' : 'Off'; $('glideRow').hidden = !S.glide;
  if (S.glide && S.holdMode !== 'sustain'){ S.holdMode = 'sustain'; $('holdSel').value = 'sustain'; toast('Glide on · Hold set to Sustain'); } else toast(S.glide ? 'Glide on' : 'Glide off'); };
$('glideTime').oninput = e => { S.glideTime = +e.target.value; $('glideVal').textContent = S.glideTime + ' MS'; };
let taps = [];
$('tap').onclick = () => {
  const t = performance.now(); taps = taps.filter(x => t - x < 2500); taps.push(t);
  if (taps.length >= 2){
    const iv = (taps[taps.length-1] - taps[0])/(taps.length-1), bpm = Math.round(Math.max(50, Math.min(160, 60000/iv)));
    $('bpm').value = bpm; $('bpm').dispatchEvent(new Event('input')); toast('Tempo ' + bpm + ' BPM');
  } else toast('Keep tapping');
};
$('helpBtn').onclick = () => { $('help').hidden = false; $('helpClose').focus(); };
$('helpClose').onclick = () => { $('help').hidden = true; };
$('help').onclick = e => { if (e.target.id === 'help') $('help').hidden = true; };
$('tMetro').onclick = () => { ensureAudio(); S.metro = !S.metro; syncTransport(); };
$('swing').oninput = e => S.swing = +e.target.value;
$('dblLoop').onclick = () => {
  if (S.bars >= 32){ toast('Already at 32 bars'); return; }
  pushHistory(); const L = LB();
  for (const st of strokes) st.notes.push(...st.notes.filter(n => n.b < L).map(n => ({ ...n, b: n.b + L, cyc: -1, hit: undefined, vis: undefined, visHold: undefined })));
  S.bars *= 2; $('barsSel').value = S.bars; lanesAt = 0; mixSig = ''; toast('Loop doubled · ' + S.bars + ' bars');
};
$('quantNow').onclick = () => {
  const list = typeof tlSel !== 'undefined' && tlSel.size ? [...tlSel] : strokes.flatMap(st => st.notes);
  if (!list.length){ toast('No notes to quantize'); return; }
  pushHistory(); const L = LB(), q = x => Math.round(x*S.grid)/S.grid;
  for (const n of list){ n.b = ((q(n.b) % L) + L) % L; if (n.d) n.d = Math.max(1/S.grid, q(n.d)); n.cyc = -1; }
  lanesAt = 0; toast((list.length > 1 ? list.length + ' notes' : 'Note') + ' snapped to the grid');
};
$('metroVol').oninput = e => S.metroVol = +e.target.value;
const SELECTS = { arpSel:['arp'], barsSel:['bars',true], gridSel:['grid',true], kalSel:['kal'], vizSel:['viz'], holdSel:['holdMode'], chordSel:['chord'], instSel:['inst'] };
function syncSelects(){ for (const id in SELECTS) $(id).value = String(S[SELECTS[id][0]]); }
for (const id in SELECTS){ const [key, num] = SELECTS[id]; $(id).addEventListener('change', e => { S[key] = num ? +e.target.value : e.target.value; }); }

// modes
for (const k in MODES){ const o = document.createElement('option'); o.value = k; o.textContent = MODES[k].toUpperCase(); $('kalSel').append(o); }
$('kalSel').addEventListener('change', () => { stashTrack(); updateMeta(); });
$('chordSel').addEventListener('change', () => { updateMeta(); voice(S.inst, SCALES[S.scale].length + 2, .5); });

// instruments, grouped
INST_GROUPS.forEach(([g, list]) => {
  const og = document.createElement('optgroup'); og.label = g.toUpperCase();
  for (const k in list){ const o = document.createElement('option'); o.value = k; o.textContent = list[k].toUpperCase(); og.append(o); }
  $('instSel').append(og);
});
$('instSel').addEventListener('change', () => { curT().inst = S.inst; renderTracks(); lanesAt = 0; mixSig = ''; updateMeta(); voice(S.inst, SCALES[S.scale].length + 2, .5); });
function syncInst(){ S.inst = curT().inst; if (S.inst === 'sampler') ensureSampleOpt(); $('instSel').value = S.inst; $('instName').textContent = instLabel(curT()).toUpperCase(); }
const instLabel = t => t && t.inst === 'sampler' ? (t.sampleName || 'Custom Sample') : (INST_NAMES[t ? t.inst : S.inst] || 'Bell');
function ensureSampleOpt(){ if (!$('instSel').querySelector('option[value=sampler]')){ const o = document.createElement('option'); o.value = 'sampler'; o.textContent = 'CUSTOM SAMPLE'; $('instSel').append(o); } }
function pickInst(k){ ensureSampleOpt(); S.inst = k; $('instSel').value = k; $('instSel').dispatchEvent(new Event('change')); stashTrack(); $('instName').textContent = instLabel(curT()).toUpperCase(); setInstPop(false); }
function renderInstPop(){
  const pop = $('instPop'); pop.innerHTML = '';
  const group = (title, items) => { const g = document.createElement('div'); g.className = 'ig'; g.innerHTML = `<div class="igh">${title}</div><div class="igl"></div>`; items.forEach(b => g.lastChild.append(b)); pop.append(g); };
  INST_GROUPS.forEach(([title, list]) => group(title, Object.keys(list).map(k => { const b = document.createElement('button'); b.textContent = list[k]; b.setAttribute('aria-pressed', S.inst === k); b.onclick = () => pickInst(k); return b; })));
  const t = curT(), items = [];
  if (t && t.sampleData){ const b = document.createElement('button'); b.textContent = '♪ ' + (t.sampleName || 'Custom Sample'); b.setAttribute('aria-pressed', S.inst === 'sampler'); b.onclick = () => pickInst('sampler'); items.push(b); }
  const up = document.createElement('button'); up.className = 'up'; up.textContent = '⬆ Upload Sample…'; up.onclick = () => { setInstPop(false); $('sampleFile').click(); }; items.push(up);
  group('Your Sample', items);
}
// a menu opens above its button, or below it when there isn't room above
function placeMenu(pop, r){
  pop.style.top = 'auto'; pop.style.bottom = (innerHeight - r.top + 8) + 'px';
  const h = pop.offsetHeight;
  if (r.top - 8 < h + 12 && innerHeight - r.bottom > r.top){ pop.style.bottom = 'auto'; pop.style.top = Math.max(12, Math.min(r.bottom + 8, innerHeight - h - 12)) + 'px'; }
}
function setInstPop(open){
  const pop = $('instPop'), btn = $('instBtn'); pop.hidden = !open; btn.setAttribute('aria-expanded', open); if (!open) return;
  renderInstPop();
  const r = btn.getBoundingClientRect(), w = Math.min(560, innerWidth - 24);
  pop.style.width = w + 'px'; pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px'; placeMenu(pop, r);
}
$('instBtn').onclick = e => { e.stopPropagation(); setInstPop($('instPop').hidden); };
document.addEventListener('pointerdown', e => { if (!$('instPop').hidden && !e.target.closest('#instPop, #instBtn')) setInstPop(false); });
addEventListener('resize', () => setInstPop(false));
/* ---- Custom samples: your own sound, pitched by the rings like any instrument ---- */
const SAMPLES = {};   // track id → AudioBuffer
function b64ToBuf(b64){ const s = atob(b64), u = new Uint8Array(s.length); for (let i=0;i<s.length;i++) u[i] = s.charCodeAt(i); return u.buffer; }
function bufToB64(buf){ const u = new Uint8Array(buf); let s = ''; for (let i=0;i<u.length;i+=0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function sampleBuffer(t){
  if (!t || !t.sampleData) return null;
  if (SAMPLES[t.id] && SAMPLES[t.id].src === t.sampleData) return SAMPLES[t.id];
  const pcm = new Int16Array(b64ToBuf(t.sampleData)), b = ac.createBuffer(1, pcm.length || 1, t.sampleRate || 22050), d = b.getChannelData(0);
  for (let i=0;i<pcm.length;i++) d[i] = pcm[i]/32768;
  b.src = t.sampleData; SAMPLES[t.id] = b; return b;
}
$('sampleFile').onchange = async e => {
  const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
  ensureAudio(); toast('Loading ' + file.name + '…');
  try {
    const raw = await ac.decodeAudioData(await file.arrayBuffer());
    // keep it light so projects stay small: mono, 22 kHz, up to 8 seconds, silence at the start trimmed
    const rate = 22050, len = Math.min(raw.duration, 8), off = new OfflineAudioContext(1, Math.ceil(len*rate), rate);
    const src = off.createBufferSource(); src.buffer = raw; src.connect(off.destination); src.start(0); const mono = (await off.startRendering()).getChannelData(0);
    let st = 0; while (st < mono.length - 1 && Math.abs(mono[st]) < .01) st++;
    let peak = 0; for (let i=st;i<mono.length;i++) peak = Math.max(peak, Math.abs(mono[i]));
    const g = peak > 0 ? .95/peak : 1, pcm = new Int16Array(mono.length - st);
    for (let i=0;i<pcm.length;i++) pcm[i] = Math.max(-32767, Math.min(32767, mono[i + st]*g*32767));
    const t = curT(); t.sampleData = bufToB64(pcm.buffer); t.sampleRate = rate; t.sampleName = file.name.replace(/\.[^.]+$/, '').slice(0, 24);
    delete SAMPLES[t.id]; pickInst('sampler'); renderTracks(); toast('Sample ready · ' + t.sampleName);
  } catch { toast("Couldn't read that audio file"); }
};

// palette + background swatches
function swatchBg(k){
  if (k === 'rainbow') return 'linear-gradient(90deg,#ff5f6d,#ffc371,#7cf29c,#5fd4ff,#a77bff,#ff5fa2)';
  if (k === 'custom') return `linear-gradient(90deg,${S.c1},${S.c2},${S.c3})`;
  return `linear-gradient(90deg,${PALETTES[k].stops.join(',')})`;
}
const SHOWN_PALS = ['rainbow','ember','ocean','aurora','forest','gold','mono','custom'];
function renderPalSw(){
  const box = $('palSw'); box.innerHTML = '';
  for (const k in PALETTES){
    if (!SHOWN_PALS.includes(k) && S.palette !== k) continue;
    const b = document.createElement('button'); b.className = 'sw'; b.setAttribute('aria-pressed', S.palette === k);
    b.innerHTML = k === 'custom' ? `<i class="cust" style="background:conic-gradient(from 200deg,${S.c1},${S.c2},${S.c3},${S.c1})"><span>✎</span></i>` : `<i style="background:${swatchBg(k)}"></i>`; b.setAttribute('aria-label', PALETTES[k].name); b.dataset.nm = PALETTES[k].name;
    b.onclick = () => { S.palette = k; renderPalSw(); };
    box.append(b);
  }
  $('customRow').hidden = S.palette !== 'custom';
}
function renderBgSw(){ $('bgCustom').value = S.bgCustom; }
['c1','c2','c3'].forEach(id => $(id).oninput = e => { S[id] = e.target.value; renderPalSw(); });
$('bgCustom').oninput = e => { S.bgCustom = e.target.value; S.bg = 'custom'; applyBg(); };
$('spread').oninput = e => { S.spread = +e.target.value; $('spreadVal').textContent = S.spread; stashTrack(); };
$('bright').oninput = e => { S.bright = +e.target.value; $('brightVal').textContent = S.bright + '%'; stashTrack(); };
$('trail').oninput = e => { S.trail = +e.target.value; $('trailVal').textContent = S.trail; stashTrack(); };
$('spin').oninput = e => { S.spin = +e.target.value; $('spinVal').textContent = S.spin; stashTrack(); };
$('react').oninput = e => { S.react = +e.target.value; $('reactVal').textContent = S.react + '%'; };
$('width').oninput = e => { S.width = +e.target.value; $('widthVal').textContent = S.width; };
$('sym').oninput = e => { S.sym = +e.target.value; $('symVal').textContent = S.sym; stashTrack(); };
$('fade').onchange = e => { S.fade = +e.target.value; stashTrack(); const n = performance.now(); strokes.forEach(s => { if (s.track === S.cur) s.born = n; }); };
$('scale').onchange = e => { S.scale = e.target.value; };
$('key').onchange = e => { S.key = +e.target.value; };
$('tuning').onchange = e => { S.tuning = +e.target.value; };
$('oct').oninput = e => { S.oct = +e.target.value; $('octVal').textContent = (S.oct > 0 ? '+' : '') + S.oct; };
$('tvol').oninput = e => { const t = curT(); t.v = +e.target.value; $('tvolVal').textContent = t.v; updateMix(); };
$('bpm').oninput = e => {
  const nb = +e.target.value;
  if (ac){ const b = beatsAt(ac.currentTime); S.bpm = nb; clock0 = ac.currentTime - b*beatLen(); } else S.bpm = nb;
  $('bpmVal').textContent = nb; updateMeta(); clearTimeout(bpmFxT); bpmFxT = setTimeout(updateMix, 250);   // echoes follow the tempo
};
let bpmFxT = 0;

// tabs
const tabs = [...document.querySelectorAll('#side [role=tab]')];
let curPanel = 'p-modes';
function showPanels(){ tabs.forEach(x => { const id = x.getAttribute('aria-controls'); $(id).hidden = id !== curPanel; }); }
tabs.forEach(t => t.onclick = () => { curPanel = t.getAttribute('aria-controls'); tabs.forEach(x => x.setAttribute('aria-selected', x === t)); showPanels(); });
// bottom menu: the tabs open one topic at a time; clicking the open tab (or Less) folds it away
// the track's settings open as pop-ups above the bottom menu, one at a time; click outside (or Esc) to close
let openPop = null;
const ptabs = [...document.querySelectorAll('.ptab')];
function setPop(id){
  openPop = id || null;
  document.querySelectorAll('.dpanel').forEach(p => p.hidden = p.id !== openPop);
  ptabs.forEach(b => b.setAttribute('aria-expanded', b.dataset.p === openPop));
  if (!openPop) return;
  if (!$('instPop').hidden) setInstPop(false); if (!$('brushPop').hidden) setBrushPop(false); hideTip();
  placePop();
}
function placePop(){
  if (!openPop) return;
  const p = $(openPop), btn = ptabs.find(b => b.dataset.p === openPop), r = btn.getBoundingClientRect(), dk = $('deck').getBoundingClientRect();
  const w = Math.min(780, innerWidth - 24); p.style.width = w + 'px';
  p.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width/2 - w/2)) + 'px';
  p.style.bottom = (innerHeight - (deckAway ? r.top : Math.min(r.top, dk.top)) + 8) + 'px';
}
ptabs.forEach(b => b.onclick = e => { e.stopPropagation(); setPop(openPop === b.dataset.p ? null : b.dataset.p); });
document.addEventListener('pointerdown', e => { if (openPop && !e.target.closest('.dpanel, .ptab, #instPop, #brushPop')) setPop(null); });
addEventListener('resize', placePop);
showPanels();
// global settings slide in from the side
function setSide(open){ $('side').hidden = !open; $('gsBtn').setAttribute('aria-expanded', open); if (open) placeSide(); }
function placeSide(){ placePanel($('side')); }
function placePanel(sd){ if (sd.hidden) return; const top = document.querySelector('.top').getBoundingClientRect().bottom; sd.style.top = (top + 8) + 'px'; const dk = $('deck'); let bot = 14; if (!deckAway){ const r = dk.getBoundingClientRect(); bot = Math.max(14, innerHeight - r.top + 8); } const b2 = Math.min(bot, innerHeight - top - 160); if (sd.id === 'proj'){ sd.style.bottom = 'auto'; sd.style.maxHeight = (innerHeight - top - 8 - b2) + 'px'; } else sd.style.bottom = b2 + 'px'; }
if (window.ResizeObserver) new ResizeObserver(placeSide).observe($('deck'));
$('gsBtn').onclick = () => setSide($('side').hidden);
$('sideClose').onclick = () => setSide(false);
addEventListener('resize', placeSide);
// bottom menu: hide it with the button (or Esc); bring it back with the handle, or just by hovering the bottom edge
let deckAway = false, peeking = false, peekTimer = 0;
function setDeck(away){
  deckAway = away; peeking = false; if (away) setPop(null);
  $('deck').classList.toggle('away', away); $('showDeck').hidden = !away; $('peekZone').hidden = !away;
  placeSide();
}
function toggleDeck(){ setDeck(!deckAway); }
$('hideDeck').onclick = () => setDeck(true);
$('showDeck').onclick = () => setDeck(false);
$('peekZone').addEventListener('pointerenter', e => { if (!deckAway || e.pointerType === 'touch') return; peeking = true; $('deck').classList.remove('away'); $('showDeck').hidden = true; });
function unpeek(){ if (peeking && deckAway){ peeking = false; $('deck').classList.add('away'); $('showDeck').hidden = false; } }
addEventListener('pointermove', e => {
  if (!peeking) return;
  const r = $('deck').getBoundingClientRect();
  const inside = e.clientY >= r.top - 24 && e.clientX >= r.left - 24 && e.clientX <= r.right + 24;
  if (inside || e.clientY > innerHeight - 34){ clearTimeout(peekTimer); peekTimer = 0; }
  else if (!peekTimer) peekTimer = setTimeout(() => { peekTimer = 0; unpeek(); }, 450);
}, {passive:true});
if (!document.documentElement.requestFullscreen) $('fs').hidden = true;
$('fs').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  else document.documentElement.requestFullscreen().catch(()=>{ $('fs').hidden = true; });
};
$('snap').onclick = () => {
  const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
  const c = o.getContext('2d'); c.fillStyle = bgHex(); c.fillRect(0,0,o.width,o.height); c.drawImage(bgCv,0,0); c.drawImage(cv,0,0); drawLayers(c, o.width, o.height); c.drawImage(fxCv,0,0,o.width,o.height);
  showMedia('img', o.toDataURL('image/png'));
  o.toBlob(b => { snapBlob = b; }, 'image/png');
};
$('closeSnap').onclick = () => { $('overlay').hidden = true; const v = $('snapVid'); v.pause(); };
/* ---- Saving files: through the page's download prompt when the viewer allows it, otherwise right-click to save ---- */
let snapBlob = null;
const dlReady = (window.claude && typeof claude.use === 'function') ? claude.use('downloads').catch(() => null) : Promise.resolve(null);
let canDownload = false; dlReady.then(d => { canDownload = !!d; $('saveSnap').hidden = !canDownload || $('snapVid').hidden === false; });
function showMedia(kind, src){
  const img = $('snapImg'), vid = $('snapVid');
  img.hidden = kind !== 'img'; vid.hidden = kind !== 'video';
  if (kind === 'img') img.src = src; else { vid.src = src; vid.currentTime = 0; }
  $('snapHint').textContent = kind === 'img' ? (canDownload ? 'Save it, or right-click / long-press the image.' : 'Right-click or long-press the image to save it.') : (canDownload ? 'Save it, or right-click the video.' : 'Right-click the video to save it.');
  $('saveSnap').hidden = !canDownload; $('saveSnap').textContent = kind === 'img' ? 'Save Image' : 'Save Video';
  $('overlay').hidden = false; $('closeSnap').focus();
}
async function saveFile(filename, data){
  const dl = await dlReady;
  if (!dl){   // a plain browser: an ordinary download
    try { const blob = data instanceof Blob ? data : new Blob([data]), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('Saved ' + filename); return true; }
    catch { return false; }
  }
  try { await dl.save({ filename, data }); toast('Saved ' + filename); return true; }
  catch (e){ if (e && e.code === 'declined') toast('Not saved'); else if (e && e.code === 'rate_limited') toast('A save prompt is already open'); else toast("Couldn't save here"); return true; }
}
const fileStem = () => ((presetName || 'mandawla').replace(/[^\w\- ]+/g, '').trim() || 'mandawla').replace(/\s+/g, '-').toLowerCase();
$('saveSnap').onclick = () => {
  if (!$('snapVid').hidden && vidBlob) saveFile(fileStem() + '.' + vidExt, vidBlob);
  else if (snapBlob) saveFile(fileStem() + '.png', snapBlob);
};
$('exportImg').onclick = () => $('snap').click();
/* ---- Export Video: records one pass of the loop, picture and sound ---- */
let vrec = null, vidBlob = null, vidExt = 'webm', recCv = null, recCtx = null, vidTimer = 0, vidStartedLoop = false;
function pickMime(){
  if (!window.MediaRecorder) return null;
  for (const m of ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1,mp4a','video/mp4'])
    if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}
function recFrame(){
  if (!recCtx) return;
  const w = recCv.width, h = recCv.height;
  recCtx.fillStyle = bgHex(); recCtx.fillRect(0, 0, w, h);
  recCtx.drawImage(bgCv, 0, 0, w, h); recCtx.drawImage(cv, 0, 0, w, h); drawLayers(recCtx, w, h); recCtx.drawImage(fxCv, 0, 0, w, h);
}
function stopExport(){
  clearTimeout(vidTimer);
  if (vrec && vrec.state !== 'inactive') vrec.stop();
}
$('exportVid').onclick = () => {
  if (vrec){ stopExport(); return; }
  const mime = pickMime();
  if (!mime || !HTMLCanvasElement.prototype.captureStream){ toast("This browser can't record video"); return; }
  if (!strokes.some(st => st.notes.length)){ toast('Record some notes first'); return; }
  ensureAudio();
  const sc = Math.min(1.5, 1920/Math.max(W, H)); recCv = document.createElement('canvas');
  recCv.width = Math.round(W*sc/2)*2; recCv.height = Math.round(H*sc/2)*2; recCtx = recCv.getContext('2d');
  const dest = ac.createMediaStreamDestination(); analyser.connect(dest);
  const stream = recCv.captureStream(30); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const chunks = []; vidExt = mime.includes('mp4') ? 'mp4' : 'webm';
  vrec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
  vrec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  vrec.onstop = () => {
    try { analyser.disconnect(dest); } catch {}
    stream.getTracks().forEach(t => t.stop());
    vrec = null; recCtx = null; $('exportVid').classList.remove('on'); setLbl($('exportVid'), '● Export Video');
    if (vidStartedLoop && S.loop) togglePlay();
    vidBlob = new Blob(chunks, { type: mime.split(';')[0] });
    if (!vidBlob.size){ toast('Nothing was recorded'); return; }
    showMedia('video', URL.createObjectURL(vidBlob));
  };
  // play from the top with no count-in, so the video starts on bar 1
  if (S.loop) togglePlay();
  const ci = S.countIn; S.countIn = false; tlCue = 0; togglePlay(); S.countIn = ci; vidStartedLoop = true;
  recFrame(); vrec.start(250);
  $('exportVid').classList.add('on'); setLbl($('exportVid'), '■ Stop Export');
  const secs = LB()*beatLen() + 1.2;
  toast('Recording one loop · ' + Math.round(secs) + ' s');
  vidTimer = setTimeout(stopExport, secs*1000);
};

