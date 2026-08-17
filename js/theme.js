/* ==========================================================================
   WAVEORA — theme.js
   Light/Dark/System, Eye Comfort, Auto Night Mode, Reduced Motion,
   and per-track dynamic "music-reactive" accent colors.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};
  const root = document.documentElement;

  function resolveThemeMode(mode){
    if (mode === 'system'){
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  }

  function applyReducedMotion(on){
    root.setAttribute('data-reduced-motion', on ? 'true' : 'false');
  }

  function withinSchedule(startStr, endStr){
    const now = new Date();
    const [sh,sm] = startStr.split(':').map(Number);
    const [eh,em] = endStr.split(':').map(Number);
    const start = sh*60+sm, end = eh*60+em, cur = now.getHours()*60 + now.getMinutes();
    if (start === end) return false;
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end; // wraps past midnight
  }

  function applyAll(){
    const s = WV.storage.getSettings();
    let effectiveTheme = resolveThemeMode(s.theme);

    let eyeComfortOn = s.eyeComfort;
    if (s.nightMode === 'scheduled'){
      eyeComfortOn = withinSchedule(s.nightScheduleStart, s.nightScheduleEnd);
    } else if (s.nightMode === 'system'){
      eyeComfortOn = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    root.setAttribute('data-theme', effectiveTheme);
    if (eyeComfortOn){
      root.setAttribute('data-eyecomfort', s.eyeComfortIntensity);
    } else {
      root.removeAttribute('data-eyecomfort');
    }
    const reduceMotion = s.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    applyReducedMotion(reduceMotion);
  }

  WV.theme = {
    init(){
      applyAll();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAll);
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyAll);
      WV.subscribe('settings:changed', applyAll);
      // re-check scheduled night mode every minute
      setInterval(()=>{
        const s = WV.storage.getSettings();
        if (s.nightMode === 'scheduled') applyAll();
      }, 60000);
    },
    setTheme(mode){ WV.storage.saveSettings({theme:mode}); WV.toast('Theme changed', 'success'); },
    toggleDark(){
      const s = WV.storage.getSettings();
      const cur = resolveThemeMode(s.theme);
      this.setTheme(cur === 'dark' ? 'light' : 'dark');
    },
    setEyeComfort(on, intensity){
      const patch = {eyeComfort: on};
      if (intensity) patch.eyeComfortIntensity = intensity;
      WV.storage.saveSettings(patch);
      WV.toast(on ? 'Eye Comfort enabled' : 'Eye Comfort disabled', 'success');
    },
    // ---- Dynamic music-reactive palette ----
    applyTrackPalette(track){
      const key = track ? (track.album || track.title || track.id) : 'default';
      const [a,b] = WV.paletteFor(key);
      root.style.setProperty('--dyn-a', a);
      root.style.setProperty('--dyn-b', b);
      root.style.setProperty('--dyn-rgb-a', WV.hexToRgb(a));
      root.style.setProperty('--dyn-rgb-b', WV.hexToRgb(b));
    },
    resetPalette(){
      root.style.removeProperty('--dyn-a');
      root.style.removeProperty('--dyn-b');
      root.style.removeProperty('--dyn-rgb-a');
      root.style.removeProperty('--dyn-rgb-b');
    }
  };
})();
