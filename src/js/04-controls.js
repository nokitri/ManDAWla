/* ================= Controls ================= */
const setP = (el, v) => el.setAttribute('aria-pressed', v);
// an On/Off button for a true/false setting
function onOff(id, key, after){ const b = $(id), sync = () => { setP(b, S[key]); b.textContent = S[key] ? 'On' : 'Off'; };
  b.onclick = () => { S[key] = !S[key]; sync(); after && after(); }; b.sync = sync; }
onOff('mirror', 'mirror');
// sliders are drawn as bars; --p is how much of the bar is lit
const fillBar = el => el.style.setProperty('--p', (el.value - el.min)/(el.max - el.min)*100 + '%');
// sliders: [id, setting, how the value reads]
const SLIDERS = [['width','width'], ['sym','sym'], ['tvol','vol',null,null,updateFx]];
for (const [id, key, fmt, out, after] of SLIDERS){ const el = $(id), val = $(out || id + 'Val');
  el.sync = () => { el.value = S[key]; val.textContent = fmt ? fmt(S[key]) : S[key]; fillBar(el); };
  el.oninput = () => { S[key] = +el.value; el.sync(); after && after(); }; }
// dropdowns: [id, setting, is a number]
const SELECTS = [['kalSel','kal'], ['chordSel','chord'], ['scale','scale'], ['key','key',1], ['tuning','tuning',1]];
for (const [id, key, num] of SELECTS) $(id).addEventListener('change', e => { S[key] = num ? +e.target.value : e.target.value; });
for (const k in MODES){ const o = document.createElement('option'); o.value = k; o.textContent = MODES[k].toUpperCase(); $('kalSel').append(o); }
$('chordSel').addEventListener('change', () => voice(SCALES[S.scale].length + 2, .5));
// fade: how long a pattern stays before it fades, in steps (the last step keeps it for good)
const STAYS = [1,2,3,5,10,20,30,0], stayEl = $('stay');
stayEl.sync = () => { stayEl.value = Math.max(0, STAYS.indexOf(S.stay)); $('stayVal').textContent = S.stay ? S.stay + ' S' : '∞'; fillBar(stayEl); };
stayEl.oninput = () => { S.stay = STAYS[+stayEl.value]; stayEl.sync(); strokes.forEach(s => s.endT = undefined); };

// a menu opens above its button, or below it when there isn't room above
function placeMenu(pop, r){
  pop.style.top = 'auto'; pop.style.bottom = (innerHeight - r.top + 8) + 'px';
  const h = pop.offsetHeight;
  if (r.top - 8 < h + 12 && innerHeight - r.bottom > r.top){ pop.style.bottom = 'auto'; pop.style.top = Math.max(12, Math.min(r.bottom + 8, innerHeight - h - 12)) + 'px'; }
}

// bottom menu: hide it with the button (or Esc); bring it back with the handle, or just by hovering the bottom edge
let deckAway = false, peeking = false, peekTimer = 0;
function setDeck(away){
  deckAway = away; peeking = false;
  $('deck').classList.toggle('away', away); $('showDeck').hidden = !away; $('peekZone').hidden = !away;
}
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
  const c = o.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0,0,o.width,o.height); c.drawImage(cv,0,0); c.drawImage(fxCv,0,0,o.width,o.height);
  $('snapImg').src = o.toDataURL('image/png'); $('overlay').hidden = false; $('closeSnap').focus();
};
$('closeSnap').onclick = () => { $('overlay').hidden = true; };
