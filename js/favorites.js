/* ==========================================================================
   WAVEORA — favorites.js
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  const Favorites = {
    ids(){ return WV.storage.getFavorites(); },
    isFav(id){ return this.ids().includes(id); },
    tracks(){
      const ids = this.ids();
      return ids.map(id => WV.library.byId(id)).filter(Boolean);
    },
    toggle(id){
      let ids = this.ids();
      const wasFav = ids.includes(id);
      ids = wasFav ? ids.filter(i=>i!==id) : [id, ...ids];
      WV.storage.saveFavorites(ids);
      WV.emit('favorites:changed', {ids, id, isFav: !wasFav});
      WV.toast(wasFav ? 'Removed from favorites' : 'Added to favorites', 'success');
      return !wasFav;
    },
    remove(id){
      const ids = this.ids().filter(i=>i!==id);
      WV.storage.saveFavorites(ids);
      WV.emit('favorites:changed', {ids});
    }
  };
  WV.favorites = Favorites;
})();
