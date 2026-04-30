// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let state = {
  start: '2026-01-05',
  end:   YESTERDAY,
  data:  null,
  activeTab: 'visao',
  channelFilter: null, // null = all channels; 'tv'|'digital'|'ooh'|'audio'|'display'
};

let crFilter='all';

// ═══════════════════════════════════════════════════════════════
// MASTER UPDATE
// ═══════════════════════════════════════════════════════════════
function update(start, end, animate=true, chKey=state.channelFilter) {
  state.start=start; state.end=end;
  const d=filterAndCompute(start, end, chKey);
  state.data=d;

  updateRangeUI(d.days, d.ratio, d.isPartial, start, end);
  updateKPIs(d);
  buildKpiAch(d);
  buildChannelTable(d.isEmpty ? BASE.channels : d.channels);
  if(animate){
    animateTimeline(d.days);
  } else {
    drawTimeline(d.days,1);
  }

  if(state.activeTab==='criativos'){
    buildCreativesTab();
  }
}

// ═══════════════════════════════════════════════════════════════
// TABS  (dynamic — Visão Geral · <one tab per source> · Criativos)
// ═══════════════════════════════════════════════════════════════
const TAB_MAP = { visao:'tab-visao', criativos:'tab-criativos' };

function buildTabs() {
  const wrap = document.getElementById('tabs');
  if (!wrap) return;
  const sources = BASE.sourcePhases ? Object.keys(BASE.sourcePhases) : [];
  let html = `<div class="tab" data-t="visao">${T('tab_visao')||'Visão Geral'}</div>`;
  for (const src of sources) {
    html += `<div class="tab" data-t="src:${src}">${chDisplayName(src)}</div>`;
  }
  html += `<div class="tab" data-t="criativos">${T('tab_criativos')||'Criativos'}</div>`;
  wrap.innerHTML = html;
  wrap.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.t)));
  // Restore active state
  const active = state.activeTab || 'visao';
  const cur = wrap.querySelector(`.tab[data-t="${active}"]`) || wrap.querySelector('.tab');
  if (cur) cur.classList.add('active');
}

function switchTab(t) {
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.t === t));
  state.activeTab = t;

  if (t.startsWith('src:')) {
    document.querySelectorAll('.tc').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-source').classList.add('active');
    buildSourcePage(t.slice(4));
    return;
  }

  document.querySelectorAll('.tc').forEach(el => el.classList.toggle('active', el.id === TAB_MAP[t]));
  if (!state.data) return;
  if (t === 'criativos') buildCreativesTab();
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE SWITCHER
// ═══════════════════════════════════════════════════════════════
function setLang(code) {
  currentLang = code;
  const labels = {pt:'PT', en:'EN', cn:'中文'};
  document.getElementById('lang-current').textContent = labels[code]||code.toUpperCase();
  document.querySelectorAll('.lang-opt').forEach(o=>o.classList.toggle('active', o.dataset.lang===code));

  // Update static elements
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.dataset.i18n;
    const val=T(key);
    if(val) el.textContent=val;
  });

  // Rebuild dynamic content
  buildKPIGrid();
  buildChannelFilter();
  buildTabs();
  if(state.data){
    updateKPIs(state.data);
    buildKpiAch(state.data);
    buildChannelTable(state.data.isEmpty ? BASE.channels : state.data.channels);
    updateRangeUI(state.data.days||[], state.data.ratio||0, state.data.isPartial, state.start, state.end);
    drawTimeline(state.data.days, 1);
  }
  if(state.activeTab==='criativos'){
    buildCreativesTab();
  }
}

const langBtn = document.getElementById('lang-btn');
const langDrop = document.getElementById('lang-drop');

langBtn.addEventListener('click', e=>{
  e.stopPropagation();
  langDrop.classList.toggle('open');
});

document.querySelectorAll('.lang-opt').forEach(opt=>{
  opt.addEventListener('click', e=>{
    e.stopPropagation();
    setLang(opt.dataset.lang);
    langDrop.classList.remove('open');
  });
});

document.addEventListener('click', ()=>langDrop.classList.remove('open'));

// ═══════════════════════════════════════════════════════════════
// DATE INPUTS
// ═══════════════════════════════════════════════════════════════
let drTimer=null;
function onDateChange() {
  clearTimeout(drTimer);
  drTimer=setTimeout(()=>{
    const s=document.getElementById('dr-start').value;
    const e=document.getElementById('dr-end').value;
    if(!s||!e||s>e) return;
    update(s,e,true);
  },300);
}

document.getElementById('dr-start').addEventListener('change',onDateChange);
document.getElementById('dr-end').addEventListener('change',onDateChange);

// ═══════════════════════════════════════════════════════════════
// RESIZE
// ═══════════════════════════════════════════════════════════════
window.addEventListener('resize',()=>{
  if(!state.data) return;
  const d=state.data;
  if(state.activeTab==='visao'){
    drawTimeline(d.days,1);
  }
});

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

// Close channel-filter dropdown on any outside click — registered once only
document.addEventListener('click', () => {
  const drop = document.getElementById('chf-drop');
  if (drop) drop.classList.remove('open');
});

// ── Apply CONFIG to header ───────────────────────────────────
(function applyConfig() {
  const logo = document.getElementById('hdr-logo');
  if (CONFIG.logoUrl) {
    logo.style.background = 'transparent';
    logo.innerHTML = `<img src="${CONFIG.logoUrl}" alt="${CONFIG.brandName}">`;
  } else {
    logo.style.background = CONFIG.logoColor;
    logo.textContent = CONFIG.logoLetter;
  }
  document.getElementById('hdr-brand').textContent = CONFIG.brandName;
  document.getElementById('page-title').textContent = `Dashboard · ${CONFIG.brandName}`;
})();

// Apply translations to all static data-i18n elements on first load
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
buildKPIGrid();
buildChannelFilter();
setupTimelineTooltip();

// Init date inputs with dynamic range (full current year) and yesterday as end
function initDateInputs() {
  const s = document.getElementById('dr-start');
  const e = document.getElementById('dr-end');
  s.min = YEAR_START; s.max = YEAR_END; s.value = state.start;
  e.min = YEAR_START; e.max = YEAR_END; e.value = state.end;
}

// ═══════════════════════════════════════════════════════════════
// ASYNC BOOTSTRAP — load Supabase data, then render
// ═══════════════════════════════════════════════════════════════
function showLoading(on) {
  let el = document.getElementById('app-loading');
  if (on) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-loading';
      el.innerHTML = '<div class="app-loading-inner"><div class="app-loading-spin"></div><span>Carregando dados…</span></div>';
      document.body.appendChild(el);
    }
  } else if (el) {
    el.remove();
  }
}

function showFatalError(msg) {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <div class="app-error">
      <div class="app-error-icon">⚠</div>
      <div class="app-error-title">Não foi possível carregar os dados</div>
      <div class="app-error-msg">${msg}</div>
      <button class="app-error-btn" onclick="location.reload()">Tentar novamente</button>
    </div>`;
}

(async function bootstrap() {
  showLoading(true);
  try {
    const sb = await loadFromSupabase();
    if (!sb) {
      throw new Error('Sem dados retornados de gold_media_plan_v70 ou gold_fct_ads.');
    }
    applySupabaseData(sb);
    const today = new Date().toISOString().slice(0,10);
    if (sb.startDate || sb.planStart) state.start = sb.startDate || sb.planStart;
    if (sb.endDate || sb.planEnd) {
      const max = sb.endDate || sb.planEnd;
      state.end = today < max ? today : max;
    }
    initDateInputs();
    buildTabs();
    update(state.start, state.end, true);
  } catch (err) {
    console.error('[Supabase] load failed:', err);
    showFatalError(err.message || String(err));
  } finally {
    showLoading(false);
  }
})();
