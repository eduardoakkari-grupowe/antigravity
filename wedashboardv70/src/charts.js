// ═══════════════════════════════════════════════════════════════
// TIMELINE CHART (daily — 84 bars)
// ═══════════════════════════════════════════════════════════════
let tlRaf=null;
function drawTimeline(days, progress=1) {
  const canvas=document.getElementById('c-timeline');
  const empty=document.getElementById('tl-empty');
  if (!canvas) return;

  if (!days || days.length===0) {
    canvas.style.display='none'; empty.classList.add('visible'); return;
  }
  canvas.style.display='block'; empty.classList.remove('visible');

  const dpr=window.devicePixelRatio||1;
  const W=canvas.parentElement.clientWidth, H=240;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);

  const pL=52, pR=54, pT=14, pB=44;
  const cW=W-pL-pR, cH=H-pT-pB;
  const bpp=FULL_BUD/FULL_IMP; // R$ per MM-impression unit (fallback)
  const dayBudget = d => (d.budget != null ? d.budget : (d._budget != null ? d._budget : d.i*bpp));
  const maxI=Math.max(...days.map(d=>d.i))*1.25;
  const maxBud=Math.max(...days.map(d=>dayBudget(d)))*1.3;
  const n=days.length;
  const slotW=cW/n;
  const bw=Math.max(1.5, Math.min(slotW*0.72, 10));

  // Grid lines
  for(let i=0;i<=4;i++){
    const y=pT+cH/4*i;
    ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+cW,y); ctx.stroke();
    ctx.fillStyle='rgba(74,85,104,.65)'; ctx.font=`400 9px 'DM Mono',monospace`;
    ctx.textAlign='right';
    ctx.fillText((maxI-maxI/4*i).toFixed(1)+'M', pL-6, y+3);
    ctx.fillStyle='rgba(34,212,200,.5)'; ctx.textAlign='left';
    ctx.fillText('R$'+((maxBud-maxBud/4*i)/1000).toFixed(0)+'k', pL+cW+6, y+3);
  }

  // Bars
  days.forEach((d,i)=>{
    const x=pL+i*slotW+(slotW-bw)/2;
    const bh=(d.i/maxI)*cH*progress, y=pT+cH-bh;
    const g=ctx.createLinearGradient(0,y,0,pT+cH);
    g.addColorStop(0,'rgba(110,95,217,.85)');
    g.addColorStop(1,'rgba(110,95,217,.05)');
    ctx.fillStyle=g;
    if(bw>2){
      ctx.beginPath(); ctx.roundRect(x,y,bw,bh,[1,1,0,0]); ctx.fill();
    } else {
      ctx.fillRect(x,y,bw,bh);
    }
  });

  // Month labels on X axis — show at first occurrence of each month
  const mn = MONTH_NAMES[currentLang]||MONTH_NAMES.pt;
  let lastM=-1;
  days.forEach((d,i)=>{
    const m=parseInt(d.d.slice(5,7));
    if(m!==lastM){
      lastM=m;
      const x=pL+i*slotW+slotW/2;
      // vertical month separator
      ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(pL+i*slotW, pT); ctx.lineTo(pL+i*slotW, pT+cH); ctx.stroke();
      ctx.setLineDash([]);
      // label
      ctx.fillStyle='rgba(136,150,176,.7)'; ctx.font=`500 9px 'DM Mono',monospace`;
      ctx.textAlign='center';
      ctx.fillText(mn[m-1], x, pT+cH+15);
    }
  });

  // Investment line (uses real d.budget when present)
  const pts=days.map((d,i)=>({x:pL+i*slotW+slotW/2, y:pT+cH-(dayBudget(d)/maxBud)*cH}));
  const vn=Math.max(2,Math.ceil(n*progress));
  const vp=pts.slice(0,vn);
  if(vp.length>=2){
    // area fill
    ctx.beginPath(); ctx.moveTo(vp[0].x,pT+cH);
    vp.forEach((p,i)=>{ if(i===0)ctx.lineTo(p.x,p.y); else { const pp=vp[i-1],cx=(pp.x+p.x)/2; ctx.bezierCurveTo(cx,pp.y,cx,p.y,p.x,p.y); }});
    ctx.lineTo(vp[vp.length-1].x,pT+cH); ctx.closePath();
    const ag=ctx.createLinearGradient(0,pT,0,pT+cH);
    ag.addColorStop(0,'rgba(34,212,200,.16)'); ag.addColorStop(1,'rgba(34,212,200,.01)');
    ctx.fillStyle=ag; ctx.fill();
    // line
    ctx.beginPath();
    vp.forEach((p,i)=>{ if(i===0)ctx.moveTo(p.x,p.y); else { const pp=vp[i-1],cx=(pp.x+p.x)/2; ctx.bezierCurveTo(cx,pp.y,cx,p.y,p.x,p.y); }});
    ctx.strokeStyle='#22D4C8'; ctx.lineWidth=1.5; ctx.stroke();
  }
}

function animateTimeline(days) {
  if(tlRaf) cancelAnimationFrame(tlRaf);
  const s=performance.now();
  function step(now){
    const t=Math.min((now-s)/1100,1);
    drawTimeline(days, ease(t));
    if(t<1) tlRaf=requestAnimationFrame(step);
  }
  tlRaf=requestAnimationFrame(step);
}

function setupTimelineTooltip() {
  const canvas=document.getElementById('c-timeline');
  const tip=document.getElementById('tip');
  if(!canvas) return;
  canvas.addEventListener('mousemove',e=>{
    if(!state.data||state.data.isEmpty){tip.style.display='none';return;}
    const days=state.data.days;
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left;
    const pL=52, cW=rect.width-pL-54, n=days.length;
    const idx=Math.floor((mx-pL)/(cW/n));
    if(idx<0||idx>=n){tip.style.display='none';return;}
    const d=days[idx];
    const parts=d.d.split('-');
    const dateLabel=parts[2]+' '+MN(parseInt(parts[1]));
    tip.style.display='block';
    tip.style.left=(e.clientX+14)+'px';
    tip.style.top=(e.clientY-52)+'px';
    document.getElementById('tip-w').textContent=dateLabel;
    const dayBud = d.budget != null ? d.budget : (d._budget != null ? d._budget : d.i*FULL_BUD/FULL_IMP);
    document.getElementById('tip-i').textContent=d.i.toFixed(2)+' '+T('mm_impr');
    document.getElementById('tip-a').textContent='R$ '+Math.round(dayBud/1000)+'k';
  });
  canvas.addEventListener('mouseleave',()=>{ tip.style.display='none'; });
}

// ═══════════════════════════════════════════════════════════════
// VCR RANKING CHART (Criativos tab)
// ═══════════════════════════════════════════════════════════════
let vcrRaf=null;
function drawVCRChart() {
  const canvas=document.getElementById('c-vcr');
  if(!canvas) return;
  if(vcrRaf) cancelAnimationFrame(vcrRaf);
  const videoC=CREATIVES.filter(c=>c.vcr!==null).sort((a,b)=>b.vcr-a.vcr);
  const dpr=window.devicePixelRatio||1;
  const W=canvas.parentElement.clientWidth;
  const bH=20, rowH=38, pL=150, pR=54, pT=10;
  const H=videoC.length*rowH+pT+10;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  const cW=W-pL-pR;
  const s=performance.now();
  function step(now){
    const t=Math.min((now-s)/1000,1), p=ease(t);
    ctx.clearRect(0,0,W,H);
    videoC.forEach((cr,i)=>{
      const y=pT+i*rowH;
      // Label
      ctx.fillStyle='rgba(136,150,176,.85)';
      ctx.font=`400 11px 'Plus Jakarta Sans',sans-serif`;
      ctx.textAlign='right'; ctx.textBaseline='middle';
      ctx.fillText(cr.name, pL-10, y+bH/2);
      // Track
      ctx.fillStyle='rgba(255,255,255,.04)';
      ctx.beginPath(); ctx.roundRect(pL,y,cW,bH,[3]); ctx.fill();
      // Bar
      const bw=(cr.vcr/100)*cW*p;
      const g=ctx.createLinearGradient(pL,0,pL+cW,0);
      g.addColorStop(0,cr.c+'CC'); g.addColorStop(1,cr.c+'55');
      ctx.fillStyle=g;
      if(bw>0){ ctx.beginPath(); ctx.roundRect(pL,y,bw,bH,[3]); ctx.fill(); }
      // Value label on right axis
      ctx.fillStyle='rgba(74,85,104,.65)'; ctx.font=`400 9px 'DM Mono',monospace`;
      ctx.textAlign='left';
      ctx.fillText(cr.vcr+'%', pL+cW+8, y+bH/2);
    });
    ctx.textBaseline='alphabetic';
    if(t<1) vcrRaf=requestAnimationFrame(step);
  }
  vcrRaf=requestAnimationFrame(step);
}
