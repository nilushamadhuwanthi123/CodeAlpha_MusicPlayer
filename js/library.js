/* ==========================================================================
   WAVEORA — library.js
   Music library CRUD (IndexedDB-backed) + Add Music pipeline + demo tracks.

   NOTE on metadata: WAVEORA reads what the browser can tell us for free
   (file name, duration via a temporary <audio> probe) and lets the user
   fill in the rest through an editable form — this keeps the app 100%
   dependency-free / offline instead of pulling in a 3rd-party ID3 parser.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  const ACCEPTED_TYPES = ['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/x-m4a','audio/aac','audio/webm'];
  const MAX_FILE_MB = 60;

  let cache = null; // in-memory mirror of all tracks, kept in sync

  async function loadAll(){
    cache = await WV.idb.getAllTracks();
    cache.sort((a,b)=>b.dateAdded-a.dateAdded);
    return cache;
  }

  function probeDuration(url){
    return new Promise(resolve=>{
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = ()=>resolve(isFinite(a.duration)?a.duration:0);
      a.onerror = ()=>resolve(0);
      a.src = url;
    });
  }

  function guessFromFilename(filename){
    const base = filename.replace(/\.[^/.]+$/,'');
    const parts = base.split(' - ');
    if (parts.length >= 2){
      return {artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim()};
    }
    return {artist:'Unknown Artist', title: base};
  }

  // ---------- Demo track synthesis (Web Audio) — no external audio files needed ----------
  async function synthTrack(name, chord, durationSec, tempo){
    const sr = 44100;
    const offline = new OfflineAudioContext(2, sr*durationSec, sr);
    const master = offline.createGain();
    master.gain.value = 0.22;
    master.connect(offline.destination);

    const beat = 60/tempo;
    let t = 0;
    while (t < durationSec){
      chord.forEach((freq,i)=>{
        const osc = offline.createOscillator();
        osc.type = i===0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const g = offline.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5/chord.length, t+0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t+beat*1.9);
        osc.connect(g); g.connect(master);
        osc.start(t); osc.stop(t+beat*2);
      });
      t += beat*2;
    }
    // gentle bass pulse
    let bt = 0;
    while (bt < durationSec){
      const osc = offline.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = chord[0]/2;
      const g = offline.createGain();
      g.gain.setValueAtTime(0.3, bt);
      g.gain.exponentialRampToValueAtTime(0.001, bt+beat*0.9);
      osc.connect(g); g.connect(master);
      osc.start(bt); osc.stop(bt+beat);
      bt += beat;
    }

    const buffer = await offline.startRendering();
    return bufferToWavBlob(buffer);
  }

  function bufferToWavBlob(buffer){
    const numCh = buffer.numberOfChannels;
    const len = buffer.length * numCh * 2 + 44;
    const arrBuf = new ArrayBuffer(len);
    const view = new DataView(arrBuf);
    const writeStr = (offset,str)=>{ for(let i=0;i<str.length;i++) view.setUint8(offset+i,str.charCodeAt(i)); };
    writeStr(0,'RIFF'); view.setUint32(4,len-8,true); writeStr(8,'WAVE');
    writeStr(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
    view.setUint16(22,numCh,true); view.setUint32(24,buffer.sampleRate,true);
    view.setUint32(28,buffer.sampleRate*numCh*2,true); view.setUint16(32,numCh*2,true); view.setUint16(34,16,true);
    writeStr(36,'data'); view.setUint32(40,len-44,true);
    let offset = 44;
    const channels = [];
    for (let ch=0; ch<numCh; ch++) channels.push(buffer.getChannelData(ch));
    for (let i=0;i<buffer.length;i++){
      for (let ch=0; ch<numCh; ch++){
        let sample = Math.max(-1,Math.min(1,channels[ch][i]));
        sample = sample < 0 ? sample*0x8000 : sample*0x7FFF;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    }
    return new Blob([arrBuf], {type:'audio/wav'});
  }

  function genCoverBlob(title, colorA, colorB){
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const c = canvas.getContext('2d');
    const grad = c.createLinearGradient(0,0,size,size);
    grad.addColorStop(0,colorA); grad.addColorStop(1,colorB);
    c.fillStyle = grad; c.fillRect(0,0,size,size);
    // soft glow circles
    for (let i=0;i<3;i++){
      c.beginPath();
      c.fillStyle = 'rgba(255,255,255,'+(0.10-i*0.02)+')';
      c.arc(size*(0.3+i*0.2), size*(0.25+i*0.15), size*(0.35-i*0.05), 0, Math.PI*2);
      c.fill();
    }
    // waveform doodle
    c.strokeStyle = 'rgba(255,255,255,.85)';
    c.lineWidth = 8; c.lineCap='round';
    c.beginPath();
    const bars = 22;
    for (let i=0;i<bars;i++){
      const x = size*0.18 + (size*0.64)*(i/(bars-1));
      const h = size*0.06 + Math.abs(Math.sin(i*1.3 + WV.hashStr(title))) * size*0.16;
      c.moveTo(x, size*0.66 - h/2);
      c.lineTo(x, size*0.66 + h/2);
    }
    c.stroke();
    return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }

  async function ensureDemoLibrary(){
    const all = await loadAll();
    if (all.length) return;
    const demos = [
      {title:'Neon Skyline', artist:'Waveora Collective', album:'Origins', genre:'Synthwave', chord:[220,277,330], tempo:96, dur:14},
      {title:'Coral Horizon', artist:'Aeris Lane', album:'Origins', genre:'Chillwave', chord:[262,330,392], tempo:84, dur:14},
      {title:'Cyan Drift', artist:'Waveora Collective', album:'Currents', genre:'Ambient', chord:[196,247,294], tempo:70, dur:14},
    ];
    for (const d of demos){
      const [ca,cb] = WV.paletteFor(d.album);
      const [audioBlob, coverBlob] = await Promise.all([
        synthTrack(d.title, d.chord, d.dur, d.tempo),
        genCoverBlob(d.title, ca, cb)
      ]);
      const track = {
        id: WV.uid('trk'),
        title: d.title, artist: d.artist, album: d.album, genre: d.genre,
        duration: d.dur, dateAdded: Date.now(), isDemo:true,
        audioBlob, coverBlob,
      };
      await WV.idb.addTrack(track);
    }
    await loadAll();
    WV.emit('library:changed', {});
  }

  const Library = {
    async init(){
      await loadAll();
      try{ await ensureDemoLibrary(); }catch(e){ console.warn('[WAVEORA] demo library generation skipped', e); }
    },
    all(){ return cache ? cache.slice() : []; },
    byId(id){ return (cache||[]).find(t=>t.id===id); },
    coverUrl(track){
      if (!track) return '';
      if (!track._coverUrl && track.coverBlob) track._coverUrl = URL.createObjectURL(track.coverBlob);
      return track._coverUrl || '';
    },

    validate(file){
      if (file.size > MAX_FILE_MB*1024*1024){
        return `"${file.name}" is larger than ${MAX_FILE_MB}MB`;
      }
      const okType = ACCEPTED_TYPES.includes(file.type) || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
      if (!okType){
        return `"${file.name}" is not a supported audio format`;
      }
      return null;
    },

    isDuplicate(file){
      const sig = WV.fileSignature(file);
      return (cache||[]).some(t=>t.sourceSignature === sig);
    },

    async addFile(file, metaOverride){
      const err = this.validate(file);
      if (err) throw new Error(err);
      const sig = WV.fileSignature(file);
      const settings = WV.storage.getSettings();
      if (this.isDuplicate(file)){
        if (settings.duplicateHandling === 'skip') throw new Error('DUPLICATE');
      }
      const url = URL.createObjectURL(file);
      const duration = await probeDuration(url);
      const guess = guessFromFilename(file.name);
      const meta = Object.assign({
        title: guess.title, artist: guess.artist, album:'Unknown Album', genre:'Unknown',
      }, metaOverride||{});
      const [ca,cb] = WV.paletteFor(meta.album || meta.title);
      const coverBlob = metaOverride && metaOverride.coverBlob ? metaOverride.coverBlob : await genCoverBlob(meta.title, ca, cb);
      const track = {
        id: WV.uid('trk'),
        title: meta.title, artist: meta.artist, album: meta.album, genre: meta.genre,
        duration, dateAdded: Date.now(),
        audioBlob: file, coverBlob, sourceSignature: sig,
      };
      URL.revokeObjectURL(url);
      await WV.idb.addTrack(track);
      cache.unshift(track);
      WV.emit('library:changed', {added: track});
      return track;
    },

    async updateTrack(id, patch){
      const track = await WV.idb.getTrack(id);
      if (!track) throw new Error('Track not found');
      Object.assign(track, patch);
      await WV.idb.putTrack(track);
      const idx = cache.findIndex(t=>t.id===id);
      if (idx>-1) cache[idx] = track;
      WV.emit('library:changed', {updated: track});
      WV.emit('track:updated', {track});
      return track;
    },

    async deleteTrack(id){
      await WV.idb.deleteTrack(id);
      cache = cache.filter(t=>t.id!==id);
      WV.favorites && WV.favorites.remove(id);
      WV.playlists && WV.playlists.removeTrackEverywhere(id);
      WV.emit('library:changed', {deletedId:id});
      WV.toast('Track removed', 'success');
    },

    search(query){
      query = (query||'').trim().toLowerCase();
      if (!query) return [];
      return (cache||[]).filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.artist.toLowerCase().includes(query) ||
        (t.album||'').toLowerCase().includes(query) ||
        (t.genre||'').toLowerCase().includes(query)
      );
    },

    artists(){
      const map = new Map();
      (cache||[]).forEach(t=>{
        if (!map.has(t.artist)) map.set(t.artist, []);
        map.get(t.artist).push(t);
      });
      return Array.from(map.entries()).map(([name,tracks])=>({name,tracks}));
    },
    albums(){
      const map = new Map();
      (cache||[]).forEach(t=>{
        const key = (t.album||'Unknown Album')+'::'+t.artist;
        if (!map.has(key)) map.set(key, {name:t.album||'Unknown Album', artist:t.artist, tracks:[]});
        map.get(key).tracks.push(t);
      });
      return Array.from(map.values());
    },
  };

  WV.library = Library;
})();
