/* ==========================================================================
   WAVEORA — playlists.js
   Playlist metadata lives in LocalStorage: {id, name, trackIds[], favorite,
   createdAt, coverColorKey}. Actual audio stays in IndexedDB via library.js.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  const Playlists = {
    all(){ return WV.storage.getPlaylists(); },
    byId(id){ return this.all().find(p=>p.id===id); },

    create(name){
      name = (name||'').trim() || 'New Playlist';
      const playlists = this.all();
      const pl = {id: WV.uid('pl'), name, trackIds:[], favorite:false, createdAt:Date.now()};
      playlists.unshift(pl);
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
      WV.toast('Playlist created', 'success');
      return pl;
    },
    rename(id, name){
      const playlists = this.all();
      const pl = playlists.find(p=>p.id===id);
      if (!pl) return;
      pl.name = (name||'').trim() || pl.name;
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
      WV.toast('Playlist renamed', 'success');
    },
    delete(id){
      const playlists = this.all().filter(p=>p.id!==id);
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
      WV.toast('Playlist deleted', 'success');
    },
    addTrack(id, trackId){
      const playlists = this.all();
      const pl = playlists.find(p=>p.id===id);
      if (!pl) return;
      if (pl.trackIds.includes(trackId)){ WV.toast('Already in this playlist', 'info'); return; }
      pl.trackIds.push(trackId);
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
      WV.toast('Added to playlist', 'success');
    },
    removeTrack(id, trackId){
      const playlists = this.all();
      const pl = playlists.find(p=>p.id===id);
      if (!pl) return;
      pl.trackIds = pl.trackIds.filter(t=>t!==trackId);
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
      WV.toast('Removed from playlist', 'success');
    },
    removeTrackEverywhere(trackId){
      const playlists = this.all();
      playlists.forEach(p=>{ p.trackIds = p.trackIds.filter(t=>t!==trackId); });
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
    },
    reorder(id, from, to){
      const playlists = this.all();
      const pl = playlists.find(p=>p.id===id);
      if (!pl) return;
      const [item] = pl.trackIds.splice(from,1);
      pl.trackIds.splice(to,0,item);
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
    },
    toggleFavorite(id){
      const playlists = this.all();
      const pl = playlists.find(p=>p.id===id);
      if (!pl) return;
      pl.favorite = !pl.favorite;
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
    },
    tracksOf(id){
      const pl = this.byId(id);
      if (!pl) return [];
      return pl.trackIds.map(tid=>WV.library.byId(tid)).filter(Boolean);
    },
    saveQueueAsPlaylist(name, trackIds){
      const pl = this.create(name);
      pl.trackIds = trackIds.slice();
      const playlists = this.all().map(p=>p.id===pl.id?pl:p);
      WV.storage.savePlaylists(playlists);
      WV.emit('playlists:changed', {playlists});
      WV.toast('Saved queue as playlist', 'success');
      return pl;
    }
  };
  WV.playlists = Playlists;
})();
