/* ==========================================================================
   WAVEORA — visualizer.js
   Web Audio API AnalyserNode + Canvas. Modes: bars, wave, circle, particles.
   Instantiate per <canvas> with WV.visualizer.attach(canvas)
   ========================================================================== */
(function(){
  const WV = window.WV = window.WV || {};

  class Visualizer{
    constructor(canvas){
      this.canvas = canvas;
      this.ctx2d = canvas.getContext('2d');
      this.raf = null;
      this.particles = [];
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this._resize();
      this._onResize = ()=>this._resize();
      window.addEventListener('resize', this._onResize);
    }
    _resize(){
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, rect.width * this.dpr);
      this.canvas.height = Math.max(1, rect.height * this.dpr);
    }
    start(){
      if (this.raf) return;
      const loop = ()=>{
        this.raf = requestAnimationFrame(loop);
        this._draw();
      };
      loop();
    }
    stop(){
      if (this.raf){ cancelAnimationFrame(this.raf); this.raf = null; }
      const c = this.ctx2d;
      c.clearRect(0,0,this.canvas.width,this.canvas.height);
    }
    destroy(){
      this.stop();
      window.removeEventListener('resize', this._onResize);
    }
    _colors(){
      const cs = getComputedStyle(document.documentElement);
      return [cs.getPropertyValue('--dyn-a').trim() || '#6C5CE7', cs.getPropertyValue('--dyn-b').trim() || '#00B8D9'];
    }
    _draw(){
      const analyser = WV.engine.analyserNode;
      const w = this.canvas.width, h = this.canvas.height;
      const c = this.ctx2d;
      c.clearRect(0,0,w,h);

      if (!analyser || !WV.engine.isPlaying){
        this._drawIdle(c,w,h);
        return;
      }
      const reduced = document.documentElement.getAttribute('data-reduced-motion') === 'true';
      const style = document.body.getAttribute('data-viz-style') || 'bars';
      const [colA,colB] = this._colors();

      const bufferLength = analyser.frequencyBinCount;
      const data = new Uint8Array(bufferLength);

      if (style === 'wave'){
        analyser.getByteTimeDomainData(data);
        this._drawWave(c,w,h,data,colA,colB);
      } else if (style === 'circle'){
        analyser.getByteFrequencyData(data);
        this._drawCircle(c,w,h,data,colA,colB, reduced);
      } else if (style === 'particles'){
        analyser.getByteFrequencyData(data);
        this._drawParticles(c,w,h,data,colA,colB, reduced);
      } else {
        analyser.getByteFrequencyData(data);
        this._drawBars(c,w,h,data,colA,colB);
      }
    }
    _drawIdle(c,w,h){
      const [colA] = this._colors();
      c.globalAlpha = .25;
      c.fillStyle = colA;
      const bars = 32;
      for (let i=0;i<bars;i++){
        const bw = w/bars;
        const bh = h*0.08;
        c.fillRect(i*bw+bw*0.2, h-bh, bw*0.6, bh);
      }
      c.globalAlpha = 1;
    }
    _drawBars(c,w,h,data,colA,colB){
      const grad = c.createLinearGradient(0,h,0,0);
      grad.addColorStop(0,colA); grad.addColorStop(1,colB);
      c.fillStyle = grad;
      const bars = Math.min(64, data.length);
      const step = Math.floor(data.length/bars);
      const bw = w/bars;
      for (let i=0;i<bars;i++){
        const v = data[i*step]/255;
        const bh = Math.max(3, v*h);
        const x = i*bw;
        const r = Math.min(6, bw*0.3);
        c.beginPath();
        c.roundRect ? c.roundRect(x+bw*0.15, h-bh, bw*0.7, bh, r) : c.rect(x+bw*0.15, h-bh, bw*0.7, bh);
        c.fill();
      }
    }
    _drawWave(c,w,h,data,colA,colB){
      c.lineWidth = Math.max(2, w*0.003);
      const grad = c.createLinearGradient(0,0,w,0);
      grad.addColorStop(0,colA); grad.addColorStop(1,colB);
      c.strokeStyle = grad;
      c.beginPath();
      const slice = w / data.length;
      let x = 0;
      for (let i=0;i<data.length;i++){
        const v = data[i]/128.0;
        const y = (v*h)/2;
        if (i===0) c.moveTo(x,y); else c.lineTo(x,y);
        x += slice;
      }
      c.stroke();
    }
    _drawCircle(c,w,h,data,colA,colB,reduced){
      const cx=w/2, cy=h/2, radius=Math.min(w,h)*0.22;
      const bars = 90;
      const step = Math.floor(data.length/bars);
      const grad = c.createLinearGradient(0,0,w,h);
      grad.addColorStop(0,colA); grad.addColorStop(1,colB);
      c.strokeStyle = grad;
      c.lineWidth = Math.max(2,w*0.006);
      c.lineCap = 'round';
      const rot = reduced ? 0 : (Date.now()/8000)%(Math.PI*2);
      for (let i=0;i<bars;i++){
        const v = data[i*step]/255;
        const angle = (i/bars)*Math.PI*2 + rot;
        const len = radius*0.4 + v*radius*1.1;
        const x1 = cx+Math.cos(angle)*radius, y1 = cy+Math.sin(angle)*radius;
        const x2 = cx+Math.cos(angle)*(radius+len), y2 = cy+Math.sin(angle)*(radius+len);
        c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
      }
      c.beginPath(); c.arc(cx,cy,radius*0.5,0,Math.PI*2); c.fillStyle = colA+'33'; c.fill();
    }
    _drawParticles(c,w,h,data,colA,colB,reduced){
      const energy = data.reduce((a,b)=>a+b,0)/data.length/255;
      const maxParticles = reduced ? 24 : 60;
      if (this.particles.length < maxParticles && Math.random() < energy){
        this.particles.push({
          x: w/2, y:h/2,
          vx:(Math.random()-0.5)*4*(1+energy*3),
          vy:(Math.random()-0.5)*4*(1+energy*3),
          life:1, size: 2+Math.random()*4*(1+energy),
          color: Math.random()>0.5?colA:colB
        });
      }
      this.particles.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.life -= 0.012;
        c.globalAlpha = Math.max(0,p.life);
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x,p.y,p.size,0,Math.PI*2); c.fill();
      });
      c.globalAlpha = 1;
      this.particles = this.particles.filter(p=>p.life>0 && p.x>-20 && p.x<w+20 && p.y>-20 && p.y<h+20);
    }
  }

  WV.visualizer = {
    instances: new Set(),
    attach(canvas){
      const inst = new Visualizer(canvas);
      this.instances.add(inst);
      inst.start();
      return inst;
    },
    detach(inst){
      if (!inst) return;
      inst.destroy();
      this.instances.delete(inst);
    },
    setStyle(style){
      document.body.setAttribute('data-viz-style', style);
      WV.storage.saveSettings({visualizerStyle: style});
    }
  };
})();
