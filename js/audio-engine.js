/* ==========================================================================
   WAVEORA — audio-engine.js
   Single source of truth for playback. Every page/component reads &
   controls state through this module + the WV.bus event system, so the
   Dashboard / Mini Player / Full Player / Visualizer never drift out of sync.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  const audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';

  let ctx = null, sourceNode = null, analyser = null, gainNode = null;
  let eqFilters = [];
  const EQ_BANDS = [60,170,350,1000,3500,10000];

  let queue = [];          // array of track objects (order = play order)
  let currentIndex = -1;
  let objectUrl = null;
  let sleepTimeout = null;
  let sleepEndAt = null;
  let restoring = false;

  function ensureGraph(){
    if (ctx) return;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      sourceNode = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      gainNode = ctx.createGain();

      eqFilters = EQ_BANDS.map(freq=>{
        const f = ctx.createBiquadFilter();
        f.type = 'peaking';
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = 0;
        return f;
      });

      let node = sourceNode;
      eqFilters.forEach(f => { node.connect(f); node = f; });
      node.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);
    }catch(err){
      console.error('[WAVEORA] Web Audio API unavailable, falling back to plain <audio>', err);
    }
  }

  function resumeCtx(){
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{});
  }

  function applyEqPreset(name){
    const PRESETS = {
      flat:      [0,0,0,0,0,0],
      bassBoost: [7,5,2,0,0,0],
      trebleBoost:[0,0,0,2,5,7],
      vocal:     [-2,-1,3,4,2,-1],
      classical: [3,2,0,0,-2,2],
      electronic:[5,3,0,1,3,5],
    };
    const s = WV.storage.getSettings();
    const gains = name === 'custom' ? (s.eqCustom || [0,0,0,0,0,0]) : (PRESETS[name] || PRESETS.flat);
    if (eqFilters.length){
      gains.forEach((g,i)=>{ if (eqFilters[i]) eqFilters[i].gain.value = g; });
    }
  }

  function setCustomEqBand(index, value){
    const s = WV.storage.getSettings();
    const custom = (s.eqCustom || [0,0,0,0,0,0]).slice();
    custom[index] = value;
    WV.storage.saveSettings({eqCustom: custom, eqPreset:'custom'});
    if (eqFilters[index]) eqFilters[index].gain.value = value;
  }

  function loadTrackIntoElement(track){
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (track.audioBlob){
      objectUrl = URL.createObjectURL(track.audioBlob);
      audio.src = objectUrl;
    } else if (track.audioUrl){
      audio.src = track.audioUrl;
    } else {
      WV.toast('This track has no playable audio source', 'error');
      return false;
    }
    return true;
  }

  function persistPlaybackState(){
    if (currentIndex < 0) return;
    WV.storage.saveLastTrackId(queue[currentIndex].id);
    WV.storage.saveQueueState({ trackIds: queue.map(t=>t.id), currentIndex });
  }

  const Engine = {
    get currentTrack(){ return currentIndex >= 0 ? queue[currentIndex] : null; },
    get queue(){ return queue.slice(); },
    get currentIndex(){ return currentIndex; },
    get isPlaying(){ return !audio.paused && !audio.ended; },
    get duration(){ return audio.duration || 0; },
    get currentTime(){ return audio.currentTime || 0; },
    get analyserNode(){ return analyser; },
    get audioCtx(){ return ctx; },

    init(){
      const s = WV.storage.getSettings();
      audio.volume = s.muted ? 0 : s.volume;
      audio.playbackRate = s.playbackSpeed || 1;

      audio.addEventListener('timeupdate', ()=>{
        WV.emit('engine:timeupdate', {currentTime: audio.currentTime, duration: audio.duration});
        WV.history && WV.history.trackProgress(audio.currentTime);
      });
      audio.addEventListener('loadedmetadata', ()=>{
        WV.emit('engine:loadedmetadata', {duration: audio.duration});
      });
      audio.addEventListener('play', ()=>{ WV.emit('engine:play', {track:this.currentTrack}); });
      audio.addEventListener('pause', ()=>{ WV.emit('engine:pause', {}); });
      audio.addEventListener('ended', ()=>{ this._handleEnded(); });
      audio.addEventListener('error', ()=>{
        if (audio.error){
          WV.toast('Playback error — the audio file may be corrupted or unsupported', 'error');
          WV.emit('engine:error', {error: audio.error});
        }
      });

      // restore last session (metadata only — never autoplay per Section 38)
      this._restoreSession();
    },

    async _restoreSession(){
      try{
        restoring = true;
        const qs = WV.storage.getQueueState();
        if (qs && qs.trackIds && qs.trackIds.length){
          const tracks = [];
          for (const id of qs.trackIds){
            const t = await WV.idb.getTrack(id);
            if (t) tracks.push(t);
          }
          if (tracks.length){
            queue = tracks;
            currentIndex = Math.min(qs.currentIndex, tracks.length-1);
            if (currentIndex >= 0){
              loadTrackIntoElement(queue[currentIndex]);
              const lastPos = WV.storage.getLastPosition();
              audio.addEventListener('loadedmetadata', function once(){
                audio.currentTime = Math.min(lastPos, audio.duration || lastPos);
                audio.removeEventListener('loadedmetadata', once);
              });
              WV.emit('engine:trackchange', {track: this.currentTrack, index: currentIndex});
            }
          }
        }
      }catch(e){ console.warn('[WAVEORA] session restore skipped', e); }
      restoring = false;
    },

    setQueue(tracks, startIndex){
      queue = tracks.slice();
      currentIndex = startIndex || 0;
      persistPlaybackState();
      WV.emit('queue:changed', {queue: this.queue, currentIndex});
    },

    addToQueue(track){
      queue.push(track);
      persistPlaybackState();
      WV.emit('queue:changed', {queue: this.queue, currentIndex});
      WV.toast(`Added "${track.title}" to queue`, 'success');
    },

    playNext(track){
      queue.splice(currentIndex+1, 0, track);
      persistPlaybackState();
      WV.emit('queue:changed', {queue: this.queue, currentIndex});
    },

    removeFromQueue(index){
      if (index === currentIndex) return;
      queue.splice(index,1);
      if (index < currentIndex) currentIndex--;
      persistPlaybackState();
      WV.emit('queue:changed', {queue: this.queue, currentIndex});
    },

    reorderQueue(from,to){
      const [item] = queue.splice(from,1);
      queue.splice(to,0,item);
      if (from === currentIndex) currentIndex = to;
      else{
        if (from < currentIndex && to >= currentIndex) currentIndex--;
        else if (from > currentIndex && to <= currentIndex) currentIndex++;
      }
      persistPlaybackState();
      WV.emit('queue:changed', {queue: this.queue, currentIndex});
    },

    clearQueue(){
      const cur = this.currentTrack;
      queue = cur ? [cur] : [];
      currentIndex = queue.length ? 0 : -1;
      persistPlaybackState();
      WV.emit('queue:changed', {queue: this.queue, currentIndex});
      WV.toast('Queue cleared', 'success');
    },

    async play(track, list, index){
      ensureGraph();
      resumeCtx();
      if (track){
        if (list){ queue = list.slice(); currentIndex = index; }
        else { queue = [track]; currentIndex = 0; }
        if (!loadTrackIntoElement(track)) return;
        persistPlaybackState();
        WV.emit('queue:changed', {queue: this.queue, currentIndex});
        WV.emit('engine:trackchange', {track, index: currentIndex});
        WV.theme.applyTrackPalette(track);
      }
      try{
        await audio.play();
        WV.history && WV.history.registerPlay(this.currentTrack);
      }catch(e){
        console.warn('[WAVEORA] play() blocked or failed', e);
      }
    },

    pause(){ audio.pause(); },
    toggle(){ this.isPlaying ? this.pause() : this.play(); },

    seek(sec){ if (audio.duration) audio.currentTime = WV.clamp(sec, 0, audio.duration); },
    seekPercent(pct){ if (audio.duration) audio.currentTime = (pct/100) * audio.duration; },

    setVolume(v){
      v = WV.clamp(v,0,1);
      audio.volume = v;
      WV.storage.saveSettings({volume:v, muted: v===0});
      WV.emit('engine:volumechange', {volume:v, muted: audio.muted});
    },
    toggleMute(){
      const s = WV.storage.getSettings();
      const muted = !s.muted;
      audio.volume = muted ? 0 : (s.volume || 0.8);
      WV.storage.saveSettings({muted});
      WV.emit('engine:volumechange', {volume: audio.volume, muted});
    },

    setSpeed(rate){
      audio.playbackRate = rate;
      WV.storage.saveSettings({playbackSpeed: rate});
      WV.emit('engine:speedchange', {rate});
    },

    toggleShuffle(){
      const s = WV.storage.getSettings();
      const shuffle = !s.shuffle;
      WV.storage.saveSettings({shuffle});
      WV.emit('engine:shufflechange', {shuffle});
      WV.toast(shuffle ? 'Shuffle on' : 'Shuffle off', 'success');
    },
    cycleRepeat(){
      const s = WV.storage.getSettings();
      const order = ['off','all','one'];
      const next = order[(order.indexOf(s.repeat)+1) % order.length];
      WV.storage.saveSettings({repeat: next});
      WV.emit('engine:repeatchange', {repeat: next});
      WV.toast('Repeat: ' + next, 'success');
      return next;
    },

    next(manual){
      if (!queue.length) return;
      const s = WV.storage.getSettings();
      let idx;
      if (s.shuffle){
        if (queue.length === 1) idx = 0;
        else { do { idx = Math.floor(Math.random()*queue.length); } while (idx === currentIndex); }
      } else {
        idx = currentIndex + 1;
        if (idx >= queue.length){
          if (s.repeat === 'all') idx = 0;
          else { if (manual) { this.pause(); } return; }
        }
      }
      currentIndex = idx;
      loadTrackIntoElement(queue[currentIndex]);
      persistPlaybackState();
      WV.emit('engine:trackchange', {track: this.currentTrack, index: currentIndex});
      WV.theme.applyTrackPalette(this.currentTrack);
      this.play();
    },

    prev(){
      if (!queue.length) return;
      if (audio.currentTime > 3){ audio.currentTime = 0; return; }
      let idx = currentIndex - 1;
      if (idx < 0) idx = 0;
      currentIndex = idx;
      loadTrackIntoElement(queue[currentIndex]);
      persistPlaybackState();
      WV.emit('engine:trackchange', {track: this.currentTrack, index: currentIndex});
      WV.theme.applyTrackPalette(this.currentTrack);
      this.play();
    },

    _handleEnded(){
      const s = WV.storage.getSettings();
      WV.history && WV.history.finalizePlay();
      if (s.repeat === 'one'){
        audio.currentTime = 0; audio.play().catch(()=>{});
        return;
      }
      this.next();
    },

    // ---- EQ ----
    setEqPreset(name){
      ensureGraph();
      WV.storage.saveSettings({eqPreset:name});
      applyEqPreset(name);
      WV.emit('engine:eqchange', {preset:name});
    },
    setEqBand(index,value){ ensureGraph(); setCustomEqBand(index,value); },
    getEqBands(){ return EQ_BANDS; },

    // ---- Sleep timer ----
    setSleepTimer(minutes){
      this.clearSleepTimer();
      if (minutes === 'endOfSong'){
        sleepEndAt = 'endOfSong';
        WV.storage.saveSleepTimer({mode:'endOfSong'});
        WV.emit('sleep:changed', {mode:'endOfSong'});
        return;
      }
      const ms = minutes*60000;
      sleepEndAt = Date.now()+ms;
      WV.storage.saveSleepTimer({mode:'timer', endAt: sleepEndAt});
      sleepTimeout = setTimeout(()=>{ this.pause(); this.clearSleepTimer(); WV.toast('Sleep timer ended playback', 'info'); }, ms);
      WV.emit('sleep:changed', {mode:'timer', endAt: sleepEndAt});
    },
    clearSleepTimer(){
      if (sleepTimeout) clearTimeout(sleepTimeout);
      sleepTimeout = null; sleepEndAt = null;
      WV.storage.saveSleepTimer(null);
      WV.emit('sleep:changed', null);
    },
    getSleepRemaining(){
      if (!sleepEndAt || sleepEndAt === 'endOfSong') return null;
      return Math.max(0, sleepEndAt - Date.now());
    },

    applyEqFromSettings(){
      ensureGraph();
      const s = WV.storage.getSettings();
      applyEqPreset(s.eqPreset || 'flat');
    }
  };

  // handle end-of-song sleep timer
  WV.subscribe('engine:pause', ()=>{});
  audio.addEventListener('ended', ()=>{
    const st = WV.storage.getSleepTimer();
    if (st && st.mode === 'endOfSong'){ Engine.clearSleepTimer(); }
  });

  WV.engine = Engine;
})();
