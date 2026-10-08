/* ================= Tutorial ================= */
const TOUR = [
  ['Draw', 'Drag inside the circle. Every ring is a note: the outside is low, the middle is high. Keys A–L play notes too.'],
  ['Make a loop', 'Press ● Rec, then ▶ Play. Whatever you draw loops, and each stroke lights up when its notes play.'],
  ['Tracks', '+ Track adds another instrument with its own look. Drag the track chips to reorder them; Duplicate copies one.'],
  ['Sound & Visuals', 'The ♪ Sound and ✦ Visuals buttons hold everything for the selected track. 🎲 Surprise Me shuffles them.'],
  ['Timeline & more', '▤ Timeline opens a note grid. ⚙ Settings has the key, loop, themes, saving and exports.']
];
let tourI = -1;
function showTour(i){
  tourI = i;
  if (i < 0 || i >= TOUR.length){ $('tour').hidden = true; try { localStorage.setItem('mandawla-tour', '1'); } catch {} return; }
  $('tour').hidden = false; $('tourStep').textContent = 'STEP ' + (i + 1) + ' OF ' + TOUR.length; $('tourTitle').textContent = TOUR[i][0]; $('tourBody').textContent = TOUR[i][1];
  $('tourNext').textContent = i === TOUR.length - 1 ? 'Done' : 'Next';
}
$('tourNext').onclick = () => showTour(tourI + 1); $('tourSkip').onclick = () => showTour(-1);
$('tourStart').onclick = () => { $('help').hidden = true; showTour(0); };

/* ================= Wiring for the new controls ================= */
function syncExtras(){
  $('loopB').value = String(S.loopB || 0); $('duck').value = S.duck || 0; $('duckVal').textContent = S.duck || 0;
  setP($('pitchCol'), !!S.pitchCol); $('pitchCol').textContent = S.pitchCol ? 'On' : 'Off';
  $('stampRow').hidden = S.brush !== 'stamp'; if (document.activeElement !== $('stampTxt')) $('stampTxt').value = S.stamp || '✿';
  $('stampClr').hidden = !S.stampImg; $('stampUp').textContent = S.stampImg ? 'Change…' : 'Image…';
}
$('loopB').onchange = e => { S.loopB = +e.target.value; stashTrack(); lanesAt = 0; toast(S.loopB ? trackName(curT()) + ' loops every ' + S.loopB + ' beats' : trackName(curT()) + ' loops with the song'); };
$('duck').oninput = e => { S.duck = +e.target.value; $('duckVal').textContent = S.duck; stashTrack(); };
$('pitchCol').onclick = () => { S.pitchCol = !S.pitchCol; syncExtras(); stashTrack(); toast(S.pitchCol ? 'Colors follow pitch' : 'Colors follow the palette'); };
$('stampTxt').oninput = e => { S.stamp = [...e.target.value.trim()].slice(0, 3).join('') || '✿'; stashTrack(); drawBrushPreview(); renderBrushGrid(); syncBrush(); };
$('stampUp').onclick = () => $('stampFile').click();
$('stampClr').onclick = () => { S.stampImg = null; stashTrack(); syncExtras(); drawBrushPreview(); renderBrushGrid(); syncBrush(); };
$('stampFile').onchange = e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => {   // shrink to a small square so projects stay light
    const c = document.createElement('canvas'), s = 96; c.width = c.height = s; const g = c.getContext('2d'), k = Math.min(s/im.width, s/im.height);
    g.drawImage(im, (s - im.width*k)/2, (s - im.height*k)/2, im.width*k, im.height*k); URL.revokeObjectURL(url);
    S.stampImg = c.toDataURL('image/png'); if (S.brush !== 'stamp') S.brush = 'stamp'; stashTrack();
    const im2 = new Image(); im2.onload = () => { drawBrushPreview(); renderBrushGrid(); syncBrush(); }; im2.src = S.stampImg; STAMP_IMGS.set(S.stampImg, im2);
    syncExtras(); toast('Stamp image ready');
  };
  im.onerror = () => toast("Couldn't read that image"); im.src = url;
};
$('composeBtn').onclick = () => setComposePop($('composePop').hidden);
$('tDup').onclick = duplicateTrack;
$('surpriseSound').onclick = surpriseSound;
$('surpriseLook').onclick = surpriseLook;
$('exportGif').onclick = exportGif; $('exportAudio').onclick = exportAudio; $('exportMidi').onclick = exportMidi; $('offlineCopy').onclick = offlineCopy;

/* ================= Tracks ================= */
const NEW_TRACK_INST = ['kick','snare','hihat','bass','pad','clap','tabla','kalimba','strings','flute','marimba','b808','choir','handpan','epiano','lead'];
function renderTracks(){
  trackHead();
  const box = $('trackChips'); box.innerHTML = '';
  S.tracks.forEach((t, i) => {
    const b = document.createElement('button'); b.className = 'tchip' + (t.m || (S.tracks.some(x => x.s) && !t.s) ? ' muted' : '');
    b.setAttribute('aria-pressed', t.id === S.cur);
    b.innerHTML = `<i style="background:rgb(${rgbStr(trackRGB(t))})"></i>${i+1} · ${(t.name || instLabel(t)).toUpperCase().slice(0, 12)}`;
    if (t.id === S.cur && S.tracks.length > 1){
      const x = document.createElement('span'); x.className = 'tdel' + (chipDelArm === t.id ? ' armed' : ''); x.setAttribute('role','button'); x.setAttribute('aria-label','Delete track');
      x.textContent = chipDelArm === t.id ? 'Delete?' : '×';
      x.onclick = ev => { ev.stopPropagation(); deleteTrack(t, chipDelArm === t.id); };
      b.append(x);
    }
    b.dataset.tip = `<b>${trackName(t)}</b><kbd>${i+1}</kbd><br>${instLabel(t)}. Click to draw on this track.`;
    b.onclick = () => { if (performance.now() - chipDragEnd < 350) return; selectTrack(t.id); };
    b.addEventListener('pointerdown', e => chipDown(e, t, b));
    box.append(b);
  });
  $('addTrack').disabled = S.tracks.length >= 12;
}
const TRACK_KEYS = ['inst','chord','strum','arp','oct','brush','width','palette','c1','c2','c3','holdMode','glide','glideTime','verb','echo','fade','alpha','zone','sym','kal','mirror','afxList','vfxList','spin','spread','bright','drift','trail','loopB','duck','pitchCol','stamp','stampImg'];
function stashTrack(){ const t = curT(); if (t) for (const k of TRACK_KEYS) t[k] = S[k]; }
function loadTrack(t){ for (const k of TRACK_KEYS) if (t[k] !== undefined) S[k] = t[k]; }
function trackHead(){ const t = curT(), el = $('tName'); if (t && el){ el.style.color = `rgb(${rgbStr(trackRGB(t))})`; el.style.borderColor = `rgba(${rgbStr(trackRGB(t))},.55)`; } }
function selectTrack(id, quiet){
  if (!trk(id)) return;
  if (id !== S.cur) stashTrack();
  S.cur = id; loadTrack(curT()); syncUI(); syncInst(); renderTracks(); lanesAt = 0; mixSig = ''; updateMeta();
  if (!quiet) toast(trackName(curT()) + ' · ' + instLabel(curT()));
}
['change','input','click'].forEach(ev => { $('deck').addEventListener(ev, () => stashTrack()); $('trackPops').addEventListener(ev, () => stashTrack()); });
addEventListener('keyup', () => stashTrack());
$('addTrack').onclick = () => {
  if (S.tracks.length >= 12) return;
  const id = Math.max(0, ...S.tracks.map(t => t.id)) + 1;
  const used = new Set(S.tracks.map(t => t.inst)), inst = NEW_TRACK_INST.find(k => !used.has(k)) || 'bell';
  stashTrack();
  makeTrack(inst); selectTrack(id);
};
function tracksFromLegacy(p){
  // older presets had no tracks: make one per instrument used
  const map = new Map(); let id = 0;
  (p.strokes||[]).forEach(s => { const k = INST_NAMES[s.inst] ? s.inst : 'bell'; if (!map.has(k)) map.set(k, ++id); });
  if (!map.size) map.set(INST_NAMES[p.inst] ? p.inst : 'bell', ++id);
  return { tracks: [...map].map(([inst, id]) => ({ id, name:'', inst, v:80, m:false, s:false })), map };
}

S.tracks.forEach(t => { for (const k of ['sym','kal','mirror','spin','zone','spread','bright','drift','trail']) if (t[k] === undefined) t[k] = S[k]; if (!Array.isArray(t.afxList)) t.afxList = t.id === S.cur ? S.afxList : [{ type:'reverb', amt:40 }]; if (!Array.isArray(t.vfxList)) t.vfxList = t.id === S.cur ? S.vfxList : []; t.sendsMoved = true; });
renderBrushGrid(); renderPresets(); syncUI(); fitTop(); placeTimeline();
renderTracks();
$('timeline').hidden = true; S.timeline = false;
if (window.ResizeObserver) new ResizeObserver(placeTimeline).observe(document.querySelector('.top'));
requestAnimationFrame(frame);
if (!pendingRestore) [1,0,4].forEach((s,k) => setTimeout(() => demoStroke(true, s), 250 + k*500));
{ let seen = true; try { seen = !!localStorage.getItem('mandawla-tour'); } catch {} if (!seen && !pendingRestore) setTimeout(() => showTour(0), 1400); }
})();
