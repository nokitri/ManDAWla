/* ================= Syncing the controls with the settings ================= */
function syncUI(){
  for (const [id, key] of SELECTS) $(id).value = String(S[key]);
  for (const [id] of SLIDERS) $(id).sync();
  $('mirror').sync(); $('stay').sync(); syncBrush(); syncStamp();
}
function syncStamp(){
  if (document.activeElement !== $('stampTxt')) $('stampTxt').value = S.stamp || '✿';
  $('stampClr').hidden = !S.stampImg; $('stampUp').textContent = S.stampImg ? 'Change…' : 'Image…';
}
$('stampTxt').oninput = e => { S.stamp = [...e.target.value.trim()].slice(0, 3).join('') || '✿'; drawBrushPreview(); renderBrushGrid(); syncBrush(); };
$('stampUp').onclick = () => $('stampFile').click();
$('stampClr').onclick = () => { S.stampImg = null; syncStamp(); drawBrushPreview(); renderBrushGrid(); syncBrush(); };
$('stampFile').onchange = e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => {   // shrink to a small square so projects stay light
    const c = document.createElement('canvas'), s = 96; c.width = c.height = s; const g = c.getContext('2d'), k = Math.min(s/im.width, s/im.height);
    g.drawImage(im, (s - im.width*k)/2, (s - im.height*k)/2, im.width*k, im.height*k); URL.revokeObjectURL(url);
    S.stampImg = c.toDataURL('image/png'); if (S.brush !== 'stamp') S.brush = 'stamp';
    const im2 = new Image(); im2.onload = () => { drawBrushPreview(); renderBrushGrid(); syncBrush(); }; im2.src = S.stampImg; STAMP_IMGS.set(S.stampImg, im2);
    syncStamp(); toast('Stamp image ready');
  };
  im.onerror = () => toast("Couldn't read that image"); im.src = url;
};
$('surpriseAll').onclick = surprise;

/* ================= Surprise me ================= */
const pickR = a => a[Math.random()*a.length | 0];
// everything except volume
function surprise(){
  S.scale = pickR(Object.keys(SCALES)); S.key = Math.random()*12 | 0; S.tuning = pickR([432, 440]);
  S.chord = pickR(['single','single','triad','seventh','sus2','sus4','power','ninth','octave','stack']);
  S.brush = pickR(Object.keys(BRUSHES).filter(k => k !== 'stamp'));
  S.kal = pickR(Object.keys(MODES)); S.sym = pickR([3,4,5,6,6,8,8,10,12]); S.mirror = Math.random() < .6;
  S.width = pickR([.5,.75,1,1,1.5,2]); S.stay = pickR([1,2,2,5,10,30,0]);
  applyTheme(pickR(Object.keys(THEMES).filter(k => k !== 'custom' && k !== theme)));
  syncUI(); strokes.forEach(st => { st.brush = S.brush; st.dirty = true; st.endT = undefined; });
  toast('🎲 ' + MODES[S.kal] + ' · ' + BRUSHES[S.brush].name + ' · ' + CHORD_NAMES[S.chord]);
}


/* ================= Toast ================= */
function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1400); }

