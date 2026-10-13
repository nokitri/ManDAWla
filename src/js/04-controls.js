/* ================= Controls ================= */
const setP = (el, v) => el.setAttribute('aria-pressed', v);
// an On/Off button for a true/false setting
function onOff(id, key, after){ const b = $(id), sync = () => { setP(b, S[key]); b.textContent = S[key] ? 'On' : 'Off'; };
  b.onclick = () => { S[key] = !S[key]; sync(); after && after(); }; b.sync = sync; }
onOff('mirror', 'mirror'); onOff('drift', 'drift');
onOff('glide', 'glide', () => { $('glideRow').hidden = !S.glide;
  if (S.glide && S.holdMode !== 'sustain'){ S.holdMode = 'sustain'; $('holdSel').value = 'sustain'; toast('Glide on · Hold set to Sustain'); } else toast(S.glide ? 'Glide on' : 'Glide off'); });
// sliders: [id, setting, how the value reads]
const SLIDERS = [['oct','oct',v => (v > 0 ? '+' : '') + v], ['strum','strum',v => v + ' MS'], ['glideTime','glideTime',v => v + ' MS', 'glideVal'], ['width','width'], ['tAlpha','alpha',v => v + '%'],
  ['bright','bright',v => v + '%'], ['spread','spread'], ['sym','sym'], ['spin','spin'], ['tvol','vol',null,null,updateFx]];
for (const [id, key, fmt, out, after] of SLIDERS){ const el = $(id), val = $(out || id + 'Val');
  el.sync = () => { el.value = S[key]; val.textContent = fmt ? fmt(S[key]) : S[key]; };
  el.oninput = () => { S[key] = +el.value; el.sync(); after && after(); }; }
// dropdowns: [id, setting, is a number]
const SELECTS = [['arpSel','arp'], ['kalSel','kal'], ['holdSel','holdMode'], ['chordSel','chord'], ['tZone','zone'], ['bgfx','bgfx'], ['scale','scale'], ['key','key',1], ['tuning','tuning',1], ['stay','stay',1]];
for (const [id, key, num] of SELECTS) $(id).addEventListener('change', e => { S[key] = num ? +e.target.value : e.target.value; });
for (const k in MODES){ const o = document.createElement('option'); o.value = k; o.textContent = MODES[k].toUpperCase(); $('kalSel').append(o); }
$('bgfx').addEventListener('change', drawStars);
$('chordSel').addEventListener('change', () => voice(S.inst, SCALES[S.scale].length + 2, .5));
$('stay').addEventListener('change', () => { strokes.forEach(s => s.endT = undefined); toast(S.stay ? 'Patterns stay ' + S.stay + ' s' : 'Patterns stay for good'); });
$('helpBtn').onclick = () => { $('help').hidden = false; $('helpClose').focus(); };
$('helpClose').onclick = () => { $('help').hidden = true; };
$('help').onclick = e => { if (e.target.id === 'help') $('help').hidden = true; };

// instruments, grouped
const instLabel = () => S.inst === 'sampler' ? SAMPLE_NAME || 'Custom Sample' : INST_NAMES[S.inst] || 'Bell';
function syncInst(){ $('instName').textContent = instLabel().toUpperCase(); }
function pickInst(k){ S.inst = k; syncInst(); setInstPop(false); voice(S.inst, SCALES[S.scale].length + 2, .5); }
function renderInstPop(){
  const pop = $('instPop'); pop.innerHTML = '';
  const group = (title, items) => { const g = document.createElement('div'); g.className = 'ig'; g.innerHTML = `<div class="igh">${title}</div><div class="igl"></div>`; items.forEach(b => g.lastChild.append(b)); pop.append(g); };
  INST_GROUPS.forEach(([title, list]) => group(title, Object.keys(list).map(k => { const b = document.createElement('button'); b.textContent = list[k]; b.setAttribute('aria-pressed', S.inst === k); b.onclick = () => pickInst(k); return b; })));
  const items = [];
  if (SAMPLE){ const b = document.createElement('button'); b.textContent = '♪ ' + SAMPLE_NAME; b.setAttribute('aria-pressed', S.inst === 'sampler'); b.onclick = () => pickInst('sampler'); items.push(b); }
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
$('sampleFile').onchange = async e => {
  const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
  ensureAudio(); toast('Loading ' + file.name + '…');
  try {
    const raw = await ac.decodeAudioData(await file.arrayBuffer()), d = raw.getChannelData(0);
    let st = 0, peak = 0; while (st < d.length - 1 && Math.abs(d[st]) < .01) st++;   // trim the silence at the start
    const len = Math.min(d.length - st, raw.sampleRate*8); for (let i=0;i<len;i++) peak = Math.max(peak, Math.abs(d[st + i]));
    const b = ac.createBuffer(1, len, raw.sampleRate), o = b.getChannelData(0), g = peak > 0 ? .95/peak : 1;
    for (let i=0;i<len;i++) o[i] = d[st + i]*g;
    SAMPLE = b; SAMPLE_NAME = file.name.replace(/\.[^.]+$/, '').slice(0, 24); pickInst('sampler'); toast('Sample ready · ' + SAMPLE_NAME);
  } catch { toast("Couldn't read that audio file"); }
};

// tabs
const tabs = [...document.querySelectorAll('#side [role=tab]')];
let curPanel = 'p-modes';
function showPanels(){ tabs.forEach(x => { const id = x.getAttribute('aria-controls'); $(id).hidden = id !== curPanel; }); }
tabs.forEach(t => t.onclick = () => { curPanel = t.getAttribute('aria-controls'); tabs.forEach(x => x.setAttribute('aria-selected', x === t)); showPanels(); });
// the sound and visual settings open as pop-ups above the bottom menu, one at a time; click outside (or Esc) to close
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
function placeSide(){ const sd = $('side'); if (sd.hidden) return; const top = document.querySelector('.top').getBoundingClientRect().bottom; sd.style.top = (top + 8) + 'px';
  const bot = deckAway ? 14 : Math.max(14, innerHeight - $('deck').getBoundingClientRect().top + 8); sd.style.bottom = 'auto'; sd.style.maxHeight = (innerHeight - top - 8 - Math.min(bot, innerHeight - top - 160)) + 'px'; }   // as tall as its contents, never under the bottom menu
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
  const c = o.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0,0,o.width,o.height); c.drawImage(bgCv,0,0); c.drawImage(cv,0,0); c.drawImage(fxCv,0,0,o.width,o.height);
  $('snapImg').src = o.toDataURL('image/png'); $('overlay').hidden = false; $('closeSnap').focus();
};
$('closeSnap').onclick = () => { $('overlay').hidden = true; };
