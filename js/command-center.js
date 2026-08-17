/* ==========================================================================
   WAVEORA — command-center.js
   Ctrl/Cmd + K palette.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  function icon(path){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`; }

  function buildCommands(){
    return [
      {label:'Play / Pause', icon: icon('<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'), run: ()=>WV.engine.toggle()},
      {label:'Open Player', icon: icon('<circle cx="12" cy="12" r="9"/>'), run: ()=>WV.router.go('player')},
      {label:'Open Dashboard', icon: icon('<path d="M3 12l9-9 9 9M5 10v10h14V10"/>'), run: ()=>WV.router.go('dashboard')},
      {label:'Search Music', icon: icon('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'), run: ()=>{ document.getElementById('global-search').focus(); }},
      {label:'Open Library', icon: icon('<path d="M4 6h16M4 12h16M4 18h16"/>'), run: ()=>WV.router.go('library')},
      {label:'Open Favorites', icon: icon('<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 5a5.5 5.5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z"/>'), run: ()=>WV.router.go('favorites')},
      {label:'Create Playlist', icon: icon('<path d="M12 5v14M5 12h14"/>'), run: ()=>WV.modals.openCreatePlaylist()},
      {label:'Open Queue', icon: icon('<path d="M4 6h16M4 12h10M4 18h7"/>'), run: ()=>WV.player.openFull('queue')},
      {label:'Toggle Dark Mode', icon: icon('<path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/>'), run: ()=>WV.theme.toggleDark()},
      {label:'Toggle Eye Comfort', icon: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'), run: ()=>{ const s=WV.storage.getSettings(); WV.theme.setEyeComfort(!s.eyeComfort); }},
      {label:'Open Statistics', icon: icon('<path d="M4 20V10M12 20V4M20 20v-7"/>'), run: ()=>WV.router.go('statistics')},
      {label:'Add Music', icon: icon('<path d="M12 5v14M5 12h14"/>'), run: ()=>WV.modals.openAddMusic()},
      {label:'Settings', icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z"/>'), run: ()=>WV.router.go('settings')},
    ];
  }

  let overlay, input, list, activeIdx=0, filtered=[];

  function open(){
    filtered = buildCommands();
    activeIdx = 0;
    input.value = '';
    renderList();
    overlay.classList.add('open');
    setTimeout(()=>input.focus(), 30);
  }
  function close(){ overlay.classList.remove('open'); }

  function renderList(){
    list.innerHTML = filtered.map((c,i)=>`
      <div class="cmdk-item ${i===activeIdx?'active':''}" data-index="${i}">${c.icon}<span>${WV.escapeHtml(c.label)}</span></div>
    `).join('') || `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.85rem;">No matching commands</div>`;
  }

  WV.commandCenter = {
    init(){
      overlay = document.getElementById('cmdk-overlay');
      input = document.getElementById('cmdk-input');
      list = document.getElementById('cmdk-list');

      document.addEventListener('keydown', e=>{
        if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){
          e.preventDefault();
          overlay.classList.contains('open') ? close() : open();
        } else if (e.key === 'Escape' && overlay.classList.contains('open')){
          close();
        }
      });
      overlay.addEventListener('click', e=>{ if (e.target === overlay) close(); });
      document.getElementById('cmdk-trigger')?.addEventListener('click', open);

      input.addEventListener('input', ()=>{
        const q = input.value.toLowerCase();
        filtered = buildCommands().filter(c=>c.label.toLowerCase().includes(q));
        activeIdx = 0;
        renderList();
      });
      input.addEventListener('keydown', e=>{
        if (e.key === 'ArrowDown'){ e.preventDefault(); activeIdx = Math.min(filtered.length-1, activeIdx+1); renderList(); }
        else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIdx = Math.max(0, activeIdx-1); renderList(); }
        else if (e.key === 'Enter'){ e.preventDefault(); const c = filtered[activeIdx]; if (c){ close(); c.run(); } }
      });
      list.addEventListener('click', e=>{
        const item = e.target.closest('.cmdk-item');
        if (!item) return;
        const c = filtered[+item.dataset.index];
        if (c){ close(); c.run(); }
      });
    },
    open, close
  };
})();
