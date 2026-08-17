/* ==========================================================================
   WAVEORA — notifications.js
   Toast system. No browser alert() ever used anywhere in the app.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  function ensureRegion(){
    let region = document.getElementById('toast-region');
    if (!region){
      region = document.createElement('div');
      region.id = 'toast-region';
      region.setAttribute('role','status');
      region.setAttribute('aria-live','polite');
      document.body.appendChild(region);
    }
    return region;
  }

  WV.toast = function(message, type){
    type = type || 'success';
    const region = ensureRegion();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="dot"></span><span>${WV.escapeHtml(message)}</span>`;
    region.appendChild(el);
    setTimeout(()=>{
      el.classList.add('leaving');
      setTimeout(()=>el.remove(), 320);
    }, 3200);
  };
})();
