/* ================= Keyboard ================= */
addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (e.key === 'Escape'){ if (!$('brushPop').hidden) setBrushPop(false); else if (!$('instPop').hidden) setInstPop(false); else if (openPop) setPop(null); else if (!$('help').hidden) $('help').hidden = true; else if (!$('overlay').hidden) $('overlay').hidden = true; else if (!$('side').hidden) setSide(false); else toggleDeck(); return; }
  // sliders and dropdowns don't swallow shortcuts: only text boxes and the slider's own arrow keys do
  if (tag === 'TEXTAREA' || (tag === 'INPUT' && !['range','checkbox','color','button'].includes(e.target.type))) return;
  if (tag === 'INPUT' && /^(Arrow|Home|End|Page)/.test(e.key)) return;
  if (tag === 'SELECT'){ if (/^(Arrow|Enter|Home|End|Page)/.test(e.key)) return; e.preventDefault(); e.target.blur(); }
  const k = e.key.toLowerCase();
  if (!$('help').hidden){ if (e.key === '?') $('help').hidden = true; return; }
  if ((e.metaKey||e.ctrlKey) && k === 'z'){ e.preventDefault(); undo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.key === '?'){ $('help').hidden = false; $('helpClose').focus(); return; }
  if (k === '[' || k === ']'){ S.width = Math.max(.25, Math.min(6, S.width + (k === ']' ? .25 : -.25))); $('width').sync(); toast('Brush size ' + S.width); return; }
  if (k === '-' || k === '='){ S.sym = Math.max(1, Math.min(16, S.sym + (k === '=' ? 1 : -1))); $('sym').sync(); toast('Symmetry ' + S.sym); return; }
  if (k === 'z'){ undo(); return; }
  if (k === 'p'){ $('snap').click(); return; }
  if (k === 'c'){ $('tClear').click(); if (clearArmed) toast('Press C again to clear everything'); return; }
  const n = 'asdfghjkl'.indexOf(k); if (n >= 0) noteOn(k, n + SCALES[S.scale].length);
});
// one note from a computer key: it plays, and draws an arc on its ring that grows while the key is held
const keyHeld = {};
function noteOn(k, i){
  ensureAudio(); noteOff(k);
  const other = Object.keys(keyHeld).find(x => keyHeld[x].h && !keyHeld[x].h.done);
  let h;
  if (S.glide && !DRUM_INSTS.has(S.inst) && S.holdMode === 'sustain' && other){ h = keyHeld[other].h; glideHeld(h, i); keyHeld[other].h = null; }
  else h = voice(S.inst, i, .6, undefined, 0, S.holdMode === 'sustain' ? Infinity : undefined);
  ripples.push({ x:W/2, y:CY(), r:0, life:1, t:i/8 });
  const st = newStroke(), r = fieldR()*(1 - (i + .5)/scaleN()), a0 = Math.random()*TAU;
  st.id = -1; st.pts = [[Math.cos(a0)*r, Math.sin(a0)*r]]; st.arc = { r, a0, a: a0 }; strokes.push(st);
  lightTones(st, null, S.strum); spark(st, 0, 6);
  keyHeld[k] = { h, st };
}
function noteOff(k){ const kh = keyHeld[k]; if (!kh) return; release(kh.h); kh.st.id = 0; delete keyHeld[k]; }
setInterval(() => { for (const k in keyHeld){ const st = keyHeld[k].st, c = st.arc;   // grow each held arc, up to most of a circle
  if (c.a - c.a0 < TAU*.9){ c.a += .05; st.pts.push([Math.cos(c.a)*c.r, Math.sin(c.a)*c.r]); st.dirty = true; } } }, 30);
addEventListener('keyup', e => noteOff(e.key.toLowerCase()));
addEventListener('blur', () => { for (const k in keyHeld) noteOff(k); });
