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
['touchstart','touchend','pointerdown','mousedown','click','keydown'].forEach(ev => addEventListener(ev, () => { if (!audioUnlocked || !ac || ac.state !== 'running') unlockAudio(); }, { capture:true, passive:true }));
// coming back to the tab (or after a phone call) the audio engine may have been paused
document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && ac.state !== 'running') ac.resume().catch(() => {}); if (!document.hidden && silentEl && audioUnlocked) silentEl.play().catch(() => {}); });
let impBuf = null, ac, analyser, master, freqData, timeData, noiseBuf, clock0 = 0;
function ensureAudio(){
  if (ac){ if (ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(() => {}); return; }
  ac = new (window.AudioContext||window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = .8;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  impBuf = impulse(3.4);   // shared by every track's reverb effect
  analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .72;
  freqData = new Uint8Array(analyser.frequencyBinCount); timeData = new Uint8Array(analyser.fftSize);
  master.connect(comp);
  comp.connect(analyser); analyser.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = Math.random()*2-1;
  clock0 = ac.currentTime + .05; schedT = ac.currentTime;
  setInterval(scheduler, 25);
}
function impulse(sec){
  const len = ac.sampleRate*sec, b = ac.createBuffer(2,len,ac.sampleRate);
  for (let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); }
  return b;
}
const hz = (semis, oct = S.oct) => (S.tuning/4) * Math.pow(2, (semis + S.key + oct*12)/12);
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
function partials(f,list,g,t,end){ list.forEach(([m,a,d=0]) => osc('sine',f*m,amp(a,g),t,end,d)); }

function metal(dest, t, end, base){ [2,3,4.16,5.43,6.79,8.21].forEach(m => osc('square', base*m, dest, t, end)); }
// p tunes the drum: 1 = its natural pitch, higher rings tune it up, lower rings down
function drum(piece, v, t, o, elec, p = 1){
  const g = ac.createGain(); g.connect(o);
  const hit = (peak, dec) => env(g, t, peak, .001, dec);
  switch (piece){
    case 'kick': { const end = hit(v*(elec ? 1 : .95), elec ? .9 : .42);
      const a = osc('sine', 50*p, g, t, end); a.frequency.setValueAtTime((elec ? 130 : 160)*p, t); a.frequency.exponentialRampToValueAtTime((elec ? 42 : 48)*p, t + (elec ? .18 : .1));
      if (!elec){ const c = ac.createGain(); env(c, t, .35, .001, .02); c.connect(g); noise(filt('highpass', 2500, .7, c), t, t+.03); } break; }
    case 'snare': { const end = hit(v*.55, elec ? .22 : .2);
      noise(filt(elec ? 'bandpass' : 'highpass', (elec ? 2600 : 1500)*p, elec ? 1.2 : .7, g), t, end);
      const tg = ac.createGain(); env(tg, t, elec ? .5 : .7, .001, .1); tg.connect(g); const a = osc('triangle', 200*p, tg, t, t+.14); a.frequency.exponentialRampToValueAtTime((elec ? 180 : 155)*p, t+.08); break; }
    case 'rim': { const end = hit(v*.45, .045); osc('square', 1650*p, filt('bandpass', 1700*p, 4, g), t, end); osc('sine', 820*p, amp(.6, g), t, end); break; }
    case 'clap': { g.gain.setValueAtTime(0, t); const bp = filt('bandpass', 1200*p, 1.1, g);
      [0, .011, .022].forEach(d => { g.gain.setValueAtTime(v*.6, t + d); g.gain.exponentialRampToValueAtTime(v*.08, t + d + .009); });
      g.gain.setValueAtTime(v*.55, t + .033); g.gain.exponentialRampToValueAtTime(.0001, t + .033 + (elec ? .24 : .16)); noise(bp, t, t + .3); break; }
    case 'tomLo': case 'tomMid': case 'tomHi': { const F = { tomLo: 88, tomMid: 125, tomHi: 175 }[piece]*p, end = hit(v*.7, elec ? .5 : .38);
      const a = osc('sine', F, g, t, end); a.frequency.setValueAtTime(F*(elec ? 1.9 : 1.45), t); a.frequency.exponentialRampToValueAtTime(F, t + .06);
      if (!elec){ const c = ac.createGain(); env(c, t, .12, .001, .06); c.connect(g); noise(filt('lowpass', 1800, .7, c), t, t+.08); } break; }
    case 'hat': case 'openHat': { const end = hit(v*.32, piece === 'hat' ? .055 : .38), hp = filt('highpass', 7200*Math.min(p, 1.6), .8, g);
      if (elec) metal(filt('bandpass', 10000*Math.min(p, 1.4), 1, hp), t, end, 40*p); else { noise(hp, t, end); metal(amp(.25, hp), t, end, 46*p); } break; }
    case 'shaker': { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v*.28, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .11); noise(filt('bandpass', 6200*Math.min(p, 1.6), 2, g), t, t + .13); break; }
    case 'ride': { const end = hit(v*.18, 1.3), bp = filt('bandpass', 5200*p, .9, g); metal(bp, t, end, 52*p); osc('sine', 3200*p, amp(.25, g), t, end); break; }
    case 'crash': { const end = hit(v*.3, 1.7), hp = filt('highpass', 4200*p, .6, g); noise(hp, t, end); metal(amp(.3, hp), t, end, 44*p); break; }
  }
}
// single drums: the pitch ring tunes the drum (gently for cymbals and noise, fully for toms)
const drumTune = (f, k = .5) => Math.max(.55, Math.min(1.9, Math.pow(f/432, k)));
const DRUM_VOICES = {
  kick:     (f,v,t,o) => drum('kick', v*1.3, t, o, false, drumTune(f, .35)),
  kick808:  (f,v,t,o) => drum('kick', v*1.3, t, o, true, drumTune(f, .5)),
  snare:    (f,v,t,o) => drum('snare', v*1.3, t, o, false, drumTune(f, .4)),
  snare808: (f,v,t,o) => drum('snare', v*1.9, t, o, true, drumTune(f, .4)),
  clap:     (f,v,t,o) => drum('clap', v*2.2, t, o, false, drumTune(f, .4)),
  rimshot:  (f,v,t,o) => drum('rim', v*1.3, t, o, false, drumTune(f, .5)),
  tom:      (f,v,t,o) => drum('tomMid', v*1.3, t, o, false, drumTune(f, 1)),
  tom808:   (f,v,t,o) => drum('tomMid', v*1.3, t, o, true, drumTune(f, 1)),
  hihat:    (f,v,t,o) => drum('hat', v*1.3, t, o, false, drumTune(f, .3)),
  hat808:   (f,v,t,o) => drum('hat', v*2.2, t, o, true, drumTune(f, .3)),
  openhat:  (f,v,t,o) => drum('openHat', v*1.3, t, o, false, drumTune(f, .3)),
  shaker:   (f,v,t,o) => drum('shaker', v*2, t, o, false, drumTune(f, .3)),
  ride:     (f,v,t,o) => drum('ride', v*1.3, t, o, false, drumTune(f, .3)),
  crash:    (f,v,t,o) => drum('crash', v*1.3, t, o, false, drumTune(f, .25)),
  snap(f,v,t,o){ const g=ac.createGain(); g.connect(o); const p=drumTune(f,.3); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*1.1,t+.002); g.gain.exponentialRampToValueAtTime(.0001,t+.07); noise(filt('bandpass',2200*p,3,g),t,t+.09); },
  conga(f,v,t,o){ const p=drumTune(f,.7), g=ac.createGain(), end=env(g,t,v*.9,.001,.32); g.connect(o); const a=osc('sine',210*p,g,t,end); a.frequency.setValueAtTime(260*p,t); a.frequency.exponentialRampToValueAtTime(205*p,t+.04); const c=ac.createGain(); env(c,t,.25,.001,.012); c.connect(g); noise(filt('bandpass',1800,1,c),t,t+.02); },
  bongo(f,v,t,o){ const p=drumTune(f,.7), g=ac.createGain(), end=env(g,t,v*.85,.001,.18); g.connect(o); const a=osc('sine',360*p,g,t,end); a.frequency.setValueAtTime(430*p,t); a.frequency.exponentialRampToValueAtTime(350*p,t+.03); },
  cowbell(f,v,t,o){ const p=drumTune(f,.5), g=ac.createGain(), end=env(g,t,v*.5,.001,.35); g.connect(o); const bp=filt('bandpass',900*p,2.5,g); osc('square',540*p,bp,t,end); osc('square',800*p,bp,t,end); },
  tambourine(f,v,t,o){ const p=drumTune(f,.3), g=ac.createGain(), end=env(g,t,v*.45,.002,.28); g.connect(o); const hp=filt('highpass',6500*p,1,g); noise(hp,t,end); metal(amp(.35,hp),t,end,60*p); },
  triangle(f,v,t,o){ const p=drumTune(f,.5), g=ac.createGain(), end=env(g,t,v*.25,.001,2.2); g.connect(o); partials(2600*p,[[1,1],[2.76,.4],[5.4,.2]],g,t,end); }
};
const DRUM_INSTS = new Set(Object.keys(DRUM_VOICES));
let SAMPLE_TID = null;
const VOICES = {
  ...DRUM_VOICES,
  sampler(f,v,t,o){
    const b = sampleBuffer(trk(SAMPLE_TID ?? S.cur)); if (!b){ VOICES.bell(f,v,t,o); return; }
    const g = ac.createGain(), src = ac.createBufferSource(), dur = b.duration/Math.max(.25, f/(S.tuning/2*Math.pow(2, S.key/12)));
    src.buffer = b; src.playbackRate.value = f/(S.tuning/2*Math.pow(2, S.key/12));   // the root ring plays the sample at its own pitch
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v*.9, t + .004);
    if (HOLD && !holdUsed){ holdUsed = true; } else g.gain.setTargetAtTime(0, t + Math.max(.05, dur - .08), .03);
    src.connect(g); g.connect(o); src.start(t); src.stop(t + dur + .3);
  },
  piano(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.32,.003,2.4); g.connect(o);
    const lp=filt('lowpass',Math.min(9000,f*7),.6,g); lp.frequency.setValueAtTime(Math.min(12000,f*12),t); lp.frequency.exponentialRampToValueAtTime(Math.min(6000,f*4),t+1.2);
    partials(f,[[1,1],[2,.45,1.5],[3,.22,-1],[4,.12],[5,.06,2]],lp,t,end); const c=ac.createGain(); env(c,t,.08,.001,.03); c.connect(g); noise(filt('bandpass',f*4,1,c),t,t+.04); },
  harpsichord(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.14,.001,1.1); g.connect(o);
    const hp=filt('highpass',f*1.5,.7,g); osc('sawtooth',f,hp,t,end); osc('square',f*2,amp(.35,hp),t,end,4); },
  vibes(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.32,.002,3.2); g.connect(o);
    const tr=ac.createGain(); tr.gain.value=.75; tr.connect(g); const l=osc('sine',5.6,amp(.25,tr.gain),t,end); osc('sine',f,tr,t,end); osc('sine',f*4,amp(.12,tr),t,end); },
  guitar(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.26,.002,1.8); g.connect(o);
    const lp=filt('lowpass',f*6,1.2,g); lp.frequency.setValueAtTime(f*10,t); lp.frequency.exponentialRampToValueAtTime(f*1.6,t+.9);
    osc('sawtooth',f,lp,t,end); osc('triangle',f,amp(.6,lp),t,end,3); const c=ac.createGain(); env(c,t,.15,.001,.02); c.connect(g); noise(filt('bandpass',f*3,2,c),t,t+.03); },
  clarinet(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.16,.06,t+1.4); g.connect(o);
    const lp=filt('lowpass',f*4,.8,g); osc('square',f,lp,t,end); osc('sine',f,amp(.5,g),t,end); },
  brass(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.15,.05,t+1.5); g.connect(o);
    const lp=filt('lowpass',400,1.4,g); lp.frequency.setValueAtTime(400,t); lp.frequency.linearRampToValueAtTime(Math.min(5000,f*7),t+.09); lp.frequency.setTargetAtTime(Math.min(3000,f*4),t+.1,.3);
    osc('sawtooth',f,lp,t,end); osc('sawtooth',f,lp,t,end,-7); },
  accordion(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.1,.04,t+1.6); g.connect(o);
    const lp=filt('lowpass',2400,.8,g); osc('sawtooth',f,lp,t,end,-9); osc('sawtooth',f,lp,t,end,9); osc('square',f*2,amp(.4,lp),t,end); },
  cello(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.2,.18,t+2.2); g.connect(o);
    const lp=filt('lowpass',1800,1,g), a=osc('sawtooth',f/2,lp,t,end), vib=osc('sine',5,amp(3,a.frequency),t,end); osc('sawtooth',f/2,amp(.5,lp),t,end,6); },
  chip(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.09,.001,.45); g.connect(o);
    const a=osc('square',f,g,t,end); a.frequency.setValueAtTime(f*2,t); a.frequency.setValueAtTime(f,t+.03); },
  fmbell(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.3,.002,2.6); g.connect(o);
    const car=osc('sine',f,g,t,end), mg=ac.createGain(); mg.gain.setValueAtTime(f*3,t); mg.gain.exponentialRampToValueAtTime(f*.2,t+1.8); mg.connect(car.frequency); osc('sine',f*3.5,mg,t,end); },
  acid(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.25,.003,.55); g.connect(o);
    const lp=filt('lowpass',300,14,g); lp.frequency.setValueAtTime(300,t); lp.frequency.exponentialRampToValueAtTime(2400,t+.04); lp.frequency.exponentialRampToValueAtTime(260,t+.35);
    osc('sawtooth',f/2,lp,t,end); },
  wobble(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.3,.005,1.4); g.connect(o);
    const lp=filt('lowpass',600,8,g), l=osc('sine',4,amp(500,lp.frequency),t,end); osc('sawtooth',f/2,lp,t,end); osc('square',f/4,amp(.6,lp),t,end); },
  bell(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.33,.01,2.8); g.connect(o);
    osc('sine',f,g,t,end); osc('triangle',f*2.001,amp(.22,g),t,end); osc('sine',f*3.01,amp(.06,g),t,end); },
  bowl(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.28,.05,6); g.connect(o);
    partials(f,[[1,1,3],[1,.6,-3],[2.76,.45,3],[2.76,.27,-3],[5.4,.22],[8.93,.1]],g,t,end); },
  gong(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.3,.07,7); g.connect(o);
    partials(f/2,[[1,1],[1.48,.6,4],[2.03,.45,-6],[2.57,.32,8],[3.2,.22],[4.1,.15,5],[5.3,.08]],g,t,end); },
  crystal(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.22,.025,4.2); g.connect(o);
    partials(f,[[1,1,4],[1,1,-4],[2.42,.4,2],[4.9,.18],[7.2,.08]],g,t,end); },
  celesta(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.3,.002,1.7); g.connect(o);
    partials(f*2,[[1,1],[2,.25,2],[3,.06]],g,t,end); },
  musicbox(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.3,.001,1.5); g.connect(o);
    osc('sine',f*2,g,t,end); osc('triangle',f*4,amp(.12,g),t,end); const g2=ac.createGain(); env(g2,t,.12,.001,.06); g2.connect(g); osc('sine',f*6.1,g2,t,end); },
  glass(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.3,.005,2.4); g.connect(o);
    const car=ac.createOscillator(); car.frequency.value=f; car.connect(g);
    const mod=ac.createOscillator(); mod.frequency.value=f*3.5; const mi=ac.createGain();
    mi.gain.setValueAtTime(f*2.5,t); mi.gain.exponentialRampToValueAtTime(f*.05,t+1.5);
    mod.connect(mi); mi.connect(car.frequency); car.start(t); mod.start(t); car.stop(end); mod.stop(end); },
  pluck(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.28,.002,1.7); g.connect(o);
    const lp=filt('lowpass',5200,2,g); lp.frequency.setValueAtTime(5200,t); lp.frequency.exponentialRampToValueAtTime(260,t+.8);
    osc('sawtooth',f,lp,t,end); osc('square',f*1.002,amp(.3,lp),t,end); },
  kalimba(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.42,.003,1.3); g.connect(o);
    osc('sine',f,g,t,end); const g2=ac.createGain(); env(g2,t,.35,.002,.12); g2.connect(g); osc('sine',f*5.4,g2,t,end); },
  koto(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.32,.002,1.6); g.connect(o);
    const lp=filt('lowpass',3200,1,g); lp.frequency.setValueAtTime(3200,t); lp.frequency.exponentialRampToValueAtTime(700,t+.6);
    const a=osc('triangle',f,lp,t,end); a.frequency.setValueAtTime(f*1.015,t); a.frequency.exponentialRampToValueAtTime(f,t+.06);
    osc('sine',f*2,amp(.3,lp),t,end); osc('sawtooth',f*3,amp(.04,lp),t,end); },
  sitar(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.2,.004,2.4); g.connect(o);
    const bp=filt('bandpass',f*6,5,g); bp.frequency.setValueAtTime(f*7,t); bp.frequency.exponentialRampToValueAtTime(f*2,t+1.2);
    const a=osc('sawtooth',f,bp,t,end); a.frequency.setValueAtTime(f*1.02,t); a.frequency.linearRampToValueAtTime(f,t+.15);
    osc('sawtooth',f*1.004,bp,t,end); osc('sine',f,amp(.5,g),t,end); },
  marimba(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.45,.002,.9); g.connect(o);
    osc('sine',f,g,t,end); const g2=ac.createGain(); env(g2,t,.25,.001,.08); g2.connect(g); osc('sine',f*4,g2,t,end); osc('sine',f*10,amp(.03,g2),t,end); },
  epiano(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.32,.003,2.3); g.connect(o);
    const car=ac.createOscillator(); car.frequency.value=f; car.connect(g);
    const mod=ac.createOscillator(); mod.frequency.value=f; const mi=ac.createGain();
    mi.gain.setValueAtTime(f*1.6,t); mi.gain.exponentialRampToValueAtTime(f*.08,t+1);
    mod.connect(mi); mi.connect(car.frequency); car.start(t); mod.start(t); car.stop(end); mod.stop(end);
    osc('sine',f*2,amp(.08,g),t,end,3); },
  organ(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.16,.02,t+1.4); g.connect(o);
    partials(f,[[1,.5],[2,.4],[3,.22],[4,.16],[6,.08],[8,.05]],g,t,end); },
  steeldrum(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.34,.003,1); g.connect(o);
    const a=osc('sine',f,g,t,end); a.frequency.setValueAtTime(f*.985,t); a.frequency.linearRampToValueAtTime(f,t+.03);
    partials(f,[[2,.5],[3.01,.22],[4.2,.08]],g,t,end); },
  handpan(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.36,.006,3.2); g.connect(o);
    const a=osc('sine',f,g,t,end); a.frequency.setValueAtTime(f*1.012,t); a.frequency.exponentialRampToValueAtTime(f,t+.05);
    partials(f,[[2,.35,2],[2.98,.12],[4.03,.05]],g,t,end); },
  flute(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.26,.12,t+2.3); g.connect(o);
    const c=osc('sine',f*2,g,t,end); const vib=ac.createOscillator(); vib.frequency.value=5.2; const vg=amp(f*.012,c.frequency); vib.connect(vg); vib.start(t+.15); vib.stop(end);
    osc('triangle',f*4,amp(.05,g),t,end); noise(filt('bandpass',f*2,2.5,amp(.25,g)),t,end); },
  choir(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.18,.3,t+3); g.connect(o);
    [700,1150,2600].forEach((ff,i)=>{ const bp=filt('bandpass',ff,8,amp([1,.6,.3][i]*3,g)); osc('sawtooth',f,bp,t,end,-5); osc('sawtooth',f,bp,t,end,6); }); },
  strings(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.11,.35,t+2.8); g.connect(o);
    const lp=filt('lowpass',1900,.7,g); [-11,0,9].forEach(d => osc('sawtooth',f,lp,t,end,d)); },
  pad(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.14,.45,t+3.5); g.connect(o);
    const lp=filt('lowpass',1400,1,g); osc('sawtooth',f,lp,t,end,-8); osc('sawtooth',f,lp,t,end,8); osc('sine',f/2,amp(.6,lp),t,end); },
  lead(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.13,.01,1.2); g.connect(o);
    const lp=filt('lowpass',3200,4,g); lp.frequency.setValueAtTime(3600,t); lp.frequency.exponentialRampToValueAtTime(800,t+.9);
    const a=osc('square',f,lp,t,end), b=osc('sawtooth',f,lp,t,end,7);
    const vib=ac.createOscillator(); vib.frequency.value=5.5; const vg=ac.createGain(); vg.gain.value=f*.008; vib.connect(vg); vg.connect(a.frequency); vg.connect(b.frequency); vib.start(t+.2); vib.stop(end); },
  subbass(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.6,.008,1.5); g.connect(o); osc('sine',f/4,g,t,end); osc('sine',f/2,amp(.12,g),t,end); },
  synthbass(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.3,.004,.9); g.connect(o);
    const lp=filt('lowpass',2400,8,g); lp.frequency.setValueAtTime(2600,t); lp.frequency.exponentialRampToValueAtTime(180,t+.35);
    osc('sawtooth',f/2,lp,t,end); osc('square',f/2,amp(.5,lp),t,end,-8); osc('sine',f/4,amp(.6,g),t,end); },
  pluckbass(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.5,.002,.6); g.connect(o);
    const lp=filt('lowpass',900,3,g); lp.frequency.setValueAtTime(1100,t); lp.frequency.exponentialRampToValueAtTime(140,t+.25);
    osc('triangle',f/2,lp,t,end); osc('sine',f/2,amp(.6,g),t,end); },
  upright(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.5,.012,1.5); g.connect(o);
    const lp=filt('lowpass',700,1,g); const a=osc('triangle',f/2,lp,t,end); a.frequency.setValueAtTime(f/2*1.02,t); a.frequency.exponentialRampToValueAtTime(f/2,t+.08);
    osc('sine',f/2,amp(.7,g),t,end); const c=ac.createGain(); env(c,t,.4,.001,.05); c.connect(g); noise(filt('bandpass',220,2,c),t,t+.08); },
  reese(f,v,t,o){ const g=ac.createGain(), end=swell(g,t,v*.22,.03,t+1.8); g.connect(o);
    const lp=filt('lowpass',520,3,g), lfo=ac.createOscillator(); lfo.frequency.value=.8; const lg=ac.createGain(); lg.gain.value=260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(end);
    osc('sawtooth',f/2,lp,t,end,-18); osc('sawtooth',f/2,lp,t,end,18); osc('sine',f/4,amp(.5,g),t,end); },
  b808(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.65,.002,1.9); g.connect(o);
    const ws=ac.createWaveShaper(), cu=new Float32Array(256); for (let i=0;i<256;i++){ const x=i/128-1; cu[i]=Math.tanh(x*2.4); } ws.curve=cu; ws.connect(amp(.45,g));
    const a=osc('sine',f/4,g,t,end); a.connect(ws); a.frequency.setValueAtTime(f*.75,t); a.frequency.exponentialRampToValueAtTime(f/4,t+.07); },
  supersaw(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.08,.01,1.3); g.connect(o);
    const lp=filt('lowpass',2600,1,g); [-24,-12,0,12,24].forEach(d=>osc('sawtooth',f,lp,t,end,d)); osc('sawtooth',f/2,amp(.4,lp),t,end); },
  bass(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.45,.005,1.1); g.connect(o);
    const lp=filt('lowpass',700,2,g); lp.frequency.setValueAtTime(1200,t); lp.frequency.exponentialRampToValueAtTime(260,t+.5);
    osc('sine',f/2,g,t,end); osc('triangle',f/2,amp(.6,lp),t,end); osc('sawtooth',f/2,amp(.15,lp),t,end); },
  tabla(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.5,.002,.55); g.connect(o);
    const a=osc('sine',f/2,g,t,end); a.frequency.setValueAtTime(f*.8,t); a.frequency.exponentialRampToValueAtTime(f/2,t+.07);
    osc('sine',f*1.5,amp(.15,g),t,end); const c=ac.createGain(); env(c,t,.5,.001,.03); c.connect(g); noise(filt('bandpass',3000,1.5,c),t,t+.06); },
  woodblock(f,v,t,o){ const g=ac.createGain(), end=env(g,t,v*.5,.001,.14); g.connect(o);
    osc('sine',f*3,g,t,end); osc('sine',f*4.7,amp(.3,g),t,end); noise(filt('bandpass',f*3,10,amp(.8,g)),t,t+.05); }
};
/* ---- Top bar: shrinks to icons when the window is too narrow for the labels ---- */
function setLbl(el, str){
  const i = str.indexOf(' '), ic = i > 0 ? str.slice(0, i) : str, tx = i > 0 ? str.slice(i + 1) : '';
  el.innerHTML = `<span class="ic">${ic}</span>` + (tx ? `<span class="tx"> ${tx}</span>` : ''); el.setAttribute('aria-label', tx || ic);
}
document.querySelectorAll('.top button').forEach(b => setLbl(b, b.textContent.trim()));
function fitTop(){
  const top = document.querySelector('.top'), rows = [...top.querySelectorAll('.transport,.btns')];
  const over = () => rows.some(r => r.scrollWidth > r.clientWidth + 1);
  top.classList.remove('c1','c2','c3');
  if (innerWidth <= 640) return;               // phones swipe the rows sideways instead
  for (const c of ['c1','c2','c3']){ if (!over()) break; top.classList.add(c); }
  if (typeof placeTimeline === 'function') placeTimeline();
  if (typeof placeSide === 'function') placeSide();
}
addEventListener('resize', fitTop);
/* ---- Mixer channels ---- */
const chans = {};
const trk = id => S.tracks.find(t => t.id === id);
const curT = () => trk(S.cur) || S.tracks[0];
const trackOf = st => trk(st.track) || null;
const instOf = st => { const t = trackOf(st); return t ? t.inst : (st.inst || 'bell'); };
const trackIndex = t => S.tracks.indexOf(t) + 1;
const trackName = t => t.name || ('Track ' + trackIndex(t));
function trackRGB(t){ return hsl2rgb((t.id*83 + 15) % 360, 72, LIGHT ? 42 : 64); }
function mixOf(key){ const t = trk(key); if (t) return t; return S.mix[key] || (S.mix[key] = { v:80, m:false, s:false }); }
function chanGain(key){ const m = mixOf(key), solo = S.tracks.some(x => x.s); return (m.m || (solo && !m.s)) ? 0 : m.v/80; }
// every track has its own fader plus its own reverb and echo sends
// each track: input → its effect → fader → master (plus reverb and echo sends)
const AFX_NAMES = {reverb:'Reverb', echo:'Echo', flanger:'Flanger', chorus:'Chorus', phaser:'Phaser', tremolo:'Tremolo', wah:'Auto-Wah', drive:'Distortion', crush:'Bitcrush', lofi:'Lo-Fi', phone:'Telephone'};
const VFX_NAMES = {strobe:'Strobe', pulse:'Pulse', shimmer:'Shimmer', rainbow:'Rainbow', glow:'Glow', spin:'Spin', jitter:'Jitter', breathe:'Breathe'};
function fxOf(key){ const t = trk(key); if (!t) return []; return ((t.id === S.cur ? S.afxList : t.afxList) || []).filter(x => AFX_NAMES[x.type]); }
// the track's effects run in order: input → effect 1 → effect 2 → … → fader
function buildFx(g){
  const list = fxOf(g.key), n = ac.currentTime;
  (g.fxNodes || []).forEach(x => { try { x.disconnect(); } catch {} if (x.stop) try { x.stop(); } catch {} });
  try { g.inp.disconnect(); } catch {}
  const nodes = g.fxNodes = [], mk = x => { nodes.push(x); return x; };
  const lfo = (hz, depth, target) => { const o = mk(ac.createOscillator()), d = mk(ac.createGain()); o.frequency.value = hz; d.gain.value = depth; o.connect(d); d.connect(target); o.start(n); return o; };
  const shaper = curveFn => { const ws = mk(ac.createWaveShaper()), c = new Float32Array(1024); for (let i=0;i<1024;i++) c[i] = curveFn(i/512 - 1); ws.curve = c; return ws; };
  g.fxSig = JSON.stringify(list) + (list.some(x => x.type === 'echo') ? '@' + S.bpm : '');
  let src = g.inp;
  for (const fx of list){
    const amt = (fx.amt ?? 60)/100, o = mk(ac.createGain());
    const wet = (node, mix) => { const w = mk(ac.createGain()); w.gain.value = mix; node.connect(w); w.connect(o); };
    switch (fx.type){
      case 'flanger': { src.connect(o); const d = mk(ac.createDelay(.05)), fb = mk(ac.createGain()); d.delayTime.value = .004; fb.gain.value = .3 + amt*.45;
        src.connect(d); d.connect(fb); fb.connect(d); lfo(.22, .0025 + amt*.002, d.delayTime); wet(d, .4 + amt*.5); break; }
      case 'chorus': { src.connect(o); for (const [base, hz] of [[.018, 1.1], [.027, .7]]){ const d = mk(ac.createDelay(.1)); d.delayTime.value = base; src.connect(d); lfo(hz, .002 + amt*.004, d.delayTime); wet(d, .3 + amt*.4); } break; }
      case 'phaser': { src.connect(o); let last = src; for (let i=0;i<4;i++){ const ap = mk(ac.createBiquadFilter()); ap.type = 'allpass'; ap.frequency.value = 700 + i*250; ap.Q.value = .7; last.connect(ap); last = ap; lfo(.35 + amt*.4, 300 + amt*500, ap.frequency); } wet(last, .5 + amt*.4); break; }
      case 'tremolo': { const tg = mk(ac.createGain()); tg.gain.value = 1 - amt*.45; src.connect(tg); tg.connect(o); lfo(4 + amt*5, amt*.45, tg.gain); break; }
      case 'wah': { const bp = mk(ac.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 4 + amt*6; src.connect(bp); lfo(1 + amt*2.5, 900, bp.frequency); wet(bp, 3.4); const dry = mk(ac.createGain()); dry.gain.value = .5; src.connect(dry); dry.connect(o); break; }
      case 'drive': { const k = 2 + amt*20, ws = shaper(x => Math.tanh(x*k)/Math.tanh(k)); src.connect(ws); const post = mk(ac.createGain()); post.gain.value = .55 - amt*.25; ws.connect(post); post.connect(o); break; }
      case 'crush': { const steps = Math.round(Math.pow(2, 6 - amt*4.5)), ws = shaper(x => Math.round(x*steps)/steps); src.connect(ws); const lp = mk(ac.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 9000 - amt*6000; ws.connect(lp); lp.connect(o); break; }
      case 'lofi': { const lp = mk(ac.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 4200 - amt*3200; lp.Q.value = .9; const ws = shaper(x => Math.tanh(x*1.8)); src.connect(lp); lp.connect(ws); ws.connect(o); lfo(.5, 60*amt, lp.frequency); break; }
      case 'phone': { const hp = mk(ac.createBiquadFilter()), lp = mk(ac.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 450; lp.type = 'lowpass'; lp.frequency.value = 3200 - amt*1200; src.connect(hp); hp.connect(lp); wet(lp, 1.4); const dry = mk(ac.createGain()); dry.gain.value = 1 - amt; src.connect(dry); dry.connect(o); break; }
      case 'reverb': { src.connect(o); const cv2 = mk(ac.createConvolver()); cv2.buffer = impBuf; src.connect(cv2); wet(cv2, amt*1.1); break; }
      case 'echo': { src.connect(o); const d = mk(ac.createDelay(2)), fb = mk(ac.createGain()), lp = mk(ac.createBiquadFilter()); d.delayTime.value = beatLen()*.75; fb.gain.value = .25 + amt*.4; lp.type = 'lowpass'; lp.frequency.value = 3200;
        src.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); wet(lp, .3 + amt*.6); break; }
      default: src.connect(o);
    }
    src = o;
  }
  src.connect(g.lp || g);
}
function chan(inst){
  if (!chans[inst]){
    const g = ac.createGain(); g.gain.value = chanGain(inst); g.connect(master);
    g.key = isNaN(inst) ? inst : +inst; g.inp = ac.createGain();
    g.lp = ac.createBiquadFilter(); g.lp.type = 'lowpass'; g.lp.frequency.value = 20000; g.lp.Q.value = .8; g.au = ac.createGain(); g.dk = ac.createGain();
    g.lp.connect(g.au); g.au.connect(g.dk); g.dk.connect(g); buildFx(g);
    chans[inst] = g;
  }
  return chans[inst].inp;
}
function updateMix(){ if (!ac) return; const n = ac.currentTime;
  for (const k in chans){ const g = chans[k];
    g.gain.setTargetAtTime(chanGain(isNaN(k) ? k : +k), n, .03);
    const l2 = fxOf(g.key); if (g.fxSig !== JSON.stringify(l2) + (l2.some(x => x.type === 'echo') ? '@' + S.bpm : '')) buildFx(g); } }
const SUSTAINS = new Set(['clarinet','brass','accordion','cello','organ','flute','choir','strings','pad','reese','lead','supersaw','subbass','synthbass','bass','upright']);
function play(inst, idx, vel, when, panPos=0, dur, tid){
  ensureAudio();
  if (!VOICES[inst]) inst = 'bell';
  const t = when ?? ac.currentTime, out = pan(chan(tid ?? S.cur), panPos);
  if (KICKS.has(inst)) duckOthers(t, tid ?? S.cur);
  const tk = trk(tid ?? S.cur), oc = tk && tk.oct !== undefined ? tk.oct : S.oct, f = hz(noteAt(idx), oc);   // each track plays in its own octave
  SAMPLE_TID = tid ?? S.cur;
  if (!dur){ VOICES[inst](f, vel, t, out); return null; }
  // held note: build it behind a gate, remember every source so release can stop them
  const gate = ac.createGain(); gate.connect(out);
  const oscs = [], mk = ac.createOscillator, mkB = ac.createBufferSource;
  ac.createOscillator = function(){ const o = mk.call(ac); oscs.push(o); return o; };
  ac.createBufferSource = function(){ const o = mkB.call(ac); oscs.push(o); return o; };
  HOLD = SUSTAINS.has(inst) ? (dur === Infinity ? 60 : dur + .6) : 0; holdUsed = false;
  try { VOICES[inst](f, vel, t, gate); }
  finally { ac.createOscillator = mk; ac.createBufferSource = mkB; HOLD = 0; }
  const h = { gate, oscs, t, done:false, f, oc };
  if (dur !== Infinity) release(h, t + dur);
  return h;
}
const CHORDS = { single:[0], triad:[0,2,4], seventh:[0,2,4,6], sus2:[0,1,4], sus4:[0,3,4], power:[0,4], ninth:[0,2,4,8], octave:[0,'o'], stack:[0,4,8] };
const CHORD_NAMES = { single:'Single Note', triad:'Triad', seventh:'Seventh', sus2:'Sus2', sus4:'Sus4', power:'Power', ninth:'Add9', octave:'Octaves', stack:'Fifths Stack' };
const ringHits = {};
function chordIdx(idx, ch){ const n = SCALES[S.scale].length; return (CHORDS[ch] || CHORDS.single).map(o => idx + (o === 'o' ? n : o)); }
function voice(inst, idx, vel, when, panPos=0, dur, ch=S.chord, tid){
  const list = chordIdx(idx, ch), now = performance.now();
  if (ac){ const lag = Math.max(0, ((when ?? ac.currentTime) - ac.currentTime)*1000), tk0 = trk(tid ?? S.cur), sm = tk0 && tk0.strum !== undefined ? tk0.strum : S.strum; list.forEach((i, k) => ringHits[i] = now + lag + k*sm); }
  if (list.length === 1) return play(inst, idx, vel, when, panPos, dur, tid);
  ensureAudio();
  const t = when ?? ac.currentTime, v = vel/(1 + .3*(list.length-1)) * 1.25;
  const tk = trk(tid ?? S.cur), strum = tk && tk.strum !== undefined ? tk.strum : S.strum;
  const group = list.map((i, k) => play(inst, i, v, t + k*strum/1000, panPos, dur, tid));
  return { group, offs: list.map(i => i - idx) };
}
function glideHeld(h, idx){
  if (h && h.group){ h.group.forEach((x, k) => glideHeld(x, idx + h.offs[k])); h.offs.forEach(o => ringHits[idx+o] = performance.now()); return; }
  if (h && !h.group) ringHits[idx] = performance.now();
  if (!h || h.done || !ac) return;
  const nf = hz(noteAt(idx), h.oc ?? S.oct), now = ac.currentTime, tc = Math.max(.008, S.glideTime/1000/3);
  if (!h.ratios) h.ratios = h.oscs.map(o => o.frequency && o.frequency.value > 25 ? o.frequency.value / h.f : 0);
  h.oscs.forEach((o, j) => { const r = h.ratios[j]; if (!r) return;
    o.frequency.cancelScheduledValues(now); o.frequency.setValueAtTime(o.frequency.value, now); o.frequency.setTargetAtTime(nf*r, now, tc); });
}
function release(h, at){
  if (h && h.group){ if (h.done) return; h.done = true; h.group.forEach(x => release(x, at)); return; }
  if (!h || h.done || !ac) return; h.done = true;
  at = Math.max(at ?? ac.currentTime, h.t + .04);
  h.gate.gain.setValueAtTime(1, at); h.gate.gain.setTargetAtTime(0, at, .08);
  h.oscs.forEach(o => { try { o.stop(at + .5); } catch {} });
}
function click(t, level){
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = [1400, 2000, 2700][level];
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(S.metroVol/100*(level ? .4 : .26), t+.001); g.gain.exponentialRampToValueAtTime(.0001, t+.06);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+.08); return o;
}

/* ---- Clock and loop ---- */
const beatLen = () => 60/S.bpm;
const beatsAt = t => (t - clock0)/beatLen();
let schedT = 0, countEnd = 0, countOscs = []; const flashes = [];
function noteWhen(c, b, Lp = LB()){
  let when = clock0 + (c*Lp + b)*beatLen();
  const s16 = b*4, r = Math.round(s16);
  if (S.swing && Math.abs(s16 - r) < .02 && r % 2) when += S.swing/100 * beatLen()/4 * .7;
  return when;
}
// ---- song parts, short track loops, chord progression, sidechain, automation ----
function trackLoopLen(t){ const L = LB(), v = t ? +trackVal(t, 'loopB') || 0 : 0; return v > 0 && v < L ? v : L; }
const KICKS = new Set(['kick','b808','kick808']);
function duckOthers(t, tid){
  for (const tk of S.tracks){
    if (tk.id === tid) continue; const d = (+trackVal(tk, 'duck') || 0)/100, g = chans[tk.id]; if (!d || !g || !g.dk) continue;
    const at = Math.max(t, ac.currentTime); g.dk.gain.cancelScheduledValues(at); g.dk.gain.setValueAtTime(Math.max(.05, 1 - d*.9), at); g.dk.gain.setTargetAtTime(1, at + .03, beatLen()*.18);
  }
}
// automation: points {b, v} across the loop; between points the value slides in a straight line
function autoVal(pts, pos, L = LB()){
  if (!pts || !pts.length) return null;
  if (pts.length === 1) return pts[0].v;
  let i = pts.findIndex(p => p.b > pos); if (i < 0) i = pts.length;
  const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i % pts.length];
  let span = b.b - a.b, off = pos - a.b; if (span <= 0) span += L; if (off < 0) off += L;
  return a.v + (b.v - a.v)*Math.min(1, off/span);
}
function applyAuto(now){
  const L = LB(), pos = ((beatsAt(now + .03) % L) + L) % L;
  for (const t of S.tracks){
    const g = chans[t.id]; if (!g || !g.au) continue;
    const a = t.auto || {}, vv = S.loop ? autoVal(a.vol, pos) : null, cv = S.loop ? autoVal(a.cut, pos) : null;
    g.au.gain.setTargetAtTime(vv == null ? 1 : vv*vv*1.2, now, .03);
    g.lp.frequency.setTargetAtTime(cv == null ? 20000 : 60*Math.pow(2, cv*8.35), now, .04);
  }
}
function scheduler(){
  if (!ac) return;
  const now = ac.currentTime, ahead = now + .12;
  applyAuto(now);
  if (schedT < now) schedT = now;
  if (S.loop){
    const L = LB();
    const each = (n, inst, st) => {
      const Lt = trackLoopLen(trackOf(st)); if (n.b >= Lt) return;
      const c0 = Math.floor(beatsAt(schedT)/Lt);
      for (const c of [c0, c0+1]){
        if (c === n.cyc) continue;
        const when = noteWhen(c, n.b, Lt);
        if (when < countEnd - .001) continue;
        if (when > schedT && when <= ahead){ voice(inst, n.i, n.v || .32, when, n.pan || 0, n.d ? n.d*beatLen() : undefined, n.ch || 'single', st.track); flashes.push({ when, st, pi: n.pi, n }); }
      }
    };
    for (const st of strokes) if (st.notes) for (const n of st.notes) each(n, instOf(st), st);
    if (S.metro){
      for (let k = Math.ceil(beatsAt(schedT)); ; k++){
        const t = clock0 + k*beatLen();
        if (t > ahead) break;
        if (t <= schedT || t < countEnd - .001) continue;
        const pos = ((k % L) + L) % L;
        click(t, pos === 0 ? 2 : pos % 4 === 0 ? 1 : 0);
      }
    }
  }
  schedT = ahead;
}

