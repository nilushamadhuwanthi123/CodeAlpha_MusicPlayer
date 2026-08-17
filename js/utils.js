/* ==========================================================================
   WAVEORA — utils.js
   Shared helper functions. Attaches to window.WV namespace.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  WV.uid = function(prefix){
    return (prefix||'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
  };

  WV.formatTime = function(sec){
    if (!isFinite(sec) || sec == null || sec < 0) return '0:00';
    sec = Math.floor(sec);
    const m = Math.floor(sec/60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2,'0');
  };

  WV.formatDuration = function(totalSec){
    totalSec = Math.floor(totalSec||0);
    const h = Math.floor(totalSec/3600);
    const m = Math.floor((totalSec%3600)/60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  WV.formatDate = function(ts){
    if(!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  };

  WV.relTime = function(ts){
    if(!ts) return '—';
    const diff = Date.now() - ts;
    const min = Math.floor(diff/60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + 'm ago';
    const hr = Math.floor(min/60);
    if (hr < 24) return hr + 'h ago';
    const day = Math.floor(hr/24);
    if (day < 7) return day + 'd ago';
    return WV.formatDate(ts);
  };

  WV.debounce = function(fn, wait){
    let t;
    return function(...args){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(this,args), wait);
    };
  };

  WV.escapeHtml = function(str){
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  };

  WV.clamp = function(v,min,max){ return Math.max(min, Math.min(max, v)); };

  WV.initials = function(name){
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  };

  // Deterministic hash -> pick a curated color pair per-track ("dominant color approximation")
  WV.PALETTES = [
    ['#A66CFF','#FF6BD6'], // purple/pink
    ['#FF8A5B','#FF4B4B'], // orange/red
    ['#3E8DFF','#19D3E6'], // blue/cyan
    ['#20BF6B','#19D3B0'], // green/turquoise
    ['#6C5CE7','#00B8D9'], // indigo/cyan (brand default)
    ['#FF6B6B','#FF9F43'], // coral/sunset
    ['#845EF7','#4DABF7'], // violet/sky
    ['#F783AC','#FFA94D'], // rose/amber
  ];
  WV.hashStr = function(str){
    str = String(str||'');
    let h = 0;
    for (let i=0;i<str.length;i++){ h = (h<<5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  };
  WV.paletteFor = function(key){
    const idx = WV.hashStr(key) % WV.PALETTES.length;
    return WV.PALETTES[idx];
  };
  WV.hexToRgb = function(hex){
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    const num = parseInt(hex,16);
    return `${(num>>16)&255},${(num>>8)&255},${num&255}`;
  };

  WV.readFileAsArrayBuffer = function(file){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = ()=>resolve(r.result);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });
  };

  WV.blobToDataURL = function(blob){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = ()=>resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  };

  // simple content hash for duplicate detection (name+size+lastModified)
  WV.fileSignature = function(file){
    return `${file.name}::${file.size}::${file.lastModified||0}`;
  };

  WV.on = function(el, ev, sel, handler){
    el.addEventListener(ev, function(e){
      const target = e.target.closest(sel);
      if (target && el.contains(target)) handler(e, target);
    });
  };

  // Tiny global event bus for cross-module state sync (Section 36: real-time dashboard sync)
  WV.bus = new EventTarget();
  WV.emit = function(name, detail){ WV.bus.dispatchEvent(new CustomEvent(name,{detail})); };
  WV.subscribe = function(name, fn){ WV.bus.addEventListener(name, e=>fn(e.detail)); };

})();
