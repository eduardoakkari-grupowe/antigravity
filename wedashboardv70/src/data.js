// ╔══════════════════════════════════════════════════════════════╗
// ║  CONFIGURAÇÃO — edite aqui sem precisar mexer no restante   ║
// ╚══════════════════════════════════════════════════════════════╝
const CONFIG = {
  // Nome da marca exibido no cabeçalho
  brandName: 'V70',

  // Título da campanha exibido ao lado do nome
  campaignTitle: 'Campanha Awareness · 2026',

  // Logo — escolha UMA das opções abaixo:
  //   Opção A) URL de imagem (http://... ou caminho relativo como './logo.png')
  //            Deixe vazio ('') para usar a Opção B
  logoUrl: 'Logo Jovi.png',
  //   Opção B) Letra + cor de fundo (usado quando logoUrl estiver vazio)
  logoLetter: 'M',
  logoColor:  '#6E5FD9',

  // Filtro de campanha (case-insensitive). '' = todas as campanhas.
  // Aplicado a AMBAS as tabelas (ads + plan).
  // Exemplos: 'LANCAMENTO', 'JOVI', 'SHARK_TANK_BRASIL', 'IMPULSIONAMENTO'
  campaignFilter: '',

  // Filtros extras aplicados SOMENTE em gold_fct_ads.
  // Aceita string (ilike) ou array (IN).
  // Colunas disponíveis: date, agency, funnel_stage, product, format,
  // campaign_goal, campaign_name, ad_group_name, ad_name,
  // publisher_platform, keyword, match_type, source
  // Exemplos:
  //   adsFilter: { funnel_stage: 'AWARENESS' }
  //   adsFilter: { source: ['Meta','TikTok'], product: 'V70' }
  adsFilter: {
    product: 'V70',
    funnel_stage: ['AWARENESS','CONSIDERACAO'],
  },

  // Filtros extras aplicados SOMENTE em gold_fct_media_plan_v70.
  // Colunas: phase, kpi, channel_type, source, format, agency,
  // funnel_stage, product, campaign_goal, campaign_name
  planFilter: {},
};
// ══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// BASE DATA — populated entirely by applySupabaseData()
// ═══════════════════════════════════════════════════════════════
const CREATIVES = [];
const BASE = {
  totalBudget: 0,
  daily: [],
  channels: [],
  audience: { age:[], gender:[], devices:[] },
  lift: [],
  targets: { budget:0, imp:0, alc:0, freq:0, cpm:0, vviews:0, cpv:0 },
  prev:    { budget:0, imp:0, alc:0, freq:0, cpm:0, vviews:0, cpv:0 },
  plannedShare: [],
  plannedByCh: {},
  sourcePhases: {},
};

// Recomputed by applySupabaseData()
let FULL_IMP    = 0;
let FULL_ALC    = 0;
let FULL_BUD    = 0;
let FULL_VVIEWS = 0;
let FULL_DAYS   = 1;
let CAMP_START  = new Date().toISOString().slice(0,10);
let CAMP_END    = CAMP_START;

// ═══════════════════════════════════════════════════════════════
// SUPABASE INTEGRATION HOOK
// ═══════════════════════════════════════════════════════════════
function applySupabaseData(s) {
  if (!s) return;
  if (s.daily && s.daily.length)       BASE.daily       = s.daily;
  if (s.channels && s.channels.length) BASE.channels    = s.channels;
  if (s.targets)                       BASE.targets     = { ...BASE.targets, ...s.targets };
  if (s.totalBudget)                   BASE.totalBudget = s.totalBudget;
  if (s.plannedShare)                  BASE.plannedShare = s.plannedShare;
  if (s.plannedByCh)                   BASE.plannedByCh  = s.plannedByCh;
  if (s.sourcePhases)                  BASE.sourcePhases = s.sourcePhases;
  if (s.creatives && s.creatives.length) {
    CREATIVES.length = 0;
    s.creatives.forEach(c => CREATIVES.push(c));
  }
  if (s.campaignName) CONFIG.campaignTitle = s.campaignName;

  FULL_IMP    = BASE.daily.reduce((sum,d) => sum+d.i, 0);
  FULL_ALC    = BASE.channels.reduce((sum,c) => sum+(c.alc||0), 0) || FULL_ALC;
  FULL_BUD    = BASE.totalBudget;
  FULL_VVIEWS = BASE.channels.reduce((sum,c) => sum+(c.vviews||0), 0) || FULL_VVIEWS;
  // Planned campaign window drives period bar (always plan-based).
  if (s.planStart || s.startDate) CAMP_START = s.planStart || s.startDate;
  if (s.planEnd   || s.endDate)   CAMP_END   = s.planEnd   || s.endDate;
  FULL_DAYS = Math.round((new Date(CAMP_END) - new Date(CAMP_START)) / 86400000) + 1;
}

// ═══════════════════════════════════════════════════════════════
// DATE CONSTANTS
// ═══════════════════════════════════════════════════════════════
// Compute yesterday dynamically
const _today = new Date();
const _yesterday = new Date(_today);
_yesterday.setDate(_today.getDate() - 1);
const YESTERDAY = _yesterday.toISOString().slice(0, 10);
const YEAR_START = _today.getFullYear() + '-01-01';
const YEAR_END   = _today.getFullYear() + '-12-31';

// ═══════════════════════════════════════════════════════════════
// FILTER & COMPUTE
// ═══════════════════════════════════════════════════════════════
function filterAndCompute(start, end, chKey) {
  const allDays = BASE.daily.filter(d => d.d >= start && d.d <= end);
  const isEmpty = allDays.length === 0;
  if (isEmpty) return { days:[], isEmpty:true, ratio:0, kpis:{}, channels:[], lift:[], isPartial:true, chKey };

  // Daily breakdowns are keyed by source.
  const days = chKey
    ? allDays.map(d => ({ d: d.d, i: d.ch[chKey]?.i || 0, _budget: d.ch[chKey]?.budget || 0 }))
    : allDays;

  // Find the base channel object for targets/prev when filtered
  const chBase = chKey ? BASE.channels.find(c => c.nameKey === 'ch_'+chKey) : null;

  // Total impressions for selected period
  const selImp = days.reduce((s,d)=>s+d.i, 0);

  // Ratio against full campaign (total or channel)
  const fullImp = chKey ? chBase.imp : FULL_IMP;
  const ratio = selImp / fullImp;
  const isPartial = ratio < 0.995;

  // Budget
  const fullBud = chKey ? chBase.budget : FULL_BUD;
  const budget = chKey
    ? days.reduce((s,d)=>s+(d._budget||0), 0)
    : FULL_BUD * ratio;

  // Alcance: unique reach grows sub-linearly
  const fullAlc = chKey ? chBase.alc : FULL_ALC;
  const alcRaw = fullAlc * Math.pow(ratio, 0.65);
  const alc = Math.min(alcRaw, fullAlc);

  // Frequência
  const freq = alc > 0 ? +(selImp / alc).toFixed(1) : (chKey ? chBase.cpm : BASE.targets.freq);

  // CPM: use channel CPM when filtered, with slight variation
  const firstDayOff = Math.floor((new Date(days[0].d+' 12:00') - new Date('2026-01-05 12:00')) / 86400000 / 7);
  const cpmVariation = firstDayOff < 4 ? 0.04 : firstDayOff > 8 ? -0.03 : 0;
  const cpm = chKey
    ? +(chBase.cpm + cpmVariation).toFixed(2)
    : +(5.13 + (firstDayOff < 4 ? 0.08 : firstDayOff > 8 ? -0.05 : 0) + (ratio < 0.3 ? 0.12 : 0)).toFixed(2);

  const fullVviews = chKey ? chBase.vviews : FULL_VVIEWS;
  const vviews = +(fullVviews * ratio).toFixed(1);
  const cpv = vviews > 0 ? budget / (vviews * 1000000) : 0;

  const maxRecall = 72, k = 2.5;
  const fullRecall = chKey ? chBase.recall : 72;
  const recall = Math.round(fullRecall * (1 - Math.exp(-k * ratio)));

  // Channels list — when filtered show only the selected channel
  const channels = chKey
    ? [chBase].map(ch => ({
        ...ch,
        imp: +selImp.toFixed(1),
        alc: +alc.toFixed(2),
        budget: Math.round(budget),
        recall,
        vviews: +vviews.toFixed(2),
      }))
    : BASE.channels.map(ch => ({
        ...ch,
        imp: +(ch.imp * ratio).toFixed(1),
        alc: +(ch.alc * Math.pow(ratio, 0.65)).toFixed(2),
        budget: Math.round(ch.budget * ratio),
        recall: Math.round(maxRecall * ch.recall/72 * (1 - Math.exp(-k * ratio))),
        vviews: +(ch.vviews * ratio).toFixed(2),
      }));

  const freqDist = computeFreqDist(freq);

  const liftScale = Math.min(1, Math.pow(ratio, 0.45) * 1.05);
  const lift = BASE.lift.map(l => {
    const scaledLift = Math.max(0, Math.round(l.lift * liftScale));
    return {...l, lift: scaledLift, after: Math.round(l.before + scaledLift), estimated: isPartial};
  });

  // Prev period — use channel-specific prev when filtered
  const prevImp    = chKey ? BASE.prev.imp * chBase.share/100    : BASE.prev.imp;
  const prevAlc    = chKey ? BASE.prev.alc * Math.pow(chBase.share/100, 0.7) : BASE.prev.alc;
  const prevBudget = chKey ? BASE.prev.budget * chBase.share/100  : BASE.prev.budget;
  const prevVviews = chKey ? BASE.prev.vviews * (chBase.vviews/(FULL_VVIEWS||1)) : BASE.prev.vviews;
  const prevScale  = ratio;
  const deltas = {
    budget: pctDelta(budget, prevBudget * prevScale),
    imp:    pctDelta(selImp, prevImp * prevScale),
    alc:    pctDelta(alc,    prevAlc * Math.pow(prevScale, 0.65)),
    freq:   pctDelta(freq,   BASE.prev.freq * (0.7 + 0.3*prevScale)),
    cpm:    pctDelta(cpm,    chKey ? chBase.cpm * 1.08 : BASE.prev.cpm),
    vviews: pctDelta(vviews, +(prevVviews * prevScale).toFixed(1)),
    cpv:    pctDelta(cpv,    BASE.prev.cpv * (chKey ? chBase.cpm/5.5 : 1)),
  };

  // Targets — when filtered use channel-specific targets
  const targets = chKey
    ? {
        budget: chBase.budget,
        imp:    chBase.imp,
        alc:    chBase.alc,
        freq:   chBase.imp / chBase.alc,
        cpm:    chBase.cpm,
        vviews: chBase.vviews,
        cpv:    chBase.vviews > 0 ? chBase.budget / (chBase.vviews * 1000000) : 0,
      }
    : BASE.targets;

  // Period progress: elapsed days within planned campaign window (CAMP_START..CAMP_END)
  // Clamps so dates outside the planned window don't inflate the bar.
  const totalDays = FULL_DAYS;
  const ms = 86400000;
  const elapsedStart = new Date(start) > new Date(CAMP_START) ? new Date(start) : new Date(CAMP_START);
  const elapsedEnd   = new Date(end)   < new Date(CAMP_END)   ? new Date(end)   : new Date(CAMP_END);
  const daysInPeriod = Math.max(0, Math.round((elapsedEnd - elapsedStart) / ms) + 1);
  const daysRatio    = totalDays > 0 ? Math.min(daysInPeriod / totalDays, 1) : 0;

  return { days, isEmpty:false, ratio, isPartial, chKey,
    kpis:{budget, imp:selImp, alc, freq, cpm, vviews, cpv, recall},
    deltas, channels, lift, freqDist, targets,
    daysInPeriod, totalDays, daysRatio };
}

function pctDelta(curr, prev) {
  if (!prev || prev===0) return 0;
  return +((curr-prev)/prev*100).toFixed(1);
}

function computeFreqDist(avgFreq) {
  const buckets = ['1–2×','3–5×','6–10×','11–15×','16+'];
  const centers = [1.5, 4, 8, 13, 20];
  const sigma = avgFreq * 0.8;
  const raw = centers.map(c => Math.exp(-0.5*Math.pow((c-avgFreq)/sigma,2)));
  const sum = raw.reduce((a,b)=>a+b,0);
  return buckets.map((r,i)=>({r, v: Math.round(raw[i]/sum*100)}));
}
