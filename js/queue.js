/* ==========================================================================
   WAVEORA — queue.js
   Renders the "Up Next" panel (full player side panel + queue drawer) and
   handles reorder / remove / clear / save-as-playlist interactions.
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  let dragFrom = null;

  function trackRowHTML(track, index, isCurrent){
    return `
    <li class="queue-item ${isCurrent?'playing':''}" data-index="${index}" data-id="${track.id}" draggable="true">
      <span class="drag-handle" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>
      </span>
      <img src="${WV.library.coverUrl(track)}" alt="" width="42" height="42">
      <div class="qmeta">
        <div class="qtitle">${WV.escapeHtml(track.title)}</div>
        <div class="qartist">${WV.escapeHtml(track.artist)}</div>
      </div>
      <button class="btn-icon btn-sm remove-from-queue" aria-label="Remove from queue" data-id="${track.id}" data-index="${index}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </li>`;
  }

  function render(container){
    if (!container) return;
    const queue = WV.engine.queue;
    const curIdx = WV.engine.currentIndex;
    if (!queue.length){
      container.innerHTML = `<div class="empty-state" style="padding:32px 12px;">
        <div class="emoji">🎧</div><h3>Queue is empty</h3><p>Play a track to start building your queue.</p>
      </div>`;
      return;
    }
    container.innerHTML = `<ul class="queue-list" style="display:flex;flex-direction:column;gap:2px;">
      ${queue.map((t,i)=>trackRowHTML(t,i,i===curIdx)).join('')}
    </ul>`;

    container.querySelectorAll('.queue-item').forEach(li=>{
      li.addEventListener('dragstart', ()=>{ dragFrom = +li.dataset.index; li.style.opacity='.4'; });
      li.addEventListener('dragend', ()=>{ li.style.opacity='1'; });
      li.addEventListener('dragover', e=>e.preventDefault());
      li.addEventListener('drop', e=>{
        e.preventDefault();
        const to = +li.dataset.index;
        if (dragFrom !== null && dragFrom !== to){ WV.engine.reorderQueue(dragFrom, to); }
        dragFrom = null;
      });
      li.addEventListener('click', (e)=>{
        if (e.target.closest('.remove-from-queue')) return;
        const idx = +li.dataset.index;
        WV.engine.play(WV.engine.queue[idx], WV.engine.queue, idx);
      });
    });
    container.querySelectorAll('.remove-from-queue').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        WV.engine.removeFromQueue(+btn.dataset.index);
      });
    });
  }

  WV.queueUI = {
    containers: new Set(),
    mount(container){ this.containers.add(container); render(container); },
    refresh(){ this.containers.forEach(render); },
    clear(){ WV.engine.clearQueue(); },
    saveAsPlaylist(name){
      const q = WV.engine.queue;
      if (!q.length){ WV.toast('Queue is empty', 'error'); return null; }
      return WV.playlists.saveQueueAsPlaylist(name || ('Queue — ' + new Date().toLocaleDateString()), q.map(t=>t.id));
    }
  };

  WV.subscribe('queue:changed', ()=>WV.queueUI.refresh());
})();
