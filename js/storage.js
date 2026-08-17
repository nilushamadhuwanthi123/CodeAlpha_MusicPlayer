/* ==========================================================================
   WAVEORA — storage.js
   LocalStorage wrapper: settings, favorites(ids), playlists(meta), history,
   queue metadata, statistics, sleep-timer, volume, theme.
   Large binary media NEVER touches this layer — see indexeddb.js
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};
  const NS = 'waveora:';

  function get(key, fallback){
    try{
      const raw = localStorage.getItem(NS+key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    }catch(e){
      console.warn('[WAVEORA storage] read failed for', key, e);
      return fallback;
    }
  }
  function set(key, value){
    try{
      localStorage.setItem(NS+key, JSON.stringify(value));
      return true;
    }catch(e){
      console.error('[WAVEORA storage] write failed for', key, e);
      WV.toast && WV.toast('Storage is full — could not save ' + key, 'error');
      return false;
    }
  }
  function remove(key){ localStorage.removeItem(NS+key); }

  const DEFAULT_SETTINGS = {
    theme: 'dark',              // light | dark | system
    eyeComfort: false,
    eyeComfortIntensity: 'medium',
    nightMode: 'manual',        // system | manual | scheduled
    nightScheduleStart: '19:00',
    nightScheduleEnd: '06:00',
    reducedMotion: false,
    visualizerStyle: 'bars',
    volume: 0.8,
    muted: false,
    playbackSpeed: 1,
    shuffle: false,
    repeat: 'off',              // off | all | one
    autoplay: true,
    crossfade: false,
    autoSaveMetadata: true,
    duplicateHandling: 'skip',  // skip | rename | ask
    eqPreset: 'flat',
    eqCustom: [0,0,0,0,0,0],
  };

  WV.storage = {
    get, set, remove,
    getSettings(){ return Object.assign({}, DEFAULT_SETTINGS, get('settings', {})); },
    saveSettings(patch){
      const s = Object.assign(this.getSettings(), patch);
      set('settings', s);
      WV.emit('settings:changed', s);
      return s;
    },
    getFavorites(){ return get('favorites', []); },
    saveFavorites(arr){ set('favorites', arr); },
    getPlaylists(){ return get('playlists', []); },
    savePlaylists(arr){ set('playlists', arr); },
    getHistory(){ return get('history', []); }, // [{trackId, playedAt}]
    saveHistory(arr){ set('history', arr.slice(0,500)); },
    getPlayCounts(){ return get('playCounts', {}); },
    savePlayCounts(obj){ set('playCounts', obj); },
    getListeningLog(){ return get('listeningLog', {}); }, // {dateStr: seconds}
    saveListeningLog(obj){ set('listeningLog', obj); },
    getQueueState(){ return get('queueState', {trackIds:[], currentIndex:-1}); },
    saveQueueState(qs){ set('queueState', qs); },
    getLastTrackId(){ return get('lastTrackId', null); },
    saveLastTrackId(id){ set('lastTrackId', id); },
    getLastPosition(){ return get('lastPosition', 0); },
    saveLastPosition(pos){ set('lastPosition', pos); },
    getSleepTimer(){ return get('sleepTimer', null); },
    saveSleepTimer(v){ set('sleepTimer', v); },
    getStreak(){ return get('streak', {count:0,lastDate:null}); },
    saveStreak(v){ set('streak', v); },
    exportAll(){
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: this.getSettings(),
        favorites: this.getFavorites(),
        playlists: this.getPlaylists(),
        history: this.getHistory(),
        playCounts: this.getPlayCounts(),
        listeningLog: this.getListeningLog(),
        streak: this.getStreak(),
      };
    },
    importAll(data){
      if (!data || data.version == null) throw new Error('Invalid backup file: missing version');
      if (data.settings) set('settings', data.settings);
      if (data.favorites) set('favorites', data.favorites);
      if (data.playlists) set('playlists', data.playlists);
      if (data.history) set('history', data.history);
      if (data.playCounts) set('playCounts', data.playCounts);
      if (data.listeningLog) set('listeningLog', data.listeningLog);
      if (data.streak) set('streak', data.streak);
      return true;
    },
    resetAll(){
      Object.keys(localStorage).filter(k=>k.startsWith(NS)).forEach(k=>localStorage.removeItem(k));
    }
  };
})();
