/* ==========================================================================
   WAVEORA — app.js
   Router + view rendering + modal orchestration + wiring everything together.
   This is intentionally a Single Page App: every "page" is a section inside
   index.html, switched instantly with zero reloads — because the audio
   engine lives in one place, playback never stops while navigating
   (Sections 37/38 require this). pages/*.html in the spec map 1:1 to the
   view sections below.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  let currentView = 'dashboard';
  let pendingPlaylistPickTrackId = null;
  let editingTrackId = null;

  // ---------------------------------------------------------------- router
  const Router = {
    go(view){
      if (!document.getElementById('view-'+view)) view = 'dashboard';
      $$('.view').forEach(v=>v.classList.remove('active'));
      const target = document.getElementById('view-'+view);
      target.classList.add('active');
      target.classList.remove('view-enter'); void target.offsetWidth; target.classList.add('view-enter');
      currentView = view;
      $$('.nav-link, .bn-link').forEach(l=>l.classList.toggle('active', l.dataset.view===view));
      document.getElementById('main-content').scrollTop = 0;
      window.scrollTo(0,0);
      if (history.pushState) history.pushState(null,'', '#'+view);
      renderView(view);
    }
  };
  WV.router = Router;

  // ---------------------------------------------------------------- helpers
  function trackCardHTML(track){
    return `<div class="card track-card" data-id="${track.id}" tabindex="0" role="button" aria-label="Play ${WV.escapeHtml(track.title)}">
      <div class="cover-wrap">
        <img src="${WV.library.coverUrl(track)}" alt="" loading="lazy">
        <button class="play-fab" aria-label="Play ${WV.escapeHtml(track.title)}"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg></button>
      </div>
      <div class="t-title">${WV.escapeHtml(track.title)}</div>
      <div class="t-artist">${WV.escapeHtml(track.artist)}</div>
    </div>`;
  }

  function mountTrackCards(container, tracks){
    if (!container) return;
    if (!tracks.length){ container.innerHTML = emptyStateHTML('🎵','Nothing here yet','Add some music to see it show up in this section.'); return; }
    container.innerHTML = tracks.map(trackCardHTML).join('');
    container.querySelectorAll('.track-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        const id = card.dataset.id;
        WV.engine.play(WV.library.byId(id), tracks, tracks.findIndex(t=>t.id===id));
      });
      card.addEventListener('keydown', e=>{ if (e.key==='Enter') card.click(); });
    });
  }

  function emptyStateHTML(emoji,title,body,ctaId,ctaLabel){
    return `<div class="empty-state">
      <div class="emoji">${emoji}</div><h3>${WV.escapeHtml(title)}</h3><p>${WV.escapeHtml(body)}</p>
      ${ctaId ? `<button class="btn btn-primary" id="${ctaId}">${WV.escapeHtml(ctaLabel)}</button>` : ''}
    </div>`;
  }

  function trackRowHTML(track, index, list){
    const isCurrent = WV.engine.currentTrack && WV.engine.currentTrack.id === track.id;
    const isFav = WV.favorites.isFav(track.id);
    return `<div class="track-row ${isCurrent?'playing':''}" data-id="${track.id}" tabindex="0" role="button">
      <span class="idx">${isCurrent && WV.engine.isPlaying ? '♪' : (index+1)}</span>
      <div class="tinfo"><img class="thumb" src="${WV.library.coverUrl(track)}" alt="">
        <div class="tmeta"><div class="ttitle">${WV.escapeHtml(track.title)}</div><div class="tartist">${WV.escapeHtml(track.artist)}</div></div>
      </div>
      <div class="talbum">${WV.escapeHtml(track.album||'—')}</div>
      <div class="tduration">${WV.formatTime(track.duration)}</div>
      <div class="tactions">
        <button class="favorite-btn ${isFav?'is-fav':''}" data-action="fav" aria-label="Favorite"><svg viewBox="0 0 24 24" fill="${isFav?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 5a5.5 5.5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z"/></svg></button>
        <button data-action="queue" aria-label="Add to queue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h7"/></svg></button>
        <button data-action="playlist" aria-label="Add to playlist"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
        <button data-action="edit" aria-label="Edit metadata"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button>
        <button data-action="delete" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>
      </div>
    </div>`;
  }

  function mountTrackList(container, tracks, opts){
    opts = opts || {};
    if (!container) return;
    if (!tracks.length){
      container.innerHTML = emptyStateHTML(opts.emptyEmoji||'🎵', opts.emptyTitle||'Nothing here yet', opts.emptyBody||'Add some music to get started.', opts.emptyCta&&'empty-cta-btn', opts.emptyCta);
      const cta = container.querySelector('#empty-cta-btn');
      if (cta) cta.addEventListener('click', ()=>Modals.openAddMusic());
      return;
    }
    container.innerHTML = `<div class="track-list">
      <div class="track-list-head"><span></span><span>Title</span><span>Album</span><span>Duration</span><span></span></div>
      ${tracks.map((t,i)=>trackRowHTML(t,i,tracks)).join('')}
    </div>`;
    container.querySelectorAll('.track-row').forEach((row,i)=>{
      const id = row.dataset.id;
      row.addEventListener('click', e=>{
        if (e.target.closest('.tactions')) return;
        WV.engine.play(WV.library.byId(id), tracks, i);
      });
      row.addEventListener('keydown', e=>{ if (e.key==='Enter' && !e.target.closest('.tactions')) row.click(); });
      row.querySelector('[data-action="fav"]').addEventListener('click', e=>{ e.stopPropagation(); WV.favorites.toggle(id); });
      row.querySelector('[data-action="queue"]').addEventListener('click', e=>{ e.stopPropagation(); WV.engine.addToQueue(WV.library.byId(id)); });
      row.querySelector('[data-action="playlist"]').addEventListener('click', e=>{ e.stopPropagation(); Modals.openAddToPlaylist(id); });
      row.querySelector('[data-action="edit"]').addEventListener('click', e=>{ e.stopPropagation(); Modals.openEditMetadata(id); });
      row.querySelector('[data-action="delete"]').addEventListener('click', async e=>{ e.stopPropagation(); await WV.library.deleteTrack(id); renderView(currentView); });
    });
  }

  // ---------------------------------------------------------------- dashboard
  function renderDashboard(){
    const hour = new Date().getHours();
    const greeting = hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
    const heading = document.getElementById('hero-greeting');
    if (heading) heading.textContent = `${greeting}, Nilusha 👋`;

    const track = WV.engine.currentTrack;
    document.getElementById('np-title').textContent = track ? track.title : 'Nothing playing yet';
    document.getElementById('np-artist').textContent = track ? track.artist : 'Add music or try a demo track to get started';
    const npCover = document.getElementById('np-cover');
    if (track){ npCover.src = WV.library.coverUrl(track); npCover.style.opacity=1; } else { npCover.style.opacity=0; }

    const all = WV.library.all();
    const tiles = [
      {icon:'🎵', value: all.length, label:'Total Tracks'},
      {icon:'⏱️', value: WV.formatDuration(WV.history.totalListeningSeconds()), label:'Listening Time'},
      {icon:'❤️', value: WV.favorites.ids().length, label:'Favorites'},
      {icon:'🔥', value: WV.history.streak().count+' days', label:'Listening Streak'},
    ];
    document.getElementById('dashboard-stat-tiles').innerHTML = tiles.map(t=>`
      <div class="card stat-tile"><div class="stat-icon">${t.icon}</div><div class="stat-value">${t.value}</div><div class="stat-label">${t.label}</div></div>
    `).join('');

    document.getElementById('dashboard-quick-actions').innerHTML = [
      {label:'Add Music', action:'add-music'},
      {label:'Create Playlist', action:'create-playlist'},
      {label:'Open Statistics', action:'go-stats'},
      {label:'Command Center', action:'open-cmdk'},
    ].map(a=>`<button class="card qa-btn" data-qa="${a.action}"><span class="qi">✦</span><span>${a.label}</span></button>`).join('');
    document.querySelectorAll('[data-qa]').forEach(btn=>btn.addEventListener('click', ()=>{
      const a = btn.dataset.qa;
      if (a==='add-music') Modals.openAddMusic();
      else if (a==='create-playlist') Modals.openCreatePlaylist();
      else if (a==='go-stats') Router.go('statistics');
      else if (a==='open-cmdk') WV.commandCenter.open();
    }));

    const week = WV.history.weekSeries();
    const maxSec = Math.max(1, ...week.map(d=>d.seconds));
    document.getElementById('dashboard-week-chart').innerHTML = week.map(d=>`
      <div class="col"><div class="bar" style="height:${Math.max(4,(d.seconds/maxSec)*100)}%"></div><div class="day">${d.label}</div></div>
    `).join('');

    mountTrackCards(document.getElementById('dashboard-recent-added'), all.slice(0,6));
    mountTrackCards(document.getElementById('dashboard-favorites'), WV.favorites.tracks().slice(0,6));
  }

  // ---------------------------------------------------------------- discover
  function renderDiscover(){
    const all = WV.library.all();
    mountTrackCards(document.getElementById('discover-recent-added'), all.slice(0,8));
    mountTrackCards(document.getElementById('discover-recent-played'), WV.history.recent(8).map(h=>h.track));
    mountTrackCards(document.getElementById('discover-favorites'), WV.favorites.tracks().slice(0,8));

    const popular = WV.history.topTracks(8).map(x=>x.track);
    mountTrackCards(document.getElementById('discover-popular'), popular);

    // simple local recommendation: other tracks by your top artist, not already heavily played
    const topArtists = WV.history.topArtists(3).map(a=>a.artist);
    const recommended = all.filter(t=>topArtists.includes(t.artist) && WV.history.playCount(t.id) < 2).slice(0,8);
    mountTrackCards(document.getElementById('discover-recommended'), recommended.length ? recommended : all.slice(0,4));
  }

  // ---------------------------------------------------------------- library
  let librarySort = 'recent';
  let libraryLayout = 'list';
  function renderLibrary(){
    let tracks = WV.library.all();
    if (librarySort==='title') tracks = tracks.slice().sort((a,b)=>a.title.localeCompare(b.title));
    else if (librarySort==='artist') tracks = tracks.slice().sort((a,b)=>a.artist.localeCompare(b.artist));

    const container = document.getElementById('library-content');
    if (!tracks.length){
      container.innerHTML = emptyStateHTML('🎵','Your library is empty','Add your first music track and start building your personal library.','empty-add-music-btn','Add Music');
      document.getElementById('empty-add-music-btn').addEventListener('click', ()=>Modals.openAddMusic());
      return;
    }
    if (libraryLayout==='grid'){
      container.innerHTML = `<div class="grid grid-auto stagger">${tracks.map(trackCardHTML).join('')}</div>`;
      mountTrackCards(container, tracks);
    } else {
      mountTrackList(container, tracks);
    }
  }

  // ---------------------------------------------------------------- playlists
  function playlistCoverHTML(pl){
    const tracks = WV.playlists.tracksOf(pl.id);
    if (tracks[0]) return `<img src="${WV.library.coverUrl(tracks[0])}" alt="">`;
    return `<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`;
  }

  function renderPlaylists(){
    const playlists = WV.playlists.all();
    const grid = document.getElementById('playlists-grid');
    grid.innerHTML = `<div class="create-playlist-tile" id="create-playlist-tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Create Playlist</div>` +
      playlists.map(pl=>`
      <div class="card" data-id="${pl.id}" style="padding:14px;cursor:pointer;">
        <div class="playlist-cover">${playlistCoverHTML(pl)}</div>
        <div class="t-title">${WV.escapeHtml(pl.name)} ${pl.favorite?'♥':''}</div>
        <div class="t-artist">${pl.trackIds.length} songs</div>
      </div>`).join('');
    document.getElementById('create-playlist-tile').addEventListener('click', ()=>Modals.openCreatePlaylist());
    grid.querySelectorAll('[data-id]').forEach(card=>{
      card.addEventListener('click', ()=>openPlaylistDetail(card.dataset.id));
    });
  }

  let currentPlaylistId = null;
  function openPlaylistDetail(id){
    currentPlaylistId = id;
    const pl = WV.playlists.byId(id);
    if (!pl) return Router.go('playlists');
    document.getElementById('pd-cover').innerHTML = playlistCoverHTML(pl);
    document.getElementById('pd-name').textContent = pl.name;
    const tracks = WV.playlists.tracksOf(id);
    document.getElementById('pd-sub').textContent = `${tracks.length} songs`;
    document.getElementById('pd-favorite-btn').textContent = pl.favorite ? '♥ Favorited' : '♡ Favorite';
    mountTrackList(document.getElementById('pd-tracklist'), tracks, {emptyBody:'Add songs to this playlist from your library.'});
    $$('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-playlist-detail').classList.add('active');
  }

  // ---------------------------------------------------------------- favorites / recently played
  function renderFavorites(){
    mountTrackList(document.getElementById('favorites-content'), WV.favorites.tracks(), {
      emptyEmoji:'❤️', emptyTitle:'No favorites yet', emptyBody:'Tap the heart icon on any track to save it here.'
    });
  }
  function renderRecentlyPlayed(){
    const items = WV.history.recent(60);
    const container = document.getElementById('recently-played-content');
    if (!items.length){
      container.innerHTML = emptyStateHTML('🕓','No listening history yet','Play a track and it will show up here with play count and timing.');
      return;
    }
    container.innerHTML = `<div class="track-list">
      <div class="track-list-head"><span></span><span>Title</span><span>Last Played</span><span>Plays</span><span></span></div>
      ${items.map((h,i)=>`
      <div class="track-row" data-id="${h.track.id}" tabindex="0" role="button">
        <span class="idx">${i+1}</span>
        <div class="tinfo"><img class="thumb" src="${WV.library.coverUrl(h.track)}" alt="">
          <div class="tmeta"><div class="ttitle">${WV.escapeHtml(h.track.title)}</div><div class="tartist">${WV.escapeHtml(h.track.artist)}</div></div>
        </div>
        <div class="talbum">${WV.relTime(h.playedAt)}</div>
        <div class="tduration">${WV.history.playCount(h.track.id)}×</div>
        <div class="tactions"><button data-action="fav" aria-label="Favorite"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 5a5.5 5.5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z"/></svg></button></div>
      </div>`).join('')}
    </div>`;
    container.querySelectorAll('.track-row').forEach(row=>{
      const id = row.dataset.id;
      row.addEventListener('click', e=>{ if (e.target.closest('.tactions')) return; WV.engine.play(WV.library.byId(id), items.map(h=>h.track), items.findIndex(h=>h.track.id===id)); });
      row.querySelector('[data-action="fav"]').addEventListener('click', e=>{ e.stopPropagation(); WV.favorites.toggle(id); });
    });
  }

  // ---------------------------------------------------------------- artists / albums
  function renderArtists(){
    const artists = WV.library.artists();
    const grid = document.getElementById('artists-grid');
    if (!artists.length){ grid.innerHTML = emptyStateHTML('🎤','No artists yet','Add tracks to your library to see artists here.'); return; }
    grid.innerHTML = artists.map(a=>`
      <div class="card artist-card" data-name="${WV.escapeHtml(a.name)}">
        <div class="av">${WV.initials(a.name)}</div>
        <div class="name">${WV.escapeHtml(a.name)}</div>
        <div class="count">${a.tracks.length} songs</div>
      </div>`).join('');
    grid.querySelectorAll('.artist-card').forEach(card=>card.addEventListener('click', ()=>openArtistDetail(card.dataset.name)));
  }
  function openArtistDetail(name){
    const artist = WV.library.artists().find(a=>a.name===name);
    if (!artist) return;
    document.getElementById('ad-cover').innerHTML = `<div class="ph" style="background:linear-gradient(135deg,var(--dyn-a),var(--dyn-b));display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:700;height:100%;">${WV.initials(name)}</div>`;
    document.getElementById('ad-name').textContent = name;
    document.getElementById('ad-sub').textContent = `${artist.tracks.length} songs`;
    mountTrackList(document.getElementById('ad-tracklist'), artist.tracks);
    document.getElementById('ad-play-btn').onclick = ()=>WV.engine.play(artist.tracks[0], artist.tracks, 0);
    $$('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-artist-detail').classList.add('active');
  }

  function renderAlbums(){
    const albums = WV.library.albums();
    const grid = document.getElementById('albums-grid');
    if (!albums.length){ grid.innerHTML = emptyStateHTML('💿','No albums yet','Add tracks to your library to see albums here.'); return; }
    grid.innerHTML = albums.map(al=>`
      <div class="card album-card" data-key="${WV.escapeHtml(al.name+'::'+al.artist)}">
        <div class="cover"><img src="${WV.library.coverUrl(al.tracks[0])}" alt=""></div>
        <div class="t-title">${WV.escapeHtml(al.name)}</div>
        <div class="t-artist">${WV.escapeHtml(al.artist)}</div>
      </div>`).join('');
    grid.querySelectorAll('.album-card').forEach(card=>card.addEventListener('click', ()=>openAlbumDetail(card.dataset.key)));
  }
  function openAlbumDetail(key){
    const album = WV.library.albums().find(a=>(a.name+'::'+a.artist)===key);
    if (!album) return;
    document.getElementById('ald-cover').innerHTML = `<img src="${WV.library.coverUrl(album.tracks[0])}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">`;
    document.getElementById('ald-name').textContent = album.name;
    const totalDur = album.tracks.reduce((a,t)=>a+(t.duration||0),0);
    document.getElementById('ald-sub').textContent = `${album.artist} · ${album.tracks.length} songs · ${WV.formatDuration(totalDur)}`;
    mountTrackList(document.getElementById('ald-tracklist'), album.tracks);
    document.getElementById('ald-play-btn').onclick = ()=>WV.engine.play(album.tracks[0], album.tracks, 0);
    document.getElementById('ald-shuffle-btn').onclick = ()=>{
      const shuffled = album.tracks.slice().sort(()=>Math.random()-0.5);
      WV.engine.play(shuffled[0], shuffled, 0);
    };
    $$('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-album-detail').classList.add('active');
  }

  // ---------------------------------------------------------------- statistics
  function renderStatistics(){
    const tiles = [
      {val: WV.formatDuration(WV.history.totalListeningSeconds()), lbl:'Total Listening Time'},
      {val: (WV.history.topTracks(1)[0]||{}).track ? WV.history.topTracks(1)[0].track.title : '—', lbl:'Most Played Song'},
      {val: (WV.history.topArtists(1)[0]||{}).artist || '—', lbl:'Top Artist'},
      {val: WV.history.mostActiveDay(), lbl:'Most Active Day'},
      {val: WV.history.favoriteGenre(), lbl:'Favorite Genre'},
      {val: WV.history.streak().count+' days', lbl:'Current Streak'},
      {val: WV.history.totalPlays(), lbl:'Total Tracks Played'},
    ];
    document.getElementById('stats-tiles').innerHTML = tiles.map(t=>`<div class="card stats-big"><div class="val">${WV.escapeHtml(String(t.val))}</div><div class="lbl">${t.lbl}</div></div>`).join('');

    WV.statistics.renderWeekChart(document.getElementById('stats-week-canvas'));
    WV.statistics.renderMonthChart(document.getElementById('stats-month-canvas'));

    const topTracks = WV.history.topTracks(8);
    const maxT = Math.max(1, ...topTracks.map(x=>x.count));
    document.getElementById('stats-top-tracks').innerHTML = topTracks.length ? topTracks.map((x,i)=>`
      <div class="top-list-row"><span class="rank">${i+1}</span><img src="${WV.library.coverUrl(x.track)}" alt="">
        <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${WV.escapeHtml(x.track.title)}</div>
        <div class="bar-bg"><span style="width:${(x.count/maxT)*100}%"></span></div></div>
        <span class="count">${x.count} plays</span></div>
    `).join('') : `<p style="color:var(--text-muted);font-size:.85rem;padding:10px;">No plays yet.</p>`;

    const topArtists = WV.history.topArtists(8);
    const maxA = Math.max(1, ...topArtists.map(x=>x.count));
    document.getElementById('stats-top-artists').innerHTML = topArtists.length ? topArtists.map((x,i)=>`
      <div class="top-list-row"><span class="rank">${i+1}</span><div class="av" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--dyn-a),var(--dyn-b));display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;">${WV.initials(x.artist)}</div>
        <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${WV.escapeHtml(x.artist)}</div>
        <div class="bar-bg"><span style="width:${(x.count/maxA)*100}%"></span></div></div>
        <span class="count">${x.count} plays</span></div>
    `).join('') : `<p style="color:var(--text-muted);font-size:.85rem;padding:10px;">No plays yet.</p>`;
  }

  // ---------------------------------------------------------------- settings
  function renderSettingsThemeOptions(){
    const s = WV.storage.getSettings();
    const opts = [
      {mode:'light', label:'Light', grad:'linear-gradient(135deg,#F7F7FC,#E3E3F0)'},
      {mode:'dark', label:'Dark', grad:'linear-gradient(135deg,#09091A,#18183A)'},
      {mode:'system', label:'System', grad:'linear-gradient(135deg,#6C5CE7,#00B8D9)'},
    ];
    document.getElementById('theme-options').innerHTML = opts.map(o=>`
      <div class="card theme-opt ${s.theme===o.mode?'active':''}" data-mode="${o.mode}">
        <div class="swatch" style="background:${o.grad}"></div><span>${o.label}</span>
      </div>`).join('');
    document.querySelectorAll('.theme-opt').forEach(el=>el.addEventListener('click', ()=>{
      WV.theme.setTheme(el.dataset.mode);
      renderSettingsThemeOptions();
    }));
  }

  function renderEqBands(){
    const s = WV.storage.getSettings();
    const bands = WV.engine.getEqBands();
    const custom = s.eqCustom || [0,0,0,0,0,0];
    document.getElementById('eq-bands').innerHTML = bands.map((f,i)=>`
      <div class="eq-band">
        <input type="range" min="-12" max="12" value="${custom[i]}" data-index="${i}" orient="vertical">
        <div class="freq">${f>=1000?(f/1000)+'k':f}Hz</div>
      </div>`).join('');
  }

  function syncSettingsPanel(){
    const s = WV.storage.getSettings();
    document.getElementById('eyecomfort-switch').checked = s.eyeComfort;
    document.querySelectorAll('[data-intensity]').forEach(b=>b.classList.toggle('active', b.dataset.intensity===s.eyeComfortIntensity));
    document.getElementById('nightmode-select').value = s.nightMode;
    document.getElementById('reducedmotion-switch').checked = s.reducedMotion;
    document.getElementById('settings-volume').value = Math.round(s.volume*100);
    document.getElementById('settings-speed').value = String(s.playbackSpeed);
    document.getElementById('settings-viz').value = s.visualizerStyle;
    document.getElementById('autoplay-switch').checked = s.autoplay;
    document.getElementById('crossfade-switch').checked = s.crossfade;
    document.getElementById('autosave-switch').checked = s.autoSaveMetadata;
    document.getElementById('duplicate-select').value = s.duplicateHandling;
    document.querySelectorAll('#eq-presets .chip').forEach(c=>c.classList.toggle('active', c.dataset.preset===s.eqPreset));
    renderSettingsThemeOptions();
    renderEqBands();
  }

  function wireSettingsOnce(){
    document.querySelectorAll('.settings-nav button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.settings-nav button').forEach(b=>b.classList.toggle('active', b===btn));
        document.querySelectorAll('.settings-section').forEach(s=>s.classList.toggle('active', s.id==='settings-'+btn.dataset.settings));
      });
    });
    document.getElementById('eyecomfort-switch').addEventListener('change', e=>WV.theme.setEyeComfort(e.target.checked));
    document.querySelectorAll('[data-intensity]').forEach(b=>b.addEventListener('click', ()=>{
      WV.theme.setEyeComfort(true, b.dataset.intensity);
      document.getElementById('eyecomfort-switch').checked = true;
      document.querySelectorAll('[data-intensity]').forEach(x=>x.classList.toggle('active', x===b));
    }));
    document.getElementById('nightmode-select').addEventListener('change', e=>WV.storage.saveSettings({nightMode:e.target.value}));
    document.getElementById('reducedmotion-switch').addEventListener('change', e=>WV.storage.saveSettings({reducedMotion:e.target.checked}));
    document.getElementById('settings-volume').addEventListener('input', e=>WV.engine.setVolume(+e.target.value/100));
    document.getElementById('settings-speed').addEventListener('change', e=>WV.engine.setSpeed(+e.target.value));
    document.getElementById('settings-viz').addEventListener('change', e=>WV.visualizer.setStyle(e.target.value));
    document.getElementById('autoplay-switch').addEventListener('change', e=>WV.storage.saveSettings({autoplay:e.target.checked}));
    document.getElementById('crossfade-switch').addEventListener('change', e=>WV.storage.saveSettings({crossfade:e.target.checked}));
    document.getElementById('autosave-switch').addEventListener('change', e=>WV.storage.saveSettings({autoSaveMetadata:e.target.checked}));
    document.getElementById('duplicate-select').addEventListener('change', e=>WV.storage.saveSettings({duplicateHandling:e.target.value}));

    document.getElementById('export-data-btn').addEventListener('click', ()=>{
      const data = WV.storage.exportAll();
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'waveora-backup-'+new Date().toISOString().slice(0,10)+'.json';
      a.click();
      URL.revokeObjectURL(a.href);
      WV.toast('Data exported', 'success');
    });
    document.getElementById('import-data-input').addEventListener('change', async e=>{
      const file = e.target.files[0];
      if (!file) return;
      try{
        const text = await file.text();
        const data = JSON.parse(text);
        WV.storage.importAll(data);
        WV.toast('Data imported successfully — reloading', 'success');
        setTimeout(()=>location.reload(), 900);
      }catch(err){
        WV.toast('Import failed: invalid backup file', 'error');
      }
      e.target.value = '';
    });
    document.getElementById('reset-data-btn').addEventListener('click', async ()=>{
      if (!confirmDialog('Reset all WAVEORA data? This clears your library, playlists and settings on this device.')) return;
      WV.storage.resetAll();
      await WV.idb.clearAll();
      WV.toast('All data reset — reloading', 'success');
      setTimeout(()=>location.reload(), 900);
    });
  }

  // minimal, non-blocking confirm affordance (no native confirm() per Section 62 spirit — but
  // destructive actions still need a guard; we use window.confirm only as last-resort safety net)
  function confirmDialog(msg){ return window.confirm(msg); }

  // ---------------------------------------------------------------- add music
  const AddMusic = {
    async handleFiles(fileList){
      const files = Array.from(fileList);
      const progressWrap = document.getElementById('upload-progress');
      progressWrap.innerHTML = '';
      let added = 0, skipped = 0, failed = 0;
      for (const file of files){
        const row = document.createElement('div');
        row.className = 'upload-row';
        row.innerHTML = `<span style="width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${WV.escapeHtml(file.name)}</span><div class="bar"><span></span></div><span class="status">…</span>`;
        progressWrap.appendChild(row);
        const bar = row.querySelector('.bar span');
        const status = row.querySelector('.status');
        try{
          bar.style.width = '40%';
          await WV.library.addFile(file);
          bar.style.width = '100%';
          status.textContent = '✓';
          added++;
        }catch(err){
          bar.style.width = '100%';
          bar.style.background = err.message === 'DUPLICATE' ? 'var(--warning)' : 'var(--danger)';
          status.textContent = err.message === 'DUPLICATE' ? 'skipped' : 'error';
          err.message === 'DUPLICATE' ? skipped++ : failed++;
        }
      }
      if (added) WV.toast(`Music added to library (${added} track${added>1?'s':''})`, 'success');
      if (skipped) WV.toast(`${skipped} duplicate file${skipped>1?'s':''} skipped`, 'info');
      if (failed) WV.toast(`${failed} file${failed>1?'s':''} could not be added`, 'error');
      renderView(currentView);
      renderDashboard();
      updateStorageMeter();
    }
  };

  // ---------------------------------------------------------------- modals
  const Modals = {
    open(id){ document.getElementById(id).classList.add('open'); },
    close(id){ document.getElementById(id).classList.remove('open'); },
    closeAll(){ $$('.modal-overlay').forEach(m=>m.classList.remove('open')); },

    openAddMusic(){ this.open('modal-add-music'); document.getElementById('upload-progress').innerHTML=''; },

    openEditMetadata(trackId){
      const track = WV.library.byId(trackId);
      if (!track) return;
      editingTrackId = trackId;
      document.getElementById('meta-title').value = track.title;
      document.getElementById('meta-artist').value = track.artist;
      document.getElementById('meta-album').value = track.album || '';
      document.getElementById('meta-genre').value = track.genre || '';
      document.getElementById('meta-cover').value = '';
      this.open('modal-edit-metadata');
    },

    openCreatePlaylist(){ document.getElementById('new-playlist-name').value=''; this.open('modal-create-playlist'); },

    openAddToPlaylist(trackId){
      pendingPlaylistPickTrackId = trackId;
      const playlists = WV.playlists.all();
      const list = document.getElementById('add-to-playlist-list');
      list.innerHTML = playlists.length ? playlists.map(pl=>`
        <button class="menu-popover-btn" data-id="${pl.id}" style="display:flex;justify-content:space-between;padding:11px 14px;border-radius:10px;background:var(--surface-secondary);font-weight:600;font-size:.85rem;">
          <span>${WV.escapeHtml(pl.name)}</span><span style="color:var(--text-muted);">${pl.trackIds.length} songs</span>
        </button>`).join('') : `<p style="color:var(--text-muted);font-size:.85rem;">No playlists yet — create one below.</p>`;
      list.querySelectorAll('button[data-id]').forEach(btn=>btn.addEventListener('click', ()=>{
        WV.playlists.addTrack(btn.dataset.id, pendingPlaylistPickTrackId);
        this.close('modal-add-to-playlist');
      }));
      this.open('modal-add-to-playlist');
    },

    openRenamePlaylist(id){
      const pl = WV.playlists.byId(id);
      if (!pl) return;
      document.getElementById('rename-playlist-input').value = pl.name;
      document.getElementById('rename-playlist-form').dataset.id = id;
      this.open('modal-rename-playlist');
    },

    openSaveQueue(){
      document.getElementById('save-queue-input').value = 'Queue — '+new Date().toLocaleDateString();
      this.open('modal-save-queue');
    }
  };
  WV.modals = Modals;

  function wireModalsOnce(){
    $$('.modal-close').forEach(btn=>btn.addEventListener('click', ()=>Modals.closeAll()));
    $$('.modal-overlay').forEach(ov=>ov.addEventListener('click', e=>{ if (e.target===ov) Modals.closeAll(); }));
    document.addEventListener('keydown', e=>{ if (e.key==='Escape') Modals.closeAll(); });

    // Add Music: dropzone + file picker + drag&drop
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    document.getElementById('choose-files-btn').addEventListener('click', ()=>fileInput.click());
    dropzone.addEventListener('click', e=>{ if (e.target.id!=='choose-files-btn') fileInput.click(); });
    fileInput.addEventListener('change', ()=>{ if (fileInput.files.length) AddMusic.handleFiles(fileInput.files); fileInput.value=''; });
    ['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.remove('drag'); }));
    dropzone.addEventListener('drop', e=>{
      const files = e.dataTransfer.files;
      if (files && files.length) AddMusic.handleFiles(files);
    });
    document.getElementById('sidebar-add-music').addEventListener('click', ()=>Modals.openAddMusic());

    // Edit metadata form
    document.getElementById('edit-meta-form').addEventListener('submit', async e=>{
      e.preventDefault();
      if (!editingTrackId) return;
      const patch = {
        title: document.getElementById('meta-title').value.trim() || 'Untitled',
        artist: document.getElementById('meta-artist').value.trim() || 'Unknown Artist',
        album: document.getElementById('meta-album').value.trim(),
        genre: document.getElementById('meta-genre').value.trim(),
      };
      const coverFile = document.getElementById('meta-cover').files[0];
      if (coverFile) patch.coverBlob = coverFile;
      try{
        const track = await WV.library.updateTrack(editingTrackId, patch);
        delete track._coverUrl;
        WV.toast('Track details updated', 'success');
        Modals.closeAll();
        renderView(currentView);
      }catch(err){ WV.toast('Could not save changes', 'error'); }
    });

    // Create playlist
    document.getElementById('create-playlist-form').addEventListener('submit', e=>{
      e.preventDefault();
      const name = document.getElementById('new-playlist-name').value.trim();
      WV.playlists.create(name);
      Modals.closeAll();
      if (currentView==='playlists') renderPlaylists();
    });
    document.getElementById('add-to-playlist-create-new').addEventListener('click', ()=>{
      Modals.closeAll();
      Modals.openCreatePlaylist();
    });

    // Rename playlist
    document.getElementById('rename-playlist-form').addEventListener('submit', e=>{
      e.preventDefault();
      const id = e.target.dataset.id;
      WV.playlists.rename(id, document.getElementById('rename-playlist-input').value.trim());
      Modals.closeAll();
      if (currentPlaylistId===id) openPlaylistDetail(id);
    });

    // Save queue as playlist
    document.getElementById('save-queue-form').addEventListener('submit', e=>{
      e.preventDefault();
      WV.queueUI.saveAsPlaylist(document.getElementById('save-queue-input').value.trim());
      Modals.closeAll();
    });
  }

  // ---------------------------------------------------------------- misc wiring
  function wireGlobalOnce(){
    $$('.nav-link, .bn-link[data-view]').forEach(link=>link.addEventListener('click', e=>{
      e.preventDefault();
      Router.go(link.dataset.view);
    }));
    document.getElementById('hero-open-player').addEventListener('click', ()=>WV.player.openFull());
    document.getElementById('hero-explore-library').addEventListener('click', ()=>Router.go('library'));
    document.getElementById('open-queue-btn').addEventListener('click', ()=>WV.player.openFull('queue'));
    document.getElementById('bn-player-open').addEventListener('click', ()=>WV.player.openFull());
    document.getElementById('playlist-back-btn').addEventListener('click', ()=>Router.go('playlists'));
    document.getElementById('artist-back-btn').addEventListener('click', ()=>Router.go('artists'));
    document.getElementById('album-back-btn').addEventListener('click', ()=>Router.go('albums'));

    document.getElementById('pd-play-btn').addEventListener('click', ()=>{
      const tracks = WV.playlists.tracksOf(currentPlaylistId);
      if (tracks.length) WV.engine.play(tracks[0], tracks, 0);
    });
    document.getElementById('pd-shuffle-btn').addEventListener('click', ()=>{
      const tracks = WV.playlists.tracksOf(currentPlaylistId).slice().sort(()=>Math.random()-0.5);
      if (tracks.length) WV.engine.play(tracks[0], tracks, 0);
    });
    document.getElementById('pd-favorite-btn').addEventListener('click', ()=>{
      WV.playlists.toggleFavorite(currentPlaylistId);
      openPlaylistDetail(currentPlaylistId);
    });
    document.getElementById('pd-rename-btn').addEventListener('click', ()=>Modals.openRenamePlaylist(currentPlaylistId));
    document.getElementById('pd-delete-btn').addEventListener('click', ()=>{
      if (!confirmDialog('Delete this playlist? This cannot be undone.')) return;
      WV.playlists.delete(currentPlaylistId);
      Router.go('playlists');
    });

    document.getElementById('ald-cover');

    // dark / eye comfort toggles in topbar
    document.getElementById('dark-toggle-btn').addEventListener('click', ()=>WV.theme.toggleDark());
    document.getElementById('eyecomfort-toggle-btn').addEventListener('click', ()=>{
      const s = WV.storage.getSettings();
      WV.theme.setEyeComfort(!s.eyeComfort);
    });

    // queue panel actions
    document.getElementById('queue-clear-btn').addEventListener('click', ()=>WV.queueUI.clear());
    document.getElementById('queue-save-playlist-btn').addEventListener('click', ()=>Modals.openSaveQueue());
    WV.queueUI.mount(document.getElementById('queue-panel-list'));

    // speed / sleep popovers
    wirePopover('speed-trigger','speed-menu');
    wirePopover('sleep-trigger','sleep-menu');

    // library filter bar
    document.querySelectorAll('#view-library .chip[data-sort]').forEach(chip=>chip.addEventListener('click', ()=>{
      librarySort = chip.dataset.sort;
      document.querySelectorAll('#view-library .chip[data-sort]').forEach(c=>c.classList.toggle('active', c===chip));
      renderLibrary();
    }));
    document.querySelectorAll('.view-toggle button').forEach(btn=>btn.addEventListener('click', ()=>{
      libraryLayout = btn.dataset.layout;
      document.querySelectorAll('.view-toggle button').forEach(b=>b.classList.toggle('active', b===btn));
      renderLibrary();
    }));

    // global search
    const searchInput = document.getElementById('global-search');
    const debouncedSearch = WV.debounce(()=>{
      const q = searchInput.value.trim();
      if (!q){ if (currentView==='search-results') Router.go('dashboard'); return; }
      renderSearchOverlay(q);
    }, 180);
    searchInput.addEventListener('input', debouncedSearch);

    // sleep timer badge
    WV.subscribe('sleep:changed', updateSleepBadge);
    setInterval(updateSleepBadge, 1000);

    // real-time sync: any track/library/queue change refreshes whatever is visible
    ['engine:trackchange','library:changed','favorites:changed','playlists:changed','history:changed','queue:changed']
      .forEach(evt => WV.subscribe(evt, ()=>{
        renderView(currentView, true);
        if (currentView !== 'dashboard') renderDashboard(); // keep dashboard fresh for quick switches
      }));

    window.addEventListener('online', updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);
    updateOfflineBanner();
  }

  function wirePopover(triggerId, menuId){
    const trigger = document.getElementById(triggerId);
    const menu = document.getElementById(menuId);
    trigger.addEventListener('click', e=>{
      e.stopPropagation();
      const open = menu.classList.contains('open');
      $$('.menu-popover').forEach(m=>m.classList.remove('open'));
      if (!open) menu.classList.add('open');
    });
    document.addEventListener('click', ()=>menu.classList.remove('open'));
  }

  function updateSleepBadge(){
    const st = WV.storage.getSleepTimer();
    const badge = document.getElementById('sleep-badge');
    if (!st){ badge.classList.remove('show'); return; }
    badge.classList.add('show');
    if (st.mode==='endOfSong'){ document.getElementById('sleep-badge-text').textContent = 'Stopping after this song'; return; }
    const remain = WV.engine.getSleepRemaining();
    if (remain==null){ badge.classList.remove('show'); return; }
    const m = Math.floor(remain/60000), s = Math.floor((remain%60000)/1000);
    document.getElementById('sleep-badge-text').textContent = `Sleeping in ${m}:${String(s).padStart(2,'0')}`;
  }

  function updateOfflineBanner(){
    document.getElementById('offline-banner').classList.toggle('show', !navigator.onLine);
  }

  let searchOverlayEl = null;
  function renderSearchOverlay(q){
    const results = WV.search.query(q);
    // Reuse the library view as an ad-hoc results surface without adding new nav state
    Router._searching = true;
    $$('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-library').classList.add('active');
    document.querySelectorAll('.nav-link,.bn-link').forEach(l=>l.classList.toggle('active', l.dataset.view==='library'));
    document.getElementById('library-content').innerHTML = `<h3 style="margin-bottom:12px;font-size:1rem;">Results for "${WV.escapeHtml(q)}"</h3>`;
    const container = document.createElement('div');
    document.getElementById('library-content').appendChild(container);
    mountTrackList(container, results.tracks, {emptyBody:'No tracks matched your search.'});
    currentView = 'library';
  }

  // ---------------------------------------------------------------- storage meter
  async function updateStorageMeter(){
    try{
      const {usage=0, quota=0} = await WV.idb.estimateUsage();
      const pct = quota ? Math.min(100, (usage/quota)*100) : 0;
      document.getElementById('storage-bar').style.width = pct.toFixed(1)+'%';
      document.getElementById('storage-meter').firstChild.textContent = `Local storage: ${(usage/1024/1024).toFixed(1)}MB used`;
    }catch(e){ /* non-fatal */ }
  }

  // ---------------------------------------------------------------- main render dispatch
  function renderView(view, silent){
    switch(view){
      case 'dashboard': renderDashboard(); break;
      case 'discover': renderDiscover(); break;
      case 'library': renderLibrary(); break;
      case 'playlists': renderPlaylists(); break;
      case 'playlist-detail': if (currentPlaylistId) openPlaylistDetail(currentPlaylistId); break;
      case 'favorites': renderFavorites(); break;
      case 'recently-played': renderRecentlyPlayed(); break;
      case 'artists': renderArtists(); break;
      case 'albums': renderAlbums(); break;
      case 'statistics': renderStatistics(); break;
      case 'settings': if (!silent) syncSettingsPanel(); break;
      default: renderDashboard();
    }
  }

  // ---------------------------------------------------------------- init
  async function init(){
    WV.theme.init();
    WV.notifications;
    WV.engine.init();

    await WV.library.init();

    WV.player.init();
    WV.commandCenter.init();
    wireModalsOnce();
    wireSettingsOnce();
    wireGlobalOnce();
    syncSettingsPanel();

    const hash = location.hash.replace('#','');
    Router.go(hash || 'dashboard');
    renderDashboard();
    updateStorageMeter();

    if ('serviceWorker' in navigator){
      window.addEventListener('load', ()=>{
        navigator.serviceWorker.register('sw.js').catch(()=>{ /* SW is optional progressive enhancement */ });
      });
    }

    WV.toast('Welcome to WAVEORA 🎧', 'success');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
