/* ==========================================================================
   WAVEORA — player.js
   Mini player + Full player overlay UI, seek/volume/speed/EQ/sleep/lyrics,
   and the global keyboard shortcut map.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};
  let vizMini=null, vizFull=null, vizDash=null;

  function el(id){ return document.getElementById(id); }

  function renderTrackMeta(track){
    const title = track ? track.title : 'Nothing playing';
    const artist = track ? track.artist : 'Pick a track from your library';
    const cover = track ? WV.library.coverUrl(track) : '';

    ['mp-title','po-title'].forEach(id=>{ const e=el(id); if(e) e.textContent = title; });
    ['mp-artist','po-artist'].forEach(id=>{ const e=el(id); if(e) e.textContent = artist; });
    ['mp-cover-img','po-cover-img'].forEach(id=>{ const e=el(id); if(e && cover) e.src = cover; });

    document.title = track ? `${title} · ${artist} — WAVEORA` : 'WAVEORA — Your Sound. Your Space.';

    document.querySelectorAll('.favorite-btn[data-scope="player"]').forEach(btn=>{
      const isFav = track && WV.favorites.isFav(track.id);
      btn.classList.toggle('is-fav', !!isFav);
      btn.dataset.id = track ? track.id : '';
    });
  }

  function updatePlayToggles(){
    const playing = WV.engine.isPlaying;
    document.querySelectorAll('.play-toggle').forEach(btn=>{
      btn.innerHTML = playing
        ? `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>`;
      btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    });
    el('mini-player').classList.toggle('show', !!WV.engine.currentTrack);
  }

  function updateProgress({currentTime, duration}){
    duration = duration || WV.engine.duration;
    const pct = duration ? (currentTime/duration)*100 : 0;
    document.querySelectorAll('.seek-track').forEach(track=>{
      const fill = track.querySelector('.fill');
      const handle = track.querySelector('.handle');
      if (fill) fill.style.width = pct+'%';
      if (handle) handle.style.left = pct+'%';
    });
    const curStr = WV.formatTime(currentTime), durStr = WV.formatTime(duration);
    if (el('mp-current')) el('mp-current').textContent = curStr;
    if (el('mp-duration')) el('mp-duration').textContent = durStr;
    if (el('po-current')) el('po-current').textContent = curStr;
    if (el('po-duration')) el('po-duration').textContent = durStr;
  }

  function wireSeek(trackEl){
    let dragging = false;
    const seekFromEvent = (e)=>{
      const rect = trackEl.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = WV.clamp((clientX-rect.left)/rect.width, 0, 1)*100;
      WV.engine.seekPercent(pct);
      const fill = trackEl.querySelector('.fill'); if (fill) fill.style.width = pct+'%';
      const handle = trackEl.querySelector('.handle'); if (handle) handle.style.left = pct+'%';
    };
    trackEl.addEventListener('pointerdown', e=>{ dragging=true; seekFromEvent(e); });
    window.addEventListener('pointermove', e=>{ if (dragging) seekFromEvent(e); });
    window.addEventListener('pointerup', ()=>{ dragging=false; });
    trackEl.setAttribute('tabindex','0');
    trackEl.setAttribute('role','slider');
    trackEl.setAttribute('aria-label','Seek');
    trackEl.addEventListener('keydown', e=>{
      if (e.key==='ArrowRight'){ WV.engine.seek(WV.engine.currentTime+5); }
      else if (e.key==='ArrowLeft'){ WV.engine.seek(WV.engine.currentTime-5); }
    });
  }

  function wireVolume(rangeEl){
    rangeEl.addEventListener('input', ()=>WV.engine.setVolume(+rangeEl.value/100));
  }

  function refreshVolumeUI(){
    const s = WV.storage.getSettings();
    const val = s.muted ? 0 : Math.round(s.volume*100);
    document.querySelectorAll('.volume-range').forEach(r=>r.value = val);
    document.querySelectorAll('.mute-btn').forEach(btn=>{
      btn.innerHTML = val === 0
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>`;
    });
  }

  function setActiveBtn(selector, predicate){
    document.querySelectorAll(selector).forEach(btn=>btn.classList.toggle('active', predicate(btn)));
  }

  const Player = {
    init(){
      renderTrackMeta(null);
      updatePlayToggles();

      document.querySelectorAll('.seek-track').forEach(wireSeek);
      document.querySelectorAll('.volume-range').forEach(wireVolume);
      refreshVolumeUI();

      document.querySelectorAll('.play-toggle').forEach(btn=>btn.addEventListener('click', ()=>WV.engine.toggle()));
      document.querySelectorAll('.next-btn').forEach(btn=>btn.addEventListener('click', ()=>WV.engine.next(true)));
      document.querySelectorAll('.prev-btn').forEach(btn=>btn.addEventListener('click', ()=>WV.engine.prev()));
      document.querySelectorAll('.shuffle-btn').forEach(btn=>btn.addEventListener('click', ()=>WV.engine.toggleShuffle()));
      document.querySelectorAll('.repeat-btn').forEach(btn=>btn.addEventListener('click', ()=>WV.engine.cycleRepeat()));
      document.querySelectorAll('.mute-btn').forEach(btn=>btn.addEventListener('click', ()=>{ WV.engine.toggleMute(); refreshVolumeUI(); }));
      document.querySelectorAll('.favorite-btn[data-scope="player"]').forEach(btn=>btn.addEventListener('click', ()=>{
        const track = WV.engine.currentTrack;
        if (!track) return;
        WV.favorites.toggle(track.id);
        btn.classList.add('pop');
        setTimeout(()=>btn.classList.remove('pop'), 500);
      }));

      el('open-player-btn')?.addEventListener('click', ()=>this.openFull());
      el('close-player-btn')?.addEventListener('click', ()=>this.closeFull());
      document.querySelectorAll('.po-tab').forEach(tab=>tab.addEventListener('click', ()=>this.switchTab(tab.dataset.tab)));

      // visualizer mounts
      const miniCanvas = el('mp-visualizer');
      if (miniCanvas) vizMini = WV.visualizer.attach(miniCanvas);
      const fullCanvas = el('po-visualizer');
      if (fullCanvas) vizFull = WV.visualizer.attach(fullCanvas);
      const dashCanvas = el('np-visualizer');
      if (dashCanvas) vizDash = WV.visualizer.attach(dashCanvas);

      const s = WV.storage.getSettings();
      document.body.setAttribute('data-viz-style', s.visualizerStyle || 'bars');
      document.querySelectorAll('.viz-style-btn').forEach(btn=>{
        btn.classList.toggle('active', btn.dataset.style === s.visualizerStyle);
        btn.addEventListener('click', ()=>{
          WV.visualizer.setStyle(btn.dataset.style);
          document.querySelectorAll('.viz-style-btn').forEach(b=>b.classList.toggle('active', b===btn));
        });
      });

      // speed menu
      document.querySelectorAll('.speed-option').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          WV.engine.setSpeed(+btn.dataset.speed);
          document.querySelectorAll('.speed-option').forEach(b=>b.classList.toggle('active', b===btn));
        });
      });
      // sleep timer menu
      document.querySelectorAll('.sleep-option').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const val = btn.dataset.sleep;
          if (val === 'off') WV.engine.clearSleepTimer();
          else if (val === 'endOfSong') WV.engine.setSleepTimer('endOfSong');
          else WV.engine.setSleepTimer(+val);
          WV.toast(val==='off' ? 'Sleep timer cancelled' : 'Sleep timer set', 'success');
        });
      });

      // EQ
      const eqPresetsEl = document.getElementById('eq-presets');
      if (eqPresetsEl){
        eqPresetsEl.querySelectorAll('.chip').forEach(chip=>{
          chip.addEventListener('click', ()=>{
            WV.engine.setEqPreset(chip.dataset.preset);
            eqPresetsEl.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c===chip));
          });
        });
      }
      document.querySelectorAll('.eq-band input[type=range]').forEach(input=>{
        input.addEventListener('input', ()=>{
          WV.engine.setEqBand(+input.dataset.index, +input.value);
          if (eqPresetsEl) eqPresetsEl.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.preset==='custom'));
        });
      });
      WV.engine.applyEqFromSettings();

      // lyrics
      el('save-lyrics-btn')?.addEventListener('click', async ()=>{
        const track = WV.engine.currentTrack;
        if (!track) return;
        const text = el('lyrics-textarea').value;
        await WV.idb.saveLyrics(track.id, text);
        WV.toast('Lyrics saved', 'success');
        this.renderLyrics(track);
      });

      // event subscriptions — this is the real-time sync backbone (Section 36)
      WV.subscribe('engine:trackchange', ({track})=>{
        renderTrackMeta(track);
        this.renderLyrics(track);
        WV.emit('dashboard:refresh', {});
      });
      WV.subscribe('engine:play', updatePlayToggles);
      WV.subscribe('engine:pause', updatePlayToggles);
      WV.subscribe('engine:timeupdate', updateProgress);
      WV.subscribe('engine:volumechange', refreshVolumeUI);
      WV.subscribe('engine:shufflechange', ({shuffle})=>setActiveBtn('.shuffle-btn', ()=>shuffle));
      WV.subscribe('engine:repeatchange', ({repeat})=>{
        document.querySelectorAll('.repeat-btn').forEach(btn=>{
          btn.classList.toggle('active', repeat!=='off');
          btn.innerHTML = repeat==='one'
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="10" y="15" font-size="8" fill="currentColor" stroke="none">1</text></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`;
        });
      });
      WV.subscribe('favorites:changed', ()=>{
        const track = WV.engine.currentTrack;
        if (track) renderTrackMeta(track);
      });

      const shuf = WV.storage.getSettings();
      setActiveBtn('.shuffle-btn', ()=>shuf.shuffle);

      this._wireKeyboard();
    },

    openFull(tab){
      el('player-overlay').classList.add('open');
      document.body.style.overflow = 'hidden';
      if (tab) this.switchTab(tab);
    },
    closeFull(){
      el('player-overlay').classList.remove('open');
      document.body.style.overflow = '';
    },
    switchTab(tab){
      document.querySelectorAll('.po-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
      document.querySelectorAll('.po-panel').forEach(p=>p.classList.toggle('active', p.dataset.panel===tab));
      if (tab === 'queue') WV.queueUI.refresh();
    },

    async renderLyrics(track){
      const wrap = el('lyrics-display');
      const textarea = el('lyrics-textarea');
      if (!wrap || !track) return;
      const text = await WV.idb.getLyrics(track.id);
      if (text){
        wrap.innerHTML = `<div class="lyrics-text">${WV.escapeHtml(text)}</div>`;
      } else {
        wrap.innerHTML = `<div class="empty-state" style="padding:24px 8px;">
          <div class="emoji">🎤</div>
          <h3>Lyrics unavailable</h3>
          <p>You can add lyrics manually from the track editor below.</p>
        </div>`;
      }
      if (textarea) textarea.value = text || '';
    },

    _wireKeyboard(){
      document.addEventListener('keydown', (e)=>{
        const tag = (e.target.tagName||'').toLowerCase();
        if (tag==='input' || tag==='textarea' || e.target.isContentEditable) return;
        if ((e.metaKey||e.ctrlKey)) return; // let cmdk own ctrl/cmd combos
        switch(e.key){
          case ' ': e.preventDefault(); WV.engine.toggle(); break;
          case 'ArrowRight': WV.engine.seek(WV.engine.currentTime+5); break;
          case 'ArrowLeft': WV.engine.seek(WV.engine.currentTime-5); break;
          case 'ArrowUp': e.preventDefault(); WV.engine.setVolume((WV.storage.getSettings().volume||0)+0.05); break;
          case 'ArrowDown': e.preventDefault(); WV.engine.setVolume((WV.storage.getSettings().volume||0)-0.05); break;
          case 'm': case 'M': WV.engine.toggleMute(); break;
          case 'n': case 'N': WV.engine.next(true); break;
          case 'p': case 'P': WV.engine.prev(); break;
          case 's': case 'S': WV.engine.toggleShuffle(); break;
          case 'r': case 'R': WV.engine.cycleRepeat(); break;
        }
      });
    }
  };

  WV.player = Player;
})();
