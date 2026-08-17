/* ==========================================================================
   WAVEORA — indexeddb.js
   Stores large local media: audio blobs, cover art blobs, lyrics text.
   Object stores: tracks, lyrics
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};
  const DB_NAME = 'waveora-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject)=>{
      if (!('indexedDB' in window)){
        reject(new Error('IndexedDB not supported in this browser'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e)=>{
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tracks')){
          const store = db.createObjectStore('tracks', {keyPath:'id'});
          store.createIndex('artist','artist',{unique:false});
          store.createIndex('album','album',{unique:false});
          store.createIndex('dateAdded','dateAdded',{unique:false});
        }
        if (!db.objectStoreNames.contains('lyrics')){
          db.createObjectStore('lyrics', {keyPath:'trackId'});
        }
      };
      req.onsuccess = (e)=>resolve(e.target.result);
      req.onerror = (e)=>reject(e.target.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode){
    return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
  }

  WV.idb = {
    async addTrack(track){
      const store = await tx('tracks','readwrite');
      return new Promise((resolve,reject)=>{
        const r = store.add(track);
        r.onsuccess = ()=>resolve(track);
        r.onerror = ()=>reject(r.error);
      });
    },
    async putTrack(track){
      const store = await tx('tracks','readwrite');
      return new Promise((resolve,reject)=>{
        const r = store.put(track);
        r.onsuccess = ()=>resolve(track);
        r.onerror = ()=>reject(r.error);
      });
    },
    async getTrack(id){
      const store = await tx('tracks','readonly');
      return new Promise((resolve,reject)=>{
        const r = store.get(id);
        r.onsuccess = ()=>resolve(r.result || null);
        r.onerror = ()=>reject(r.error);
      });
    },
    async getAllTracks(){
      const store = await tx('tracks','readonly');
      return new Promise((resolve,reject)=>{
        const r = store.getAll();
        r.onsuccess = ()=>resolve(r.result || []);
        r.onerror = ()=>reject(r.error);
      });
    },
    async deleteTrack(id){
      const store = await tx('tracks','readwrite');
      return new Promise((resolve,reject)=>{
        const r = store.delete(id);
        r.onsuccess = ()=>resolve(true);
        r.onerror = ()=>reject(r.error);
      });
    },
    async saveLyrics(trackId, text){
      const store = await tx('lyrics','readwrite');
      return new Promise((resolve,reject)=>{
        const r = store.put({trackId, text, updatedAt: Date.now()});
        r.onsuccess = ()=>resolve(true);
        r.onerror = ()=>reject(r.error);
      });
    },
    async getLyrics(trackId){
      const store = await tx('lyrics','readonly');
      return new Promise((resolve,reject)=>{
        const r = store.get(trackId);
        r.onsuccess = ()=>resolve(r.result ? r.result.text : null);
        r.onerror = ()=>reject(r.error);
      });
    },
    async estimateUsage(){
      if (navigator.storage && navigator.storage.estimate){
        try{ return await navigator.storage.estimate(); }catch(e){ return {usage:0, quota:0}; }
      }
      return {usage:0, quota:0};
    },
    async clearAll(){
      const db = await openDB();
      await Promise.all(['tracks','lyrics'].map(name => new Promise((resolve,reject)=>{
        const r = db.transaction(name,'readwrite').objectStore(name).clear();
        r.onsuccess = ()=>resolve();
        r.onerror = ()=>reject(r.error);
      })));
    }
  };
})();
