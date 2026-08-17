/* ==========================================================================
   WAVEORA — search.js
   Instant local search across songs / artists / albums / playlists / genres.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  const Search = {
    query(q){
      q = (q||'').trim().toLowerCase();
      if (!q) return {tracks:[], artists:[], albums:[], playlists:[]};

      const tracks = WV.library.search(q);

      const artistMap = new Map();
      WV.library.all().forEach(t=>{
        if (t.artist.toLowerCase().includes(q)) artistMap.set(t.artist, (artistMap.get(t.artist)||0)+1);
      });
      const artists = Array.from(artistMap.entries()).map(([name,count])=>({name,count}));

      const albumMap = new Map();
      WV.library.all().forEach(t=>{
        const album = t.album || 'Unknown Album';
        if (album.toLowerCase().includes(q)){
          const key = album+'::'+t.artist;
          if (!albumMap.has(key)) albumMap.set(key, {name:album, artist:t.artist, count:0});
          albumMap.get(key).count++;
        }
      });
      const albums = Array.from(albumMap.values());

      const playlists = WV.playlists.all().filter(p=>p.name.toLowerCase().includes(q));

      return {tracks, artists, albums, playlists};
    }
  };
  WV.search = Search;
})();
