/* ================= Keyboard ================= */
addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (e.key === 'Escape' && !$('composePop').hidden){ setComposePop(false); return; }
  if (e.key === 'Escape' && tlFull){ setTlFull(false); return; }
  if (e.key === 'Escape' && tool !== 'draw'){ setTool('draw'); return; }
  if (e.key === 'Escape'){ if (tlSel.size){ tlSel.clear(); syncTlBtns(); } else if (!$('brushPop').hidden) setBrushPop(false); else if (!$('instPop').hidden) setInstPop(false); else if (openPop) setPop(null); else if (tlRoll) setRoll(false); else if (!$('help').hidden) $('help').hidden = true; else if (!$('overlay').hidden) $('overlay').hidden = true; else if (!$('side').hidden) setSide(false); else toggleDeck(); return; }
    // sliders and dropdowns don't swallow shortcuts: only text boxes and the slider's own arrow keys do
  const typing = tag === 'TEXTAREA' || (tag === 'INPUT' && !['range','checkbox','color','button'].includes(e.target.type));
  if (typing) return;
  if (tag === 'INPUT' && /^(Arrow|Home|End|Page)/.test(e.key)) return;
  if (tag === 'SELECT'){ if (/^(Arrow|Enter|Home|End|Page)/.test(e.key)) return; e.preventDefault(); e.target.blur(); }
  const k = e.key.toLowerCase();
  if (!$('help').hidden){ if (e.key === '?' || k === 'escape') $('help').hidden = true; return; }
  if ((e.metaKey||e.ctrlKey) && k==='z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.metaKey||e.ctrlKey) && k==='y'){ e.preventDefault(); redo(); return; }
  if ((e.metaKey||e.ctrlKey) && k==='s'){ e.preventDefault(); $('save').click(); toast('Saved project'); return; }
  if ((e.metaKey||e.ctrlKey) && k==='a'){ e.preventDefault(); tlSel = new Set(strokes.filter(st => st.track === S.cur).flatMap(st => st.notes)); syncTlBtns(); toast(tlSel.size + ' notes selected'); return; }
  if ((e.metaKey||e.ctrlKey) && k==='c' && tlSel.size){ e.preventDefault(); copySel(); return; }
  if ((e.metaKey||e.ctrlKey) && k==='v' && tlClip){ e.preventDefault(); pasteClip(); return; }
  if ((e.metaKey||e.ctrlKey) && k==='d' && tlSel.size){ e.preventDefault(); duplicateSel(); return; }
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && tlSel.size && !e.metaKey && !e.ctrlKey && e.target.id !== 'tlGrip'){
    e.preventDefault(); if (!e.repeat) pushHistory();
    const N = scaleN(), step = (e.shiftKey ? SCALES[S.scale].length : 1)*(e.key === 'ArrowUp' ? 1 : -1);
    let lo = Infinity, hi = -Infinity; for (const n of tlSel){ lo = Math.min(lo, n.i); hi = Math.max(hi, n.i); }
    const d = Math.max(-lo, Math.min(N - 1 - hi, step));
    if (d){ for (const n of tlSel) n.i += d; const f = [...tlSel][0], st = ownerOf(f); if (st){ ensureAudio(); voice(instOf(st), f.i, .3, ac.currentTime + .01, f.pan || 0, .25, 'single', st.track); } }
    lanesAt = 0; return;
  }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tlSel.size && !e.metaKey && !e.ctrlKey){
    e.preventDefault(); if (!e.repeat) pushHistory();
    const L = LB(), step = (e.shiftKey ? 1 : 1/S.grid)*(e.key === 'ArrowLeft' ? -1 : 1);
    for (const n of tlSel){ n.b = Math.min(L - 1e-3, (((n.b + step) % L) + L) % L); n.cyc = -1; }
    lanesAt = 0; return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && tlSel.size){ e.preventDefault(); deleteSel(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.key === '?'){ $('help').hidden = false; $('helpClose').focus(); return; }
  if (k === 't'){ $('tRoll').click(); return; }
  if (k === 'b'){ $('glide').click(); return; }
  if (k === 'o'){ $('tRings').click(); return; }
  if (/^[1-9]$/.test(k)){ const t = S.tracks[+k - 1]; if (t) selectTrack(t.id); return; }
  if (k === 'n'){ const ks = Object.keys(CHORDS); S.chord = ks[(ks.indexOf(S.chord)+1) % ks.length]; $('chordSel').value = S.chord; updateMeta(); toast('Chord · ' + CHORD_NAMES[S.chord]); return; }
  if (k === 'y'){ redo(); return; }
  if (k === '[' || k === ']'){ S.width = Math.max(.25, Math.min(6, S.width + (k === ']' ? .25 : -.25))); $('width').value = S.width; $('widthVal').textContent = S.width; toast('Brush size ' + S.width); return; }
  if (k === '-' || k === '='){ S.sym = Math.max(1, Math.min(16, S.sym + (k === '=' ? 1 : -1))); $('sym').value = S.sym; $('symVal').textContent = S.sym; toast('Symmetry ' + S.sym); return; }
  if (k === ' '){ e.preventDefault(); if (tag === 'BUTTON') e.target.blur(); $('tPlay').click(); return; }
  if (k === 'r'){ $('rec').click(); return; }
  if (k === 'm'){ $('tMetro').click(); return; }
  if (k === 'z'){ undo(); return; }
  if (k === 'c'){ $('tClear').click(); if (clearArmed) toast('Press C again to clear everything'); return; }
  if (k === 'p'){ $('snap').click(); return; }
  if (k === 'e'){ setTool(tool === 'erase' ? 'draw' : 'erase'); return; }
  if (k === 'v'){ setTool(tool === 'move' ? 'draw' : 'move'); return; }
  const n = 'asdfghjkl'.indexOf(k); if (n < 0) return;
  noteOn(k, n + SCALES[S.scale].length, .6, n/8);
});
// one note from a computer key: it plays (unless silent), draws an arc on its ring that grows while held,
// and when recording becomes a note in the loop
function noteOn(k, i, vel = .6, rt = .5, silent){
  ensureAudio();
  if (!silent){
    if (keyHeld[k]) release(keyHeld[k]);
    const other = Object.keys(keyHeld).find(x => x !== k && keyHeld[x] && !keyHeld[x].done);
    if (S.glide && !DRUM_INSTS.has(S.inst) && S.holdMode === 'sustain' && other){ glideHeld(keyHeld[other], i); keyHeld[k] = keyHeld[other]; delete keyHeld[other]; }
    else keyHeld[k] = voice(S.inst, i, vel, undefined, 0, S.holdMode === 'sustain' ? Infinity : undefined);
  }
  ripples.push({ x:W/2, y:CY(), r:0, life:1, t:rt });
  if (keyRec[k]) endKeyRec(k);
  const Lt = trackLoopLen(curT()), raw = beatsAt(ac.currentTime), bq = S.quant ? Math.round(raw*S.grid)/S.grid : raw, bm = Math.min(((bq % Lt) + Lt) % Lt, Lt - 1e-3);
  let nt, st;
  if (S.rec){ pushHistory(); nt = prAddNote(curT(), bm, i, 1/S.grid); nt.ch = S.chord; nt.cyc = Math.floor(bq/Lt); nt.v = Math.max(.12, Math.min(.62, vel*.8)); st = ownerOf(nt); }
  else {   // just playing: a drawing with no note, which fades away after you let go
    nt = { b: bm, i, d: 1/S.grid }; st = newStroke(); st.pts = [[0, 0], [.5, .5]]; st.roll = true; st.rollN = nt; strokes.push(st); rollArc(st);
  }
  if (st){ st.ch = S.chord; st.pulse = 1; st.vis = 1; st.keyHeld = true; st.dirty = true; lightTones(st, null, trackStrum(curT())); spark(st, Math.floor(st.pts.length/2), 6); }
  keyRec[k] = { n: nt, st, start: raw };
}
function noteOff(k){ endKeyRec(k); if (keyHeld[k]){ release(keyHeld[k]); delete keyHeld[k]; } }
const keyRec = {};
function keyLen(r){ let d = beatsAt(ac.currentTime) - r.start; if (S.quant) d = Math.round(d*S.grid)/S.grid; return Math.max(1/S.grid, Math.min(LB(), d)); }
function endKeyRec(k){
  const r = keyRec[k]; if (!r) return; delete keyRec[k];
  if (!ac) return; r.n.d = keyLen(r); if (r.st){ r.st.keyHeld = false; r.st.endT = undefined; } lanesAt = 0;
}
const keyHeld = {};
addEventListener('keyup', e => noteOff(e.key.toLowerCase()));
addEventListener('blur', () => { for (const k in keyRec) endKeyRec(k); for (const k in keyHeld){ release(keyHeld[k]); delete keyHeld[k]; } });

