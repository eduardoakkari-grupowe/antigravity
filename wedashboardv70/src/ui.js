// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
const LOCALE_MAP = { pt:'pt-BR', en:'en-US', cn:'zh-CN' };
// Translates a channel nameKey, falling back to ch.name when the key
// has no entry (T() returns the raw key when missing).
function chLabel(ch) {
  const t = T(ch.nameKey);
  return (t === ch.nameKey) ? ch.name : t;
}
function fmt(v, dec) {
  const loc = LOCALE_MAP[currentLang] || 'pt-BR';
  if (dec===0) return Math.round(v).toLocaleString(loc);
  return v.toLocaleString(loc,{minimumFractionDigits:dec,maximumFractionDigits:dec});
}
function fmtCPM(v)    { return 'R$ '+v.toFixed(2).replace('.',','); }
function fmtCPV(v)    { return 'R$ '+v.toFixed(4).replace('.',','); }
function fmtBudget(v) { return v>=1000000 ? 'R$ '+(v/1000000).toFixed(1).replace('.',',')+'M' : 'R$ '+(v/1000).toFixed(0)+'k'; }
function fmtBR(v)     { return 'R$ '+(v/1000).toFixed(0)+'k'; }
function ease(t)   { return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
function lerp(a,b,t){ return a+(b-a)*t; }

function animateVal(el, from, to, dec, dur=1100) {
  const s=performance.now();
  function step(now){
    const t=Math.min((now-s)/dur,1), v=lerp(from,to,ease(t));
    el.textContent = dec==='cpm' ? fmtCPM(v) : dec==='cpv' ? fmtCPV(v) : dec==='budget' ? fmtBudget(v) : fmt(v,dec);
    if(t<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════════════════
// KPI GRID
// ═══════════════════════════════════════════════════════════════
const KPI_DEFS = [
  {id:'budget', lk:'kpi_budget', unit:'',    dec:'budget', accent:'#6E5FD9', low:false, targetKey:'budget'},
  {id:'imp',    lk:'kpi_imp',    unit:'MM',  dec:1,        accent:'#4A66E8', low:false, targetKey:'imp'},
  {id:'alc',    lk:'kpi_alc',    unit:'MM',  dec:1,        accent:'#22D4C8', low:false, targetKey:'alc'},
  {id:'freq',   lk:'kpi_freq',   unit:'×',   dec:1,        accent:'#9B8FD4', low:false, targetKey:'freq'},
  {id:'cpm',    lk:'kpi_cpm',    unit:'',    dec:'cpm',    accent:'#22D4C8', low:true,  targetKey:'cpm'},
  {id:'vviews', lk:'kpi_vviews', unit:'MM',  dec:1,        accent:'#9B8FD4', low:false, targetKey:'vviews'},
];

function buildKPIGrid() {
  const grid=document.getElementById('kpi-grid');
  grid.innerHTML='';
  KPI_DEFS.forEach(k=>{
    const el=document.createElement('div');
    el.className='kpi'; el.id='kpi-'+k.id;
    el.style.setProperty('--accent',k.accent);
    el.innerHTML=`
      <div class="kpi-lbl">${T(k.lk)}</div>
      <div class="kpi-val"><span class="cv" id="cv-${k.id}">0</span><span class="kpi-u">${k.unit}</span></div>
      <div class="kpi-delta" id="kd-${k.id}"></div>
      <div class="kpi-prog"><div class="kpi-prog-fill" id="kp-${k.id}" style="background:${k.accent}"></div></div>
      <div class="kpi-tgt" id="kt-${k.id}"></div>
    `;
    grid.appendChild(el);
  });
}

function updateKPIs(d) {
  if (d.isEmpty) {
    KPI_DEFS.forEach(k=>{
      document.getElementById('cv-'+k.id).textContent='—';
      document.getElementById('kd-'+k.id).innerHTML='';
      document.getElementById('kp-'+k.id).style.width='0%';
      document.getElementById('kt-'+k.id).textContent='';
    });
    return;
  }
  const vals={budget:d.kpis.budget, imp:d.kpis.imp, alc:d.kpis.alc, freq:d.kpis.freq, cpm:d.kpis.cpm, vviews:d.kpis.vviews, cpv:d.kpis.cpv};
  const targets=d.targets||BASE.targets;

  KPI_DEFS.forEach(k=>{
    const cv=document.getElementById('cv-'+k.id);
    const kd=document.getElementById('kd-'+k.id);
    const kp=document.getElementById('kp-'+k.id);
    const kt=document.getElementById('kt-'+k.id);
    const v=vals[k.id];
    const tgt=targets[k.id] * d.ratio;
    const pct = tgt>0 ? Math.min(Math.round(v/tgt*100),120) : 100;

    animateVal(cv, 0, v, k.dec);
    kd.innerHTML=''; kd.className='kpi-delta';
    setTimeout(()=>{ kp.style.width=Math.min(pct,100)+'%'; }, 200);
    const tgtFmt = k.dec==='cpm' ? fmtCPM(tgt) : k.dec==='cpv' ? fmtCPV(tgt) : k.dec==='budget' ? fmtBudget(tgt) : fmt(tgt,typeof k.dec==='number'?k.dec:1)+(k.unit||'');
    kt.textContent = `${pct}% ${T('of_goal')} — ${T('target_lbl')}: ${tgtFmt}`;
  });
}

// ═══════════════════════════════════════════════════════════════
// KPI ACHIEVEMENT BARS
// ═══════════════════════════════════════════════════════════════
function buildKpiAch(d) {
  const el = document.getElementById('kpi-ach');
  if (!el) return;

  if (d.isEmpty) { el.innerHTML = ''; return; }

  const kpis    = d.kpis;
  const targets = d.targets || BASE.targets;
  const ratio   = d.ratio || 1;

  const totalDays   = d.totalDays    || FULL_DAYS;
  const elapsedDays = d.daysInPeriod || Math.round(ratio * totalDays);
  const periodPct   = (d.daysRatio != null ? d.daysRatio : ratio) * 100;
  const metrics = [
    { lk:'kach_period', val:periodPct,   tgt:100,              c:'#46546A',
      fmt: _ => `${elapsedDays} / ${totalDays} dias` },
    { lk:'kpi_budget',  val:kpis.budget, tgt:targets.budget * ratio, c:'#6E5FD9',
      fmt: v => fmtBudget(v) },
    { lk:'kpi_imp',     val:kpis.imp,    tgt:targets.imp    * ratio, c:'#4A66E8',
      fmt: v => v.toFixed(1)+'MM' },
    { lk:'kpi_vviews',  val:kpis.vviews, tgt:targets.vviews * ratio, c:'#9B8FD4',
      fmt: v => v.toFixed(1)+'MM' },
  ];

  el.innerHTML = metrics
    .map(m => ({ m, rawPct: m.tgt > 0 ? (m.val / m.tgt * 100) : 0 }))
    .filter(({ rawPct }) => rawPct > 0)            // hide zero rows
    .map(({ m, rawPct }) => {
      const barW   = Math.min(rawPct, 100).toFixed(1);
      const pctLbl = rawPct.toFixed(0) + '%';
      const tgtLbl = m.fmt(m.tgt);
      // Place label inside the fill (white) for wide bars; outside (text color) for narrow bars
      const inside = +barW >= 25;
      return `<div class="kach-item">
        <div class="kach-hdr">
          <span class="kach-lbl">${T(m.lk)}</span>
          <span class="kach-meta">${T('kach_meta_lbl')}: ${tgtLbl}</span>
        </div>
        <div class="kach-track">
          <div class="kach-track-inner">
            <div class="kach-fill" style="background:${m.c}" data-w="${barW}"></div>
            <span class="kach-pct ${inside?'inside':'outside'}" data-w="${barW}">${pctLbl}</span>
          </div>
        </div>
      </div>`;
    }).join('');

  setTimeout(() => {
    el.querySelectorAll('.kach-fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
    el.querySelectorAll('.kach-pct').forEach(s => { s.style.left = s.dataset.w + '%'; });
  }, 80);
}

// ═══════════════════════════════════════════════════════════════
// CHANNEL TABLE
// ═══════════════════════════════════════════════════════════════
function buildChannelTable(channels) {
  const el=document.getElementById('ch-table-card');
  if(!el) return;
  const totalBudget=channels.reduce((s,c)=>s+c.budget, 0);
  const ratio = state.data?.ratio ?? 1;

  const fmtM = v => v>=1 ? v.toFixed(1)+'M' : v>0 ? (v*1000).toFixed(0)+'K' : '—';

  // Achievement badge: actual vs planned, colored by performance
  function achBadge(actual, planned, lowIsBetter=false) {
    if (!planned || planned===0) return '';
    const pct = actual / planned * 100;
    let cls;
    if (lowIsBetter) {
      cls = pct<=105 ? 'ach-good' : pct<=125 ? 'ach-warn' : 'ach-bad';
    } else {
      cls = pct>=95 ? 'ach-good' : pct>=75 ? 'ach-warn' : 'ach-bad';
    }
    return `<span class="cht-ach ${cls}">${pct.toFixed(0)}%</span>`;
  }

  // Stacked cell: actual (top, bold) + plan value + % badge (bottom, small)
  function stackCell(actualStr, planStr, badge, dimActual=false) {
    return `<div class="cht-cell-s">
      <div class="cht-v${dimActual?' sub':''}">${actualStr}</div>
      <div class="cht-p"><span class="cht-p-val">${planStr}</span>${badge}</div>
    </div>`;
  }

  const rows=channels.map(ch=>{
    const vv      = ch.vviews;
    const cpv     = vv>0 ? ch.budget/(vv*1000000) : null;
    const alcStr  = fmtM(ch.alc);
    const freqStr = ch.alc>0 ? (ch.imp/ch.alc).toFixed(1)+'×' : '—';

    // Planned — from BASE.plannedByCh (plan budget scaled by period ratio)
    const sourceKey = ch.nameKey.replace('ch_','');
    const planSrc = (BASE.plannedByCh && BASE.plannedByCh[sourceKey]) || null;
    const pBud = (planSrc ? planSrc.budget : ch.budget) * ratio;
    const pImp = (planSrc ? planSrc.imp    : ch.imp)    * ratio;
    const pVV  = (planSrc ? planSrc.vviews : ch.vviews) * ratio;
    const pCPM = planSrc ? planSrc.cpm : ch.cpm;
    const pCPV = pVV>0 ? pBud/(pVV*1000000) : null;

    const cpvCell = (cpv!=null && pCPV!=null)
      ? stackCell('R$ '+cpv.toFixed(3).replace('.',','), 'R$ '+pCPV.toFixed(3).replace('.',','), achBadge(cpv,pCPV,true))
      : `<div class="cht-cell dim">—</div>`;

    const vvCell = vv>0
      ? stackCell(fmtM(vv), fmtM(pVV), achBadge(vv,pVV))
      : `<div class="cht-cell dim">—</div>`;

    return `<div class="cht-row">
      <div class="cht-ch">${chLabel(ch)}</div>
      ${stackCell(fmtBudget(ch.budget), fmtBudget(pBud), achBadge(ch.budget,pBud))}
      ${stackCell(fmtM(ch.imp), fmtM(pImp), achBadge(ch.imp,pImp))}
      <div class="cht-cell">${alcStr}</div>
      <div class="cht-cell">${freqStr}</div>
      ${vvCell}
      ${stackCell('R$ '+ch.cpm.toFixed(2).replace('.',','), 'R$ '+pCPM.toFixed(2).replace('.',','), achBadge(ch.cpm,pCPM,true), true)}
      ${cpvCell}
    </div>`;
  }).join('');

  // Share of investment: list ALL plan groups (source · phase · kpi).
  // Each row's value = portion matching the active product filter (V70);
  // groups without a matching product display 0. Denominator = full plan
  // total across all groups, so percentages stay relative to the whole plan.
  const shareSource = (BASE.plannedShare || []).map(p => ({
    name:   p.name,
    c:      p.color,
    budget: p.budget,
  }));
  const shareTotal = (BASE.plannedShare || []).reduce((s,p) => s+(p.total||p.budget), 0);
  const shareRows = shareSource.map(ch => {
    const pct = shareTotal>0 ? (ch.budget/shareTotal*100) : 0;
    return `<div class="share-row">
      <div class="share-meta">
        <span class="share-name" style="color:${ch.c}">${ch.name}</span>
        <span class="share-pct">${pct.toFixed(1)}%</span>
      </div>
      <div class="share-track"><div class="share-fill" style="background:${ch.c}" data-w="${pct.toFixed(1)}"></div></div>
    </div>`;
  }).join('');

  el.innerHTML=`<div class="cht-wrap">
    <div class="cht-head">
      <div class="cht-hcell">${T('tbl_canal')}</div>
      <div class="cht-hcell">${T('tbl_invest')}</div>
      <div class="cht-hcell">${T('tbl_impressoes')}</div>
      <div class="cht-hcell">${T('tbl_alc')}</div>
      <div class="cht-hcell">${T('tbl_freq')}</div>
      <div class="cht-hcell">${T('tbl_vviews_col')}</div>
      <div class="cht-hcell">CPM</div>
      <div class="cht-hcell">${T('tbl_cpv')}</div>
    </div>
    ${rows}
    <div class="share-sect">
      <div class="share-title">${T('share_invest')}</div>
      ${shareRows}
    </div>
  </div>`;

  setTimeout(()=>{ el.querySelectorAll('.share-fill').forEach(f=>{ f.style.width=f.dataset.w+'%'; }); }, 200);
}

// ═══════════════════════════════════════════════════════════════
// SOURCE PAGE — KPI grid · Pacing · Weeks · Charts · Daily table
// ═══════════════════════════════════════════════════════════════
function srcPctColor(pct, tempo) {
  if (pct >= 100)            return '#22D4C8';
  if (pct - tempo >= -5)     return '#22D4C8';
  if (pct - tempo >= -12)    return '#9B8FD4';
  return '#E05470';
}

function srcKpiGrid(srcName, ch, plan) {
  const fmtMM = v => v != null ? v.toFixed(2).replace('.',',') + 'M' : '—';
  const fmtR  = v => v != null ? 'R$ '+(+v).toFixed(2).replace('.',',') : '—';
  const fields = [
    { lbl:'Investimento', val: fmtBudget(ch.budget),  plan: plan ? fmtBudget(plan.budget) : '—' },
    { lbl:'Impressões',   val: fmtMM(ch.imp),         plan: plan ? fmtMM(plan.imp)        : '—' },
    { lbl:'Alcance',      val: fmtMM(ch.alc),         plan: plan ? fmtMM(plan.alc)        : '—' },
    { lbl:'Video Views',  val: fmtMM(ch.vviews),      plan: plan ? fmtMM(plan.vviews)     : '—' },
    { lbl:'CPM',          val: fmtR(ch.cpm),          plan: plan ? fmtR(plan.cpm)         : '—' },
  ];
  return `
    <div class="sec-title">${srcName} · Resumo acumulado</div>
    <div class="src-kpi-grid">
      ${fields.map(f => `
        <div class="src-kpi-card">
          <div class="src-kpi-lbl">${f.lbl}</div>
          <div class="src-kpi-val">${f.val}</div>
          <div class="src-kpi-sub">Plano: ${f.plan}</div>
        </div>`).join('')}
    </div>`;
}

function srcHPacing(ch, plan, daysIn, totalDays) {
  const tempo  = totalDays > 0 ? (daysIn / totalDays) * 100 : 0;
  const investPct = plan && plan.budget > 0 ? (ch.budget / plan.budget) * 100 : 0;
  const impPct    = plan && plan.imp    > 0 ? (ch.imp    / plan.imp)    * 100 : 0;
  const alcPct    = plan && plan.alc    > 0 ? (ch.alc    / plan.alc)    * 100 : 0;
  const vvPct     = plan && plan.vviews > 0 ? (ch.vviews / plan.vviews) * 100 : 0;

  const fmtMM = v => v != null ? v.toFixed(2).replace('.',',')+'M' : '—';
  const rows = [
    { lbl:'Tempo',        pct:tempo,     real:`${daysIn} dias`, plan:`${totalDays} dias`, isTempo:true },
    { lbl:'Investimento', pct:investPct, real:fmtBudget(ch.budget), plan: plan ? fmtBudget(plan.budget) : '—' },
    { lbl:'Impressões',   pct:impPct,    real:fmtMM(ch.imp),    plan: plan ? fmtMM(plan.imp) : '—' },
    { lbl:'Alcance',      pct:alcPct,    real:fmtMM(ch.alc),    plan: plan ? fmtMM(plan.alc) : '—' },
    { lbl:'Video Views',  pct:vvPct,     real:fmtMM(ch.vviews), plan: plan ? fmtMM(plan.vviews) : '—' },
  ];

  return `
    <div class="sec-title">Pacing de entregas vs tempo</div>
    <div class="hpacing-card">
      <div class="hpacing-header">
        <div class="hpacing-title">Realizado vs Plano</div>
        <div class="hpacing-subtitle">Campanha (${totalDays} dias)</div>
      </div>
      ${rows.map(r => {
        const cap = Math.min(r.pct, 100).toFixed(1);
        const fill = r.isTempo ? '#46546A' : '#6E5FD9';
        const pctC = r.isTempo ? '#8896B0' : srcPctColor(r.pct, tempo);
        return `
          <div class="hpacing-row">
            <div class="hpacing-label ${r.isTempo?'is-tempo':''}">${r.lbl}</div>
            <div class="hpacing-track">
              <div class="hpacing-fill" style="background:${fill};width:${cap}%"></div>
              ${!r.isTempo ? `<div class="hpacing-marker" style="left:${Math.min(tempo,100)}%" data-label="${tempo.toFixed(1).replace('.',',')}%"></div>` : ''}
            </div>
            <div class="hpacing-pct" style="color:${pctC}">${r.pct.toFixed(1).replace('.',',')}%</div>
            <div class="hpacing-volumes"><strong>${r.real}</strong><span>plano: ${r.plan}</span></div>
          </div>`;
      }).join('')}
    </div>`;
}

function srcWeeks(srcKey) {
  const start = new Date(CAMP_START + 'T00:00:00Z');
  const end   = new Date(CAMP_END   + 'T00:00:00Z');
  const today = new Date(new Date().toISOString().slice(0,10) + 'T00:00:00Z');
  const allDays = BASE.daily || [];
  const fmtDayMonth = d => `${d.getUTCDate().toString().padStart(2,'0')}/${(d.getUTCMonth()+1).toString().padStart(2,'0')}`;

  const weeks = [];
  let idx = 1;
  for (let cur = new Date(start); cur <= end; ) {
    const wStart = new Date(cur);
    const wEnd   = new Date(cur); wEnd.setUTCDate(wEnd.getUTCDate() + 6);
    if (wEnd > end) wEnd.setTime(end.getTime());
    const startStr = wStart.toISOString().slice(0,10);
    const endStr   = wEnd.toISOString().slice(0,10);
    let invest=0, imp=0, reach=0;
    for (const d of allDays) {
      if (d.d < startStr || d.d > endStr) continue;
      const c = d.ch[srcKey]; if (!c) continue;
      invest += c.budget || 0;
      imp    += c.i || 0;
      reach  += c.reach || 0;
    }
    const isCurrent = today >= wStart && today <= wEnd;
    weeks.push({ tag:'W'+idx, range:`${fmtDayMonth(wStart)}–${fmtDayMonth(wEnd)}`, invest, imp, reach, isCurrent });
    cur = new Date(wEnd); cur.setUTCDate(cur.getUTCDate() + 1);
    idx++;
  }

  const fmtMM = v => v > 0 ? v.toFixed(2).replace('.',',')+'M' : '—';
  return `
    <div class="sec-title">Pacing por semana</div>
    <div class="weeks-grid">
      ${weeks.map(w => {
        const has = w.invest > 0 || w.imp > 0;
        return `
          <div class="week-card ${w.isCurrent?'is-current':''}" style="opacity:${has?1:0.4}">
            <div class="week-label">
              ${w.tag} <span style="font-weight:400;color:var(--muted)">${w.range}</span>
              <div class="week-dot ${w.isCurrent?'active':''}"></div>
            </div>
            <div class="week-metric"><span class="wm-key">Invest.</span><span class="wm-val">${has?fmtBudget(w.invest):'—'}</span></div>
            <div class="week-metric"><span class="wm-key">Impressões</span><span class="wm-val">${fmtMM(w.imp)}</span></div>
            <div class="week-metric"><span class="wm-key">Alcance</span><span class="wm-val">${fmtMM(w.reach)}</span></div>
          </div>`;
      }).join('')}
    </div>`;
}

function srcCharts(srcKey, srcColor) {
  const allDays = BASE.daily || [];
  // Build 30+ day series within campaign window (with nulls outside data)
  const start = new Date(CAMP_START + 'T00:00:00Z');
  const end   = new Date(CAMP_END   + 'T00:00:00Z');
  const series = [];
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate()+1)) {
    const ds = cur.toISOString().slice(0,10);
    const d = allDays.find(x => x.d === ds);
    const c = d && d.ch[srcKey];
    series.push({
      d: ds,
      day: cur.getUTCDate(),
      invest: c ? c.budget : 0,
      imp:    c ? c.i      : 0,
      reach:  c ? c.reach  : 0,
      vviews: c ? c.vviews : 0,
    });
  }

  const charts = [
    { id:'inv', label:'Investimento', key:'invest', fmtBar: v=>'R$ '+(v/1000).toFixed(0)+'k', total: series.reduce((s,x)=>s+x.invest,0), totalFmt: v=>fmtBudget(v) },
    { id:'imp', label:'Impressões',   key:'imp',    fmtBar: v=>v>=1?v.toFixed(2).replace('.',',')+'M':(v*1000).toFixed(0)+'K', total: series.reduce((s,x)=>s+x.imp,0), totalFmt: v=>v.toFixed(2).replace('.',',')+'M' },
    { id:'vv',  label:'Video Views',  key:'vviews', fmtBar: v=>v>=1?v.toFixed(2).replace('.',',')+'M':(v*1000).toFixed(0)+'K', total: series.reduce((s,x)=>s+x.vviews,0), totalFmt: v=>v.toFixed(2).replace('.',',')+'M' },
  ];

  const html = `
    <div class="sec-title">Histórico diário</div>
    <div class="src-charts">
      ${charts.map(c => `
        <div class="src-chart-card">
          <div class="src-chart-header">
            <div class="src-chart-title">${c.label}</div>
            <div class="src-chart-total">${c.totalFmt(c.total)}</div>
          </div>
          <div class="src-chart-wrap"><canvas class="src-chart-canvas" data-cid="${c.id}"></canvas></div>
          <div class="src-chart-axis" id="src-axis-${c.id}"></div>
        </div>`).join('')}
    </div>`;

  // After insertion we'll need to draw — return both html and a draw fn.
  return { html, draw: () => {
    charts.forEach(c => {
      const canvas = document.querySelector(`canvas[data-cid="${c.id}"]`);
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.parentElement.clientWidth, H = 160;
      canvas.width = W*dpr; canvas.height = H*dpr;
      canvas.style.height = H+'px';
      const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);

      const n = series.length, gap = W/n, barW = gap * 0.55;
      const vals = series.map(x => x[c.key]);
      const maxV = Math.max(...vals) * 1.22 || 1;

      // Grid horizontal
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
      [.25,.5,.75,1].forEach(p => { const y = H - H*p; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); });

      // Bars
      series.forEach((x,i) => {
        const v = x[c.key];
        if (v == null || v <= 0) return;
        const bh = (v/maxV) * H;
        const bx = gap*i + (gap-barW)/2;
        const by = H - bh;
        ctx.fillStyle = srcColor + '33';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, barW, bh, [2,2,0,0]);
        else ctx.rect(bx, by, barW, bh);
        ctx.fill();
        ctx.fillStyle = srcColor;
        ctx.fillRect(bx, by, barW, 2);
        // Value label
        ctx.fillStyle = '#AEBBD2';
        ctx.font = `600 10px 'DM Mono',monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(c.fmtBar(v), bx + barW/2, by - 4);
      });

      // X axis labels (every 5 days)
      const ax = document.getElementById('src-axis-' + c.id);
      if (ax) {
        ax.innerHTML = series.map((x,i) => `<span style="text-align:center;flex:1;">${(x.day===1||x.day%5===0)?x.day:''}</span>`).join('');
      }
    });
  }};
}

function srcDailyTable(srcKey) {
  const allDays = BASE.daily || [];
  const rows = allDays
    .map(d => ({ ...d, c: d.ch[srcKey] }))
    .filter(d => d.c && (d.c.budget > 0 || d.c.i > 0))
    .sort((a,b) => a.d.localeCompare(b.d));
  if (rows.length === 0) return '';

  const fmtDate = ds => {
    const [y,m,day] = ds.split('-');
    return `${day}/${m}`;
  };
  const fmtMM = v => v >= 1 ? v.toFixed(2).replace('.',',')+'M' : v > 0 ? (v*1000).toFixed(0)+'K' : '—';

  return `
    <div class="sec-title">Detalhe diário</div>
    <div class="src-table-wrap">
      <table class="src-table">
        <thead>
          <tr>
            <th>Data</th><th>Invest.</th><th>Impressões</th><th>Alcance</th><th>Video Views</th><th>CPM</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const cpm = r.c.i > 0 ? (r.c.budget/(r.c.i*1000)).toFixed(2).replace('.',',') : '—';
            return `<tr>
              <td>${fmtDate(r.d)}</td>
              <td>${fmtBudget(r.c.budget)}</td>
              <td>${fmtMM(r.c.i)}</td>
              <td>${fmtMM(r.c.reach)}</td>
              <td>${fmtMM(r.c.vviews)}</td>
              <td>R$ ${cpm}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function buildSourcePage(srcKey) {
  const wrap = document.getElementById('src-content');
  if (!wrap) return;
  const ch    = (BASE.channels || []).find(c => c.nameKey === 'ch_'+srcKey);
  const plan  = (BASE.plannedByCh && BASE.plannedByCh[srcKey]) || null;
  const srcName = (typeof chDisplayName === 'function') ? chDisplayName(srcKey) : srcKey;
  const color = ch ? ch.c : '#6E5FD9';

  if (!ch && !plan) {
    wrap.innerHTML = `<div class="sec-title">${srcName}</div><div class="cc"><div class="empty-state visible"><div class="empty-icon">◈</div><div class="empty-txt">Sem dados pra ${srcName}</div></div></div>`;
    return;
  }

  // For the KPI/pacing section, fall back to zeros if ads has no rows for this source.
  const realized = ch || { budget:0, imp:0, alc:0, vviews:0, cpm:0, c:color };

  // Period elapsed vs full campaign — use state if defined, else the full window
  const totalDays = FULL_DAYS;
  const ms = 86400000;
  const eStart = (state && state.start) ? state.start : CAMP_START;
  const eEnd   = (state && state.end)   ? state.end   : CAMP_END;
  const elapsedStart = new Date(eStart) > new Date(CAMP_START) ? new Date(eStart) : new Date(CAMP_START);
  const elapsedEnd   = new Date(eEnd)   < new Date(CAMP_END)   ? new Date(eEnd)   : new Date(CAMP_END);
  const daysIn = Math.max(0, Math.round((elapsedEnd - elapsedStart) / ms) + 1);

  const charts = srcCharts(srcKey, color);

  wrap.innerHTML =
    srcKpiGrid(srcName, realized, plan) +
    srcHPacing(realized, plan, daysIn, totalDays) +
    srcWeeks(srcKey) +
    charts.html +
    srcDailyTable(srcKey);

  // Draw canvases after DOM updates
  requestAnimationFrame(() => requestAnimationFrame(charts.draw));
}

// ═══════════════════════════════════════════════════════════════
// CREATIVES TAB
// ═══════════════════════════════════════════════════════════════
function buildCreativesTab() {
  const wrap=document.getElementById('cr-content');
  if(!wrap) return;

  const fmtCPMv=v=>'R$ '+v.toFixed(2).replace('.',',');
  const filtered=crFilter==='all' ? CREATIVES : CREATIVES.filter(c=>c.fk===crFilter);
  const videoC=CREATIVES.filter(c=>c.vcr!==null);

  const bestVCR=videoC.reduce((b,c)=>c.vcr>b.vcr?c:b, videoC[0]);
  const bestCPM=CREATIVES.reduce((b,c)=>(c.spend/c.imp)<(b.spend/b.imp)?c:b, CREATIVES[0]);
  const bestAlc=CREATIVES.reduce((b,c)=>c.alc>b.alc?c:b, CREATIVES[0]);

  const pills=[
    {k:'all',    lk:'cr_all'},
    {k:'video',  lk:'cr_video'},
    {k:'ooh',    lk:'cr_ooh'},
    {k:'audio',  lk:'cr_audio'},
    {k:'display',lk:'cr_display'},
  ];
  const icons={video:'▶', ooh:'◼', audio:'♫', display:'☷'};

  const cards=filtered.map(cr=>{
    const cpm=cr.spend/cr.imp/1000;
    const icon=icons[cr.fk]||'▶';
    const isHighVCR=cr.vcr!==null && cr.vcr>=70;
    const m1l=cr.vcr!==null ? T('cr_vcr') : (cr.ctr!==undefined ? 'CTR' : T('kpi_alc'));
    const m1v=cr.vcr!==null ? cr.vcr+'%' : (cr.ctr!==undefined ? cr.ctr.toFixed(2)+'%' : cr.alc.toFixed(2)+'M');
    return `<div class="cr-card">
      <div class="cr-thumb" style="background:linear-gradient(140deg,${cr.c}28 0%,${cr.c}0d 55%,rgba(8,10,17,.88) 100%)">
        <div class="cr-thumb-icon">${icon}</div>
        <div class="cr-ch-tag" style="background:${cr.c}22;color:${cr.c}">${T(cr.ch)||cr.ch}</div>
        <div class="cr-fmt-badge">${cr.fmt}</div>
      </div>
      <div class="cr-body">
        <div class="cr-name">${cr.name}</div>
        <div class="cr-mets">
          <div class="cr-met"><div class="cr-met-l">${m1l}</div><div class="cr-met-v ${isHighVCR?'hi':''}">${m1v}</div></div>
          <div class="cr-met"><div class="cr-met-l">${T('kpi_imp')}</div><div class="cr-met-v">${cr.imp.toFixed(1)}M</div></div>
          <div class="cr-met"><div class="cr-met-l">CPM</div><div class="cr-met-v">${fmtCPMv(cpm)}</div></div>
          <div class="cr-met"><div class="cr-met-l">Recall</div><div class="cr-met-v">+${cr.recall}pp</div></div>
        </div>
      </div>
    </div>`;
  }).join('');

  const showVCR=crFilter==='all'||crFilter==='video';

  wrap.innerHTML=`
    <div class="cr-filter-row">
      ${pills.map(p=>`<button class="cr-pill${crFilter===p.k?' active':''}" data-fk="${p.k}">${T(p.lk)}</button>`).join('')}
    </div>
    <div class="cr-hi-row">
      <div class="cr-hi" style="--hi-accent:${bestVCR.c}">
        <div class="cr-hi-lbl">${T('cr_best_vcr')}</div>
        <div class="cr-hi-val" style="color:${bestVCR.c}">${bestVCR.vcr}%</div>
        <div class="cr-hi-name">${bestVCR.name} · ${T(bestVCR.ch)||bestVCR.ch}</div>
      </div>
      <div class="cr-hi" style="--hi-accent:${bestCPM.c}">
        <div class="cr-hi-lbl">${T('cr_best_cpm')}</div>
        <div class="cr-hi-val" style="color:${bestCPM.c}">${fmtCPMv(bestCPM.spend/bestCPM.imp/1000)}</div>
        <div class="cr-hi-name">${bestCPM.name} · ${T(bestCPM.ch)||bestCPM.ch}</div>
      </div>
      <div class="cr-hi" style="--hi-accent:${bestAlc.c}">
        <div class="cr-hi-lbl">${T('cr_top_reach')}</div>
        <div class="cr-hi-val" style="color:${bestAlc.c}">${bestAlc.alc.toFixed(1)}M</div>
        <div class="cr-hi-name">${bestAlc.name} · ${T(bestAlc.ch)||bestAlc.ch}</div>
      </div>
    </div>
    <div class="cr-grid">${filtered.length ? cards : `<div class="cr-empty">${T('cr_empty_msg')}</div>`}</div>
    ${showVCR ? `<div class="cc">
      <div class="cc-hdr">
        <div>
          <div class="cc-title">${T('cr_vcr_title')}</div>
          <div class="cc-sub">${T('cr_vcr_sub')}</div>
        </div>
      </div>
      <div class="cw"><canvas id="c-vcr"></canvas></div>
    </div>` : ''}
  `;

  wrap.querySelectorAll('.cr-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{ crFilter=btn.dataset.fk; buildCreativesTab(); });
  });

  if(showVCR) setTimeout(drawVCRChart, 60);
}

// ═══════════════════════════════════════════════════════════════
// RANGE PILL + PARTIAL INDICATOR
// ═══════════════════════════════════════════════════════════════
function updateRangeUI(days, ratio, isPartial, start, end) {
  const partialTag=document.getElementById('partial-tag');
  if (isPartial) partialTag.classList.add('visible');
  else partialTag.classList.remove('visible');

  if (days.length > 0) {
    const d0=days[0].d.split('-'), d1=days[days.length-1].d.split('-');
    const rng=d0[2]+' '+MN(parseInt(d0[1]))+' – '+d1[2]+' '+MN(parseInt(d1[1]));
    const sub=document.getElementById('tl-sub');
    if (sub) sub.textContent=rng+' · '+T('sub_daily');
  }
}

// ═══════════════════════════════════════════════════════════════
// CHANNEL FILTER
// ═══════════════════════════════════════════════════════════════
function buildChannelFilter() {
  const el = document.getElementById('ch-filter');
  if (!el) return;
  const active = state.channelFilter;
  const activeCh = active ? BASE.channels.find(c => c.nameKey === 'ch_'+active) : null;
  const label = activeCh ? chLabel(activeCh) : T('ch_all');
  const color = activeCh ? activeCh.c : null;

  let opts = `<div class="chf-opt ${!active?'active':''}" data-ch="all">
    ${T('ch_all')}
  </div>`;
  BASE.channels.forEach(ch => {
    const key = ch.nameKey.replace('ch_','');
    const isActive = active === key;
    opts += `<div class="chf-opt ${isActive?'active':''}" data-ch="${key}">
      ${chLabel(ch)}
    </div>`;
  });

  el.innerHTML = `
    <span class="ch-filter-lbl">${T('ch_filter_lbl')}</span>
    <div class="chf-wrap" id="chf-wrap">
      <button class="chf-btn ${active?'filtered':''}" id="chf-btn" style="${color?'--chf-c:'+color:''}">
        ${color ? `<span class="chf-dot" style="background:${color}"></span>` : ''}
        <span class="chf-label">${label}</span>
        <span class="chf-arr" id="chf-arr">▾</span>
      </button>
      <div class="chf-drop" id="chf-drop">${opts}</div>
    </div>`;

  const btn  = el.querySelector('#chf-btn');
  const drop = el.querySelector('#chf-drop');
  const arr  = el.querySelector('#chf-arr');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    drop.classList.toggle('open');
    arr.style.transform = drop.classList.contains('open') ? 'rotate(180deg)' : '';
  });

  el.querySelectorAll('.chf-opt').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const ch = opt.dataset.ch;
      state.channelFilter = ch === 'all' ? null : ch;
      drop.classList.remove('open');
      buildChannelFilter();
      update(state.start, state.end, true, state.channelFilter);
    });
  });

}
