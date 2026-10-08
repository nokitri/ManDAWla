/* ================= Files: zip, WAV, MIDI, GIF ================= */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u){ let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipBlob(files){
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files){
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  }
  const cs = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
function wavBytes(buf){
  const ch = Math.min(2, buf.numberOfChannels), len = buf.length, sr = buf.sampleRate, dv = new DataView(new ArrayBuffer(44 + len*ch*2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + len*ch*2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr*ch*2, true); dv.setUint16(32, ch*2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, len*ch*2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++){ const v = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, v < 0 ? v*32768 : v*32767, true); o += 2; }
  return new Uint8Array(dv.buffer);
}
const slug = s => (s || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'track';
// ---- MIDI file ----
const GM_PROG = { piano:0, epiano:4, harpsichord:6, celesta:8, musicbox:10, vibes:11, marimba:12, bell:14, glass:14, bowl:14, gong:14, fmbell:14, organ:19, accordion:21, guitar:24, pluck:46, sitar:104, koto:107, kalimba:108, steeldrum:114, handpan:114,
  bass:33, upright:32, pluckbass:34, synthbass:38, subbass:38, b808:38, acid:38, reese:39, wobble:39, strings:48, cello:42, choir:52, brass:61, clarinet:71, flute:73, lead:80, chip:80, supersaw:81, pad:88, crystal:98, tabla:116, woodblock:115, sampler:0 };
const GM_DRUM = { kick:36, snare:38, clap:39, snap:39, rimshot:37, tom:47, conga:63, bongo:60, cowbell:56, hihat:42, openhat:46, shaker:70, tambourine:54, triangle:81, ride:51, crash:49 };
function midiFile(){
  const L = LB(), ppq = 480;
  const vlq = v => { const b = [v & 127]; while ((v >>= 7) > 0) b.unshift((v & 127) | 128); return b; };
  const u32 = v => [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255], u16 = v => [v >> 8 & 255, v & 255], txt = s => [...new TextEncoder().encode(s)];
  const tracks = [[[0, [0xFF, 0x51, 3, ...u32(Math.round(60e6/S.bpm)).slice(1)], 0], [0, [0xFF, 0x58, 4, 4, 2, 24, 8], 0]]];
  let chn = 0;
  S.tracks.forEach(t => {
    const drum = DRUM_INSTS.has(t.inst), ch = drum ? 9 : (chn === 9 ? ++chn : chn) % 16; if (!drum) chn++;
    const evs = [[0, [0xFF, 0x03, ...vlq(txt(trackName(t)).length), ...txt(trackName(t))], 0]];
    if (!drum) evs.push([0, [0xC0 | ch, GM_PROG[t.inst] ?? 0], 0]);
    const Lt = trackLoopLen(t), vol = Math.max(0, Math.min(127, Math.round(t.v/120*127)));
    evs.push([0, [0xB0 | ch, 7, vol], 0]);
    {
      for (const st of strokes){ if (st.track !== t.id) continue;
        for (const n of st.notes){ if (n.b >= Lt) continue;
          for (let r = 0; n.b + r*Lt < L; r++){
            const b = n.b + r*Lt, start = Math.round(b*ppq), end = start + Math.max(30, Math.round((n.d || 1/S.grid)*ppq*.98)), vel = Math.max(1, Math.min(127, Math.round((n.v || .32)/.62*110)));
            const keys = drum ? [GM_DRUM[t.inst] ?? 38] : chordIdx(n.i, n.ch || 'single').map(ci => midiOfIdx(ci, t));
            for (const k of keys){ const kk = Math.max(0, Math.min(127, k)); evs.push([start, [0x90 | ch, kk, vel], 1], [end, [0x80 | ch, kk, 0], 0]); }
          }
        }
      }
    }
    tracks.push(evs);
  });
  const out = [...txt('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(ppq)];
  for (const evs of tracks){
    evs.sort((a, b) => a[0] - b[0] || a[2] - b[2]); let last = 0; const body = [];
    for (const [tick, bytes] of evs){ body.push(...vlq(Math.max(0, tick - last)), ...bytes); last = tick; }
    body.push(0, 0xFF, 0x2F, 0); out.push(...txt('MTrk'), ...u32(body.length)); for (const x of body) out.push(x);
  }
  return new Uint8Array(out);
}
function exportMidi(){
  if (!strokes.some(st => st.notes.length)){ toast('Record some notes first'); return; }
  const mid = midiFile(), nm = fileStem();
  saveFile(nm + '-midi.zip', zipBlob([{ name: nm + '.mid', data: mid }]));
}
// ---- audio: one pass of the loop (or the song), the mix plus one file per track ----
let audioRec = null;
async function exportAudio(){
  if (audioRec){ finishAudio(); return; }
  if (!window.MediaRecorder){ toast("This browser can't record audio"); return; }
  if (!strokes.some(st => st.notes.length)){ toast('Record some notes first'); return; }
  ensureAudio();
  const mime = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].find(m => MediaRecorder.isTypeSupported(m));
  S.tracks.forEach(t => chan(t.id));
  const recs = [], mk = (node, name) => { const d = ac.createMediaStreamDestination(); node.connect(d); const r = new MediaRecorder(d.stream, mime ? { mimeType: mime } : undefined), chunks = []; r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; recs.push({ r, chunks, name, node, d }); };
  mk(analyser, 'mix');
  S.tracks.forEach((t, i) => mk(chans[t.id], 'stems/' + String(i + 1).padStart(2, '0') + '-' + slug(trackName(t))));
  if (S.loop) togglePlay(); const ci = S.countIn; S.countIn = false; tlCue = 0; togglePlay(); S.countIn = ci;
  recs.forEach(x => x.r.start());
  const secs = LB()*beatLen() + 1.5;
  setLbl($('exportAudio'), '■ Stop Audio'); $('exportAudio').classList.add('on');
  toast('Recording audio · ' + Math.round(secs) + ' s');
  audioRec = { recs, timer: setTimeout(finishAudio, secs*1000) };
}
async function finishAudio(){
  if (!audioRec) return; clearTimeout(audioRec.timer); const { recs } = audioRec; audioRec = null;
  setLbl($('exportAudio'), '♫ Audio + Stems'); $('exportAudio').classList.remove('on');
  await Promise.all(recs.map(x => new Promise(res => { x.r.onstop = res; try { x.r.stop(); } catch { res(); } })));
  recs.forEach(x => { try { x.node.disconnect(x.d); } catch {} });
  if (S.loop) togglePlay();
  toast('Making WAV files…');
  const files = [];
  for (const x of recs){ const blob = new Blob(x.chunks); if (!blob.size) continue; try { const buf = await ac.decodeAudioData(await blob.arrayBuffer()); files.push({ name: x.name + '.wav', data: wavBytes(buf) }); } catch {} }
  if (!files.length){ toast("Couldn't record audio here"); return; }
  saveFile(fileStem() + '-audio.zip', zipBlob(files));
}
// ---- GIF ----
function lzwEncode(ix, minSize){
  const clear = 1 << minSize, eoi = clear + 1, out = []; let next = eoi + 1, size = minSize + 1, cur = 0, shift = 0, table = new Map();
  const emit = c => { cur |= c << shift; shift += size; while (shift >= 8){ out.push(cur & 255); cur >>>= 8; shift -= 8; } };
  emit(clear); let code = ix[0];
  for (let i = 1; i < ix.length; i++){
    const k = ix[i], key = code << 8 | k, got = table.get(key);
    if (got !== undefined){ code = got; continue; }
    emit(code);
    if (next === 4096){ emit(clear); next = eoi + 1; size = minSize + 1; table = new Map(); }
    else { if (next >= (1 << size)) size++; table.set(key, next++); }
    code = k;
  }
  emit(code); emit(eoi); if (shift > 0) out.push(cur & 255);
  return out;
}
async function encodeGif(frames, w, h, delayCs){
  const out = [], b = v => out.push(v & 255), s16 = v => { b(v); b(v >> 8); }, str = t => { for (const c of t) b(c.charCodeAt(0)); };
  str('GIF89a'); s16(w); s16(h); b(0xF7); b(0); b(0);
  for (let i = 0; i < 256; i++){ b(Math.round(((i >> 5) & 7)*255/7)); b(Math.round(((i >> 2) & 7)*255/7)); b(Math.round((i & 3)*255/3)); }
  b(0x21); b(0xFF); b(11); str('NETSCAPE2.0'); b(3); b(1); s16(0); b(0);
  const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5], idx = new Uint8Array(w*h);
  for (const px of frames){
    for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++){
      const d = BAYER[(y & 3)*4 + (x & 3)]/16 - .47, q = p*4;
      const r = Math.max(0, Math.min(7, Math.round(px[q]*7/255 + d))), g = Math.max(0, Math.min(7, Math.round(px[q + 1]*7/255 + d))), bl = Math.max(0, Math.min(3, Math.round(px[q + 2]*3/255 + d)));
      idx[p] = r << 5 | g << 2 | bl;
    }
    b(0x21); b(0xF9); b(4); b(0); s16(delayCs); b(0); b(0);
    b(0x2C); s16(0); s16(0); s16(w); s16(h); b(0);
    const lz = lzwEncode(idx, 8); b(8);
    for (let i = 0; i < lz.length; i += 255){ const n = Math.min(255, lz.length - i); b(n); for (let k = 0; k < n; k++) out.push(lz[i + k]); }
    b(0);
    await new Promise(r => setTimeout(r, 0));   // keep the page responsive while it works
  }
  b(0x3B); return new Uint8Array(out);
}
let gifRec = null;
function gifFrame(g, size){
  const R = maxR()*1.07, cx = W/2, cy = CY(), sx = cx - R, sy = cy - R, s = R*2;
  g.fillStyle = bgHex(); g.fillRect(0, 0, size, size);
  g.drawImage(bgCv, sx*DPR, sy*DPR, s*DPR, s*DPR, 0, 0, size, size); g.drawImage(cv, sx*DPR, sy*DPR, s*DPR, s*DPR, 0, 0, size, size);
  for (let i = 1; i < TRAIL_LAYERS.length; i++) g.drawImage(TRAIL_LAYERS[i].cv, sx*DPR, sy*DPR, s*DPR, s*DPR, 0, 0, size, size);
  g.drawImage(fxCv, sx*FXDPR, sy*FXDPR, s*FXDPR, s*FXDPR, 0, 0, size, size);
}
function exportGif(){
  if (gifRec){ gifRec.stop = true; return; }
  if (!strokes.some(st => st.notes.length) && !strokes.length){ toast('Draw something first'); return; }
  ensureAudio();
  const loopS = LB()*beatLen(), fps = loopS > 9 ? 8 : 12, size = 320, max = Math.min(110, Math.ceil(loopS*fps));
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d', { willReadFrequently: true });
  if (S.loop) togglePlay(); const ci = S.countIn; S.countIn = false; tlCue = 0; togglePlay(); S.countIn = ci;
  const frames = []; gifRec = { stop: false };
  setLbl($('exportGif'), '■ Stop GIF'); $('exportGif').classList.add('on'); toast('Recording a looping GIF · ' + Math.round(Math.min(loopS, max/fps)) + ' s');
  const timer = setInterval(async () => {
    gifFrame(g, size); frames.push(g.getImageData(0, 0, size, size).data.slice());
    if (frames.length >= max || gifRec.stop){
      clearInterval(timer); gifRec = null; setLbl($('exportGif'), '◎ Looping GIF'); $('exportGif').classList.remove('on'); if (S.loop) togglePlay();
      toast('Making the GIF…'); await new Promise(r => setTimeout(r, 30));
      const bytes = await encodeGif(frames, size, size, Math.round(100/fps));
      saveFile(fileStem() + '.gif', new Blob([bytes], { type: 'image/gif' }));
    }
  }, 1000/fps);
}
// ---- the whole app as one file that works offline ----
function offlineCopy(){ saveFile('mandawla.html', new Blob([PAGE_SRC], { type: 'text/html' })); }

