/* ==========================================================================
   WAVEORA — statistics.js
   Canvas bar-chart renderer (no external chart lib needed).
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  function drawBarChart(canvas, series, opts){
    opts = opts || {};
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width*dpr;
    canvas.height = rect.height*dpr;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const w = canvas.width, h = canvas.height;
    const padBottom = 26*dpr, padTop = 12*dpr;
    const max = Math.max(1, ...series.map(s=>s.seconds));
    const cs = getComputedStyle(document.documentElement);
    const colA = cs.getPropertyValue('--dyn-a').trim() || '#6C5CE7';
    const colB = cs.getPropertyValue('--dyn-b').trim() || '#00B8D9';
    const textColor = cs.getPropertyValue('--text-muted').trim() || '#9696AA';
    const gap = w*0.01;
    const bw = (w - gap*(series.length+1))/series.length;

    const grad = ctx.createLinearGradient(0,h-padBottom,0,padTop);
    grad.addColorStop(0,colA); grad.addColorStop(1,colB);
    ctx.fillStyle = grad;

    series.forEach((s,i)=>{
      const bh = Math.max(3*dpr, ((s.seconds/max) * (h-padBottom-padTop)));
      const x = gap + i*(bw+gap);
      const y = h - padBottom - bh;
      const r = Math.min(6*dpr, bw*0.25);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x,y,bw,bh,[r,r,2,2]); else ctx.rect(x,y,bw,bh);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.font = `${11*dpr}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(s.label), x+bw/2, h-8*dpr);
      ctx.fillStyle = grad;
    });
  }

  WV.statistics = {
    renderWeekChart(canvas){ drawBarChart(canvas, WV.history.weekSeries()); },
    renderMonthChart(canvas){ drawBarChart(canvas, WV.history.monthSeries()); },
  };
})();
