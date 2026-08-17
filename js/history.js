/* ==========================================================================
   WAVEORA — history.js
   Recently played, play counts, listening-time log (throttled writes),
   and the daily listening streak used by Statistics + Dashboard.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  let lastProgressTime = 0;
  let pendingSeconds = 0;
  let lastFlush = 0;
  let currentPlayTrackId = null;

  function todayKey(d){
    d = d || new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function flushListening(){
    if (pendingSeconds <= 0) return;
    const log = WV.storage.getListeningLog();
    const key = todayKey();
    log[key] = (log[key]||0) + pendingSeconds;
    WV.storage.saveListeningLog(log);
    pendingSeconds = 0;
    WV.emit('history:changed', {});
  }

  function updateStreak(){
    const streak = WV.storage.getStreak();
    const today = todayKey();
    if (streak.lastDate === today) return;
    const yesterday = todayKey(new Date(Date.now()-86400000));
    const count = streak.lastDate === yesterday ? streak.count+1 : 1;
    WV.storage.saveStreak({count, lastDate: today});
  }

  const History = {
    registerPlay(track){
      if (!track) return;
      currentPlayTrackId = track.id;
      lastProgressTime = 0;

      const hist = WV.storage.getHistory();
      hist.unshift({trackId: track.id, playedAt: Date.now()});
      WV.storage.saveHistory(hist);

      const counts = WV.storage.getPlayCounts();
      counts[track.id] = (counts[track.id]||0) + 1;
      WV.storage.savePlayCounts(counts);

      updateStreak();
      WV.emit('history:changed', {});
    },
    trackProgress(currentTime){
      if (!currentPlayTrackId) return;
      const delta = currentTime - lastProgressTime;
      lastProgressTime = currentTime;
      if (delta > 0 && delta < 2){ // ignore seeks/jumps
        pendingSeconds += delta;
      }
      if (Date.now() - lastFlush > 5000){ // throttle writes (Section 67)
        flushListening();
        lastFlush = Date.now();
      }
    },
    finalizePlay(){
      flushListening();
      currentPlayTrackId = null;
    },
    recent(limit){
      const hist = WV.storage.getHistory();
      const seen = new Set();
      const out = [];
      for (const h of hist){
        if (seen.has(h.trackId)) continue;
        const track = WV.library.byId(h.trackId);
        if (track){ out.push({track, playedAt:h.playedAt}); seen.add(h.trackId); }
        if (limit && out.length>=limit) break;
      }
      return out;
    },
    playCount(trackId){ return WV.storage.getPlayCounts()[trackId] || 0; },
    totalListeningSeconds(){
      const log = WV.storage.getListeningLog();
      return Object.values(log).reduce((a,b)=>a+b,0);
    },
    weekSeries(){
      const log = WV.storage.getListeningLog();
      const days = [];
      for (let i=6;i>=0;i--){
        const d = new Date(Date.now()-i*86400000);
        days.push({label: d.toLocaleDateString(undefined,{weekday:'short'}), seconds: log[todayKey(d)]||0});
      }
      return days;
    },
    monthSeries(){
      const log = WV.storage.getListeningLog();
      const days = [];
      for (let i=29;i>=0;i--){
        const d = new Date(Date.now()-i*86400000);
        days.push({label: d.getDate(), seconds: log[todayKey(d)]||0});
      }
      return days;
    },
    topTracks(limit){
      const counts = WV.storage.getPlayCounts();
      return Object.entries(counts)
        .map(([id,count])=>({track:WV.library.byId(id), count}))
        .filter(x=>x.track)
        .sort((a,b)=>b.count-a.count)
        .slice(0, limit||10);
    },
    topArtists(limit){
      const counts = WV.storage.getPlayCounts();
      const byArtist = {};
      Object.entries(counts).forEach(([id,count])=>{
        const t = WV.library.byId(id);
        if (!t) return;
        byArtist[t.artist] = (byArtist[t.artist]||0)+count;
      });
      return Object.entries(byArtist).map(([artist,count])=>({artist,count})).sort((a,b)=>b.count-a.count).slice(0,limit||10);
    },
    favoriteGenre(){
      const counts = WV.storage.getPlayCounts();
      const byGenre = {};
      Object.entries(counts).forEach(([id,count])=>{
        const t = WV.library.byId(id);
        if (!t) return;
        const g = t.genre || 'Unknown';
        byGenre[g] = (byGenre[g]||0)+count;
      });
      const arr = Object.entries(byGenre).sort((a,b)=>b[1]-a[1]);
      return arr.length ? arr[0][0] : '—';
    },
    mostActiveDay(){
      const log = WV.storage.getListeningLog();
      const byDow = [0,0,0,0,0,0,0];
      Object.entries(log).forEach(([key,sec])=>{
        const d = new Date(key);
        byDow[d.getDay()] += sec;
      });
      const max = Math.max(...byDow);
      if (max === 0) return '—';
      const idx = byDow.indexOf(max);
      return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][idx];
    },
    streak(){ return WV.storage.getStreak(); },
    totalPlays(){
      const counts = WV.storage.getPlayCounts();
      return Object.values(counts).reduce((a,b)=>a+b,0);
    }
  };

  window.addEventListener('beforeunload', flushListening);
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) flushListening(); });

  WV.history = History;
})();
