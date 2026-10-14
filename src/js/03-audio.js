/* ================= Audio ================= */
/* Phones only allow sound after a real tap, and iPhones mute web audio when the silent switch is on.
   On every early touch/click: make sure the audio engine is running, play an inaudible blip inside the gesture,
   and keep a silent media element playing so the page counts as media playback (which ignores the silent switch). */
let audioUnlocked = false, silentEl = null;
function silentWavURL(){
  const n = 4410, buf = new ArrayBuffer(44 + n*2), v = new DataView(buf), w = (o, str) => { for (let i=0;i<str.length;i++) v.setUint8(o+i, str.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4, 36 + n*2, true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,44100,true); v.setUint32(28,88200,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40, n*2, true);
  return URL.createObjectURL(new Blob([buf], { type:'audio/wav' }));
}
function unlockAudio(){
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  ensureAudio();
  if (ac.state !== 'running') ac.resume().catch(() => {});
  if (!audioUnlocked){
    try { const b = ac.createBuffer(1, 1, ac.sampleRate), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start(0); } catch {}
    try { if (!silentEl){ silentEl = new Audio(silentWavURL()); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.volume = 0.01; } silentEl.play().catch(() => {}); } catch {}
  }
  if (!unlockAudio.tipped && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))){
    unlockAudio.tipped = true; setTimeout(() => toast('No sound? Turn up the volume and check the silent switch'), 600);
  }
  if (ac.state === 'running') audioUnlocked = true;
  else setTimeout(() => { if (ac.state === 'running') audioUnlocked = true; }, 250);
}
['touchstart','touchend','pointerdown','mousedown','click'].forEach(ev => addEventListener(ev, () => { if (!audioUnlocked || !ac || ac.state !== 'running') unlockAudio(); }, { capture:true, passive:true }));
// coming back to the tab (or after a phone call) the audio engine may have been paused
document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && ac.state !== 'running') ac.resume().catch(() => {}); if (!document.hidden && silentEl && audioUnlocked) silentEl.play().catch(() => {}); });
let impBuf = null, ac, analyser, master, bus, freqData, timeData, noiseBuf, clock0 = 0;
function ensureAudio(){
  if (ac){ if (ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(() => {}); return; }
  ac = new (window.AudioContext||window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = .8;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  impBuf = impulse(3.4);
  analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .72;
  freqData = new Uint8Array(analyser.frequencyBinCount); timeData = new Uint8Array(analyser.fftSize);
  master.connect(comp);
  comp.connect(analyser); analyser.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = Math.random()*2-1;
  clock0 = ac.currentTime + .05;
  bus = ac.createGain(); bus.gain.value = S.vol/80; bus.connect(master); bus.inp = ac.createGain(); buildFx();
}
function impulse(sec){
  const len = ac.sampleRate*sec, b = ac.createBuffer(2,len,ac.sampleRate);
  for (let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); }
  return b;
}
const hz = semis => (S.tuning/4) * Math.pow(2, (semis + S.key)/12);
const sem = i => { const sc = SCALES[S.scale], n = sc.length, m = ((i%n)+n)%n; return sc[m] + 12*Math.floor(i/n); };
const noteAt = i => sem(i) + 12;

// HOLD > 0 while a held note is being built: its main envelope sustains instead of decaying
let HOLD = 0, holdUsed = false;
function env(g,t,peak,att,dec){
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+att);
  if (HOLD && !holdUsed){ holdUsed = true; g.gain.setTargetAtTime(peak*.6, t+att, Math.max(.15, dec*.25)); return t+HOLD; }
  g.gain.exponentialRampToValueAtTime(.0001,t+att+dec); return t+att+dec+.05;
}
function swell(g,t,peak,att,endT){
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+att);
  if (HOLD && !holdUsed){ holdUsed = true; g.gain.setTargetAtTime(peak*.85, t+att, .5); return t+HOLD; }
  g.gain.exponentialRampToValueAtTime(.0001,endT); return endT+.05;
}
function osc(type,f,dest,t,end,detune=0){ const o=ac.createOscillator(); o.type=type; o.frequency.value=f; o.detune.value=detune; o.connect(dest); o.start(t); o.stop(end); return o; }
function amp(v,dest){ const g=ac.createGain(); g.gain.value=v; g.connect(dest); return g; }
function filt(type,f,q,dest){ const b=ac.createBiquadFilter(); b.type=type; b.frequency.value=f; b.Q.value=q; b.connect(dest); return b; }
function noise(dest,t,end){ const n=ac.createBufferSource(); n.buffer=noiseBuf; n.loop=true; n.connect(dest); n.start(t); n.stop(end); return n; }
function pan(dest, p){ if (!ac.createStereoPanner) return dest; const n=ac.createStereoPanner(); n.pan.value=p; n.connect(dest); return n; }

const VOICES = {
  pad(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.14,.45,t+3.5); g.connect(o);
    const lp=filt('lowpass',1400,1,g); osc('sawtooth',f,lp,t,end,-8); osc('sawtooth',f,lp,t,end,8); osc('sine',f/2,amp(.6,lp),t,end); },
};
/* ---- Top bar: shrinks to icons when the window is too narrow for the labels ---- */
function setLbl(el, str){
  const i = str.indexOf(' '), ic = i > 0 ? str.slice(0, i) : str, tx = i > 0 ? str.slice(i + 1) : '';
  el.innerHTML = `<span class="ic">${ic}</span>` + (tx ? `<span class="tx"> ${tx}</span>` : ''); el.setAttribute('aria-label', tx || ic);
}
document.querySelectorAll('.top button').forEach(b => setLbl(b, b.textContent.trim()));
function fitTop(){
  const top = document.querySelector('.top'), rows = [top.querySelector('.btns')];
  const over = () => rows.some(r => r.scrollWidth > r.clientWidth + 1);
  top.classList.remove('c1','c2','c3');
  if (innerWidth <= 640) return;               // phones swipe the rows sideways instead
  for (const c of ['c1','c2','c3']){ if (!over()) break; top.classList.add(c); }
}
addEventListener('resize', fitTop);
/* ---- Every sound runs through one full reverb ---- */
function buildFx(){
  const rv = ac.createConvolver(), wet = ac.createGain(); rv.buffer = impBuf; wet.gain.value = .75;
  bus.inp.connect(bus); bus.inp.connect(rv); rv.connect(wet); wet.connect(bus);
}
const updateFx = () => { if (ac) bus.gain.setTargetAtTime(S.vol/80, ac.currentTime, .03); };
function play(idx, vel, when, panPos=0, dur){
  ensureAudio();
  const t = when ?? ac.currentTime, out = pan(bus.inp, panPos), f = hz(noteAt(idx))/4;   // the pad sits two octaves down
  if (!dur){ VOICES.pad(f, vel, t, out); return null; }
  // held note: build it behind a gate, remember every source so release can stop them
  const gate = ac.createGain(); gate.connect(out);
  const oscs = [], mk = ac.createOscillator, mkB = ac.createBufferSource;
  ac.createOscillator = function(){ const o = mk.call(ac); oscs.push(o); return o; };
  ac.createBufferSource = function(){ const o = mkB.call(ac); oscs.push(o); return o; };
  HOLD = dur === Infinity ? 60 : dur + .6; holdUsed = false;
  try { VOICES.pad(f, vel, t, gate); }
  finally { ac.createOscillator = mk; ac.createBufferSource = mkB; HOLD = 0; }
  const h = { gate, oscs, t, done:false, f };
  if (dur !== Infinity) release(h, t + dur);
  return h;
}
const CHORDS = { single:[0], triad:[0,2,4], seventh:[0,2,4,6], sus2:[0,1,4], sus4:[0,3,4], power:[0,4], ninth:[0,2,4,8], octave:[0,'o'], stack:[0,4,8] };
const CHORD_NAMES = { single:'Single Note', triad:'Triad', seventh:'Seventh', sus2:'Sus2', sus4:'Sus4', power:'Power', ninth:'Add9', octave:'Octaves', stack:'Fifths Stack' };
function chordIdx(idx, ch){ const n = SCALES[S.scale].length; return (CHORDS[ch] || CHORDS.single).map(o => idx + (o === 'o' ? n : o)); }
function voice(idx, vel, when, panPos=0, dur, ch=S.chord){
  const list = chordIdx(idx, ch);
  if (list.length === 1) return play(idx, vel, when, panPos, dur);
  ensureAudio();
  const t = when ?? ac.currentTime, v = vel/(1 + .3*(list.length-1)) * 1.25;
  return { group: list.map(i => play(i, v, t, panPos, dur)) };
}
function release(h, at){
  if (h && h.group){ if (h.done) return; h.done = true; h.group.forEach(x => release(x, at)); return; }
  if (!h || h.done || !ac) return; h.done = true;
  at = Math.max(at ?? ac.currentTime, h.t + .04);
  h.gate.gain.setValueAtTime(1, at); h.gate.gain.setTargetAtTime(0, at, .08);
  h.oscs.forEach(o => { try { o.stop(at + .5); } catch {} });
}
