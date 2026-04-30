// ═══════════════════════════════════════════════════════════════
// SUPABASE CONNECTOR
// Fetches data from gold_media_plan_v70 + gold_fct_ads and
// transforms it into the dashboard's BASE shape.
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://ztcfogopvcymdgjkizii.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Y2ZvZ29wdmN5bWRnamtpemlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NzQ4MzIsImV4cCI6MjA5MTA1MDgzMn0.oVUT0nx3GB4T4V0vZNN20m9OxWSrlmaX7BkE9RrrKC0';

const PAGE_SIZE = 1000;

async function sbFetchAll(table, { select='*', filters='' } = {}) {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${to}`,
        'Range-Unit': 'items',
      },
    });
    if (!res.ok) throw new Error(`${table} fetch failed: ${res.status}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

// ── Channel key derivation (by `source` column) ────────────────
const SOURCE_COLORS = {
  meta:'#E05470', tiktok:'#9B8FD4', youtube:'#E05470',
  google_ads:'#4A66E8', other:'#46546A',
};
const SOURCE_NAMES = {
  meta:'Meta', tiktok:'TikTok', youtube:'YouTube',
  google_ads:'Google Ads', other:'Outros',
};

function normSource(raw) {
  if (!raw) return 'other';
  return String(raw).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
}

// Normalize phase/funnel_stage across plan ('awareness') and ads ('AWARENESS', 'CONSIDERACAO')
function normPhase(raw) {
  if (!raw) return 'unknown';
  const s = String(raw).trim().toLowerCase()
    .replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/[íî]/g,'i')
    .replace(/[óôõ]/g,'o').replace(/[ú]/g,'u').replace(/[ç]/g,'c');
  if (s === 'awareness') return 'awareness';
  if (s === 'consideracao' || s === 'consideration') return 'consideration';
  if (s === 'conversao' || s === 'conversion')       return 'conversion';
  return s.replace(/[^a-z0-9]+/g,'_');
}

function normKpi(raw) {
  if (raw == null || raw === '') return 'unknown';
  return String(raw).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
}

// Main grouping is by source only (Meta · TikTok · Google Ads).
function adChannel(row)   { return normSource(row.source); }
function planChannel(row) { return normSource(row.source); }
// Source × phase used inside per-source detail pages.
function adSourcePhase(row)   { return normSource(row.source) + '__' + normPhase(row.funnel_stage); }
function planSourcePhase(row) { return normSource(row.source) + '__' + normPhase(row.phase); }

const PHASE_NAMES = { awareness:'Awareness', consideration:'Consideration', conversion:'Conversion', unknown:'—' };

function chColor(key) {
  const src = key.split('__')[0];
  return SOURCE_COLORS[src] || SOURCE_COLORS.other;
}
function chDisplayName(key) {
  const [src, phase] = key.split('__');
  const srcName = SOURCE_NAMES[src] || (src.charAt(0).toUpperCase() + src.slice(1).replace(/_/g,' '));
  const phaseName = phase ? (PHASE_NAMES[phase] || phase) : '';
  return phaseName && phaseName !== '—' ? `${srcName} · ${phaseName}` : srcName;
}

// ── Aggregations ───────────────────────────────────────────────
function sumBy(rows, keyFn, valFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const v = +valFn(r) || 0;
    m.set(k, (m.get(k) || 0) + v);
  }
  return m;
}

// ── Transform ──────────────────────────────────────────────────
function buildDaily(adsRows) {
  const byDate = new Map();
  for (const r of adsRows) {
    if (!r.date) continue;
    const chKey = adChannel(r);
    if (!byDate.has(r.date)) byDate.set(r.date, { d:r.date, i:0, budget:0, reach:0, vviews:0, clicks:0, ch:{} });
    const day = byDate.get(r.date);
    const impM = (+r.impressions || 0) / 1_000_000;
    const cost = +r.cost || 0;
    const reachM = (+r.reach || 0) / 1_000_000;
    const vviewsM = (+r.video_views || 0) / 1_000_000;
    const clk = +r.clicks || 0;
    day.i += impM;
    day.budget += cost;
    day.reach += reachM;
    day.vviews += vviewsM;
    day.clicks += clk;
    if (!day.ch[chKey]) day.ch[chKey] = { i:0, budget:0, reach:0, vviews:0, clicks:0 };
    day.ch[chKey].i += impM;
    day.ch[chKey].budget += cost;
    day.ch[chKey].reach += reachM;
    day.ch[chKey].vviews += vviewsM;
    day.ch[chKey].clicks += clk;
  }
  const round = (x, dp=4) => +x.toFixed(dp);
  return [...byDate.values()].sort((a,b) => a.d.localeCompare(b.d)).map(d => ({
    d: d.d,
    i: round(d.i),
    budget: round(d.budget, 2),
    reach: round(d.reach),
    vviews: round(d.vviews),
    clicks: d.clicks,
    ch: Object.fromEntries(Object.entries(d.ch).map(([k,v]) => [k, {
      i:round(v.i), budget:round(v.budget,2), reach:round(v.reach), vviews:round(v.vviews), clicks:v.clicks,
    }])),
  }));
}

function aggregatePlanByKey(planRows, keyFn) {
  const m = new Map();
  let total = 0;
  for (const r of planRows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, { budget:0, imp:0, reach:0, views:0, vtrSum:0, vtrCnt:0, cpmSum:0, cpmCnt:0 });
    const p = m.get(k);
    p.budget += +r.net_investment || 0;
    p.imp    += (+r.impressions   || 0) / 1_000_000;
    p.reach  += (+r.reach         || 0) / 1_000_000;
    p.views  += (+r.views         || 0) / 1_000_000;
    if (r.vtr != null) { p.vtrSum += +r.vtr; p.vtrCnt++; }
    if (r.cpm != null) { p.cpmSum += +r.cpm; p.cpmCnt++; }
    total += +r.net_investment || 0;
  }
  return { byCh:m, totalBudget:total };
}
const aggregatePlanByChannel = rows => aggregatePlanByKey(rows, planChannel);

function aggregateAdsByKey(adsRows, keyFn) {
  const m = new Map();
  let total = 0;
  for (const r of adsRows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, { cost:0, imp:0, reach:0, vviews:0, clicks:0 });
    const a = m.get(k);
    a.cost   += +r.cost          || 0;
    a.imp    += (+r.impressions  || 0) / 1_000_000;
    a.reach  += (+r.reach        || 0) / 1_000_000;
    a.vviews += (+r.video_views  || 0) / 1_000_000;
    a.clicks += +r.clicks        || 0;
    total += +r.cost || 0;
  }
  return { byCh:m, totalBudget:total };
}
const aggregateAdsByChannel = rows => aggregateAdsByKey(rows, adChannel);

// Build channel rows for the main view: one per source, realized from ads,
// planned-vs-realized comparable directly since both keyed by source.
function buildChannelsAt(planRows, adsRows, planKeyFn, adsKeyFn) {
  const plan = aggregatePlanByKey(planRows, planKeyFn);
  const ads  = aggregateAdsByKey(adsRows, adsKeyFn);
  const keys = new Set([...plan.byCh.keys(), ...ads.byCh.keys()]);

  const channels = [];
  for (const k of keys) {
    const p = plan.byCh.get(k) || { budget:0, imp:0, reach:0, views:0, vtrSum:0, vtrCnt:0 };
    const a = ads.byCh.get(k)  || { cost:0, imp:0, reach:0, vviews:0, clicks:0 };
    const impRaw = a.imp * 1_000_000;
    const cpm    = a.imp > 0 ? a.cost / (a.imp * 1000) : 0;
    const ctr    = impRaw > 0 ? a.clicks / impRaw : 0;
    const cpc    = a.clicks > 0 ? a.cost / a.clicks : 0;
    const recall = p.vtrCnt ? Math.round(p.vtrSum/p.vtrCnt * 100) : 0;
    channels.push({
      nameKey: 'ch_' + k,
      name:    chDisplayName(k),
      share:   ads.totalBudget > 0 ? Math.round((a.cost / ads.totalBudget) * 100) : 0,
      budget:  Math.round(a.cost),
      imp:     +a.imp.toFixed(2),
      alc:     +a.reach.toFixed(2),
      cpm:     +cpm.toFixed(2),
      recall,
      vviews:  +a.vviews.toFixed(2),
      clicks:  a.clicks,
      ctr:     +ctr.toFixed(4),
      cpc:     +cpc.toFixed(2),
      c:       chColor(k),
    });
  }
  channels.sort((a,b) => b.budget - a.budget);
  return { channels, totalPlanBudget: plan.totalBudget, totalAdsBudget: ads.totalBudget };
}

const buildChannels = (planRows, adsRows) =>
  buildChannelsAt(planRows, adsRows, planChannel, adChannel);

function buildCreatives(planRows, adsRows) {
  // Plan-based creatives (from plan.creative when present)
  const byCreative = new Map();
  for (const r of planRows) {
    if (!r.creative) continue;
    const k = r.creative;
    const chKey = planChannel(r);
    if (!byCreative.has(k)) byCreative.set(k, {
      id:k, name:k, fmt:r.format||'', fk:(r.format||'').toLowerCase(),
      ch:'ch_'+chKey, c:chColor(chKey),
      imp:0, alc:0, vcr:null, recall:0, spend:0, vtrSum:0, vtrCnt:0, ctrSum:0, ctrCnt:0,
    });
    const c = byCreative.get(k);
    c.imp   += (+r.impressions || 0) / 1_000_000;
    c.alc   += (+r.reach       || 0) / 1_000_000;
    c.spend += +r.net_investment || 0;
    if (r.vtr != null) { c.vtrSum += +r.vtr; c.vtrCnt++; }
    if (r.ctr != null) { c.ctrSum += +r.ctr; c.ctrCnt++; }
  }
  // Fallback: derive from ads.ad_name when plan has no creatives
  if (byCreative.size === 0 && adsRows.length) {
    const byAd = new Map();
    for (const r of adsRows) {
      if (!r.ad_name) continue;
      const k = r.ad_name;
      const chKey = adChannel(r);
      if (!byAd.has(k)) byAd.set(k, {
        id:k, name:k, fmt:r.format||'', fk:(r.format||'').toLowerCase(),
        ch:'ch_'+chKey, c:chColor(chKey),
        imp:0, alc:0, vcr:null, recall:0, spend:0, vviews:0, ctrSum:0, ctrCnt:0,
      });
      const c = byAd.get(k);
      c.imp    += (+r.impressions || 0) / 1_000_000;
      c.alc    += (+r.reach       || 0) / 1_000_000;
      c.spend  += +r.cost || 0;
      c.vviews += (+r.video_views || 0) / 1_000_000;
      const imp = +r.impressions || 0;
      const clk = +r.clicks || 0;
      if (imp > 0) { c.ctrSum += (clk/imp)*100; c.ctrCnt++; }
    }
    return [...byAd.values()].map(c => ({
      id:c.id, name:c.name, fmt:c.fmt, fk:c.fk, ch:c.ch,
      imp:+c.imp.toFixed(2), alc:+c.alc.toFixed(2),
      vcr:c.vviews>0 && c.imp>0 ? Math.round((c.vviews/c.imp)*100) : null,
      recall:0, spend:Math.round(c.spend), c:c.c,
      ctr:c.ctrCnt ? +(c.ctrSum/c.ctrCnt).toFixed(2) : undefined,
    }));
  }
  return [...byCreative.values()].map(c => ({
    id:c.id, name:c.name, fmt:c.fmt, fk:c.fk, ch:c.ch,
    imp:+c.imp.toFixed(2), alc:+c.alc.toFixed(2),
    vcr:c.vtrCnt ? Math.round(c.vtrSum/c.vtrCnt*100) : null,
    recall:c.recall, spend:Math.round(c.spend), c:c.c,
    ctr:c.ctrCnt ? +(c.ctrSum/c.ctrCnt).toFixed(2) : undefined,
  }));
}

function buildTargetsFromPlan(planRows) {
  let budget=0, imp=0, alc=0, views=0;
  for (const r of planRows) {
    budget += +r.net_investment || 0;
    imp    += (+r.impressions   || 0) / 1_000_000;
    alc    += (+r.reach         || 0) / 1_000_000;
    views  += (+r.views         || 0) / 1_000_000;
  }
  const freq = alc > 0 ? +(imp/alc).toFixed(1) : 0;
  const cpm  = imp > 0 ? +(budget / (imp * 1000)).toFixed(2) : 0;
  const cpv  = views > 0 ? +(budget / (views * 1_000_000)).toFixed(4) : 0;
  return { budget, imp:+imp.toFixed(2), alc:+alc.toFixed(2), freq, cpm, vviews:+views.toFixed(2), cpv };
}


// ── Filter builder ─────────────────────────────────────────────
function buildFilterString(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (Array.isArray(v)) {
      const list = v.map(x => `"${String(x).replace(/"/g,'\\"')}"`).join(',');
      parts.push(`&${k}=in.(${list})`);
    } else {
      parts.push(`&${k}=ilike.${encodeURIComponent(v)}`);
    }
  }
  return parts.join('');
}

// ── Main loader ────────────────────────────────────────────────
async function loadFromSupabase() {
  const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
  const camp = (cfg.campaignFilter || '').trim();
  const campFilter = camp ? `&campaign_name=ilike.${encodeURIComponent(camp)}` : '';
  const adsExtra  = buildFilterString(cfg.adsFilter);
  const planExtra = buildFilterString(cfg.planFilter);
  const planFilters = campFilter + planExtra;

  // Load PLAN first — it defines the source set that ads must match.
  const planRowsRaw = await sbFetchAll('gold_media_plan_v70', { filters: planFilters });
  let planRows = planRowsRaw;
  if ((camp || planExtra) && planRowsRaw.length === 0) {
    console.warn(`[Supabase] no plan rows match filters, falling back to full plan`);
    planRows = await sbFetchAll('gold_media_plan_v70');
  }

  // Build the ads source filter from the plan's distinct sources so the
  // realized data joins exactly to the planned rows by source__phase.
  const planSourceList = [...new Set(planRows.map(r => (r.source||'').trim()).filter(Boolean))];
  const sourceFilter = planSourceList.length
    ? `&or=(${planSourceList.map(s => `source.ilike.${encodeURIComponent(s)}`).join(',')})`
    : '';

  // Now load ADS with the strict source filter applied alongside campaign/funnel/product/etc.
  const adsFilters  = campFilter + adsExtra + sourceFilter;
  const adsRows = await sbFetchAll('gold_fct_ads', { filters: adsFilters });

  if (planRows.length === 0 && adsRows.length === 0) {
    console.warn('[Supabase] no data for current filters — using mock data');
    return null;
  }

  const activeFilters = [];
  if (camp) activeFilters.push(`campaign_name~"${camp}"`);
  if (adsExtra)  activeFilters.push(`ads:${adsExtra.replace(/^&/,'').replace(/&/g,', ')}`);
  if (sourceFilter) activeFilters.push(`ads.source∈[${planSourceList.join(',')}]`);
  if (planExtra) activeFilters.push(`plan:${planExtra.replace(/^&/,'').replace(/&/g,', ')}`);
  if (activeFilters.length) console.log('[Supabase] active filters →', activeFilters.join(' | '));

  // Realized → ads | Planned → plan. Always.
  const daily = adsRows.length ? buildDaily(adsRows) : [];
  const { channels, totalPlanBudget, totalAdsBudget } = buildChannels(planRows, adsRows);
  const creatives = buildCreatives(planRows, adsRows);
  const targets = buildTargetsFromPlan(planRows);

  // Plan-based share by (source, phase, kpi) — one entry per plan row.
  // Share section shows ALL plan groups, but `budget` is the portion that
  // matches the active product filter (e.g. only V70). Rows without a
  // matching product show budget=0; `total` keeps each group's full plan
  // budget so the share denominator stays = full plan total.
  const planAgg = aggregatePlanByChannel(planRows);
  const productFilter = (cfg.adsFilter && cfg.adsFilter.product)
    ? String(cfg.adsFilter.product).toLowerCase()
    : null;
  const productMatchByCh = new Map();
  for (const r of planRows) {
    const k = planChannel(r);
    const cost = +r.net_investment || 0;
    const matches = productFilter
      ? String(r.product || '').toLowerCase() === productFilter
      : true;
    if (!matches) continue;
    productMatchByCh.set(k, (productMatchByCh.get(k) || 0) + cost);
  }
  const plannedShare = [...planAgg.byCh.entries()].map(([k, v]) => ({
    key:    k,
    name:   chDisplayName(k),
    color:  chColor(k),
    budget: productMatchByCh.get(k) || 0,
    total:  v.budget,
  })).sort((a,b) => b.total - a.total);

  // Plan metrics per source. CPM comes from plan: cost/impressions × 1000.
  // clicks/ctr/cpc remain null when plan columns are unpopulated.
  const plannedByCh = {};
  let planClicksRaw = 0, planCtrSum = 0, planCtrCnt = 0;
  const planClicksByCh = new Map();
  const planCtrByCh    = new Map();
  for (const r of planRows) {
    const k = planChannel(r);
    const clk = +r.clicks || 0;
    const ctr = r.ctr != null ? +r.ctr : null;
    if (clk > 0) planClicksByCh.set(k, (planClicksByCh.get(k) || 0) + clk);
    if (ctr != null) {
      planCtrSum += ctr; planCtrCnt++;
      const cur = planCtrByCh.get(k) || { sum:0, n:0 };
      cur.sum += ctr; cur.n++;
      planCtrByCh.set(k, cur);
    }
    planClicksRaw += clk;
  }
  for (const [k, v] of planAgg.byCh.entries()) {
    const pClicks = planClicksByCh.get(k) || 0;
    const pCtrAgg = planCtrByCh.get(k);
    plannedByCh[k] = {
      budget: v.budget,
      imp:    +v.imp.toFixed(2),
      alc:    +v.reach.toFixed(2),
      vviews: +v.views.toFixed(2),
      cpm:    v.imp > 0 ? +(v.budget / (v.imp * 1000)).toFixed(2) : 0,
      clicks: pClicks || null,
      ctr:    pCtrAgg ? +(pCtrAgg.sum/pCtrAgg.n).toFixed(4) : null,
      cpc:    pClicks > 0 ? +(v.budget / pClicks).toFixed(2) : null,
    };
  }

  // KPI "Investimento" reflects REALIZED ads spend. Plan total goes into targets.
  const totalBudget = totalAdsBudget;

  // Planned campaign window — from plan only (used for period progress bar)
  const planStarts = planRows.map(r => r.start_date).filter(Boolean).sort();
  const planEnds   = planRows.map(r => r.end_date).filter(Boolean).sort();
  const planStart = planStarts[0] || null;
  const planEnd   = planEnds[planEnds.length-1] || null;

  // Data window — covers all dates with delivery
  const dataStart = daily.length ? daily[0].d : null;
  const dataEnd   = daily.length ? daily[daily.length-1].d : null;

  // Default selection range = data window (where delivery exists)
  const startDate = dataStart || planStart;
  const endDate   = dataEnd   || planEnd;

  // Campaign name: prefer filter value, then plan, then ads
  const campaignName = camp
    || planRows.find(r => r.campaign_name)?.campaign_name
    || adsRows.find(r => r.campaign_name)?.campaign_name
    || null;

  // Per-source phase breakdown (used in source-specific tabs).
  const phaseAds  = aggregateAdsByKey(adsRows, adSourcePhase);
  const phasePlan = aggregatePlanByKey(planRows, planSourcePhase);
  const sourcePhases = {}; // { meta: [{phase, name, budget, imp, ...}], ... }
  const allKeys = new Set([...phaseAds.byCh.keys(), ...phasePlan.byCh.keys()]);
  for (const k of allKeys) {
    const [src, phase] = k.split('__');
    const a = phaseAds.byCh.get(k)  || { cost:0, imp:0, reach:0, vviews:0 };
    const p = phasePlan.byCh.get(k) || { budget:0, imp:0, reach:0, views:0 };
    if (!sourcePhases[src]) sourcePhases[src] = [];
    sourcePhases[src].push({
      phase,
      name: PHASE_NAMES[phase] || phase,
      // realized
      cost:    Math.round(a.cost),
      imp:     +a.imp.toFixed(2),
      reach:   +a.reach.toFixed(2),
      vviews:  +a.vviews.toFixed(2),
      cpm:     a.imp>0 ? +(a.cost/(a.imp*1000)).toFixed(2) : 0,
      // planned
      pBudget: Math.round(p.budget),
      pImp:    +p.imp.toFixed(2),
      pReach:  +p.reach.toFixed(2),
      pViews:  +p.views.toFixed(2),
      pCpm:    p.imp>0 ? +(p.budget/(p.imp*1000)).toFixed(2) : 0,
      c:       chColor(src),
    });
  }
  // Sort each source's phases: awareness, consideration, conversion
  const PHASE_ORDER = { awareness:1, consideration:2, conversion:3 };
  for (const src of Object.keys(sourcePhases)) {
    sourcePhases[src].sort((a,b) => (PHASE_ORDER[a.phase]||9) - (PHASE_ORDER[b.phase]||9));
  }

  console.log('[Supabase] loaded', { plan:planRows.length, ads:adsRows.length, channels:channels.length, creatives:creatives.length, daily:daily.length });

  return {
    daily, channels, creatives, targets,
    totalBudget,
    plannedShare,
    plannedByCh,
    sourcePhases,
    startDate, endDate,            // default selection
    planStart, planEnd,            // planned campaign window (for period progress)
    campaignName,
  };
}
