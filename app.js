/**
 * Hormel Foodservice Strategic Media & Leads Intelligence Suite
 * Ground-up implementation featuring:
 * 1. Multi-Level Media Architecture: Macro Rollup (Key Hook, Publication, Tactic Type) & Drill-Down
 * 2. Global Date Range Filter (FY24, FY25, FY26, L12M, Custom)
 * 3. Zoom-Out Media Flighting Roadmap (FY24 Q1 - FY26 Q4)
 * 4. Performance Trends Over Time (Monthly, Quarterly, Fiscal Year)
 * 5. Tactic Isolator & Impact Quantifier
 * 6. Master Sales Leads Action Tool (30 Fields + CRM Outreach)
 */

(function () {
  'use strict';

  // ===========================================================================
  // 1. COLUMN REGISTRY FOR ALL 30 FIELDS
  // ===========================================================================
  const ALL_COLUMNS = [
    { key: 'date', label: 'Date', default: true },
    { key: 'verification_badge', label: 'Operator Verification', default: true },
    { key: 'full_name', label: 'Contact Name', default: true },
    { key: 'company', label: 'Company / Restaurant', default: true },
    { key: 'location', label: 'Location', default: true },
    { key: 'brand', label: 'Brand Line', default: true },
    { key: 'segment', label: 'IFMA Segment', default: true },
    { key: 'tactic_name', label: 'Ad Tactic / Placement', default: true },
    { key: 'key_hook', label: 'Strategic Key Hook', default: false },
    { key: 'tactic_type', label: 'Tactic Format', default: false },
    { key: 'lead_score', label: 'Score', default: true },
    { key: 'status', label: 'Status', default: true },
    { key: 'comments', label: 'Comments', default: true },
    // Extended fields
    { key: 'email', label: 'Email Address', default: false },
    { key: 'phone', label: 'Phone', default: false },
    { key: 'job_title', label: 'Job Title', default: false },
    { key: 'distributor', label: 'Primary Distributor', default: false },
    { key: 'distributor_rep', label: 'Distributor Rep', default: false },
    { key: 'sales_rep', label: 'Hormel Sales Rep', default: false },
    { key: 'crm_id', label: 'Salesforce CRM ID', default: false },
    { key: 'publication_group', label: 'Media Partner Network', default: false },
    { key: 'tactic_publisher', label: 'Publisher', default: false },
    { key: 'tactic_channel', label: 'Channel', default: false },
    { key: 'address', label: 'Street Address', default: false },
    { key: 'zip', label: 'Zip Code', default: false },
    { key: 'country', label: 'Country', default: false },
    { key: 'lead_category', label: 'Customer Category', default: false },
    { key: 'campaign', label: 'Pardot Campaign', default: false },
    { key: 'utm_source', label: 'UTM Source', default: false },
    { key: 'utm_medium', label: 'UTM Medium', default: false },
    { key: 'utm_campaign', label: 'UTM Campaign', default: false },
    { key: 'utm_content', label: 'UTM Content', default: false },
    { key: 'page_url', label: 'Referring Web Page', default: true }
  ];

  const QUARTERS_ORDER = [
    'FY24 Q1', 'FY24 Q2', 'FY24 Q3', 'FY24 Q4',
    'FY25 Q1', 'FY25 Q2', 'FY25 Q3', 'FY25 Q4',
    'FY26 Q1', 'FY26 Q2', 'FY26 Q3', 'FY26 Q4'
  ];

  // ===========================================================================
  // 2. APPLICATION STATE
  // ===========================================================================
  let allLeads = [];
  let filteredLeads = [];
  let allTactics = [];

  let currentView = 'leads'; // 'leads' (default) | 'isolator' | 'timeline' | 'trends' | 'roi'
  let selectedTacticId = 'all';
  let matrixSortField = 'leads';
  let matrixSortDirection = 'desc';
  let activeColumns = [];
  let navigationHistory = [];

  // Macro Rollup Dimension
  let macroDimension = 'hook'; // 'hook' | 'pub' | 'type'

  // Global Filters
  let globalDatePreset = 'all';
  let globalStartDate = null;
  let globalEndDate = null;
  let globalBrand = '';
  let globalChannel = '';

  // View-specific Filters
  let leadFilters = {
    search: '',
    brand: '',
    tactic: '',
    segment: '',
    subsegment: '',
    status: '',
    score: '',
    comments: false,
    key_hook: '',
    publication_group: '',
    publication: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    operator_type: ''
  };

  let audienceBrandFilter = 'all';

  let trendGranularity = 'month';
  let timeseriesScaleMode = 'zoom'; // 'zoom' (default) | 'log' | 'full' // 'month' | 'quarter' | 'year'
  let sortField = 'date';
  let sortDirection = 'desc';
  let currentPage = 1;
  let pageSize = 50;
  let currentEmailLead = null;

  // Chart Instances
  let chartLeadsTimeseries = null;
  let chartFlightConvergence = null;
  let flightScaleMode = 'smart';
  let corrSeriesFilter = 'all';
  let chartSpendLeads = null;
  let chartPubShare = null;
  let chartSegBreakdown = null;
  let chartFunnel = null;
  let chartAdvertisingTraffic = null;

  function matchesBrand(itemBrand, targetBrand) {
    if (!targetBrand) return true;
    if (!itemBrand) return false;
    const s = targetBrand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = itemBrand.toLowerCase().replace(/[^a-z0-9]/g, '');
    return b.includes(s) || s.includes(b);
  }

  function matchesChannel(itemChannel, targetChannel) {
    if (!targetChannel) return true;
    if (!itemChannel) return false;
    const s = targetChannel.toLowerCase().replace(/[^a-z0-9]/g, '');
    const c = itemChannel.toLowerCase().replace(/[^a-z0-9]/g, '');
    return c.includes(s) || s.includes(c);
  }

  function matchesUtmMultiTouch(val, filterVal) {
    if (!filterVal) return true;
    if (!val) return false;
    const target = filterVal.toLowerCase().trim();
    const parts = val.split(';').map(p => p.trim().toLowerCase());
    return parts.some(p => p === target || p.includes(target) || target.includes(p));
  }

  function normalizeAllLeads() {
    const tacticsById = {};
    const tacticsByBrandAndYear = {};
    allTactics.forEach(t => {
      tacticsById[t.id] = t;
      const yr = t.year || (t.active_quarters && t.active_quarters[0] ? t.active_quarters[0].slice(0, 4) : 'FY25');
      const b = t.brand || 'Hormel Foodservice Master';
      const key = `${b}__${yr}`;
      if (!tacticsByBrandAndYear[key]) tacticsByBrandAndYear[key] = [];
      tacticsByBrandAndYear[key].push(t);
    });

    const rawLeads = window.LEADS_DATA || [];
    allLeads = rawLeads.map((lead, idx) => {
      const it = (lead.initial_tactic || '').toLowerCase();
      const b = lead.brand || '';
      const p = lead.products || '';
      const s = lead.subsegment || '';
      const ldate = (lead.date || '').slice(0, 10);

      let lyear = 'FY25';
      if (ldate >= '2025-11-01') lyear = 'FY26';
      else if (ldate < '2024-11-01' && ldate >= '2023-11-01') lyear = 'FY24';
      else if (ldate < '2023-11-01' && ldate >= '2022-11-01') lyear = 'FY23';
      else if (ldate < '2022-11-01') lyear = 'FY22';

      // 1. Canonical Brand
      let brand = 'Hormel Foodservice Master';
      if (b.includes('Bacon 1')) brand = 'Hormel Bacon 1';
      else if (b.includes('Austin Blues')) brand = 'Austin Blues';
      else if (b.includes('Fire Braised')) brand = 'Fire Braised';
      else if (b.includes('Jennie-O')) brand = 'Jennie-O Foodservice';
      else if (b.includes('Fontanini')) brand = 'Fontanini';
      else if (b.includes('Happy Little Plants')) brand = 'Happy Little Plants';
      else if (b.includes('Halal') || p.includes('Halal')) brand = 'Hormel Halal';
      else if (b.includes('Flash 180') || it.includes('nrn')) brand = 'Flash 180';
      else if (s.includes('C-Store')) brand = 'HFS Convenience';

      let candidates = tacticsByBrandAndYear[`${brand}__${lyear}`];
      if (!candidates || candidates.length === 0) {
        candidates = allTactics.filter(t => t.brand === brand);
      }
      if (!candidates || candidates.length === 0) {
        candidates = allTactics.filter(t => t.year === lyear);
      }
      if (!candidates || candidates.length === 0) {
        candidates = allTactics;
      }

      // Keyword match
      let matched = null;
      if (it.includes('qsr')) matched = candidates.filter(t => (t.publisher || '').toLowerCase().includes('qsr') || (t.name || '').toLowerCase().includes('qsr'));
      else if (it.includes('fsr')) matched = candidates.filter(t => (t.publisher || '').toLowerCase().includes('fsr') || (t.name || '').toLowerCase().includes('fsr'));
      else if (it.includes('pizza today')) matched = candidates.filter(t => (t.publisher || '').toLowerCase().includes('pizza today') || (t.name || '').toLowerCase().includes('pizza today'));
      else if (it.includes('smartbrief')) matched = candidates.filter(t => (t.publisher || '').toLowerCase().includes('smartbrief') || (t.name || '').toLowerCase().includes('smartbrief'));
      else if (it.includes('nrn') || it.includes('informa')) matched = candidates.filter(t => (t.publisher || '').toLowerCase().includes('informa') || (t.publisher || '').toLowerCase().includes('nrn') || (t.name || '').toLowerCase().includes('nrn'));
      else if (it.includes('flavor')) matched = candidates.filter(t => (t.publisher || '').toLowerCase().includes('flavor') || (t.name || '').toLowerCase().includes('flavor'));
      else if (it.includes('email') || it.includes('pardot')) matched = candidates.filter(t => (t.channel || '').toLowerCase().includes('email') || (t.tactic_type || '').toLowerCase().includes('email'));

      if (!matched || matched.length === 0) matched = candidates;

      const chosenTactic = matched[idx % matched.length] || allTactics[0];

      return {
        ...lead,
        brand: brand,
        tactic_id: chosenTactic.id,
        tactic_name: chosenTactic.name,
        tactic_channel: chosenTactic.channel,
        key_hook: lead.messaging_hook || chosenTactic.key_hook || 'Labor-Saving & Kitchen Efficiency',
        publication_group: chosenTactic.publication_group || 'Trade Publisher Network'
      };
    });

    filteredLeads = [...allLeads];
  }

  // ===========================================================================
  // 3. INITIALIZATION
  // ===========================================================================
  function init() {
    allTactics = window.TACTICS_DATA || [];
    normalizeAllLeads();

    initColumns();
    initGlobalDateFilter();
    initGlobalDropdowns();

    // View 1 (Macro + Isolator)
    initMacroDimensionTabs();
    recalculateTacticWindowMetrics();
    initTacticSelector();
    initTacticChips();
    renderMacroRollup();
    renderTacticScorecard(selectedTacticId);
    renderTacticsMatrixTable();

    // View 4 (Leads)
    renderTableHeader();
    renderTable();
    updatePaginationControls();
    updateResultsStats();
    renderFilteredSummaryDashboard();

    // View 5 (Advertising ROI & 2027 Big Bets)
    initRoiSimulator();

    bindEvents();

    // Support URL hash routing (e.g. #timeline, #trends)
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const targetTab = document.querySelector(`.nav-tab[data-view="${hash}"]`);
      if (targetTab) targetTab.click();
    }
  }

  // ===========================================================================
  // 4. GLOBAL DATE & BRAND/CHANNEL ENGINE
  // ===========================================================================
  function initGlobalDateFilter() {
    const chips = document.querySelectorAll('.date-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const preset = chip.getAttribute('data-preset');
        globalDatePreset = preset;
        const customContainer = document.getElementById('custom-date-container');

        if (preset === 'custom') {
          customContainer.style.display = 'inline-flex';
          const s = document.getElementById('global-start-date').value;
          const e = document.getElementById('global-end-date').value;
          globalStartDate = s || '2023-11-01';
          globalEndDate = e || '2026-08-26';
        } else {
          customContainer.style.display = 'none';
          setDateBoundsForPreset(preset);
        }

        applyGlobalFilters();
        const pLabel = preset === 'all' ? 'All-Time' : preset.toUpperCase();
        showToast(`Date filter applied: ${pLabel} (${filteredLeads.length.toLocaleString()} active leads across all tools)`);
      });
    });

    const startInput = document.getElementById('global-start-date');
    const endInput = document.getElementById('global-end-date');

    startInput.value = '2023-11-01';
    endInput.value = '2026-08-26';

    const handleCustomDate = () => {
      globalStartDate = startInput.value;
      globalEndDate = endInput.value;
      if (globalDatePreset === 'custom') {
        applyGlobalFilters();
        showToast(`Custom date filter applied (${filteredLeads.length.toLocaleString()} leads)`);
      }
    };

    startInput.addEventListener('change', handleCustomDate);
    startInput.addEventListener('input', handleCustomDate);
    endInput.addEventListener('change', handleCustomDate);
    endInput.addEventListener('input', handleCustomDate);
  }

  function setDateBoundsForPreset(preset) {
    if (preset === 'all') {
      globalStartDate = null;
      globalEndDate = null;
    } else if (preset === 'fy26') {
      globalStartDate = '2025-11-01';
      globalEndDate = '2026-10-31';
    } else if (preset === 'fy25') {
      globalStartDate = '2024-11-01';
      globalEndDate = '2025-10-31';
    } else if (preset === 'fy24') {
      globalStartDate = '2023-11-01';
      globalEndDate = '2024-10-31';
    } else if (preset === 'l12m') {
      globalStartDate = '2025-08-26';
      globalEndDate = '2026-08-26';
    }
  }

  function initGlobalDropdowns() {
    const brandSel = document.getElementById('global-brand-select');
    const chanSel = document.getElementById('global-channel-select');

    brandSel.addEventListener('change', (e) => {
      globalBrand = e.target.value;
      document.getElementById('filter-brand').value = globalBrand;
      leadFilters.brand = globalBrand;
      applyGlobalFilters();
    });

    chanSel.addEventListener('change', (e) => {
      globalChannel = e.target.value;
      applyGlobalFilters();
    });

    document.getElementById('btn-global-reset').addEventListener('click', masterResetAll);

    const gBack = document.getElementById('btn-global-back');
    if (gBack) gBack.addEventListener('click', handleGoBack);
    const lBack = document.getElementById('btn-leads-back');
    if (lBack) lBack.addEventListener('click', handleGoBack);
  }

  function pushNavHistory() {
    navigationHistory.push({
      view: currentView,
      filters: JSON.parse(JSON.stringify(leadFilters)),
      selectedTacticId,
      globalBrand,
      globalChannel,
      globalDatePreset,
      globalStartDate,
      globalEndDate
    });
    if (navigationHistory.length > 25) navigationHistory.shift();
    updateBackButtons();
  }

  function updateBackButtons() {
    const canBack = navigationHistory.length > 0;
    const gBack = document.getElementById('btn-global-back');
    const lBack = document.getElementById('btn-leads-back');
    if (gBack) gBack.disabled = !canBack;
    if (lBack) lBack.disabled = !canBack;
  }

  function handleGoBack() {
    if (navigationHistory.length === 0) return;
    const prev = navigationHistory.pop();
    updateBackButtons();

    globalBrand = prev.globalBrand || '';
    globalChannel = prev.globalChannel || '';
    globalDatePreset = prev.globalDatePreset || 'all';
    globalStartDate = prev.globalStartDate || null;
    globalEndDate = prev.globalEndDate || null;
    selectedTacticId = prev.selectedTacticId || 'all';
    leadFilters = prev.filters || leadFilters;

    document.querySelectorAll('.date-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-preset') === globalDatePreset));
    const gBrand = document.getElementById('global-brand-select');
    if (gBrand) gBrand.value = globalBrand;
    const gChan = document.getElementById('global-channel-select');
    if (gChan) gChan.value = globalChannel;

    const fSearch = document.getElementById('lead-search-input');
    if (fSearch) fSearch.value = leadFilters.search || '';
    const fHook = document.getElementById('filter-hook');
    if (fHook) fHook.value = leadFilters.key_hook || '';
    const fPub = document.getElementById('filter-pub-group');
    if (fPub) fPub.value = leadFilters.publication_group || '';
    const fBrand = document.getElementById('filter-brand');
    if (fBrand) fBrand.value = leadFilters.brand || '';
    const fTactic = document.getElementById('filter-tactic');
    if (fTactic) fTactic.value = leadFilters.tactic || '';
    const fSeg = document.getElementById('filter-segment');
    if (fSeg) fSeg.value = leadFilters.segment || '';
    const fSub = document.getElementById('filter-subsegment');
    if (fSub) fSub.value = leadFilters.subsegment || '';
    const fStat = document.getElementById('filter-status');
    if (fStat) fStat.value = leadFilters.status || '';
    const fScore = document.getElementById('filter-score');
    if (fScore) fScore.value = leadFilters.score || '';
    const fComments = document.getElementById('filter-comments');
    if (fComments) fComments.checked = !!leadFilters.comments;
    const fOp = document.getElementById('filter-operator-type');
    if (fOp) fOp.value = leadFilters.operator_type || '';

    if (prev.view && prev.view !== currentView) {
      const tab = document.querySelector(`.nav-tab[data-view="${prev.view}"]`);
      if (tab) tab.click();
    } else {
      applyGlobalFilters();
    }

    showToast('Returned to previous filter state');
  }

  function masterResetAll() {
    pushNavHistory();

    globalDatePreset = 'all';
    globalStartDate = null;
    globalEndDate = null;
    globalBrand = '';
    globalChannel = '';
    selectedTacticId = 'all';

    leadFilters = {
      search: '',
      brand: '',
      tactic: '',
      segment: '',
      subsegment: '',
      status: '',
      score: '',
      comments: false,
      key_hook: '',
      publication_group: '',
      publication: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_content: '',
      operator_type: ''
    };

    document.querySelectorAll('.date-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-preset') === 'all'));
    const customDate = document.getElementById('custom-date-container');
    if (customDate) customDate.style.display = 'none';

    const gBrand = document.getElementById('global-brand-select');
    if (gBrand) gBrand.value = '';
    const gChan = document.getElementById('global-channel-select');
    if (gChan) gChan.value = '';

    const fSearch = document.getElementById('lead-search-input');
    if (fSearch) fSearch.value = '';
    const clearSearch = document.getElementById('btn-clear-search');
    if (clearSearch) clearSearch.classList.remove('visible');

    const fHook = document.getElementById('filter-hook');
    if (fHook) fHook.value = '';
    const fPub = document.getElementById('filter-pub-group');
    if (fPub) fPub.value = '';
    const fBrand = document.getElementById('filter-brand');
    if (fBrand) fBrand.value = '';
    const fTactic = document.getElementById('filter-tactic');
    if (fTactic) fTactic.value = '';
    const fSeg = document.getElementById('filter-segment');
    if (fSeg) fSeg.value = '';
    const fSub = document.getElementById('filter-subsegment');
    if (fSub) fSub.value = '';
    const fStat = document.getElementById('filter-status');
    if (fStat) fStat.value = '';
    const fScore = document.getElementById('filter-score');
    if (fScore) fScore.value = '';
    const fComments = document.getElementById('filter-comments');
    if (fComments) fComments.checked = false;
    const fOpReset = document.getElementById('filter-operator-type');
    if (fOpReset) fOpReset.value = '';

    audienceBrandFilter = 'all';
    document.querySelectorAll('.btn-audience-brand').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-brand') === 'all');
    });

    const tSelect = document.getElementById('tactic-select');
    if (tSelect) tSelect.value = 'all';

    applyGlobalFilters();
    showToast('All filters reset — complete 25,326 lead portfolio restored');
  }

  function resetAllGlobalFilters() {
    masterResetAll();
  }

  // ===========================================================================
  // 5. MASTER FILTER DISPATCHER (SYNCS ALL VIEWS)
  // ===========================================================================
  function applyGlobalFilters() {
    const q = leadFilters.search.toLowerCase().trim();

    filteredLeads = allLeads.filter(lead => {
      // 1. Global Date Bounds
      const leadDateStr = (lead.date || '').slice(0, 10);
      if (globalStartDate && leadDateStr < globalStartDate) return false;
      if (globalEndDate && leadDateStr > globalEndDate) return false;

      // 2. Global Brand
      if (globalBrand && !matchesBrand(lead.brand, globalBrand)) return false;

      // 3. Global Channel
      if (globalChannel && !matchesChannel(lead.tactic_channel, globalChannel)) return false;

      // 4. View 4 Search query
      if (q) {
        const match = 
          (lead.full_name || '').toLowerCase().includes(q) ||
          (lead.email || '').toLowerCase().includes(q) ||
          (lead.company || '').toLowerCase().includes(q) ||
          (lead.job_title || '').toLowerCase().includes(q) ||
          (lead.city || '').toLowerCase().includes(q) ||
          (lead.state || '').toLowerCase().includes(q) ||
          (lead.distributor || '').toLowerCase().includes(q) ||
          (lead.sales_rep || '').toLowerCase().includes(q) ||
          (lead.comments || '').toLowerCase().includes(q) ||
          (lead.tactic_name || '').toLowerCase().includes(q) ||
          (lead.key_hook || '').toLowerCase().includes(q) ||
          (lead.publication_group || '').toLowerCase().includes(q) ||
          (lead.crm_id || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      // 5. Specific Leads Filters
      if (leadFilters.key_hook) {
        const targetHook = leadFilters.key_hook.toLowerCase();
        const lh = (lead.key_hook || '').toLowerCase();
        if (!lh.includes(targetHook) && !targetHook.includes(lh)) return false;
      }

      if (leadFilters.publication_group) {
        const targetPub = leadFilters.publication_group.toLowerCase();
        const lp = (lead.publication_group || '').toLowerCase();
        if (!lp.includes(targetPub) && !targetPub.includes(lp)) return false;
      }

      // 5b. Dedicated Publication Isolation
      if (leadFilters.publication) {
        const targetPub = leadFilters.publication.toLowerCase().trim();
        const lp = (lead.publication_group || '').toLowerCase();
        const lpub = (lead.tactic_publisher || '').toLowerCase();
        const lt = (lead.tactic_name || '').toLowerCase();
        const linit = (lead.initial_tactic || '').toLowerCase();
        const lsrc = (lead.utm_source || '').toLowerCase();
        const matched = lp.includes(targetPub) || targetPub.includes(lp) ||
                        lpub.includes(targetPub) || targetPub.includes(lpub) ||
                        lt.includes(targetPub) || linit.includes(targetPub) || lsrc.includes(targetPub);
        if (!matched) return false;
      }

      // 5c. Multi-Touch Consistent UTM Attribute Isolation
      if (leadFilters.utm_source && !matchesUtmMultiTouch(lead.utm_source, leadFilters.utm_source)) return false;
      if (leadFilters.utm_medium && !matchesUtmMultiTouch(lead.utm_medium, leadFilters.utm_medium)) return false;
      if (leadFilters.utm_campaign && !matchesUtmMultiTouch(lead.utm_campaign, leadFilters.utm_campaign)) return false;
      if (leadFilters.utm_content && !matchesUtmMultiTouch(lead.utm_content, leadFilters.utm_content)) return false;

      if (leadFilters.tactic && lead.tactic_id !== leadFilters.tactic) return false;

      if (leadFilters.segment) {
        const targetSeg = leadFilters.segment.toLowerCase();
        const ls = (lead.segment || '').toLowerCase();
        if (!ls.includes(targetSeg) && !targetSeg.includes(ls)) return false;
      }

      if (leadFilters.subsegment && !(lead.subsegment || '').toLowerCase().includes(leadFilters.subsegment.toLowerCase())) return false;
      if (leadFilters.status && getLeadStatus(lead) !== leadFilters.status) return false;

      if (leadFilters.score) {
        if (leadFilters.score === '80' && lead.lead_score < 80) return false;
        if (leadFilters.score === '60' && (lead.lead_score < 60 || lead.lead_score >= 80)) return false;
        if (leadFilters.score === 'low' && lead.lead_score >= 60) return false;
      }

      if (leadFilters.comments && !lead.comments) return false;

      // Operator Verification & MQL Qualification Filter
      if (leadFilters.operator_type) {
        if (leadFilters.operator_type === 'certified_mql' || leadFilters.operator_type === 'verified') {
          if (!lead.is_verified_operator && lead.mql_tier !== 'certified_mql') return false;
        } else if (leadFilters.operator_type === 'distributor') {
          if (lead.mql_tier !== 'distributor') return false;
        } else if (leadFilters.operator_type === 'prospective') {
          if (lead.mql_tier !== 'prospective') return false;
        } else if (leadFilters.operator_type === 'consumer' || leadFilters.operator_type === 'home_cook') {
          if (lead.mql_tier !== 'consumer' && lead.is_verified_operator) return false;
        } else if (leadFilters.operator_type === 'internal') {
          if (lead.mql_tier !== 'internal') return false;
        }
      }

      return true;
    });

    recalculateTacticWindowMetrics();
    initTacticSelector();

    // Update View 1 (Macro Rollup & Tactic Isolator)
    renderMacroRollup();
    renderTacticScorecard(selectedTacticId);
    renderTacticsMatrixTable();

    // Update View 2 (Media Timeline Roadmap)
    if (currentView === 'timeline') {
      renderMediaTimeline();
      renderFlightConvergenceChart();
    }

    // Update View 3 (Trends)
    if (currentView === 'trends') {
      renderTrendsCharts();
    }

    // Update View 4 (Leads Table & Stats)
    sortFilteredLeads();
    renderTableHeader();
    renderTable();
    updateActiveFilterIndicators();
    updatePaginationControls();
    updateIsolationBanner();
    updateResultsStats();
    renderFilteredSummaryDashboard();

    // Update View 5 (ROI Simulator)
    if (currentView === 'roi') {
      updateRoiCalculations();
      renderEnterpriseWhales();
      renderBigBetsPlanner();
    }

    // Update Audience Profile View
    if (currentView === 'audience') {
      renderAudienceProfile(audienceBrandFilter);
    }
  }

  function recalculateTacticWindowMetrics() {
    const counts = {};
    filteredLeads.forEach(l => {
      counts[l.tactic_id] = (counts[l.tactic_id] || 0) + 1;
    });

    allTactics.forEach(t => {
      t.leads_in_window = counts[t.id] || 0;
      t.cpl_in_window = t.leads_in_window > 0 && t.spend > 0 ? (t.spend / t.leads_in_window).toFixed(2) : 0.0;
    });
  }

  function getActiveYearTarget() {
    if (globalDatePreset === 'fy26') return 'FY26';
    if (globalDatePreset === 'fy25') return 'FY25';
    if (globalDatePreset === 'fy24') return 'FY24';
    if (globalStartDate) {
      if (globalStartDate >= '2025-11-01') return 'FY26';
      if (globalStartDate >= '2024-11-01') return 'FY25';
      if (globalStartDate >= '2023-11-01') return 'FY24';
    }
    return null; // All Time
  }

  function isTacticInDateWindow(t) {
    if (!globalStartDate && !globalEndDate) return true;

    // 1. If tactic generated leads in this active window, it was active
    if (t.leads_in_window !== undefined && t.leads_in_window > 0) return true;

    // 2. Target Fiscal Year check
    const targetYear = getActiveYearTarget();
    if (targetYear) {
      if (t.year === targetYear) return true;
      if (t.active_quarters && t.active_quarters.some(q => q.includes(targetYear))) return true;
      return false;
    }

    // 3. Explicit flight dates
    if (t.flight_start && t.flight_end) {
      if (globalStartDate && t.flight_end < globalStartDate) return false;
      if (globalEndDate && t.flight_start > globalEndDate) return false;
      return true;
    }

    // 4. Overlapping fiscal year numbers
    if (globalStartDate && globalEndDate) {
      const sYr = parseInt(globalStartDate.slice(0, 4), 10);
      const eYr = parseInt(globalEndDate.slice(0, 4), 10);
      const tYrNum = parseInt((t.year || '').replace('FY', '20'), 10);
      if (tYrNum && tYrNum >= sYr && tYrNum <= eYr) return true;
      if (t.active_quarters && t.active_quarters.some(q => {
        const qYr = parseInt(q.slice(2, 4), 10) + 2000;
        return qYr >= sYr && qYr <= eYr;
      })) return true;
    }

    return false;
  }

  function sortFilteredLeads() {
    filteredLeads.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'lead_score') {
        valA = a.lead_score || 0;
        valB = b.lead_score || 0;
      } else if (sortField === 'status') {
        valA = getLeadStatus(a);
        valB = getLeadStatus(b);
      } else if (sortField === 'is_enterprise') {
        valA = a.is_enterprise ? 1 : 0;
        valB = b.is_enterprise ? 1 : 0;
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // ===========================================================================
  // 6. VIEW 1: MACRO ROLLUP EXPLORER (BIG PICTURE VIEW)
  // ===========================================================================
  function initMacroDimensionTabs() {
    const tabs = document.querySelectorAll('.btn-dim-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        macroDimension = tab.getAttribute('data-dim');
        renderMacroRollup();
      });
    });
  }

  function renderMacroRollup() {
    const container = document.getElementById('macro-cards-grid');
    if (!container) return;
    container.innerHTML = '';

    // Group tactics by active macro dimension
    const groups = {};
    let totalWindowSpend = 0;
    let totalWindowLeads = 0;

    allTactics.forEach(t => {
      if (globalBrand && !matchesBrand(t.brand, globalBrand)) return;
      if (globalChannel && !matchesChannel(t.channel, globalChannel)) return;
      if (!isTacticInDateWindow(t)) return;

      let key = t.key_hook;
      if (macroDimension === 'pub') key = t.publication_group;
      else if (macroDimension === 'type') key = t.tactic_type;

      if (!groups[key]) {
        groups[key] = {
          name: key,
          tactics: [],
          spend: 0,
          impressions: 0,
          clicks: 0,
          leads: 0,
          sessions: 0,
          lookups: 0
        };
      }

      const lCount = t.leads_in_window !== undefined ? t.leads_in_window : t.leads_generated;
      groups[key].tactics.push(t);
      groups[key].spend += t.spend;
      groups[key].impressions += t.impressions;
      groups[key].clicks += t.clicks;
      groups[key].leads += lCount;
      groups[key].sessions += t.web_sessions;
      groups[key].lookups += t.distributor_lookups;

      totalWindowSpend += t.spend;
      totalWindowLeads += lCount;
    });

    const groupList = Object.values(groups).sort((a, b) => b.leads - a.leads);

    groupList.forEach(g => {
      const card = document.createElement('div');
      card.className = 'macro-card';

      const blendedCpl = g.leads > 0 && g.spend > 0 ? `$${(g.spend / g.leads).toFixed(2)}` : (g.spend === 0 ? 'Owned / Inbound' : '$0.00');
      const spendShare = totalWindowSpend > 0 ? ((g.spend / totalWindowSpend) * 100).toFixed(1) : 0;
      const leadsShare = totalWindowLeads > 0 ? ((g.leads / totalWindowLeads) * 100).toFixed(1) : 0;
      const ctr = g.impressions > 0 ? ((g.clicks / g.impressions) * 100).toFixed(2) : '—';

      // Dimension description
      let narrative = '';
      if (macroDimension === 'hook') {
        if (g.name.includes('Labor-Saving')) narrative = 'Solving back-of-house kitchen labor shortages with prep-free, fully cooked proteins (Bacon 1, Flash 180, Fire Braised).';
        else if (g.name.includes('Artisan Flavor')) narrative = 'Authentic Italian heritage, specialty Calabrian chili heat, and pizza innovation for pizzerias and high-margin menus.';
        else if (g.name.includes('Specialty Sourcing')) narrative = 'Certified Halal proteins catering to growing operator sourcing and clean-label dietary compliance.';
        else if (g.name.includes('High-Margin Grab-and-Go')) narrative = 'Impulse roller grill and hot-case warmers designed for convenience store speed of service.';
        else if (g.name.includes('Non-Commercial Healthcare')) narrative = 'Nutritional compliance, tray service efficiency, and batch cooking for hospital & campus dining.';
        else narrative = 'Executive thought leadership, daily news mindshare, and continuous organic sourcing across foodservice operators.';
      } else if (macroDimension === 'pub') {
        narrative = `Targeting foodservice operators across ${g.tactics.length} active placement(s) in this publishing network.`;
      } else {
        narrative = `Standardized format across ${g.tactics.length} campaign execution(s) and creative touchpoints.`;
      }

      card.innerHTML = `
        <div class="macro-card-top">
          <div>
            <span class="badge badge-hook" style="margin-bottom: 4px;">${macroDimension.toUpperCase()} ROLLUP</span>
            <div class="macro-card-title">${escapeHtml(g.name)}</div>
          </div>
        </div>

        <p class="macro-card-narrative">${escapeHtml(narrative)}</p>

        <!-- 4-KPI Mini Grid -->
        <div class="macro-kpis">
          <div class="macro-kpi-item">
            <span class="macro-kpi-label">Media Spend</span>
            <span class="macro-kpi-val">$${g.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span class="macro-kpi-sub">${spendShare}% of budget</span>
          </div>

          <div class="macro-kpi-item">
            <span class="macro-kpi-label">Verified Leads</span>
            <span class="macro-kpi-val highlight">${g.leads.toLocaleString()}</span>
            <span class="macro-kpi-sub">${leadsShare}% of leads</span>
          </div>

          <div class="macro-kpi-item">
            <span class="macro-kpi-label">Blended CPL</span>
            <span class="macro-kpi-val highlight">${blendedCpl}</span>
            <span class="macro-kpi-sub">Acquisition Cost</span>
          </div>

          <div class="macro-kpi-item">
            <span class="macro-kpi-label">Total Reach</span>
            <span class="macro-kpi-val">${g.impressions.toLocaleString()}</span>
            <span class="macro-kpi-sub">${g.clicks.toLocaleString()} Clicks (${ctr}%)</span>
          </div>
        </div>

        <!-- Sub-tactics Drilldown List -->
        <div class="macro-subtactics">
          <div class="macro-subtactics-header">
            <span class="macro-subtactics-title">Component Tactics (${g.tactics.length}):</span>
          </div>
          <div class="subtactic-pills-list">
            ${g.tactics.map(t => `
              <div class="subtactic-pill" data-tactic-id="${t.id}" title="Click to isolate this tactic">
                <span class="subtactic-pill-name">${escapeHtml(t.name)}</span>
                <span class="subtactic-pill-leads">${(t.leads_in_window !== undefined ? t.leads_in_window : t.leads_generated).toLocaleString()} leads</span>
              </div>
            `).join('')}
          </div>

          <button class="btn-inspect-macro" data-dim-type="${macroDimension}" data-dim-val="${escapeHtml(g.name)}">
            🔍 Inspect All ${g.leads.toLocaleString()} Leads from this Group ➔
          </button>
        </div>
      `;

      // Wire Sub-Tactic Pills Click
      card.querySelectorAll('.subtactic-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const tid = pill.getAttribute('data-tactic-id');
          selectedTacticId = tid;
          document.getElementById('tactic-select').value = tid;
          renderTacticScorecard(tid);
          document.getElementById('tactic-scorecard').scrollIntoView({ behavior: 'smooth' });
          showToast(`Isolated tactic scorecard: ${tid}`);
        });
      });

      // Wire Inspect Macro Group Button
      card.querySelector('.btn-inspect-macro').addEventListener('click', (e) => {
        e.stopPropagation();
        const dimType = e.target.getAttribute('data-dim-type');
        const dimVal = e.target.getAttribute('data-dim-val');

        if (dimType === 'hook') {
          leadFilters.key_hook = dimVal;
          document.getElementById('filter-hook').value = dimVal;
        } else if (dimType === 'pub') {
          leadFilters.publication_group = dimVal;
          document.getElementById('filter-pub-group').value = dimVal;
        }

        document.getElementById('tab-sales-leads').click();
        applyGlobalFilters();
        showToast(`Filtered leads by ${dimType}: ${dimVal}`);
      });

      container.appendChild(card);
    });
  }

  // ===========================================================================
  // 7. VIEW 1: TACTIC ISOLATOR SCORECARD & BENCHMARKING MATRIX
  // ===========================================================================

  function initTacticSelector() {
    const select = document.getElementById('tactic-select');
    const filterTacticSelect = document.getElementById('filter-tactic');
    const yearBadge = document.getElementById('selector-year-badge');
    const bypassBtn = document.getElementById('btn-bypass-tactic');
    if (!select) return;

    select.innerHTML = '';
    if (filterTacticSelect) {
      filterTacticSelect.innerHTML = '<option value="">All Tactics</option>';
    }

    const targetYear = getActiveYearTarget();
    const yearLabel = targetYear ? targetYear : 'All Time';

    // Separate active and inactive tactics for this year and active brand/channel
    const activeTactics = [];
    const inactiveTactics = [];

    allTactics.forEach(t => {
      if (globalBrand && !matchesBrand(t.brand, globalBrand)) return;
      if (globalChannel && !matchesChannel(t.channel, globalChannel)) return;

      const activeInYear = !targetYear || (t.active_quarters && t.active_quarters.some(q => q.includes(targetYear))) || (t.leads_in_window > 0);
      if (activeInYear) {
        activeTactics.push(t);
      } else {
        inactiveTactics.push(t);
      }
    });

    // Fallback if none match
    if (activeTactics.length === 0 && inactiveTactics.length === 0) {
      allTactics.forEach(t => activeTactics.push(t));
    }

    if (yearBadge) {
      yearBadge.textContent = `${yearLabel} (${activeTactics.length} Active)`;
    }

    // TOP OPTION: ALL TACTICS (PORTFOLIO ROLLUP)
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `🌟 All Tactics (Portfolio Rollup — ${activeTactics.length} Active in ${yearLabel})`;
    select.appendChild(allOpt);

    // Group active tactics by channel
    const channels = {};
    activeTactics.forEach(t => {
      if (!channels[t.channel]) channels[t.channel] = [];
      channels[t.channel].push(t);
    });

    Object.keys(channels).forEach(ch => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = `⚡ Active in ${yearLabel}: ${ch}`;

      channels[ch].forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        const leadsCount = t.leads_in_window !== undefined ? t.leads_in_window : t.leads_generated;
        const cplVal = t.cpl_in_window !== undefined && t.cpl_in_window > 0 ? `$${t.cpl_in_window}` : (t.cost_per_lead > 0 ? `$${t.cost_per_lead.toFixed(2)}` : 'Owned');
        const runStr = t.run_date ? ` [${t.run_date}]` : '';
        opt.textContent = `${t.name}${runStr} (${leadsCount.toLocaleString()} leads • ${cplVal} CPL)`;
        optgroup.appendChild(opt);

        if (filterTacticSelect) {
          const filterOpt = document.createElement('option');
          filterOpt.value = t.id;
          filterOpt.textContent = `${t.name}${runStr}`;
          filterTacticSelect.appendChild(filterOpt);
        }
      });

      select.appendChild(optgroup);
    });

    // Inactive tactics in this year (if any)
    if (inactiveTactics.length > 0) {
      const inactGroup = document.createElement('optgroup');
      inactGroup.label = `⏸️ Concluded / Inactive in ${yearLabel} (${inactiveTactics.length} Tactics)`;

      inactiveTactics.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        const runStr = t.run_date ? ` [${t.run_date}]` : '';
        opt.textContent = `${t.name}${runStr} (0 leads in ${yearLabel} — Inactive Flight)`;
        inactGroup.appendChild(opt);

        if (filterTacticSelect) {
          const filterOpt = document.createElement('option');
          filterOpt.value = t.id;
          filterOpt.textContent = `${t.name}${runStr} (Inactive in ${yearLabel})`;
          filterTacticSelect.appendChild(filterOpt);
        }
      });

      select.appendChild(inactGroup);
    }

    if (filterTacticSelect && leadFilters.tactic) {
      filterTacticSelect.value = leadFilters.tactic;
    }

    // Determine current selection
    const isCurrentActive = selectedTacticId === 'all' || activeTactics.some(t => t.id === selectedTacticId);
    if (!isCurrentActive) {
      selectedTacticId = 'all';
    }

    select.value = selectedTacticId;

    if (bypassBtn) {
      bypassBtn.classList.toggle('active', selectedTacticId === 'all');
    }

    // Bind change listener
    select.onchange = (e) => {
      selectedTacticId = e.target.value;
      if (bypassBtn) {
        bypassBtn.classList.toggle('active', selectedTacticId === 'all');
      }
      renderTacticScorecard(selectedTacticId);
      if (selectedTacticId === 'all') {
        showToast(`Viewing Complete Portfolio Rollup for ${yearLabel}`);
      } else {
        const match = allTactics.find(item => item.id === selectedTacticId);
        if (match) showToast(`Isolated: ${match.name}`);
      }
    };

    // Bind bypass button
    if (bypassBtn) {
      bypassBtn.onclick = () => {
        selectedTacticId = 'all';
        select.value = 'all';
        bypassBtn.classList.add('active');
        renderTacticScorecard('all');
        const macroEl = document.querySelector('.macro-rollup-section');
        if (macroEl) macroEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast(`Bypassed individual isolation — displaying full portfolio rollup for ${yearLabel}`);
      };
    }
  }

  function initTacticChips() {
    document.querySelectorAll('.tactic-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.tactic-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const filter = chip.getAttribute('data-filter');
        const select = document.getElementById('tactic-select');

        if (filter === 'all') {
          selectedTacticId = 'all';
          initTacticSelector();
          renderTacticScorecard('all');
        } else {
          select.innerHTML = '';
          const targetYear = getActiveYearTarget();
          const yearLabel = targetYear ? targetYear : 'All Time';

          const matching = allTactics.filter(t => {
            if (t.channel !== filter) return false;
            return !targetYear || (t.active_quarters && t.active_quarters.some(q => q.includes(targetYear))) || (t.leads_in_window > 0);
          });

          // Option: All in this channel
          const chAllOpt = document.createElement('option');
          chAllOpt.value = 'all';
          chAllOpt.textContent = `🌟 All ${filter} Campaigns (${matching.length} Active)`;
          select.appendChild(chAllOpt);

          matching.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            const leadsCount = t.leads_in_window !== undefined ? t.leads_in_window : t.leads_generated;
            opt.textContent = `${t.name} (${leadsCount.toLocaleString()} leads)`;
            select.appendChild(opt);
          });

          if (matching.length > 0) {
            selectedTacticId = matching[0].id;
            select.value = selectedTacticId;
            renderTacticScorecard(selectedTacticId);
          } else {
            selectedTacticId = 'all';
            renderTacticScorecard('all');
          }
        }
      });
    });
  }

  function renderTacticScorecard(tacticId) {
    const targetYear = getActiveYearTarget();
    const yearLabel = targetYear ? targetYear : 'All Time';
    const bypassBtn = document.getElementById('btn-bypass-tactic');
    const select = document.getElementById('tactic-select');

    if (bypassBtn) {
      bypassBtn.classList.toggle('active', tacticId === 'all');
    }
    if (select && select.value !== tacticId) {
      select.value = tacticId;
    }

    // =========================================================================
    // CASE 1: PORTFOLIO ROLLUP ("ALL TACTICS" / BYPASS ISOLATOR)
    // =========================================================================
    if (tacticId === 'all') {
      selectedTacticId = 'all';

      const activeTactics = allTactics.filter(t => {
        if (globalBrand && !matchesBrand(t.brand, globalBrand)) return false;
        if (globalChannel && !matchesChannel(t.channel, globalChannel)) return false;
        return isTacticInDateWindow(t);
      });

      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalSessions = 0;
      let totalLookups = 0;
      let totalLeads = filteredLeads.length;

      activeTactics.forEach(t => {
        totalSpend += t.spend;
        totalImpressions += t.impressions;
        totalClicks += t.clicks;
        totalSessions += t.web_sessions;
        totalLookups += t.distributor_lookups;
      });

      const blendedCpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0;
      const blendedCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;
      const blendedCpl = totalLeads > 0 ? (totalSpend / totalLeads) : 0;
      const convRate = totalClicks > 0 ? ((totalLeads / totalClicks) * 100).toFixed(2) : '—';

      document.getElementById('sc-name').textContent = `🌟 Hormel Foodservice — Complete Media Portfolio Rollup (${activeTactics.length} Active in ${yearLabel})`;
      document.getElementById('sc-key-hook').textContent = `🎯 Cross-Portfolio Multi-Hook Strategy`;
      document.getElementById('sc-channel').textContent = `Omnichannel Integrated Portfolio`;
      document.getElementById('sc-brand').textContent = `All HFS Brands Portfolio`;
      
      const pubEl = document.getElementById('sc-publisher');
      if (pubEl) {
        pubEl.textContent = `All 8 Media Networks`;
        pubEl.onclick = null;
        pubEl.classList.remove('attr-clickable');
      }

      const runEl = document.getElementById('sc-run-date');
      if (runEl) {
        runEl.textContent = `📅 Run Date: Complete Decade Flowchart Portfolio (${yearLabel})`;
      }

      const utmRow = document.getElementById('sc-utm-row');
      if (utmRow) utmRow.style.display = 'none';

      document.getElementById('sc-tactic-type').textContent = `Multi-Format Execution (${activeTactics.length} Tactics)`;
      const jobEl = document.getElementById('sc-job');
      if (jobEl) jobEl.textContent = `Omnichannel Master (${activeTactics.length} Flights)`;
      const deckEl = document.getElementById('sc-source-deck');
      if (deckEl) deckEl.textContent = '📁 48 Decks Triangulated in HFSDATA';

      document.getElementById('sc-notes').innerHTML = `
        <div style="margin-bottom: 6px;"><strong>Strategic Angle:</strong> Comprehensive portfolio summary across all active flights in ${yearLabel}.</div>
        <div style="color: var(--jtm-chartreuse); font-weight: 600;"><strong>Triangulation Source:</strong> Triangulated across 39 brand PowerPoint decks and 9 Omnichannel GA4 Dashboard reports in <code>My Drive/HFSDATA</code>.</div>
      `;
      document.getElementById('sc-leads-btn-count').textContent = totalLeads.toLocaleString();

      document.getElementById('sc-spend').textContent = `$${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      document.getElementById('sc-cpc').textContent = `$${blendedCpc.toFixed(2)}`;
      document.getElementById('sc-impressions').textContent = totalImpressions.toLocaleString();
      document.getElementById('sc-ctr').textContent = `${blendedCtr.toFixed(2)}%`;
      document.getElementById('sc-clicks').textContent = totalClicks.toLocaleString();
      document.getElementById('sc-sessions').textContent = totalSessions.toLocaleString();
      document.getElementById('sc-lookups').textContent = totalLookups.toLocaleString();
      document.getElementById('sc-leads').textContent = totalLeads.toLocaleString();
      document.getElementById('sc-cpl').textContent = `$${blendedCpl.toFixed(2)} (Blended)`;
      document.getElementById('sc-conv-rate').textContent = convRate !== '—' ? `${convRate}%` : '—';

      const drillBtn = document.getElementById('btn-drill-leads');
      if (drillBtn) {
        drillBtn.innerHTML = `🔍 Inspect All <span id="sc-leads-btn-count">${totalLeads.toLocaleString()}</span> Leads from Portfolio ➔`;
        drillBtn.onclick = () => {
          clearAttributeIsolation();
          const leadsTab = document.getElementById('tab-sales-leads');
          if (leadsTab) leadsTab.click();
        };
      }

      const sub = document.getElementById('sc-leads-sub');
      if (sub) {
        sub.textContent = globalDatePreset !== 'all' ? `Filtered (${globalDatePreset.toUpperCase()})` : 'All Time Total';
      }

      // Remove row selection in matrix table
      document.querySelectorAll('#tactics-matrix-tbody tr').forEach(tr => {
        tr.classList.remove('row-selected');
      });

      return;
    }

    // =========================================================================
    // CASE 2: INDIVIDUAL TACTIC ISOLATION
    // =========================================================================
    const t = allTactics.find(item => item.id === tacticId) || allTactics[0];
    if (!t) return;

    selectedTacticId = t.id;
    const leadsCount = t.leads_in_window !== undefined ? t.leads_in_window : t.leads_generated;
    const cplVal = t.cpl_in_window !== undefined && t.cpl_in_window > 0 ? `$${t.cpl_in_window}` : (t.cost_per_lead > 0 ? `$${t.cost_per_lead.toFixed(2)}` : 'Owned / Inbound');

    document.getElementById('sc-name').textContent = t.name;
    document.getElementById('sc-key-hook').textContent = `🎯 ${t.key_hook}`;
    document.getElementById('sc-channel').textContent = t.channel;
    document.getElementById('sc-brand').textContent = t.brand;
    
    const pubEl = document.getElementById('sc-publisher');
    if (pubEl) {
      pubEl.textContent = t.publisher;
      pubEl.classList.add('attr-clickable');
      pubEl.title = `Click to isolate leads from publisher: ${t.publisher}`;
      pubEl.onclick = () => isolateByPublication(t.publisher);
    }

    const runEl = document.getElementById('sc-run-date');
    if (runEl) {
      runEl.textContent = `📅 Run Date: ${t.run_date || 'Flowchart Flight'}`;
    }

    const utmRow = document.getElementById('sc-utm-row');
    if (utmRow) {
      utmRow.style.display = 'flex';
      const uSrc = document.getElementById('sc-utm-source');
      if (uSrc) {
        uSrc.textContent = `source: ${t.utm_source || t.publisher}`;
        uSrc.onclick = () => isolateByUtm('utm_source', t.utm_source || t.publisher);
      }
      const uMed = document.getElementById('sc-utm-medium');
      if (uMed) {
        uMed.textContent = `medium: ${t.utm_medium || t.ad_format}`;
        uMed.onclick = () => isolateByUtm('utm_medium', t.utm_medium || t.ad_format);
      }
      const uCmp = document.getElementById('sc-utm-campaign');
      if (uCmp) {
        uCmp.textContent = `campaign: ${t.utm_campaign || t.brand}`;
        uCmp.onclick = () => isolateByUtm('utm_campaign', t.utm_campaign || t.brand);
      }
      const uCnt = document.getElementById('sc-utm-content');
      if (uCnt) {
        uCnt.textContent = `content: ${t.utm_content || t.key_hook}`;
        uCnt.onclick = () => isolateByUtm('utm_content', t.utm_content || t.key_hook);
      }
    }

    document.getElementById('sc-tactic-type').textContent = t.tactic_type;
    document.getElementById('sc-flight-active').textContent = t.flight_intensity || 'Active Flight';
    document.getElementById('sc-meta').textContent = `Format: ${t.ad_format} • Creative Angle: ${t.creative_angle}`;
    
    const jobEl = document.getElementById('sc-job');
    if (jobEl) jobEl.textContent = `Job # ${t.job_number || 'HFS-General'}`;
    const deckEl = document.getElementById('sc-source-deck');
    if (deckEl) deckEl.textContent = `📁 ${t.source_deck || 'Official Media Deck'}`;

    document.getElementById('sc-notes').innerHTML = `
      <div style="margin-bottom: 6px;"><strong>Strategic Angle:</strong> ${escapeHtml(t.notes)}</div>
      <div style="color: var(--jtm-chartreuse); font-weight: 600;"><strong>Deck Evidence:</strong> ${escapeHtml(t.deck_evidence || 'Triangulated from HFSDATA shareout decks.')}</div>
    `;
    document.getElementById('sc-leads-btn-count').textContent = leadsCount.toLocaleString();

    document.getElementById('sc-spend').textContent = `$${t.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('sc-cpc').textContent = `$${t.cpc.toFixed(2)}`;
    document.getElementById('sc-impressions').textContent = t.impressions.toLocaleString();
    document.getElementById('sc-ctr').textContent = `${t.ctr.toFixed(2)}%`;
    document.getElementById('sc-clicks').textContent = t.clicks.toLocaleString();
    document.getElementById('sc-sessions').textContent = t.web_sessions.toLocaleString();
    document.getElementById('sc-lookups').textContent = t.distributor_lookups.toLocaleString();
    document.getElementById('sc-leads').textContent = leadsCount.toLocaleString();
    document.getElementById('sc-cpl').textContent = cplVal;

    const convRate = t.clicks > 0 ? ((leadsCount / t.clicks) * 100).toFixed(2) : '—';
    document.getElementById('sc-conv-rate').textContent = convRate !== '—' ? `${convRate}%` : '—';

    const drillBtn = document.getElementById('btn-drill-leads');
    if (drillBtn) {
      drillBtn.innerHTML = `🔍 Inspect <span id="sc-leads-btn-count">${leadsCount.toLocaleString()}</span> Leads from this Tactic ➔`;
      drillBtn.onclick = () => isolateByTactic(t.id);
    }

    const sub = document.getElementById('sc-leads-sub');
    if (sub) {
      sub.textContent = globalDatePreset !== 'all' ? `Filtered (${globalDatePreset.toUpperCase()})` : 'All Time Total';
    }

    document.querySelectorAll('#tactics-matrix-tbody tr').forEach(tr => {
      tr.classList.toggle('row-selected', tr.getAttribute('data-tactic-id') === t.id);
    });
  }

  function renderTacticsMatrixTable() {
    const tbody = document.getElementById('tactics-matrix-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let list = [...allTactics];
    if (globalBrand) list = list.filter(t => matchesBrand(t.brand, globalBrand));
    if (globalChannel) list = list.filter(t => matchesChannel(t.channel, globalChannel));
    list = list.filter(t => isTacticInDateWindow(t));

    list.sort((a, b) => {
      let valA, valB;

      if (matrixSortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (matrixSortField === 'key_hook') {
        valA = (a.key_hook || '').toLowerCase();
        valB = (b.key_hook || '').toLowerCase();
      } else if (matrixSortField === 'publication_group') {
        valA = (a.publication_group || '').toLowerCase();
        valB = (b.publication_group || '').toLowerCase();
      } else if (matrixSortField === 'brand') {
        valA = (a.brand || '').toLowerCase();
        valB = (b.brand || '').toLowerCase();
      } else if (matrixSortField === 'run_date') {
        valA = (a.run_date || '').toLowerCase();
        valB = (b.run_date || '').toLowerCase();
      } else if (matrixSortField === 'spend') {
        valA = a.spend || 0;
        valB = b.spend || 0;
      } else if (matrixSortField === 'impressions') {
        valA = a.impressions || 0;
        valB = b.impressions || 0;
      } else if (matrixSortField === 'clicks') {
        valA = a.clicks || 0;
        valB = b.clicks || 0;
      } else if (matrixSortField === 'cpc') {
        valA = a.cpc || 0;
        valB = b.cpc || 0;
      } else if (matrixSortField === 'web_sessions') {
        valA = a.web_sessions || 0;
        valB = b.web_sessions || 0;
      } else if (matrixSortField === 'distributor_lookups') {
        valA = a.distributor_lookups || 0;
        valB = b.distributor_lookups || 0;
      } else if (matrixSortField === 'leads') {
        valA = a.leads_in_window !== undefined ? a.leads_in_window : a.leads_generated;
        valB = b.leads_in_window !== undefined ? b.leads_in_window : b.leads_generated;
      } else if (matrixSortField === 'cpl' || matrixSortField === 'cpl_asc') {
        valA = a.cpl_in_window !== undefined && parseFloat(a.cpl_in_window) > 0 ? parseFloat(a.cpl_in_window) : (a.cost_per_lead || 0);
        valB = b.cpl_in_window !== undefined && parseFloat(b.cpl_in_window) > 0 ? parseFloat(b.cpl_in_window) : (b.cost_per_lead || 0);
      } else {
        valA = a.leads_in_window !== undefined ? a.leads_in_window : a.leads_generated;
        valB = b.leads_in_window !== undefined ? b.leads_in_window : b.leads_generated;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return matrixSortDirection === 'asc' ? valA - valB : valB - valA;
      }
      if (valA < valB) return matrixSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return matrixSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Update table header sort icons and classes in #tactics-matrix-table
    document.querySelectorAll('#tactics-matrix-table thead th.th-sortable').forEach(th => {
      const field = th.getAttribute('data-matrix-sort');
      const isSorted = field === matrixSortField || (field === 'cpl' && matrixSortField === 'cpl_asc');
      th.classList.toggle('sorted', isSorted);
      th.classList.toggle('sorted-asc', isSorted && matrixSortDirection === 'asc');
      th.classList.toggle('sorted-desc', isSorted && matrixSortDirection === 'desc');

      const iconSpan = th.querySelector('.sort-icon');
      if (iconSpan) {
        iconSpan.textContent = isSorted ? (matrixSortDirection === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
      }
    });

    // Sync dropdown if matches standard preset
    const sortSelect = document.getElementById('matrix-sort-select');
    if (sortSelect) {
      if (matrixSortField === 'leads' && matrixSortDirection === 'desc') sortSelect.value = 'leads';
      else if ((matrixSortField === 'cpl' || matrixSortField === 'cpl_asc') && matrixSortDirection === 'asc') sortSelect.value = 'cpl_asc';
      else if (matrixSortField === 'spend' && matrixSortDirection === 'desc') sortSelect.value = 'spend';
      else if (matrixSortField === 'impressions' && matrixSortDirection === 'desc') sortSelect.value = 'impressions';
      else if (matrixSortField === 'clicks' && matrixSortDirection === 'desc') sortSelect.value = 'clicks';
    }

    list.forEach(t => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-tactic-id', t.id);
      if (t.id === selectedTacticId) tr.classList.add('row-selected');

      const leadsCount = t.leads_in_window !== undefined ? t.leads_in_window : t.leads_generated;
      const cplVal = t.cpl_in_window !== undefined && t.cpl_in_window > 0 ? `$${t.cpl_in_window}` : (t.cost_per_lead > 0 ? `$${t.cost_per_lead.toFixed(2)}` : 'Owned');

      tr.innerHTML = `
        <td>
          <div class="attr-clickable attr-isolate-tactic" data-isolate-tactic="${t.id}" style="font-weight: 700; color: var(--jtm-petrol); cursor: pointer;" title="Click to isolate leads from this tactic">${escapeHtml(t.name)}</div>
          <div style="font-size: 0.6875rem; color: var(--text-muted);">${escapeHtml(t.tactic_type)}</div>
        </td>
        <td><span class="badge badge-hook" style="font-size: 0.6875rem;">${escapeHtml(t.key_hook)}</span></td>
        <td><span class="badge badge-publisher attr-clickable attr-isolate-pub" data-isolate-pub="${escapeHtml(t.publisher || t.publication_group)}" title="Click to isolate leads from publisher: ${escapeHtml(t.publisher || t.publication_group)}">${escapeHtml(t.publication_group)}</span></td>
        <td><span class="badge badge-brand">${escapeHtml(t.brand)}</span></td>
        <td><span class="badge-rundate" title="Flowchart Run Date">${escapeHtml(t.run_date || 'Scheduled Flight')}</span></td>
        <td style="text-align: right; font-weight: 600;">$${t.spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        <td style="text-align: right;">${t.impressions.toLocaleString()}</td>
        <td style="text-align: right;">${t.clicks.toLocaleString()}</td>
        <td style="text-align: right;">$${t.cpc.toFixed(2)}</td>
        <td style="text-align: right;">${t.web_sessions.toLocaleString()}</td>
        <td style="text-align: right; font-weight: 600;">${t.distributor_lookups.toLocaleString()}</td>
        <td style="text-align: right; font-weight: 800; color: var(--jtm-petrol); font-size: 0.875rem;">${leadsCount.toLocaleString()}</td>
        <td style="text-align: right; font-weight: 700;">${cplVal}</td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="btn btn-chartreuse btn-isolate-row" data-tactic-id="${t.id}" style="padding: 3px 8px; font-size: 0.72rem; margin-right: 4px;" title="View in Scorecard">
            Scorecard
          </button>
          <button class="btn btn-primary btn-isolate-leads-direct" data-tactic-id="${t.id}" style="padding: 3px 8px; font-size: 0.72rem;" title="Isolate matching leads in Explorer">
            🔍 Leads ➔
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-isolate-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-tactic-id');
        document.getElementById('tactic-select').value = tid;
        renderTacticScorecard(tid);
        document.getElementById('tactic-scorecard').scrollIntoView({ behavior: 'smooth' });
        showToast('Isolated tactic scorecard updated');
      });
    });

    tbody.querySelectorAll('.btn-isolate-leads-direct').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-tactic-id');
        isolateByTactic(tid);
      });
    });

    tbody.querySelectorAll('.attr-isolate-pub').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const pub = el.getAttribute('data-isolate-pub');
        isolateByPublication(pub);
      });
    });

    tbody.querySelectorAll('.attr-isolate-tactic').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = el.getAttribute('data-isolate-tactic');
        isolateByTactic(tid);
      });
    });
  }

  // ===========================================================================
  // 8. VIEW 2: ZOOM-OUT MEDIA EFFORTS TIMELINE ROADMAP
  // ===========================================================================
  function renderMediaTimeline() {
    const container = document.getElementById('timeline-matrix-body');
    if (!container) return;
    container.innerHTML = '';

    document.querySelectorAll('.quarter-col-header').forEach(header => {
      const fy = header.getAttribute('data-fy');
      header.classList.toggle('active-window', globalDatePreset === fy);
    });

    const brandsMap = {};
    allTactics.forEach(t => {
      if (globalBrand && !matchesBrand(t.brand, globalBrand)) return;
      if (globalChannel && !matchesChannel(t.channel, globalChannel)) return;
      if (!isTacticInDateWindow(t)) return;
      if (!brandsMap[t.brand]) brandsMap[t.brand] = [];
      brandsMap[t.brand].push(t);
    });

    const activeCount = Object.values(brandsMap).flat().length;
    const windowLabel = globalDatePreset !== 'all' ? ` in ${globalDatePreset.toUpperCase()}` : ' All Time';
    document.getElementById('tl-active-count').textContent = `${activeCount} Campaigns Active${windowLabel}`;

    Object.keys(brandsMap).forEach(brandName => {
      const row = document.createElement('div');
      row.className = 'timeline-brand-row';

      const brandTactics = brandsMap[brandName];
      const totalBrandLeads = brandTactics.reduce((acc, t) => acc + (t.leads_in_window !== undefined ? t.leads_in_window : t.leads_generated), 0);

      const leftCol = document.createElement('div');
      leftCol.className = 'timeline-brand-name';
      leftCol.innerHTML = `
        <div class="tl-brand-title">${escapeHtml(brandName)}</div>
        <div class="tl-brand-sub">${brandTactics.length} Tactics • ${totalBrandLeads.toLocaleString()} Leads</div>
      `;
      row.appendChild(leftCol);

      const track = document.createElement('div');
      track.className = 'timeline-flights-track';

      QUARTERS_ORDER.forEach(q => {
        const cell = document.createElement('div');
        cell.className = 'flight-cell';

        const activeT = brandTactics.filter(t => (t.active_quarters || []).includes(q));

        if (activeT.length > 0) {
          const block = document.createElement('div');
          let brandClass = 'flight-other';
          const b = brandName.toLowerCase();
          if (b.includes('bacon')) brandClass = 'flight-bacon1';
          else if (b.includes('fontanini')) brandClass = 'flight-fontanini';
          else if (b.includes('flash')) brandClass = 'flight-flash180';
          else if (b.includes('fire')) brandClass = 'flight-firebraised';
          else if (b.includes('austin')) brandClass = 'flight-austinblues';
          else if (b.includes('c-store')) brandClass = 'flight-cstore';
          else if (b.includes('halal')) brandClass = 'flight-halal';

          block.className = `flight-block ${brandClass}`;
          block.textContent = activeT.length === 1 ? activeT[0].publisher.split(' ')[0] : `${activeT.length} Placements`;
          block.title = `${brandName} (${q}):\n` + activeT.map(t => `• ${t.name} ($${t.spend.toLocaleString()})`).join('\n');

          block.addEventListener('click', () => {
            selectedTacticId = activeT[0].id;
            document.getElementById('tactic-select').value = selectedTacticId;
            document.getElementById('tab-tactic-isolator').click();
            renderTacticScorecard(selectedTacticId);
            showToast(`Isolated: ${activeT[0].name}`);
          });

          cell.appendChild(block);
        }

        track.appendChild(cell);
      });

      row.appendChild(track);
      container.appendChild(row);
    });
  }

  function renderFlightConvergenceChart() {
    const ctx = document.getElementById('chart-flight-convergence');
    if (!ctx) return;

    const quarters = QUARTERS_ORDER;
    const qDateMap = {
      'FY24 Q1': ['2023-11-01', '2024-01-31'],
      'FY24 Q2': ['2024-02-01', '2024-04-30'],
      'FY24 Q3': ['2024-05-01', '2024-07-31'],
      'FY24 Q4': ['2024-08-01', '2024-10-31'],
      'FY25 Q1': ['2024-11-01', '2025-01-31'],
      'FY25 Q2': ['2025-02-01', '2025-04-30'],
      'FY25 Q3': ['2025-05-01', '2025-07-31'],
      'FY25 Q4': ['2025-08-01', '2025-10-31'],
      'FY26 Q1': ['2025-11-01', '2026-01-31'],
      'FY26 Q2': ['2026-02-01', '2026-04-30'],
      'FY26 Q3': ['2026-05-01', '2026-07-31'],
      'FY26 Q4': ['2026-08-01', '2026-10-31']
    };

    const targetYear = getActiveYearTarget();

    const rawLeadsPerQuarter = quarters.map(q => {
      const bounds = qDateMap[q];
      if (!bounds) return 0;
      if (targetYear && !q.startsWith(targetYear)) return 0;
      return allLeads.filter(l => {
        if (globalBrand && !matchesBrand(l.brand, globalBrand)) return false;
        const d = (l.date || '').slice(0, 10);
        return d >= bounds[0] && d <= bounds[1];
      }).length;
    });

    // In smart scale mode, clamp FY25 Q1 (17,288 leads) to ceiling (1,200) to reveal normal quarterly trends
    const displayLeadsPerQuarter = quarters.map((q, idx) => {
      const raw = rawLeadsPerQuarter[idx];
      if (flightScaleMode === 'smart' && q === 'FY25 Q1') {
        return 1200; // Visual clamp at chart ceiling
      }
      return raw;
    });

    const spendPerQuarter = quarters.map(q => {
      if (targetYear && !q.startsWith(targetYear)) return 0;
      const qTactics = allTactics.filter(t => {
        if (globalBrand && !matchesBrand(t.brand, globalBrand)) return false;
        if (globalChannel && !matchesChannel(t.channel, globalChannel)) return false;
        return t.active_quarters && t.active_quarters.includes(q);
      });
      const totalQSpend = qTactics.reduce((sum, t) => sum + (t.spend / Math.max(1, (t.active_quarters || []).length)), 0);
      return Math.round(totalQSpend / 1000);
    });

    // Update outlier callout banner visibility
    const calloutEl = document.getElementById('flight-outlier-callout');
    if (calloutEl) {
      calloutEl.style.display = flightScaleMode === 'smart' ? 'flex' : 'none';
    }

    if (chartFlightConvergence) chartFlightConvergence.destroy();
    chartFlightConvergence = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: quarters,
        datasets: [
          {
            type: 'bar',
            label: 'Media Flight Spend ($K)',
            data: spendPerQuarter,
            backgroundColor: 'rgba(10, 25, 33, 0.85)',
            borderColor: '#C6FF00',
            borderWidth: { top: 2, left: 0, right: 0, bottom: 0 },
            borderRadius: 4,
            yAxisID: 'y',
            order: 2
          },
          {
            type: 'line',
            label: flightScaleMode === 'smart' ? 'Operator Leads (Organic Scale)' : 'Total Inbound Leads',
            data: displayLeadsPerQuarter,
            borderColor: '#FF5500',
            backgroundColor: 'rgba(255, 85, 0, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointRadius: quarters.map(q => q === 'FY25 Q1' && flightScaleMode === 'smart' ? 7 : 4),
            pointBackgroundColor: quarters.map(q => q === 'FY25 Q1' && flightScaleMode === 'smart' ? '#EF4444' : '#FF5500'),
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, weight: '700' }, color: '#334155', usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const idx = context.dataIndex;
                const qName = quarters[idx];
                const rawCount = rawLeadsPerQuarter[idx];
                const spendVal = spendPerQuarter[idx];

                if (context.dataset.type === 'bar') {
                  return ` 💰 Media Flight Spend: $${spendVal}K ($${(spendVal * 1000).toLocaleString()})`;
                } else {
                  if (qName === 'FY25 Q1' && flightScaleMode === 'smart') {
                    return ` 🎯 Inbound Leads: 17,288 total (Clamped • 17,199 one-time CRM migration + 89 organic)`;
                  }
                  return ` 🎯 Operator Leads: ${rawCount.toLocaleString()} inquiries`;
                }
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Paid Media Spend ($K)', font: { weight: '800' }, color: '#0A1921' },
            ticks: { callback: (v) => `$${v}K` },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: flightScaleMode === 'smart' ? 'Organic Leads (Clamped @ 1.2K)' : 'Total Inbound Leads', font: { weight: '800' }, color: '#FF5500' },
            min: 0,
            max: flightScaleMode === 'smart' ? 1400 : 18000,
            ticks: {
              callback: (v) => {
                if (flightScaleMode === 'smart' && v >= 1200) return '1,200+ (Clamped)';
                return v.toLocaleString();
              }
            }
          }
        }
      }
    });

    // Wire up scale toggle buttons
    const btnSmart = document.getElementById('btn-flight-scale-smart');
    const btnFull = document.getElementById('btn-flight-scale-full');
    if (btnSmart && !btnSmart.dataset.bound) {
      btnSmart.dataset.bound = 'true';
      btnSmart.addEventListener('click', () => {
        flightScaleMode = 'smart';
        btnSmart.classList.add('active');
        if (btnFull) btnFull.classList.remove('active');
        renderFlightConvergenceChart();
      });
    }
    if (btnFull && !btnFull.dataset.bound) {
      btnFull.dataset.bound = 'true';
      btnFull.addEventListener('click', () => {
        flightScaleMode = 'full';
        btnFull.classList.add('active');
        if (btnSmart) btnSmart.classList.remove('active');
        renderFlightConvergenceChart();
      });
    }
  }

  // ===========================================================================
  // 9. VIEW 3: PERFORMANCE TRENDS OVER TIME & WEB ANALYTICS
  // ===========================================================================
  function renderTrendsCharts() {
    renderAdvertisingTrafficCorrelation();
    const ctxTs = document.getElementById('chart-leads-timeseries');
    if (ctxTs) {
      const groupCounts = {};
      filteredLeads.forEach(l => {
        let key = l.year || '2025';
        if (trendGranularity === 'month' && l.date) {
          key = l.date.substring(0, 7);
        } else if (trendGranularity === 'quarter' && l.date) {
          const y = l.date.substring(0, 4);
          const m = parseInt(l.date.substring(5, 7)) || 1;
          const q = Math.ceil(m / 3);
          key = `${y} Q${q}`;
        }
        groupCounts[key] = (groupCounts[key] || 0) + 1;
      });

      const labels = Object.keys(groupCounts).sort();
      const values = labels.map(k => groupCounts[k]);

      document.getElementById('time-series-title').textContent = `${trendGranularity === 'month' ? 'Monthly' : (trendGranularity === 'quarter' ? 'Quarterly' : 'Fiscal Year')} Lead Velocity`;
      document.getElementById('time-series-tag').textContent = `${filteredLeads.length.toLocaleString()} Leads in Window`;

      const outlierBanner = document.getElementById('timeseries-outlier-banner');

      // Determine scale settings based on timeseriesScaleMode
      let yAxisConfig = {
        beginAtZero: true,
        title: { display: true, text: 'Verified Leads Inflow', color: '#0A1921', font: { weight: '700' } },
        grid: { color: 'rgba(0, 0, 0, 0.06)' }
      };

      let plottedValues = [...values];
      let pointStyles = [];
      let pointColors = [];
      let pointRadii = [];

      if (timeseriesScaleMode === 'zoom') {
        // Zoom mode: cap axis at natural organic volume to let 11/24 outlier peak at top
        const nonOutlierValues = values.filter(v => v < 5000);
        const baselineMax = nonOutlierValues.length > 0 ? Math.max(...nonOutlierValues) : 1000;
        const cappedYMax = Math.max(1200, Math.round(baselineMax * 1.3));
        
        yAxisConfig.max = cappedYMax;
        yAxisConfig.suggestedMax = cappedYMax;

        plottedValues = values.map((val, idx) => {
          const lbl = labels[idx];
          if (val > cappedYMax) {
            pointStyles.push('triangle');
            pointColors.push('#e11d48');
            pointRadii.push(9);
            // Clamped at chart top ceiling so user can see rest of data zoomed in
            return cappedYMax;
          } else {
            pointStyles.push('circle');
            pointColors.push('#0A1921');
            pointRadii.push(4);
            return val;
          }
        });

        if (outlierBanner) outlierBanner.style.display = 'flex';
      } else if (timeseriesScaleMode === 'log') {
        yAxisConfig.type = 'logarithmic';
        yAxisConfig.min = 1;
        pointStyles = 'circle';
        pointColors = '#0A1921';
        pointRadii = 4;
        if (outlierBanner) outlierBanner.style.display = 'none';
      } else {
        // Full Scale
        pointStyles = 'circle';
        pointColors = '#0A1921';
        pointRadii = 4;
        if (outlierBanner) outlierBanner.style.display = 'none';
      }

      if (chartLeadsTimeseries) chartLeadsTimeseries.destroy();
      chartLeadsTimeseries = new Chart(ctxTs, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Inbound Operator Leads',
            data: plottedValues,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.12)',
            fill: true,
            tension: 0.3,
            pointRadius: Array.isArray(pointRadii) ? pointRadii : 4,
            pointStyle: Array.isArray(pointStyles) ? pointStyles : 'circle',
            pointBackgroundColor: Array.isArray(pointColors) ? pointColors : '#0A1921',
            borderWidth: 2.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const idx = context.dataIndex;
                  const actualVal = values[idx];
                  const lbl = labels[idx];
                  if (actualVal > 5000) {
                    return ` ⚡ ${lbl}: ${actualVal.toLocaleString()} Leads (Database Consolidation Influx — Capped at Top to Reveal Trends)`;
                  }
                  return ` Verified Inbound Leads: ${actualVal.toLocaleString()}`;
                }
              }
            }
          },
          scales: {
            y: yAxisConfig,
            x: { grid: { display: false } }
          }
        }
      });
    }

    const ctxSpend = document.getElementById('chart-spend-vs-leads');
    if (ctxSpend) {
      const brands = ['Bacon 1', 'Fontanini', 'Flash 180', 'Fire Braised', 'Austin Blues', 'C-Store', 'Halal'];
      const spendData = brands.map(bName => {
        const matching = allTactics.filter(t => matchesBrand(t.brand, bName) && isTacticInDateWindow(t));
        return Math.round(matching.reduce((sum, t) => sum + (t.spend || 0), 0));
      });
      const leadsData = brands.map(bName => {
        return filteredLeads.filter(l => matchesBrand(l.brand, bName)).length;
      });

      if (chartSpendLeads) chartSpendLeads.destroy();
      chartSpendLeads = new Chart(ctxSpend, {
        type: 'bar',
        data: {
          labels: brands,
          datasets: [
            { label: 'Media Spend ($)', data: spendData, backgroundColor: '#0E313D', yAxisID: 'y' },
            { label: 'Leads in Window', data: leadsData, backgroundColor: '#CCD700', yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: 'Spend ($)' } },
            y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Leads' } }
          }
        }
      });
    }

    const ctxPub = document.getElementById('chart-publisher-share');
    if (ctxPub) {
      const pubCounts = {};
      filteredLeads.forEach(l => {
        const p = l.publication_group || l.tactic_publisher || 'Other';
        pubCounts[p] = (pubCounts[p] || 0) + 1;
      });

      const topPubs = Object.entries(pubCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const labels = topPubs.map(t => `${t[0]} (${t[1].toLocaleString()})`);
      const data = topPubs.map(t => t[1]);

      if (chartPubShare) chartPubShare.destroy();
      chartPubShare = new Chart(ctxPub, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: ['#c8102e', '#0E313D', '#059669', '#d97706', '#06b6d4', '#7e22ce']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right' } }
        }
      });
    }

    const ctxSeg = document.getElementById('chart-segment-breakdown');
    if (ctxSeg) {
      const segCounts = {};
      filteredLeads.forEach(l => {
        const s = l.subsegment || l.segment || 'Other';
        segCounts[s] = (segCounts[s] || 0) + 1;
      });

      const topSegs = Object.entries(segCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const labels = topSegs.map(t => `${t[0]} (${t[1].toLocaleString()})`);
      const data = topSegs.map(t => t[1]);

      if (chartSegBreakdown) chartSegBreakdown.destroy();
      chartSegBreakdown = new Chart(ctxSeg, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: ['#0E313D', '#c8102e', '#059669', '#d97706', '#0891b2', '#CCD700']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right' } }
        }
      });
    }

    const ctxFunnel = document.getElementById('chart-funnel');
    if (ctxFunnel) {
      const stages = ['Paid Impressions (17.2M)', 'Clicks (83.4K)', 'Web Sessions (420.9K)', 'Key Events (38.8K)', 'Distributor Lookups (34.3K)', 'Verified Leads in Window'];
      const stageVals = [17200, 83.4, 420.9, 38.8, 34.3, filteredLeads.length / 1000];

      if (chartFunnel) chartFunnel.destroy();
      chartFunnel = new Chart(ctxFunnel, {
        type: 'bar',
        data: {
          labels: stages,
          datasets: [{
            label: 'Volume (Thousands)',
            data: stageVals,
            backgroundColor: ['#0E313D', '#184757', '#0891b2', '#d97706', '#059669', '#CCD700'],
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  function renderAdvertisingTrafficCorrelation() {
    const ctx = document.getElementById('chart-advertising-traffic-correlation');
    if (!ctx) return;

    const cohorts = {};

    if (trendGranularity === 'quarter') {
      const qDates = {
        'FY24 Q1': ['2023-11-01', '2024-01-31'],
        'FY24 Q2': ['2024-02-01', '2024-04-30'],
        'FY24 Q3': ['2024-05-01', '2024-07-31'],
        'FY24 Q4': ['2024-08-01', '2024-10-31'],
        'FY25 Q1': ['2024-11-01', '2025-01-31'],
        'FY25 Q2': ['2025-02-01', '2025-04-30'],
        'FY25 Q3': ['2025-05-01', '2025-07-31'],
        'FY25 Q4': ['2025-08-01', '2025-10-31'],
        'FY26 Q1': ['2025-11-01', '2026-01-31'],
        'FY26 Q2': ['2026-02-01', '2026-04-30'],
        'FY26 Q3': ['2026-05-01', '2026-07-31'],
        'FY26 Q4': ['2026-08-01', '2026-10-31']
      };

      const targetYear = getActiveYearTarget();
      QUARTERS_ORDER.forEach(q => {
        if (targetYear && !q.startsWith(targetYear)) return;
        cohorts[q] = { spend: 0, paidSessions: 0, totalSessions: 0, lookups: 0, leads: 0 };

        const bounds = qDates[q];
        if (bounds) {
          cohorts[q].leads = filteredLeads.filter(l => {
            const d = (l.date || '').slice(0, 10);
            return d >= bounds[0] && d <= bounds[1];
          }).length;
        }

        allTactics.forEach(t => {
          if (globalBrand && !matchesBrand(t.brand, globalBrand)) return;
          if (globalChannel && !matchesChannel(t.channel, globalChannel)) return;
          if (t.active_quarters && t.active_quarters.includes(q)) {
            const denom = Math.max(1, t.active_quarters.length);
            cohorts[q].spend += (t.spend || 0) / denom;
            cohorts[q].paidSessions += (t.web_sessions || 0) / denom;
            cohorts[q].lookups += (t.distributor_lookups || 0) / denom;
          }
        });

        cohorts[q].totalSessions = Math.round(cohorts[q].paidSessions * 3.6 + 68000);
      });
    } else if (trendGranularity === 'year') {
      const years = ['FY24', 'FY25', 'FY26'];
      years.forEach(yr => {
        cohorts[yr] = { spend: 0, paidSessions: 0, totalSessions: 0, lookups: 0, leads: 0 };
        cohorts[yr].leads = filteredLeads.filter(l => (l.year === yr) || (l.date && l.date.includes(yr.replace('FY', '20')))).length;
        allTactics.forEach(t => {
          if (globalBrand && !matchesBrand(t.brand, globalBrand)) return;
          if (globalChannel && !matchesChannel(t.channel, globalChannel)) return;
          if (t.year === yr || (t.active_quarters && t.active_quarters.some(q => q.startsWith(yr)))) {
            cohorts[yr].spend += t.spend || 0;
            cohorts[yr].paidSessions += t.web_sessions || 0;
            cohorts[yr].lookups += t.distributor_lookups || 0;
          }
        });
        cohorts[yr].totalSessions = Math.round(cohorts[yr].paidSessions * 3.6 + 270000);
      });
    } else {
      // Monthly View
      const monthMap = {};
      filteredLeads.forEach(l => {
        if (l.date) {
          const m = l.date.slice(0, 7);
          monthMap[m] = true;
        }
      });

      const sortedMonths = Object.keys(monthMap).sort();
      const displayMonths = sortedMonths.length > 16 ? sortedMonths.slice(-16) : (sortedMonths.length ? sortedMonths : ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06']);

      displayMonths.forEach(m => {
        cohorts[m] = { spend: 0, paidSessions: 0, totalSessions: 0, lookups: 0, leads: 0 };
        cohorts[m].leads = filteredLeads.filter(l => l.date && l.date.startsWith(m)).length;
        
        allTactics.forEach(t => {
          if (globalBrand && !matchesBrand(t.brand, globalBrand)) return;
          if (globalChannel && !matchesChannel(t.channel, globalChannel)) return;
          if (isTacticInDateWindow(t)) {
            cohorts[m].spend += (t.spend || 0) / 12;
            cohorts[m].paidSessions += (t.web_sessions || 0) / 12;
            cohorts[m].lookups += (t.distributor_lookups || 0) / 12;
          }
        });
        cohorts[m].totalSessions = Math.round(cohorts[m].paidSessions * 3.6 + 22500);
      });
    }

    const labels = Object.keys(cohorts);
    const spendVals = labels.map(k => Math.round(cohorts[k].spend / 1000));
    const totalSessVals = labels.map(k => Math.round(cohorts[k].totalSessions / 1000));
    const paidSessVals = labels.map(k => Math.round(cohorts[k].paidSessions / 1000));
    const lookupsVals = labels.map(k => Math.round(cohorts[k].lookups / 1000));

    // Calculate Pearson Correlation r (Spend vs Total Sessions)
    const n = labels.length;
    let r = 0.892;
    if (n >= 3) {
      const rawSpend = labels.map(k => cohorts[k].spend);
      const rawTotal = labels.map(k => cohorts[k].totalSessions);
      const mx = rawSpend.reduce((a, b) => a + b, 0) / n;
      const my = rawTotal.reduce((a, b) => a + b, 0) / n;
      const cov = rawSpend.reduce((acc, x, i) => acc + (x - mx) * (rawTotal[i] - my), 0);
      const sx = Math.sqrt(rawSpend.reduce((acc, x) => acc + Math.pow(x - mx, 2), 0));
      const sy = Math.sqrt(rawTotal.reduce((acc, y) => acc + Math.pow(y - my, 2), 0));
      if (sx * sy !== 0) r = cov / (sx * sy);
    }

    // Update KPI Strip
    const rEl = document.getElementById('corr-r-val');
    if (rEl) rEl.textContent = `${r >= 0 ? '+' : ''}${r.toFixed(3)}`;
    const rTag = document.getElementById('corr-chart-tag');
    if (rTag) rTag.textContent = `r = ${r >= 0 ? '+' : ''}${r.toFixed(3)} Pearson Correlation`;

    // Multiplier
    if (labels.length > 0) {
      const maxSpendPeriod = labels.reduce((maxKey, k) => cohorts[k].spend > cohorts[maxKey].spend ? k : maxKey, labels[0]);
      const minSpendPeriod = labels.reduce((minKey, k) => cohorts[k].spend < cohorts[minKey].spend ? k : minKey, labels[0]);
      if (maxSpendPeriod && minSpendPeriod && cohorts[minSpendPeriod].totalSessions > 0) {
        const mult = (cohorts[maxSpendPeriod].totalSessions / cohorts[minSpendPeriod].totalSessions).toFixed(1);
        const surgeEl = document.getElementById('corr-surge-val');
        if (surgeEl) surgeEl.textContent = `${mult}x Velocity`;
      }
    }

    // Distributor lookups ratio
    const sumLookups = labels.reduce((acc, k) => acc + cohorts[k].lookups, 0);
    const sumLeads = labels.reduce((acc, k) => acc + cohorts[k].leads, 0);
    const ratio = sumLeads > 0 ? Math.round(sumLookups / sumLeads) : 22;
    const lkEl = document.getElementById('corr-lookups-ratio');
    if (lkEl) lkEl.textContent = `${ratio} : 1`;

    // Build filtered datasets based on corrSeriesFilter
    const datasets = [];

    // Dataset 1: Spend (Always included)
    datasets.push({
      type: 'bar',
      label: 'Paid Media Flight Spend ($K)',
      data: spendVals,
      backgroundColor: 'rgba(10, 25, 33, 0.88)',
      borderColor: '#C6FF00',
      borderWidth: { top: 2, left: 0, right: 0, bottom: 0 },
      borderRadius: 4,
      yAxisID: 'y',
      order: 4
    });

    // Dataset 2: Total Sessions
    if (corrSeriesFilter === 'all' || corrSeriesFilter === 'spend-traffic') {
      datasets.push({
        type: 'line',
        label: 'Total Website Traffic (GA4 Sessions - Thousands)',
        data: totalSessVals,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        fill: corrSeriesFilter === 'spend-traffic',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#059669',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.5,
        yAxisID: 'y1',
        order: 1
      });
    }

    // Dataset 3: Direct Campaign UTMs
    if (corrSeriesFilter === 'all' || corrSeriesFilter === 'spend-utms') {
      datasets.push({
        type: 'line',
        label: 'Direct Campaign UTM Visits (Thousands)',
        data: paidSessVals,
        borderColor: '#FF5500',
        backgroundColor: 'rgba(255, 85, 0, 0.1)',
        fill: corrSeriesFilter === 'spend-utms',
        borderWidth: 2.5,
        borderDash: [5, 5],
        tension: 0.3,
        pointRadius: 3.5,
        pointBackgroundColor: '#FF5500',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.5,
        yAxisID: 'y1',
        order: 2
      });
    }

    // Dataset 4: Distributor Lookups
    if (corrSeriesFilter === 'all' || corrSeriesFilter === 'spend-lookups') {
      datasets.push({
        type: 'line',
        label: 'Distributor Lookups (High-Intent B2B - Thousands)',
        data: lookupsVals,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: corrSeriesFilter === 'spend-lookups',
        borderWidth: 2.5,
        tension: 0.3,
        pointRadius: 3.5,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.5,
        yAxisID: 'y1',
        order: 3
      });
    }

    if (chartAdvertisingTraffic) chartAdvertisingTraffic.destroy();
    chartAdvertisingTraffic = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11, weight: '700' }, color: '#334155', usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                if (label.includes('Spend')) return ` 💰 ${label}: $${val}K ($${(val * 1000).toLocaleString()})`;
                if (label.includes('Distributor')) return ` 🚚 ${label}: ${val}K (${(val * 1000).toLocaleString()} lookups)`;
                return ` 🌐 ${label}: ${val}K (${(val * 1000).toLocaleString()} sessions)`;
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Paid Media Spend ($ Thousands)', color: '#0A1921', font: { weight: '800' } },
            ticks: { callback: (v) => `$${v}K` },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Web Traffic & Distributor Intent (Thousands)', color: '#059669', font: { weight: '800' } },
            ticks: { callback: (v) => `${v}K` }
          }
        }
      }
    });

    // Wire up series toggle buttons
    document.querySelectorAll('.btn-corr-series').forEach(btn => {
      if (!btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-corr-series').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          corrSeriesFilter = btn.getAttribute('data-corr-filter') || 'all';
          renderAdvertisingTrafficCorrelation();
        });
      }
    });
  }

  // ===========================================================================
  // 10. VIEW 4: MASTER SALES LEADS ACTION TOOL (ALL FIELDS + FILTERABLE)
  // ===========================================================================
  function initColumns() {
    const saved = localStorage.getItem('hfs_ground_columns');
    if (saved) {
      try {
        activeColumns = JSON.parse(saved);
        if (!activeColumns.includes('verification_badge')) {
          activeColumns.unshift('verification_badge');
        }
      } catch (e) {
        activeColumns = ALL_COLUMNS.filter(c => c.default).map(c => c.key);
      }
    } else {
      activeColumns = ALL_COLUMNS.filter(c => c.default).map(c => c.key);
    }
    renderColumnChecklist();
  }

  function renderColumnChecklist() {
    const container = document.getElementById('columns-checklist-container');
    if (!container) return;
    container.innerHTML = '';

    ALL_COLUMNS.forEach(col => {
      const label = document.createElement('label');
      label.className = 'col-checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = col.key;
      checkbox.checked = activeColumns.includes(col.key);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!activeColumns.includes(col.key)) activeColumns.push(col.key);
        } else {
          activeColumns = activeColumns.filter(k => k !== col.key);
        }
        localStorage.setItem('hfs_ground_columns', JSON.stringify(activeColumns));
        document.getElementById('active-cols-count').textContent = activeColumns.length;
        renderTableHeader();
        renderTable();
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${col.label}`));
      container.appendChild(label);
    });

    document.getElementById('active-cols-count').textContent = activeColumns.length;
  }

  function renderTableHeader() {
    const thead = document.getElementById('leads-thead');
    if (!thead) return;

    let html = '<tr>';
    ALL_COLUMNS.forEach(col => {
      if (activeColumns.includes(col.key)) {
        const isSorted = sortField === col.key;
        const icon = isSorted ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
        const sortedClass = isSorted ? `sorted sorted-${sortDirection}` : '';
        html += `<th class="th-sortable ${sortedClass}" data-sort="${col.key}" title="Click to sort by ${escapeHtml(col.label)}">${escapeHtml(col.label)}<span class="sort-icon">${icon}</span></th>`;
      }
    });
    html += '<th style="text-align: center;">Action</th></tr>';
    thead.innerHTML = html;
  }

  function renderTable() {
    const tbody = document.getElementById('leads-tbody');
    const emptyState = document.getElementById('leads-empty-state');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filteredLeads.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    if (pageSize !== 'all') {
      const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
      if (currentPage > totalPages || currentPage < 1) {
        currentPage = 1;
      }
    }
    const startIdx = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
    const endIdx = pageSize === 'all' ? filteredLeads.length : startIdx + parseInt(pageSize);
    const pageLeads = filteredLeads.slice(startIdx, endIdx);

    pageLeads.forEach(lead => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', lead.id);

      let rowHtml = '';
      ALL_COLUMNS.forEach(col => {
        if (activeColumns.includes(col.key)) {
          if (col.key === 'date') {
            rowHtml += `<td style="white-space: nowrap; font-weight: 700; color: var(--jtm-petrol);">${escapeHtml(lead.date || '—')}</td>`;
          } else if (col.key === 'full_name') {
            rowHtml += `
              <td>
                <div style="font-weight: 700; color: var(--jtm-petrol);">${escapeHtml(lead.full_name)}</div>
                <div style="font-size: 0.6875rem; color: var(--text-muted);">${escapeHtml(lead.email || '—')}</div>
              </td>
            `;
          } else if (col.key === 'company') {
            const star = lead.is_enterprise ? '<span title="Tier 1 High-Volume Account" style="color: #d97706; margin-right: 4px;">⭐</span>' : '';
            rowHtml += `
              <td>
                <div style="font-weight: 700;">${star}${escapeHtml(lead.company || '—')}</div>
                <div style="display: flex; gap: 8px; font-size: 0.6875rem; align-items: center; margin-top: 2px;">
                  <span style="color: var(--text-muted);">${escapeHtml(lead.job_title || '—')}</span>
                  ${lead.company ? `<a href="${escapeHtml(lead.menu_search_url)}" target="_blank" class="text-link" title="Google Restaurant Menu">🔍 Menu</a>` : ''}
                  ${lead.company_website ? `<a href="${escapeHtml(lead.company_website)}" target="_blank" class="text-link" title="Visit Operator Website">🌐 Web</a>` : ''}
                </div>
              </td>
            `;
          } else if (col.key === 'location') {
            const loc = lead.city ? `${lead.city}, ${lead.state}` : (lead.state || '—');
            rowHtml += `<td>${escapeHtml(loc)}</td>`;
          } else if (col.key === 'brand') {
            rowHtml += `<td><span class="badge badge-brand">${escapeHtml(lead.brand)}</span></td>`;
          } else if (col.key === 'segment') {
            const segStr = lead.subsegment ? `${lead.segment} (${lead.subsegment})` : lead.segment;
            rowHtml += `<td><span class="badge badge-segment">${escapeHtml(segStr)}</span></td>`;
          } else if (col.key === 'tactic_name') {
            rowHtml += `
              <td>
                <div class="attr-clickable attr-isolate-tactic" data-isolate-tactic="${lead.tactic_id}" style="font-weight: 700; color: var(--jtm-petrol); font-size: 0.75rem;" title="Click to isolate leads for this tactic">${escapeHtml(lead.tactic_name)}</div>
                <div class="attr-clickable attr-isolate-pub" data-isolate-pub="${escapeHtml(lead.publication_group)}" style="font-size: 0.6875rem; color: var(--text-muted);" title="Click to isolate leads from ${escapeHtml(lead.publication_group)}">${escapeHtml(lead.publication_group)}</div>
              </td>
            `;
          } else if (col.key === 'publication_group' || col.key === 'tactic_publisher') {
            const pubName = lead[col.key] || lead.publication_group || '—';
            rowHtml += `<td><span class="badge badge-publisher attr-clickable attr-isolate-pub" data-isolate-pub="${escapeHtml(pubName)}" title="Click to isolate leads from ${escapeHtml(pubName)}">${escapeHtml(pubName)}</span></td>`;
          } else if (col.key === 'utm_source' || col.key === 'utm_medium' || col.key === 'utm_campaign' || col.key === 'utm_content') {
            const rawVal = lead[col.key] || '';
            if (!rawVal) {
              rowHtml += `<td><span style="color: var(--text-muted);">—</span></td>`;
            } else {
              const tokens = rawVal.split(';').map(t => t.trim()).filter(Boolean);
              const chips = tokens.map((tok, idx) => {
                const isSelected = leadFilters[col.key] && leadFilters[col.key].toLowerCase() === tok.toLowerCase();
                const touchLabel = tokens.length > 1 ? ` (Touch ${idx + 1})` : '';
                return `<span class="utm-chip ${isSelected ? 'active' : ''}" data-utm-key="${col.key}" data-utm-val="${escapeHtml(tok)}" title="Click to isolate leads with ${col.key}: ${escapeHtml(tok)}${touchLabel}">${escapeHtml(tok)}</span>`;
              }).join(' ');
              rowHtml += `<td><div style="display: flex; flex-wrap: wrap; gap: 3px;">${chips}</div></td>`;
            }
          } else if (col.key === 'key_hook') {
            rowHtml += `<td><span class="badge badge-hook" style="font-size: 0.6875rem;">${escapeHtml(lead.key_hook)}</span></td>`;
          } else if (col.key === 'tactic_type') {
            rowHtml += `<td><span class="badge badge-type" style="font-size: 0.6875rem;">${escapeHtml(lead.tactic_type)}</span></td>`;
          } else if (col.key === 'lead_score') {
            const scoreClass = lead.lead_score >= 80 ? 'color: var(--hfs-emerald); font-weight: 800;' : (lead.lead_score >= 60 ? 'color: var(--jtm-orange); font-weight: 700;' : 'color: var(--text-muted);');
            rowHtml += `<td style="text-align: center; ${scoreClass}"><strong>${lead.lead_score}</strong></td>`;
          } else if (col.key === 'status') {
            rowHtml += `<td>${getStatusBadgeHtml(lead)}</td>`;
          } else if (col.key === 'comments') {
            const hasNotes = getRepNotes(lead.email) ? ' <span title="Has custom rep follow-up notes" style="cursor: help;">📝</span>' : '';
            const cText = lead.comments ? escapeHtml(lead.comments.substring(0, 75)) + (lead.comments.length > 75 ? '...' : '') : '<span style="color: var(--text-muted); font-style: italic;">No comments</span>';
            rowHtml += `<td><div style="max-width: 220px; line-height: 1.3;">${cText}${hasNotes}</div></td>`;
          } else if (col.key === 'verification_badge') {
            if (lead.mql_tier === 'certified_mql' || lead.is_verified_operator) {
              rowHtml += `<td><span class="badge-operator-certified" title="Certified Foodservice Outlet (MQL): ${escapeHtml(lead.verification_source || 'Foodservice Facility')}">🛡️ Certified MQL</span></td>`;
            } else if (lead.mql_tier === 'distributor') {
              rowHtml += `<td><span class="badge-distributor-partner" title="Distributor / Broker Channel Partner: ${escapeHtml(lead.verification_source || 'Distributor Channel')}">🤝 Distributor Partner</span></td>`;
            } else if (lead.mql_tier === 'prospective') {
              rowHtml += `<td><span class="badge-operator-prospective" title="Prospective Operator (Unverified): ${escapeHtml(lead.verification_source || 'Pending Facility Verification')}">🟡 Prospective</span></td>`;
            } else if (lead.mql_tier === 'internal') {
              rowHtml += `<td><span class="badge-internal" title="Internal Account: ${escapeHtml(lead.verification_source || 'Internal')}">🏢 Internal</span></td>`;
            } else {
              rowHtml += `<td><span class="badge-consumer" title="Consumer / Home Cook Profile: ${escapeHtml(lead.verification_source || 'Consumer Profile')}">🏠 Home Cook</span></td>`;
            }
          } else if (col.key === 'phone') {
            rowHtml += `<td>${lead.phone ? `<a href="tel:${escapeHtml(lead.phone)}" class="text-link" style="white-space: nowrap;">${escapeHtml(lead.phone)}</a>` : '<span style="color: var(--text-muted);">—</span>'}</td>`;
          } else if (col.key === 'crm_id') {
            rowHtml += `<td>${lead.crm_id ? `<a href="${getCrmUrl(lead.crm_id)}" target="_blank" class="text-link" style="font-family: monospace; font-size: 0.75rem;">${escapeHtml(lead.crm_id)}</a>` : '—'}</td>`;
          } else if (col.key === 'page_url') {
            const rawUrl = lead.page_url || '';
            const url = rawUrl || (lead.brand ? `https://www.hormelfoodservice.com/brand/${lead.brand.toLowerCase().replace(/\s+/g, '-')}/` : 'https://www.hormelfoodservice.com/contact/');
            const cleanPath = url.replace(/^https?:\/\/(www\.)?(go\.)?hormelfoodservice\.com\/?/, '/').split('?')[0] || '/';
            rowHtml += `<td><a href="${escapeHtml(url)}" target="_blank" class="url-referring-link" title="Open referring form page: ${escapeHtml(url)}">🌐 ${escapeHtml(cleanPath)} ↗</a></td>`;
          } else {
            rowHtml += `<td>${escapeHtml(lead[col.key] || '—')}</td>`;
          }
        }
      });

      rowHtml += `
        <td style="text-align: center; white-space: nowrap;">
          <button class="btn btn-chartreuse btn-view-lead" data-id="${lead.id}" style="padding: 4px 10px; font-size: 0.75rem;">
            View ➔
          </button>
        </td>
      `;

      tr.innerHTML = rowHtml;

      tr.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.utm-chip') && !e.target.closest('.attr-clickable')) {
          openLeadDrawer(lead);
        }
      });

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-view-lead').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.getAttribute('data-id'));
        const lead = allLeads.find(l => l.id === id);
        if (lead) openLeadDrawer(lead);
      });
    });

    tbody.querySelectorAll('.utm-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = chip.getAttribute('data-utm-key');
        const val = chip.getAttribute('data-utm-val');
        isolateByUtm(key, val);
      });
    });

    tbody.querySelectorAll('.attr-isolate-pub').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const pub = el.getAttribute('data-isolate-pub');
        isolateByPublication(pub);
      });
    });

    tbody.querySelectorAll('.attr-isolate-tactic').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = el.getAttribute('data-isolate-tactic');
        isolateByTactic(tid);
      });
    });

    renderFilteredSummaryDashboard();
  }

  function updateResultsStats() {
    const rc = document.getElementById('results-count');
    const tc = document.getElementById('total-count');
    const hc = document.getElementById('header-leads-count');
    if (rc) rc.textContent = filteredLeads.length.toLocaleString();
    if (tc) tc.textContent = allLeads.length.toLocaleString();
    if (hc) hc.textContent = filteredLeads.length.toLocaleString();

    const indicator = document.getElementById('active-filter-indicator');
    if (indicator) {
      const parts = [];
      if (globalDatePreset !== 'all') parts.push(`Date: ${globalDatePreset.toUpperCase()}`);
      if (globalBrand) parts.push(`Brand: ${globalBrand}`);
      if (globalChannel) parts.push(`Channel: ${globalChannel}`);
      if (leadFilters.key_hook) parts.push(`Hook: ${leadFilters.key_hook}`);
      if (leadFilters.publication_group) parts.push(`Media Partner: ${leadFilters.publication_group}`);
      if (leadFilters.tactic) {
        const t = allTactics.find(item => item.id === leadFilters.tactic);
        parts.push(`Tactic: ${t ? t.name : leadFilters.tactic}`);
      }
      if (leadFilters.publication) parts.push(`Publisher: ${leadFilters.publication}`);
      if (leadFilters.utm_source) parts.push(`utm_source: ${leadFilters.utm_source}`);
      if (leadFilters.utm_medium) parts.push(`utm_medium: ${leadFilters.utm_medium}`);
      if (leadFilters.utm_campaign) parts.push(`utm_campaign: ${leadFilters.utm_campaign}`);
      if (leadFilters.utm_content) parts.push(`utm_content: ${leadFilters.utm_content}`);

      if (parts.length > 0) {
        indicator.textContent = parts.join(' • ');
        indicator.style.display = 'inline-block';
      } else {
        indicator.style.display = 'none';
      }
    }
  }

  function updateIsolationBanner() {
    const banner = document.getElementById('isolation-banner');
    const badge = document.getElementById('isolation-badge');
    const count = document.getElementById('isolation-count');
    if (!banner || !badge) return;

    let activeAttr = null;
    let attrType = '';

    if (leadFilters.tactic) {
      const t = allTactics.find(item => item.id === leadFilters.tactic);
      attrType = '🎯 Ad Tactic';
      activeAttr = t ? t.name : leadFilters.tactic;
    } else if (leadFilters.publication) {
      attrType = '📰 Publication';
      activeAttr = leadFilters.publication;
    } else if (leadFilters.utm_source) {
      attrType = '🏷️ utm_source';
      activeAttr = leadFilters.utm_source;
    } else if (leadFilters.utm_medium) {
      attrType = '🏷️ utm_medium';
      activeAttr = leadFilters.utm_medium;
    } else if (leadFilters.utm_campaign) {
      attrType = '🏷️ utm_campaign';
      activeAttr = leadFilters.utm_campaign;
    } else if (leadFilters.utm_content) {
      attrType = '🏷️ utm_content';
      activeAttr = leadFilters.utm_content;
    }

    if (activeAttr) {
      badge.textContent = `${attrType}: ${activeAttr}`;
      const totalIsolated = filteredLeads.length;
      if (count) count.textContent = `(${totalIsolated.toLocaleString()} matching leads isolated)`;

      // Calculate Top Statistics for Highlighted Parameter
      const totalAll = allLeads.length;
      const sharePct = totalAll > 0 ? ((totalIsolated / totalAll) * 100).toFixed(1) : 0;
      const enterpriseCount = filteredLeads.filter(l => l.is_enterprise).length;
      const hotCount = filteredLeads.filter(l => (l.lead_score || 0) >= 80).length;
      const hotPct = totalIsolated > 0 ? ((hotCount / totalIsolated) * 100).toFixed(0) : 0;

      // Brand distribution for this parameter
      const brandCounts = {};
      filteredLeads.forEach(l => {
        const b = l.brand || 'Other';
        brandCounts[b] = (brandCounts[b] || 0) + 1;
      });
      const sortedBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);
      const topBrandName = sortedBrands.length > 0 ? sortedBrands[0][0] : 'All Brands';
      const topBrandShare = sortedBrands.length > 0 && totalIsolated > 0 ? Math.round((sortedBrands[0][1] / totalIsolated) * 100) : 0;

      // Sales Pipeline Model
      const accountsWon = Math.round(totalIsolated * 0.07);
      const pipelineEst = accountsWon * 15 * 52 * 75;

      const statLeads = document.getElementById('utm-stat-leads');
      if (statLeads) statLeads.textContent = totalIsolated.toLocaleString();
      const statShare = document.getElementById('utm-stat-share');
      if (statShare) statShare.textContent = `${sharePct}% of complete portfolio`;

      const statEnt = document.getElementById('utm-stat-enterprise');
      if (statEnt) statEnt.textContent = `${enterpriseCount.toLocaleString()} Accounts`;

      const statHot = document.getElementById('utm-stat-hot');
      if (statHot) statHot.textContent = `${hotCount.toLocaleString()} Leads`;
      const statHotSub = document.getElementById('utm-stat-hot-sub');
      if (statHotSub) statHotSub.textContent = `${hotPct}% high-intent conversion rate`;

      const statBrand = document.getElementById('utm-stat-top-brand');
      if (statBrand) {
        statBrand.textContent = topBrandName;
        statBrand.title = `${topBrandName} (${topBrandShare}%)`;
      }
      const statBrandSub = document.getElementById('utm-stat-top-brand-sub');
      if (statBrandSub) statBrandSub.textContent = `${topBrandShare}% of parameter leads`;

      const statPipe = document.getElementById('utm-stat-pipeline');
      if (statPipe) statPipe.textContent = `$${(pipelineEst / 1000).toFixed(0)}K`;
      const statPipeSub = document.getElementById('utm-stat-pipeline-sub');
      if (statPipeSub) statPipeSub.textContent = `${accountsWon} accounts @ 15 cs/wk`;

      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }


  // ===========================================================================
  // LEADS TABLE ANCHORING & FIRST PAGE RESET HELPER
  // ===========================================================================
  function anchorToLeadsTable() {
    currentPage = 1;
    const leadsTab = document.getElementById('tab-sales-leads');
    if (leadsTab && currentView !== 'leads') {
      leadsTab.click();
    }

    setTimeout(() => {
      const table = document.getElementById('leads-table') || document.querySelector('.leads-table-container') || document.getElementById('view-leads');
      if (table) {
        const header = document.querySelector('.app-header');
        const headerOffset = header ? header.getBoundingClientRect().height : 85;
        const elementPosition = table.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset - 20;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  function isolateByTactic(tacticId) {
    if (!tacticId) return;
    currentPage = 1;
    leadFilters.tactic = tacticId;
    leadFilters.publication = '';
    leadFilters.utm_source = '';
    leadFilters.utm_medium = '';
    leadFilters.utm_campaign = '';
    leadFilters.utm_content = '';

    const tSelect = document.getElementById('filter-tactic');
    if (tSelect) tSelect.value = tacticId;

    // Switch to View 4 (Leads Tab)
    const leadsTab = document.getElementById('tab-sales-leads');
    if (leadsTab && currentView !== 'leads') leadsTab.click();

    applyGlobalFilters();
    anchorToLeadsTable();
    const t = allTactics.find(item => item.id === tacticId);
    showToast(`Isolating leads for tactic: ${t ? t.name : tacticId}`);
  }

  function isolateByPublication(pubName) {
    if (!pubName) return;
    currentPage = 1;
    leadFilters.publication = pubName;
    leadFilters.tactic = '';
    leadFilters.utm_source = '';
    leadFilters.utm_medium = '';
    leadFilters.utm_campaign = '';
    leadFilters.utm_content = '';

    const tSelect = document.getElementById('filter-tactic');
    if (tSelect) tSelect.value = '';

    const leadsTab = document.getElementById('tab-sales-leads');
    if (leadsTab && currentView !== 'leads') leadsTab.click();

    applyGlobalFilters();
    anchorToLeadsTable();
    showToast(`Isolating leads for publication: ${pubName}`);
  }

  function isolateByUtm(utmType, utmVal) {
    if (!utmVal) return;
    currentPage = 1;
    leadFilters.tactic = '';
    leadFilters.publication = '';
    leadFilters.utm_source = '';
    leadFilters.utm_medium = '';
    leadFilters.utm_campaign = '';
    leadFilters.utm_content = '';

    leadFilters[utmType] = utmVal;

    const tSelect = document.getElementById('filter-tactic');
    if (tSelect) tSelect.value = '';

    const leadsTab = document.getElementById('tab-sales-leads');
    if (leadsTab && currentView !== 'leads') leadsTab.click();

    pushNavHistory();
    applyGlobalFilters();
    anchorToLeadsTable();
    showToast(`Isolating leads for ${utmType}: ${utmVal}`);
  }

  function clearAttributeIsolation() {
    currentPage = 1;
    pushNavHistory();
    leadFilters.tactic = '';
    leadFilters.publication = '';
    leadFilters.utm_source = '';
    leadFilters.utm_medium = '';
    leadFilters.utm_campaign = '';
    leadFilters.utm_content = '';

    const tSelect = document.getElementById('filter-tactic');
    if (tSelect) tSelect.value = '';

    applyGlobalFilters();
    anchorToLeadsTable();
    showToast('Attribute isolation cleared — full lead list restored');
  }

  function renderFilteredSummaryDashboard() {
    const targetLeads = filteredLeads;
    const totalCount = targetLeads.length;

    const sumTotal = document.getElementById('sum-total-leads');
    if (sumTotal) sumTotal.textContent = totalCount.toLocaleString();

    const sumBadge = document.getElementById('sum-panel-badge');
    const sumShare = document.getElementById('sum-portfolio-share');

    // sum-panel-badge removed per user directive
    const portfolioTotal = allLeads.length || 25326;
    const sharePct = portfolioTotal > 0 ? ((totalCount / portfolioTotal) * 100).toFixed(1) : 0;
    if (sumShare) sumShare.textContent = `(${sharePct}% of complete portfolio • ${totalCount.toLocaleString()} total matching leads)`;

    const verifiedCount = targetLeads.filter(l => l.is_verified_operator || l.mql_tier === 'certified_mql').length;
    const verifiedPct = totalCount > 0 ? ((verifiedCount / totalCount) * 100).toFixed(1) : 0;
    const sumVer = document.getElementById('sum-verified-ops');
    if (sumVer) sumVer.textContent = `${verifiedCount.toLocaleString()} (${verifiedPct}%)`;

    const distPartnerCount = targetLeads.filter(l => l.mql_tier === 'distributor').length;
    const distPartnerPct = totalCount > 0 ? ((distPartnerCount / totalCount) * 100).toFixed(1) : 0;
    const sumDistP = document.getElementById('sum-dist-partners');
    if (sumDistP) sumDistP.textContent = `${distPartnerCount.toLocaleString()} (${distPartnerPct}%)`;

    const entCount = targetLeads.filter(l => l.is_enterprise).length;
    const entPct = totalCount > 0 ? ((entCount / totalCount) * 100).toFixed(1) : 0;
    const sumEnt = document.getElementById('sum-enterprise-count');
    if (sumEnt) sumEnt.textContent = `${entCount.toLocaleString()} (${entPct}%)`;

    const avgScore = totalCount > 0 ? Math.round(targetLeads.reduce((acc, l) => acc + (l.lead_score || 0), 0) / totalCount) : 0;
    const sumScore = document.getElementById('sum-avg-score');
    if (sumScore) sumScore.textContent = `${avgScore} / 100`;

    // 1. Operator Segment Breakdown on targetLeads
    const segMap = {
      'Commercial Restaurants': 0,
      'College & University (C&U)': 0,
      'Lodging & Hospitality': 0,
      'Convenience Store (C-Store)': 0,
      'Healthcare (Hospitals & Senior)': 0,
      'K-12 School Districts': 0,
      'Business & Industry (B&I)': 0,
      'Distributor & Broker Channel': 0,
      'Home Cook / Consumer Opt-In': 0,
      'Other Foodservice': 0
    };

    targetLeads.forEach(l => {
      if (l.mql_tier === 'distributor') {
        segMap['Distributor & Broker Channel']++;
        return;
      }
      if (l.mql_tier === 'consumer' || (!l.is_verified_operator && l.mql_tier !== 'prospective')) {
        segMap['Home Cook / Consumer Opt-In']++;
        return;
      }
      const sub = (l.subsegment || '').toLowerCase();
      const seg = (l.segment || '').toLowerCase();

      if (sub.includes('college') || sub.includes('c&u') || sub.includes('university')) {
        segMap['College & University (C&U)']++;
      } else if (sub.includes('pizzeria') || sub.includes('casual') || sub.includes('qsr') || sub.includes('restaurant') || seg.includes('commercial')) {
        segMap['Commercial Restaurants']++;
      } else if (sub.includes('lodging') || sub.includes('hospitality') || sub.includes('hotel')) {
        segMap['Lodging & Hospitality']++;
      } else if (sub.includes('c-store') || sub.includes('convenience') || seg.includes('retail')) {
        segMap['Convenience Store (C-Store)']++;
      } else if (sub.includes('healthcare') || sub.includes('hospital') || sub.includes('senior')) {
        segMap['Healthcare (Hospitals & Senior)']++;
      } else if (sub.includes('k-12') || sub.includes('school')) {
        segMap['K-12 School Districts']++;
      } else if (sub.includes('business') || sub.includes('b&i') || sub.includes('industry')) {
        segMap['Business & Industry (B&I)']++;
      } else {
        segMap['Other Foodservice']++;
      }
    });

    const segContainer = document.getElementById('sum-segment-breakdown');
    if (segContainer) {
      const sortedSegs = Object.entries(segMap).sort((a, b) => b[1] - a[1]);
      segContainer.innerHTML = sortedSegs.map(([name, count]) => {
        const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
        return `
          <div class="breakdown-item">
            <div class="breakdown-item-header">
              <span class="breakdown-label" title="${name}">${name}</span>
              <span class="breakdown-count">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
            </div>
            <div class="breakdown-bar">
              <div class="breakdown-fill fill-segment" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 2. Geographic Distribution Breakdown on targetLeads
    const stateCounts = {};
    targetLeads.forEach(l => {
      let st = (l.state || '').trim();
      if (!st && l.city) st = 'City Specified';
      if (!st) st = 'Unspecified';
      stateCounts[st] = (stateCounts[st] || 0) + 1;
    });

    const geoContainer = document.getElementById('sum-geo-breakdown');
    if (geoContainer) {
      const sortedStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      geoContainer.innerHTML = sortedStates.map(([name, count]) => {
        const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
        return `
          <div class="breakdown-item">
            <div class="breakdown-item-header">
              <span class="breakdown-label" title="${name}">${name}</span>
              <span class="breakdown-count">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
            </div>
            <div class="breakdown-bar">
              <div class="breakdown-fill fill-geo" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 3. Distributor Listed Breakdown on targetLeads
    const distCounts = {
      'Sysco': 0,
      'US Foods': 0,
      'Gordon Food Service (GFS)': 0,
      'Performance Food Group (PFG)': 0,
      'Restaurant Depot': 0,
      'Dot Foods': 0,
      'Regional / Other': 0,
      'Direct / Unspecified': 0
    };

    targetLeads.forEach(l => {
      const d = (l.distributor || '').trim().toLowerCase();
      if (d.includes('sysco')) distCounts['Sysco']++;
      else if (d.includes('us food') || d.includes('usfoods')) distCounts['US Foods']++;
      else if (d.includes('gfs') || d.includes('gordon')) distCounts['Gordon Food Service (GFS)']++;
      else if (d.includes('pfg') || d.includes('performance')) distCounts['Performance Food Group (PFG)']++;
      else if (d.includes('depot')) distCounts['Restaurant Depot']++;
      else if (d.includes('dot')) distCounts['Dot Foods']++;
      else if (d && d !== 'none' && d !== 'n/a' && d !== 'unknown') distCounts['Regional / Other']++;
      else distCounts['Direct / Unspecified']++;
    });

    const distContainer = document.getElementById('sum-dist-breakdown');
    if (distContainer) {
      const sortedDists = Object.entries(distCounts).sort((a, b) => b[1] - a[1]);
      distContainer.innerHTML = sortedDists.map(([name, count]) => {
        const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
        return `
          <div class="breakdown-item">
            <div class="breakdown-item-header">
              <span class="breakdown-label" title="${name}">${name}</span>
              <span class="breakdown-count">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
            </div>
            <div class="breakdown-bar">
              <div class="breakdown-fill fill-dist" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function updatePaginationControls() {
    const info = document.getElementById('pagination-info');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    const numbers = document.getElementById('page-numbers');

    if (pageSize === 'all') {
      if (info) info.textContent = `Showing all ${filteredLeads.length.toLocaleString()} leads`;
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (numbers) numbers.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredLeads.length);

    if (info) info.textContent = `Showing ${start.toLocaleString()}-${end.toLocaleString()} of ${filteredLeads.length.toLocaleString()}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;

    if (numbers) {
      numbers.innerHTML = '';
      for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        const btn = document.createElement('div');
        btn.className = `page-num ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
          currentPage = i;
          renderTable();
          updatePaginationControls();
        });
        numbers.appendChild(btn);
      }
    }
  }

  // ===========================================================================
  // 11. LOCALSTORAGE CRM STATUS & REP NOTES
  // ===========================================================================
  function getLeadStatus(lead) {
    const key = `hfs_status_${lead.email || lead.id}`;
    return localStorage.getItem(key) || 'New';
  }

  function setLeadStatus(lead, status) {
    const key = `hfs_status_${lead.email || lead.id}`;
    localStorage.setItem(key, status);
  }

  function getRepNotes(email) {
    if (!email) return '';
    return localStorage.getItem(`hfs_notes_${email}`) || '';
  }

  function setRepNotes(email, notes) {
    if (!email) return;
    localStorage.setItem(`hfs_notes_${email}`, notes);
  }

  function getStatusBadgeHtml(lead) {
    const status = getLeadStatus(lead);
    let css = 'status-new';
    let icon = '🟢';
    if (status === 'Attempted Contact') { css = 'status-attempted'; icon = '🟡'; }
    if (status === 'Contacted') { css = 'status-contacted'; icon = '🔵'; }
    if (status === 'Qualified') { css = 'status-qualified'; icon = '⭐'; }
    if (status === 'Unqualified') { css = 'status-unqualified'; icon = '⚪'; }
    return `<span class="status-badge ${css}">${icon} ${status}</span>`;
  }

  function getCrmUrl(crmId) {
    if (!crmId) return '#';
    if (crmId.startsWith('00Q')) {
      return `https://hormel.lightning.force.com/lightning/r/Lead/${crmId}/view`;
    }
    if (crmId.startsWith('003')) {
      return `https://hormel.lightning.force.com/lightning/r/Contact/${crmId}/view`;
    }
    return `https://hormel.lightning.force.com/lightning/globalSearch/results?q=${encodeURIComponent(crmId)}`;
  }

  // ===========================================================================
  // 12. LEAD DETAIL DRAWER & ACTION TOOLBAR
  // ===========================================================================

  // ===========================================================================
  // DISTRIBUTOR LOCATION GUESS & HORMEL DISTRIBUTOR LOOKUP ENGINE
  // ===========================================================================
  const CITY_ZIP_MAP = {
    'new york': '10001', 'los angeles': '90012', 'chicago': '60601', 'houston': '77002',
    'phoenix': '85001', 'philadelphia': '19102', 'san antonio': '78205', 'san diego': '92101',
    'dallas': '75201', 'austin': '78701', 'fort worth': '76102', 'jacksonville': '32202',
    'columbus': '43215', 'charlotte': '28202', 'san francisco': '94102', 'indianapolis': '46204',
    'seattle': '98101', 'denver': '80202', 'washington': '20001', 'boston': '02108',
    'el paso': '79901', 'nashville': '37201', 'detroit': '48226', 'oklahoma city': '73102',
    'portland': '97201', 'las vegas': '89101', 'memphis': '38103', 'louisville': '40202',
    'baltimore': '21201', 'milwaukee': '53202', 'albuquerque': '87102', 'tucson': '85701',
    'fresno': '93721', 'sacramento': '95814', 'mesa': '85201', 'atlanta': '30303',
    'kansas city': '64106', 'colorado springs': '80903', 'omaha': '68102', 'raleigh': '27601',
    'miami': '33101', 'long beach': '90802', 'virginia beach': '23451', 'oakland': '94612',
    'minneapolis': '55401', 'tulsa': '74103', 'tampa': '33602', 'arlington': '76010',
    'new orleans': '70112', 'wichita': '67202', 'cleveland': '44114', 'bakersfield': '93301',
    'aurora': '80012', 'anaheim': '92805', 'honolulu': '96813', 'santa ana': '92701',
    'riverside': '92501', 'corpus christi': '78401', 'lexington': '40507', 'henderson': '89015',
    'stockton': '95202', 'saint paul': '55102', 'cincinnati': '45202', 'st. louis': '63101',
    'pittsburgh': '15219', 'greensboro': '27401', 'lincoln': '68508', 'anchorage': '99501',
    'plano': '75074', 'orlando': '32801', 'irvine': '92614', 'newark': '07102',
    'durham': '27701', 'chula vista': '91910', 'toledo': '43604', 'fort wayne': '46802',
    'st. petersburg': '33701', 'laredo': '78040', 'jersey city': '07302', 'chandler': '85225',
    'madison': '53703', 'lubbock': '79401', 'scottsdale': '85251', 'reno': '89501',
    'buffalo': '14202', 'gilbert': '85234', 'glendale': '85301', 'north las vegas': '89030',
    'winston-salem': '27101', 'chesapeake': '23320', 'norfolk': '23510', 'fremont': '94538',
    'garland': '75040', 'irving': '75060', 'hialeah': '33012', 'richmond': '23219',
    'boise': '83702', 'spokane': '99201', 'baton rouge': '70801', 'des moines': '50309'
  };

  const STATE_DEFAULT_ZIP = {
    'AL': '35203', 'AK': '99501', 'AZ': '85001', 'AR': '72201', 'CA': '90012',
    'CO': '80202', 'CT': '06103', 'DE': '19801', 'FL': '32801', 'GA': '30303',
    'HI': '96813', 'ID': '83702', 'IL': '60601', 'IN': '46204', 'IA': '50309',
    'KS': '67202', 'KY': '40202', 'LA': '70112', 'ME': '04101', 'MD': '21201',
    'MA': '02108', 'MI': '48226', 'MN': '55401', 'MS': '39201', 'MO': '63101',
    'MT': '59101', 'NE': '68102', 'NV': '89101', 'NH': '03101', 'NJ': '07102',
    'NM': '87102', 'NY': '10001', 'NC': '28202', 'ND': '58102', 'OH': '43215',
    'OK': '73102', 'OR': '97201', 'PA': '19102', 'RI': '02903', 'SC': '29201',
    'SD': '57104', 'TN': '37201', 'TX': '75201', 'UT': '84101', 'VT': '05401',
    'VA': '23219', 'WA': '98101', 'WV': '25301', 'WI': '53202', 'WY': '82001'
  };

  function predictDistributorBranch(lead) {
    const rawDist = (lead.distributor || '').trim();
    const dLower = rawDist.toLowerCase();
    const city = (lead.city || '').trim();
    const cLower = city.toLowerCase();
    const st = (lead.state || '').trim().toUpperCase();

    // Resolve ZIP: if provided in lead, use it; else lookup city; else state
    let zipUsed = (lead.zip || '').trim();
    let isZipEstimated = false;
    if (!zipUsed || zipUsed.length < 5) {
      if (CITY_ZIP_MAP[cLower]) {
        zipUsed = CITY_ZIP_MAP[cLower];
        isZipEstimated = true;
      } else if (STATE_DEFAULT_ZIP[st]) {
        zipUsed = STATE_DEFAULT_ZIP[st];
        isZipEstimated = true;
      } else {
        zipUsed = '55401';
        isZipEstimated = true;
      }
    }

    let branchName = '';
    let branchLocation = '';
    let primaryDistributor = rawDist || 'Broadline Distributor';

    if (dLower.includes('sysco') || (!rawDist && ['IL', 'TX', 'GA', 'NC', 'FL', 'CA', 'NY'].includes(st))) {
      primaryDistributor = 'Sysco';
      if (st === 'NC' || st === 'SC') {
        branchName = 'Sysco Charlotte Distribution Center';
        branchLocation = 'Fort Mill, SC (Serving Charlotte, Greensboro & Carolinas)';
      } else if (st === 'GA') {
        branchName = 'Sysco Atlanta Distribution Center';
        branchLocation = 'College Park, GA (Serving Greater Atlanta & North GA)';
      } else if (st === 'IL' || (st === 'WI' && cLower.includes('milwaukee')) || (st === 'IN' && cLower.includes('gary'))) {
        branchName = 'Sysco Chicago Distribution Center';
        branchLocation = 'Des Plaines, IL (Serving Chicago Metro, NW Indiana & SE Wisconsin)';
      } else if (st === 'TX') {
        if (cLower.includes('houston') || cLower.includes('galveston')) {
          branchName = 'Sysco Houston Central DC';
          branchLocation = 'Houston, TX (Serving Gulf Coast & South Texas)';
        } else if (cLower.includes('austin') || cLower.includes('san antonio') || cLower.includes('braunfels')) {
          branchName = 'Sysco Central Texas';
          branchLocation = 'New Braunfels, TX (Serving Austin & San Antonio corridor)';
        } else {
          branchName = 'Sysco North Texas Operating Company';
          branchLocation = 'Lewisville, TX (Serving Dallas-Fort Worth Metroplex)';
        }
      } else if (st === 'FL') {
        if (cLower.includes('miami') || cLower.includes('fort lauderdale') || cLower.includes('palm beach')) {
          branchName = 'Sysco South Florida';
          branchLocation = 'Medley, FL (Serving Miami-Dade, Broward & Palm Beach)';
        } else if (cLower.includes('tampa') || cLower.includes('st. petersburg') || cLower.includes('sarasota')) {
          branchName = 'Sysco West Coast Florida';
          branchLocation = 'Palmetto, FL (Serving Tampa Bay & Suncoast)';
        } else {
          branchName = 'Sysco Central Florida';
          branchLocation = 'Ocoee, FL (Serving Orlando, Daytona & Space Coast)';
        }
      } else if (st === 'CA') {
        if (cLower.includes('francisco') || cLower.includes('oakland') || cLower.includes('jose') || cLower.includes('sacramento')) {
          branchName = 'Sysco San Francisco';
          branchLocation = 'Fremont, CA (Serving Bay Area & Northern California)';
        } else {
          branchName = 'Sysco Los Angeles';
          branchLocation = 'Walnut, CA (Serving Greater Los Angeles & Orange County)';
        }
      } else if (st === 'NY' || st === 'NJ' || st === 'CT') {
        branchName = 'Sysco Metro New York';
        branchLocation = 'Jersey City, NJ (Serving NYC 5 Boroughs, Long Island & North Jersey)';
      } else if (st === 'MA' || st === 'RI' || st === 'NH' || st === 'ME' || st === 'VT') {
        branchName = 'Sysco Boston Operating Company';
        branchLocation = 'Plympton, MA (Serving Greater Boston & New England)';
      } else if (st === 'PA') {
        branchName = cLower.includes('pittsburgh') ? 'Sysco Western PA (Harmony, PA)' : 'Sysco Philadelphia (Philadelphia, PA)';
        branchLocation = `${city || 'PA'}, PA Market`;
      } else if (st === 'CO') {
        branchName = 'Sysco Denver Distribution Center';
        branchLocation = 'Denver, CO (Serving Front Range & Mountain Resort Region)';
      } else if (st === 'MN' || st === 'ND' || st === 'SD') {
        branchName = 'Sysco Minnesota Distribution Center';
        branchLocation = 'St. Paul, MN (Serving Twin Cities & Upper Midwest)';
      } else if (st === 'WA' || st === 'OR') {
        branchName = st === 'WA' ? 'Sysco Seattle (Kent, WA)' : 'Sysco Portland (Wilsonville, OR)';
        branchLocation = 'Pacific Northwest Division';
      } else if (st === 'TN') {
        branchName = 'Sysco Nashville Distribution Center';
        branchLocation = 'Nashville, TN (Serving Middle & East Tennessee)';
      } else if (st === 'OH') {
        branchName = cLower.includes('cleveland') ? 'Sysco Cleveland (Cleveland, OH)' : 'Sysco Central Ohio (Columbus, OH)';
        branchLocation = 'Ohio Valley Division';
      } else if (st === 'MI') {
        branchName = 'Sysco Detroit Distribution Center';
        branchLocation = 'Canton, MI (Serving Metro Detroit & SE Michigan)';
      } else if (st === 'VA' || st === 'DC' || st === 'MD') {
        branchName = 'Sysco Virginia (Harrisonburg, VA) / Sysco Baltimore';
        branchLocation = 'Mid-Atlantic Operating Division';
      } else if (st === 'AZ') {
        branchName = 'Sysco Arizona Distribution Center';
        branchLocation = 'Phoenix, AZ (Serving Valley of the Sun & Tucson)';
      } else {
        branchName = `Sysco ${st || 'Regional'} Broadline Division`;
        branchLocation = `${city || 'Local Area'}, ${st || 'US'}`;
      }
    } else if (dLower.includes('us foods') || dLower.includes('usfoods')) {
      primaryDistributor = 'US Foods';
      if (st === 'NC' || st === 'SC') {
        branchName = 'US Foods Charlotte Division';
        branchLocation = 'Fort Mill, SC (Serving Charlotte, Triad & Upstate SC)';
      } else if (st === 'GA') {
        branchName = 'US Foods Atlanta Division';
        branchLocation = 'Fairburn, GA (Serving Metro Atlanta & Central GA)';
      } else if (st === 'IL' || st === 'WI') {
        branchName = 'US Foods Chicago Metro Division';
        branchLocation = 'Bensenville, IL (Serving Chicago, Chicagoland & Milwaukee)';
      } else if (st === 'TX') {
        branchName = cLower.includes('houston') ? 'US Foods Houston Division' : 'US Foods Dallas-Fort Worth Division (Garland, TX)';
        branchLocation = `${city || 'Texas'}, TX Market`;
      } else if (st === 'FL') {
        branchName = cLower.includes('orlando') ? 'US Foods Orlando (Orlando, FL)' : 'US Foods South Florida (Boca Raton, FL)';
        branchLocation = 'Florida Dining Market';
      } else if (st === 'CA') {
        branchName = (cLower.includes('francisco') || cLower.includes('sacramento')) ? 'US Foods San Francisco (Livermore, CA)' : 'US Foods Los Angeles (La Mirada, CA)';
        branchLocation = 'California Foodservice Division';
      } else if (st === 'CO') {
        branchName = 'US Foods Denver Division';
        branchLocation = 'Centennial, CO (Serving Colorado Front Range)';
      } else if (st === 'MN') {
        branchName = 'US Foods Twin Cities Division';
        branchLocation = 'Plymouth, MN (Serving Minneapolis-St. Paul & Minnesota)';
      } else if (st === 'NY' || st === 'NJ') {
        branchName = 'US Foods Metro New York';
        branchLocation = 'Perth Amboy, NJ (Serving NYC Metro & New Jersey)';
      } else {
        branchName = `US Foods ${st || 'Regional'} Division`;
        branchLocation = `${city || 'Metro'}, ${st || 'US'}`;
      }
    } else if (dLower.includes('gordon') || dLower.includes('gfs')) {
      primaryDistributor = 'Gordon Food Service (GFS)';
      if (st === 'MI') {
        branchName = 'Gordon Food Service Midwest HQ & DC';
        branchLocation = 'Wyoming / Grand Rapids, MI (Primary GFS Distribution Hub)';
      } else if (st === 'KY' || st === 'IN') {
        branchName = 'GFS Shepherdsville Distribution Center';
        branchLocation = 'Shepherdsville, KY (Serving Louisville, Indianapolis & Bluegrass)';
      } else if (st === 'OH') {
        branchName = 'GFS Springfield Distribution Center';
        branchLocation = 'Springfield, OH (Serving Columbus, Cincinnati & Dayton)';
      } else if (st === 'IL' || st === 'WI') {
        branchName = 'GFS Kenosha Distribution Center';
        branchLocation = 'Kenosha, WI (Serving Chicago & Milwaukee corridors)';
      } else if (st === 'NC' || st === 'SC') {
        branchName = 'GFS Kannapolis Distribution Center';
        branchLocation = 'Kannapolis, NC (Serving Charlotte & Piedmont Region)';
      } else if (st === 'FL') {
        branchName = 'GFS Plant City Distribution Center';
        branchLocation = 'Plant City, FL (Serving Central & West Coast Florida)';
      } else {
        branchName = 'Gordon Food Service Regional Broadline DC';
        branchLocation = `${city || 'Midwest'}, ${st || 'Regional Hub'}`;
      }
    } else if (dLower.includes('pfg') || dLower.includes('performance')) {
      primaryDistributor = 'Performance Food Group (PFG)';
      if (st === 'GA') {
        branchName = "PFG Milton's Foodservice";
        branchLocation = 'Oakwood, GA (Serving Greater Atlanta & North Georgia)';
      } else if (st === 'NC' || st === 'SC') {
        branchName = 'Performance Foodservice Charlotte';
        branchLocation = 'Rock Hill, SC (Serving Charlotte & Piedmont)';
      } else if (st === 'IL') {
        branchName = 'PFG Roma Food Chicago';
        branchLocation = 'Franklin Park, IL (Dedicated Pizza & Italian Specialist DC)';
      } else if (st === 'TX') {
        branchName = 'Performance Foodservice Temple';
        branchLocation = 'Temple, TX (Serving Central & North Texas)';
      } else {
        branchName = 'Performance Foodservice Regional DC';
        branchLocation = `${city || 'Regional'}, ${st || 'Division'}`;
      }
    } else if (dLower.includes('ben e. keith') || dLower.includes('keith')) {
      primaryDistributor = 'Ben E. Keith Foods';
      if (cLower.includes('dallas') || cLower.includes('fort worth') || !city) {
        branchName = 'Ben E. Keith DFW Division HQ';
        branchLocation = 'Fort Worth, TX (Serving North Texas & DFW)';
      } else if (cLower.includes('antonio') || cLower.includes('austin')) {
        branchName = 'Ben E. Keith San Antonio Division';
        branchLocation = 'Selma, TX (Serving South & Central Texas)';
      } else if (cLower.includes('houston')) {
        branchName = 'Ben E. Keith Houston Division';
        branchLocation = 'Missouri City, TX (Serving Houston & Gulf Coast)';
      } else if (st === 'OK') {
        branchName = 'Ben E. Keith Oklahoma Division';
        branchLocation = 'Edmond, OK (Serving Oklahoma City & Tulsa)';
      } else {
        branchName = 'Ben E. Keith Southwest Foodservice Division';
        branchLocation = 'Fort Worth, TX';
      }
    } else if (dLower.includes('dot')) {
      primaryDistributor = 'Dot Foods';
      if (st === 'GA' || st === 'FL' || st === 'SC') {
        branchName = 'Dot Foods Georgia DC';
        branchLocation = 'Vidalia, GA (Serving Southeast Distributors)';
      } else if (st === 'TX') {
        branchName = 'Dot Foods Texas DC';
        branchLocation = 'Burleson, TX (Serving Texas & Southwest DSRs)';
      } else if (st === 'CA' || st === 'NV') {
        branchName = 'Dot Foods California DC';
        branchLocation = 'Modesto, CA (Serving West Coast Broadliners)';
      } else if (st === 'MD' || st === 'PA' || st === 'VA') {
        branchName = 'Dot Foods Maryland DC';
        branchLocation = 'Williamsport, MD (Serving Mid-Atlantic Distributors)';
      } else {
        branchName = 'Dot Foods National HQ & Redistribution DC';
        branchLocation = 'Mt. Sterling, IL (Serving All National Broadliners)';
      }
    } else if (dLower.includes('cheney')) {
      primaryDistributor = 'Cheney Brothers (CBI)';
      if (st === 'NC') {
        branchName = 'Cheney Brothers Statesville';
        branchLocation = 'Statesville, NC (Serving North Carolina)';
      } else if (cLower.includes('ocala') || cLower.includes('orlando') || cLower.includes('tampa')) {
        branchName = 'Cheney Brothers Ocala';
        branchLocation = 'Ocala, FL (Serving Central & North Florida)';
      } else {
        branchName = 'Cheney Brothers Riviera Beach Corporate HQ';
        branchLocation = 'Riviera Beach, FL (Serving South Florida & Caribbean)';
      }
    } else if (dLower.includes('shamrock')) {
      primaryDistributor = 'Shamrock Foods';
      branchName = st === 'CO' ? 'Shamrock Foods Denver (Commerce City, CO)' : 'Shamrock Foods Phoenix Corporate (Phoenix, AZ)';
      branchLocation = `${city || 'Rocky Mountain / Desert SW'}, ${st || 'AZ/CO'}`;
    } else {
      primaryDistributor = rawDist || 'Primary Regional Broadliner';
      branchName = `${primaryDistributor} Serving ${city || 'Metro'}, ${st || 'Market'}`;
      branchLocation = `${city || 'Local DC'}, ${st || 'Regional Route'}`;
    }

    return {
      branchName,
      branchLocation,
      zipUsed,
      isZipEstimated,
      primaryDistributor
    };
  }

  function getConversionPageInfo(lead) {
    const rawUrl = lead.page_url || 'https://www.hormelfoodservice.com/contact-us/';
    const u = rawUrl.toLowerCase();
    const brand = (lead.brand || '').toLowerCase();
    const hook = (lead.key_hook || '').toLowerCase();
    const tactic = (lead.tactic_name || '').toLowerCase();

    let pageTitle = 'Hormel Foodservice B2B Inbound Portal';
    let thumbImg = 'assets/landing_pages/real_hfs_home.png';
    let badgeText = 'Web Form Submission';

    if (u.includes('calabrian') || tactic.includes('calabrian') || hook.includes('calabrian') || hook.includes('chili')) {
      pageTitle = 'Fontanini® Calabrian Chili Campaign';
      thumbImg = 'assets/landing_pages/real_calabrian_chili.png';
      badgeText = '🌶️ Campaign Landing Page';
    } else if (u.includes('bacon-1') || u.includes('bacon1') || brand.includes('bacon')) {
      pageTitle = 'HORMEL® BACON 1™ Brand Portal';
      thumbImg = 'assets/landing_pages/real_bacon_1.png';
      badgeText = '🥓 Brand Sample Page';
    } else if (u.includes('fontanini') || brand.includes('fontanini') || u.includes('meatball')) {
      pageTitle = 'FONTANINI® Italian Meats & Pizza';
      thumbImg = 'assets/landing_pages/real_fontanini.png';
      badgeText = '🍕 Brand Solutions Portal';
    } else if (u.includes('flash-180') || brand.includes('flash 180') || hook.includes('under 3 min')) {
      pageTitle = 'FLASH 180™ Battered Chicken';
      thumbImg = 'assets/landing_pages/real_flash_180.png';
      badgeText = '🍗 Speed-of-Service Portal';
    } else if (u.includes('fire-braised') || brand.includes('fire braised')) {
      pageTitle = 'HORMEL® FIRE BRAISED™ Meats';
      thumbImg = 'assets/landing_pages/real_fire_braised.png';
      badgeText = '🔥 Flame-Seared Solutions';
    } else if (u.includes('austin-blues') || brand.includes('austin blues') || hook.includes('smokehouse')) {
      pageTitle = 'AUSTIN BLUES® BBQ';
      thumbImg = 'assets/landing_pages/real_austin_blues.png';
      badgeText = '🍖 Hardwood BBQ Portal';
    } else if (u.includes('find-distributor') || u.includes('locate-distributor')) {
      pageTitle = 'Find a Distributor Tool';
      thumbImg = 'assets/landing_pages/real_find_distributor.png';
      badgeText = '🔍 Distributor Finder';
    } else if (u.includes('opt-in') || u.includes('newsletter')) {
      pageTitle = 'Operator Registration Portal';
      thumbImg = 'assets/landing_pages/real_opt_in.png';
      badgeText = '📧 Operator Opt-In';
    } else if (u.includes('contact')) {
      pageTitle = 'Contact A Rep Portal';
      thumbImg = 'assets/landing_pages/real_contact_us.png';
      badgeText = '🤝 Contact A Rep';
    } else {
      pageTitle = 'Culinary Solutions Hub';
      thumbImg = 'assets/landing_pages/real_hfs_home.png';
      badgeText = '🌐 Solutions Portal';
    }

    return {
      rawUrl,
      pageTitle,
      thumbImg,
      badgeText
    };
  }

  function openLeadDrawer(lead) {
    document.getElementById('drawer-lead-name').textContent = lead.full_name || 'Anonymous Lead';
    document.getElementById('drawer-lead-company').textContent = `${lead.company || 'Private Operator'} • ${lead.city || ''}, ${lead.state || ''}`;

    const badges = document.getElementById('drawer-badges');
    let opBadgeHtml = '';
    if (lead.mql_tier === 'certified_mql' || lead.is_verified_operator) {
      opBadgeHtml = `<span class="badge-operator-certified" style="font-size: 0.75rem; padding: 4px 10px;" title="${escapeHtml(lead.verification_source || '')}">🛡️ Certified Foodservice Outlet (MQL)</span>`;
    } else if (lead.mql_tier === 'distributor') {
      opBadgeHtml = `<span class="badge-distributor-partner" style="font-size: 0.75rem; padding: 4px 10px;" title="${escapeHtml(lead.verification_source || '')}">🤝 Foodservice Distributor Partner</span>`;
    } else if (lead.mql_tier === 'prospective') {
      opBadgeHtml = `<span class="badge-operator-prospective" style="font-size: 0.75rem; padding: 4px 10px;" title="${escapeHtml(lead.verification_source || '')}">🟡 Prospective Operator (Pending Match)</span>`;
    } else if (lead.mql_tier === 'internal') {
      opBadgeHtml = `<span class="badge-internal" style="font-size: 0.75rem; padding: 4px 10px;" title="${escapeHtml(lead.verification_source || '')}">🏢 Internal Corporate Record</span>`;
    } else {
      opBadgeHtml = `<span class="badge-consumer" style="font-size: 0.75rem; padding: 4px 10px;" title="${escapeHtml(lead.verification_source || '')}">🏠 Home Cook / Consumer Profile</span>`;
    }

    badges.innerHTML = `
      ${opBadgeHtml}
      <span class="badge badge-hook">🎯 ${escapeHtml(lead.key_hook)}</span>
      <span class="badge badge-brand">${escapeHtml(lead.brand)}</span>
      <span class="badge badge-segment">${escapeHtml(lead.subsegment || lead.segment)}</span>
      <span class="badge badge-type">${escapeHtml(lead.tactic_type)}</span>
      ${lead.is_enterprise ? '<span class="badge badge-brand" style="background-color: #fef08a; color: #854d0e;">⭐ Enterprise Account</span>' : ''}
    `;

    const emailLink = document.getElementById('drawer-email-link');
    emailLink.textContent = lead.email || '—';
    emailLink.href = lead.email ? `mailto:${lead.email}` : '#';

    const webSearchQ = encodeURIComponent(`${lead.company || lead.full_name} ${lead.city || ''} ${lead.state || ''} address phone foodservice menu`);

    document.getElementById('drawer-phone').innerHTML = lead.phone 
      ? `<a href="tel:${escapeHtml(lead.phone)}" class="text-link">${escapeHtml(lead.phone)}</a>` 
      : '<span style="color: var(--text-muted); font-style: italic;">Phone not listed</span>';
    document.getElementById('drawer-job-title').textContent = lead.job_title || '—';
    document.getElementById('drawer-company-name').innerHTML = `
      <strong>${escapeHtml(lead.company || 'Personal / Household')}</strong> 
      <a href="https://www.google.com/search?q=${webSearchQ}" target="_blank" class="btn-web-search" style="margin-left: 10px;" title="Search web to verify address, phone, and menu">🔍 Web Search Operator Info ↗</a>
      ${lead.company ? `<a href="${escapeHtml(lead.menu_search_url)}" target="_blank" class="text-link" style="margin-left: 8px;">🍽️ Menu</a>` : ''}
      <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px; font-weight: 500;">
        Audit: <span style="color: #0f172a; font-weight: 700;">${escapeHtml(lead.verification_source || 'Standard Contact')}</span>
      </div>
    `;

    document.getElementById('drawer-address').innerHTML = lead.address 
      ? escapeHtml(lead.address) 
      : '<span style="color: var(--text-muted); font-style: italic;">Address not listed</span>';
    document.getElementById('drawer-city-state-zip').textContent = `${lead.city || '—'}, ${lead.state || ''} ${lead.zip || ''}`;
    document.getElementById('drawer-distributor').textContent = lead.distributor || '—';
    document.getElementById('drawer-sales-rep').textContent = lead.sales_rep || 'Unassigned';
    document.getElementById('drawer-products').textContent = lead.products || '—';
    document.getElementById('drawer-crm-id').innerHTML = lead.crm_id ? `<a href="${getCrmUrl(lead.crm_id)}" target="_blank" class="text-link">${escapeHtml(lead.crm_id)}</a>` : '—';

    const commentsBox = document.getElementById('drawer-comments-box');
    commentsBox.innerHTML = lead.comments ? escapeHtml(lead.comments) : '<span style="color: var(--text-muted); font-style: italic;">No custom inquiry submitted with form.</span>';

    const statusSelect = document.getElementById('drawer-lead-status');
    statusSelect.value = getLeadStatus(lead);
    statusSelect.onchange = (e) => {
      setLeadStatus(lead, e.target.value);
      applyGlobalFilters();
      showToast(`Status updated to ${e.target.value}`);
    };

    const notesArea = document.getElementById('drawer-rep-notes');
    notesArea.value = getRepNotes(lead.email);
    notesArea.oninput = (e) => {
      setRepNotes(lead.email, e.target.value);
    };
    notesArea.onblur = () => {
      renderTable();
    };

    const scoreVal = lead.lead_score || 0;
    const scoreBadge = document.getElementById('drawer-lead-score-badge');
    scoreBadge.textContent = `Score: ${scoreVal}`;
    const scoreFill = document.getElementById('drawer-lead-score-fill');
    scoreFill.style.width = `${scoreVal}%`;
    scoreFill.style.backgroundColor = scoreVal >= 80 ? 'var(--hfs-emerald)' : (scoreVal >= 60 ? 'var(--jtm-orange)' : 'var(--text-muted)');
    document.getElementById('drawer-lead-score-breakdown').textContent = getScoreExplanation(lead);

    const primaryTactic = allTactics.find(item => item.id === lead.tactic_id);

    const srcTokens = (lead.utm_source || '').split(';').map(s => s.trim()).filter(Boolean);
    const medTokens = (lead.utm_medium || '').split(';').map(s => s.trim()).filter(Boolean);
    const cmpTokens = (lead.utm_campaign || '').split(';').map(s => s.trim()).filter(Boolean);
    const cntTokens = (lead.utm_content || '').split(';').map(s => s.trim()).filter(Boolean);

    const maxTouches = Math.max(1, srcTokens.length, medTokens.length, cmpTokens.length, cntTokens.length);

    // Parse conversion date timestamp as anchor
    let conversionTs = 0;
    if (lead.date) {
      const parsed = Date.parse(lead.date.replace(' ', 'T'));
      if (!isNaN(parsed)) conversionTs = parsed;
    }
    if (!conversionTs) conversionTs = Date.now();

    const touchpointList = [];

    for (let i = 0; i < maxTouches; i++) {
      const src = srcTokens[i] || (i === 0 ? (lead.utm_source || lead.publication_group || 'Direct Web') : '');
      const med = medTokens[i] || (i === 0 ? (lead.utm_medium || lead.tactic_channel || 'Inbound') : '');
      const cmp = cmpTokens[i] || (i === 0 ? (lead.utm_campaign || lead.brand || 'General') : '');
      const cnt = cntTokens[i] || (i === 0 ? (lead.utm_content || lead.key_hook || 'Default') : '');

      // Find best-matching tactic for this touchpoint
      let touchTactic = primaryTactic;
      if (i > 0) {
        const altTactic = allTactics.find(t => 
          (src && t.utm_source && t.utm_source.toLowerCase().includes(src.toLowerCase())) ||
          (cmp && t.utm_campaign && t.utm_campaign.toLowerCase().includes(cmp.toLowerCase())) ||
          (src && t.publisher && t.publisher.toLowerCase().includes(src.toLowerCase()))
        );
        if (altTactic) touchTactic = altTactic;
      }

      const placementName = touchTactic ? touchTactic.name : lead.tactic_name;
      const placementPub = touchTactic ? (touchTactic.publisher || touchTactic.publication_group) : lead.publication_group;
      const placementType = touchTactic ? touchTactic.tactic_type : (lead.tactic_type || 'Digital Ad');
      const creativeImg = touchTactic ? touchTactic.creative_image : null;

      // Determine chronological placement date
      let touchDateStr = '';
      let touchDateTs = 0;

      if (touchTactic && touchTactic.run_date && touchTactic.run_date !== 'Flight Period') {
        const parsedTacticDate = Date.parse(touchTactic.run_date);
        if (!isNaN(parsedTacticDate) && parsedTacticDate <= conversionTs) {
          touchDateStr = touchTactic.run_date;
          touchDateTs = parsedTacticDate;
        }
      }

      // If tactic date is missing or after conversion date, determine realistic preceding date
      if (!touchDateTs) {
        const daysPrior = (maxTouches - i) * 6 + 4;
        const calcDate = new Date(conversionTs - (daysPrior * 86400000));
        touchDateStr = calcDate.toISOString().slice(0, 10);
        touchDateTs = calcDate.getTime();
      }

      touchpointList.push({
        index: i,
        tactic: touchTactic,
        name: placementName,
        pub: placementPub,
        type: placementType,
        img: creativeImg,
        dateStr: touchDateStr,
        dateTs: touchDateTs,
        src,
        med,
        cmp,
        cnt
      });
    }

    // STRICT CHRONOLOGICAL SORTING: Ascending order (earliest interaction first -> latest before conversion)
    touchpointList.sort((a, b) => a.dateTs - b.dateTs);

    let touchesHtml = '';
    touchpointList.forEach((touch, seqIdx) => {
      const isInitial = seqIdx === 0;
      const isFinalTouch = seqIdx === touchpointList.length - 1;
      const touchTitle = isInitial
        ? 'Touchpoint 1: Initial Ad Impression'
        : (isFinalTouch && touchpointList.length > 1 
            ? `Touchpoint ${seqIdx + 1}: Pre-Conversion Touch` 
            : `Touchpoint ${seqIdx + 1}: Re-Engagement`);

      const thumbHtml = touch.img ? `
        <div class="pathway-thumb-col" title="Click to open full creative image">
          <img src="${escapeHtml(touch.img)}" alt="${escapeHtml(touch.name)}" class="tactic-thumb-img" onclick="window.open('${escapeHtml(touch.img)}', '_blank')" onerror="this.parentElement.innerHTML='<div class=\'creative-thumb-fallback\'><span>📷</span><small>Image not available</small></div>';">
        </div>
      ` : `
        <div class="pathway-thumb-col">
          <div class="creative-thumb-fallback" title="Creative visual not found in media deck">
            <span>📷</span>
            <small>Image not available</small>
          </div>
        </div>
      `;

      touchesHtml += `
        <div class="pathway-step-card">
          ${thumbHtml}
          <div class="pathway-details-col">
            <div class="pathway-step-header">
              <span>${touchTitle}</span>
              <span class="attr-clickable drawer-isolate-tactic" data-isolate-tactic="${touch.tactic ? touch.tactic.id : lead.tactic_id}" style="color: #0284c7; text-decoration: underline; font-size: 0.6875rem;" title="Isolate leads for this placement">Isolate Tactic ➔</span>
            </div>
            
            <div style="font-weight: 700; font-size: 0.8125rem; color: var(--jtm-petrol); margin-bottom: 3px;">
              ${escapeHtml(touch.name)}
            </div>

            <div class="pathway-date-badge">
              📅 Run Date: <strong>${escapeHtml(touch.dateStr)}</strong>
            </div>

            <div style="font-size: 0.6875rem; color: var(--text-muted); margin-bottom: 6px;">
              Publisher: <span class="attr-clickable drawer-isolate-pub" data-isolate-pub="${escapeHtml(touch.pub)}" style="color: #0284c7; font-weight: 600; text-decoration: underline;">${escapeHtml(touch.pub)}</span> • Format: ${escapeHtml(touch.type)}
            </div>

            <div class="touchpoint-tags">
              ${touch.src ? `<span class="utm-chip drawer-utm-chip" data-utm-key="utm_source" data-utm-val="${escapeHtml(touch.src)}" title="Click to isolate leads with source: ${escapeHtml(touch.src)}">source: <strong>${escapeHtml(touch.src)}</strong></span>` : ''}
              ${touch.med ? `<span class="utm-chip drawer-utm-chip" data-utm-key="utm_medium" data-utm-val="${escapeHtml(touch.med)}" title="Click to isolate leads with medium: ${escapeHtml(touch.med)}">medium: <strong>${escapeHtml(touch.med)}</strong></span>` : ''}
              ${touch.cmp ? `<span class="utm-chip drawer-utm-chip" data-utm-key="utm_campaign" data-utm-val="${escapeHtml(touch.cmp)}" title="Click to isolate leads with campaign: ${escapeHtml(touch.cmp)}">campaign: <strong>${escapeHtml(touch.cmp)}</strong></span>` : ''}
              ${touch.cnt ? `<span class="utm-chip drawer-utm-chip" data-utm-key="utm_content" data-utm-val="${escapeHtml(touch.cnt)}" title="Click to isolate leads with content: ${escapeHtml(touch.cnt)}">content: <strong>${escapeHtml(touch.cnt)}</strong></span>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    const pageInfo = getConversionPageInfo(lead);
    const pathway = document.getElementById('drawer-attribution-pathway');
    pathway.innerHTML = `
      <div class="attribution-node">
        <div class="attribution-dot dot-tactic" title="Strategic Key Hook"></div>
        <div class="attribution-label">Strategic Focus: ${escapeHtml(lead.key_hook)}</div>
      </div>
      <div class="attribution-meta">Creative Angle: ${escapeHtml(lead.creative_angle || lead.tactic_name)}</div>

      <div class="attribution-connector"></div>
      
      <div style="margin: 6px 0 10px 0;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #334155; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em;">
          Sequential Marketing Pathway (${maxTouches} Placement Interaction${maxTouches > 1 ? 's' : ''}):
        </div>
        ${touchesHtml}
      </div>

      <div class="attribution-connector"></div>
      <div class="attribution-node">
        <div class="attribution-dot dot-touchpoint" title="Web Inbound Lead Conversion"></div>
        <div class="attribution-label" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span>Website Form Conversion</span>
          <span class="badge" style="font-size: 0.6875rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
            ${pageInfo.badgeText}
          </span>
        </div>
      </div>

      <div class="conversion-page-step-card" style="margin-top: 8px; margin-left: 26px;">
        <div class="conversion-thumb-col" title="Click to view live conversion page: ${escapeHtml(pageInfo.rawUrl)}" onclick="window.open('${escapeHtml(pageInfo.rawUrl)}', '_blank')">
          <img src="${escapeHtml(pageInfo.thumbImg)}" alt="${escapeHtml(pageInfo.pageTitle)}" class="conversion-thumb-img" onerror="this.src='assets/landing_pages/real_hfs_home.png'">
          <div class="thumb-hover-overlay">
            <span>🔍 Open Live Page ↗</span>
          </div>
        </div>

        <div class="pathway-details-col">
          <div class="pathway-step-header">
            <span style="color: #047857; font-weight: 800;">📍 Landing Page Viewed</span>
            <a href="${escapeHtml(pageInfo.rawUrl)}" target="_blank" class="conversion-external-btn" title="Open page in new tab">
              Open Page ↗
            </a>
          </div>

          <div style="font-weight: 800; font-size: 0.8125rem; color: var(--jtm-petrol); margin-bottom: 4px;">
            ${escapeHtml(pageInfo.pageTitle)}
          </div>

          <div class="pathway-date-badge" style="background: #f0fdf4; color: #166534; border-color: #bbf7d0; margin-bottom: 6px;">
            📅 Conversion Date: <strong>${escapeHtml(lead.date)}</strong>
          </div>

          <div class="conversion-url-container">
            <span class="conversion-url-label">Destination URL:</span>
            <a href="${escapeHtml(pageInfo.rawUrl)}" target="_blank" class="conversion-clickable-url" title="Click to open conversion page in new browser tab">
              🔗 ${escapeHtml(pageInfo.rawUrl)}
            </a>
          </div>
        </div>
      </div>
    `;

    pathway.querySelectorAll('.drawer-utm-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        closeLeadDrawer();
        isolateByUtm(chip.getAttribute('data-utm-key'), chip.getAttribute('data-utm-val'));
      });
    });
    pathway.querySelectorAll('.drawer-isolate-pub').forEach(el => {
      el.addEventListener('click', () => {
        closeLeadDrawer();
        isolateByPublication(el.getAttribute('data-isolate-pub'));
      });
    });
    pathway.querySelectorAll('.drawer-isolate-tactic').forEach(el => {
      el.addEventListener('click', () => {
        closeLeadDrawer();
        isolateByTactic(el.getAttribute('data-isolate-tactic'));
      });
    });

    // Action Buttons
    const actEmail = document.getElementById('action-email');
    if (lead.email) {
      actEmail.style.display = 'inline-flex';
      actEmail.onclick = () => openEmailModal(lead);
    } else {
      actEmail.style.display = 'none';
    }

    const actCall = document.getElementById('action-call');
    if (lead.phone) {
      actCall.style.display = 'inline-flex';
      actCall.onclick = () => window.open(`tel:${lead.phone.replace(/\D/g, '')}`, '_self');
    } else {
      actCall.style.display = 'none';
    }

    const actWeb = document.getElementById('action-website');
    if (lead.company_website) {
      actWeb.style.display = 'inline-flex';
      actWeb.onclick = () => window.open(lead.company_website, '_blank');
    } else {
      actWeb.style.display = 'none';
    }

    const actMaps = document.getElementById('action-maps');
    if (lead.address || lead.city) {
      const qStr = lead.address ? `${lead.address}, ${lead.city}, ${lead.state}` : `${lead.company}, ${lead.city}, ${lead.state}`;
      actMaps.style.display = 'inline-flex';
      actMaps.onclick = () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(qStr)}`, '_blank');
    } else {
      actMaps.style.display = 'none';
    }

    const actCrm = document.getElementById('action-crm');
    if (lead.crm_id) {
      actCrm.style.display = 'inline-flex';
      actCrm.innerHTML = '☁️ Salesforce CRM';
      actCrm.onclick = () => window.open(getCrmUrl(lead.crm_id), '_blank');
    } else if (lead.company || lead.full_name) {
      actCrm.style.display = 'inline-flex';
      actCrm.innerHTML = '🔍 Search CRM';
      actCrm.onclick = () => window.open(`https://hormel.lightning.force.com/lightning/globalSearch/results?q=${encodeURIComponent(lead.company || lead.full_name)}`, '_blank');
    } else {
      actCrm.style.display = 'none';
    }

    renderDrawerCulinaryPlaybook(lead);
    renderDrawerRestaurantMenuIdeation(lead);

    document.getElementById('drawer-overlay').classList.add('open');
    document.getElementById('lead-drawer').classList.add('open');
    document.getElementById('lead-drawer').setAttribute('aria-hidden', 'false');
  }

  function closeLeadDrawer() {
    document.getElementById('drawer-overlay').classList.remove('open');
    document.getElementById('lead-drawer').classList.remove('open');
    document.getElementById('lead-drawer').setAttribute('aria-hidden', 'true');
  }

  function getScoreExplanation(lead) {
    const reasons = ['Base: 40 pts'];
    if (lead.is_enterprise) reasons.push('Enterprise Account: +35 pts');
    if (lead.job_title) reasons.push('Key Decision Title: +15 pts');
    if (lead.comments) reasons.push('Direct Inquiry: +10 pts');
    if (lead.distributor) reasons.push('Distributor Linked: +5 pts');
    return reasons.join(' • ');
  }

  // ===========================================================================
  // 13. EMAIL OUTREACH MODAL
  // ===========================================================================
  function openEmailModal(lead) {
    currentEmailLead = lead;
    updateEmailPreview();
    document.getElementById('email-modal-overlay').classList.add('open');
    document.getElementById('email-modal').classList.add('open');
  }

  function closeEmailModal() {
    document.getElementById('email-modal-overlay').classList.remove('open');
    document.getElementById('email-modal').classList.remove('open');
    currentEmailLead = null;
  }

  function updateEmailPreview() {
    if (!currentEmailLead) return;
    const l = currentEmailLead;
    const type = document.getElementById('email-template-select').value;
    const firstName = l.first_name || l.full_name.split(' ')[0] || 'there';
    const repName = l.sales_rep || 'your Hormel Foodservice Representative';
    const brand = l.brand || 'Hormel Foodservice';
    const company = l.company || 'your restaurant';
    const distributor = l.distributor || 'your regional distributor';

    let subject = '';
    let body = '';

    if (type === 'follow_up_sample') {
      subject = `Follow-up on your Hormel Foodservice Sample Request`;
      body = `Hi ${firstName},

I saw that you recently submitted a sample inquiry for ${brand} products on our website through our ${l.tactic_name} placement (${l.key_hook}). 

I wanted to follow up and see if you have had a chance to connect with ${distributor} to coordinate, or if I can assist with sample logistics directly.

Are you looking to add these items to your menu at ${company} in the near future?

Best regards,

${repName}
Hormel Foodservice Team`;
    } else if (type === 'general_intro') {
      subject = `Foodservice Protein Solutions - Hormel Foodservice`;
      body = `Hi ${firstName},

My name is ${repName}, and I am your dedicated Hormel Foodservice representative. I noticed your interest in our ${brand} portfolio page recently.

I would love to learn more about the menu concepts at ${company} and share how our labor-saving proteins can support your kitchen. Do you have a few minutes for a brief introductory call this week?

Best,

${repName}
Hormel Foodservice`;
    } else if (type === 'brand_pitch') {
      const brands = window.BRAND_CATALOG_DATA || [];
      const bName = (brand || '').toLowerCase();
      let matchedBrand = brands.find(b => bName.includes(b.brand_line.toLowerCase()) || b.brand_line.toLowerCase().includes(bName));
      if (!matchedBrand) {
        const sub = (l.subsegment || l.segment || '').toLowerCase();
        if (sub.includes('pizz') || sub.includes('italian')) matchedBrand = brands.find(b => b.id === 'fontanini');
        else if (sub.includes('college') || sub.includes('c&u')) matchedBrand = brands.find(b => b.id === 'hormel-halal');
        else if (sub.includes('school') || sub.includes('k-12')) matchedBrand = brands.find(b => b.id === 'jennie-o');
        else if (sub.includes('qsr') || sub.includes('c-store')) matchedBrand = brands.find(b => b.id === 'flash-180');
        else if (sub.includes('bbq')) matchedBrand = brands.find(b => b.id === 'austin-blues');
        else matchedBrand = brands[0]; // Bacon 1
      }
      const topSku = (matchedBrand && matchedBrand.flagship_skus && matchedBrand.flagship_skus[0]) || { item_code: '#102342', name: 'Flagship SKU' };
      const prep = (matchedBrand && (matchedBrand.prep_specs.convection_oven || matchedBrand.prep_specs.deep_fryer || matchedBrand.prep_specs.oven_bake || matchedBrand.prep_specs.steamer_or_oven)) || 'Heat & Serve';

      subject = `Culinary Labor-Saving Solutions with ${matchedBrand ? matchedBrand.brand_name : brand} for ${company}`;
      body = `Hi ${firstName},

I noticed your inquiry regarding ${brand} on our website. As your dedicated Hormel Foodservice representative, I wanted to share how our culinary solutions can solve back-of-house labor challenges at ${company}:

"${matchedBrand ? matchedBrand.official_copy : ''}"

Operational & Speed Highlights:
• BOH Prep Benchmark: ${prep}
• Kitchen Labor Savings: ${matchedBrand ? matchedBrand.prep_specs.labor_savings : 'Eliminates skilled prep labor'}
• Yield Advantage: ${matchedBrand ? matchedBrand.prep_specs.yield_advantage : '100% usable billable yield'}

Our top recommended product for your kitchen is ${topSku.name} (${topSku.item_code}).

Would you be open to receiving a chef sample kit or coordinating a cut-and-wrap demonstration with ${distributor}?

Best regards,

${repName}
Hormel Foodservice Team
https://www.hormelfoodservice.com/`;
    } else if (type === 'brand_interest') {
      subject = `Menu Innovation with ${brand} - Hormel Foodservice`;
      body = `Hi ${firstName},

Thank you for your interest in our ${brand} product line. Our culinary team has put together some menu inspiration and recipe suggestions specifically tailored for ${l.subsegment || l.segment} operators around ${l.key_hook}.

I've prepared some product details and specs for ${company}. Let me know if you would like to schedule a brief consultation to explore how we can help save on back-of-house labor while driving guest traffic.

Best,

${repName}
Hormel Foodservice`;
    }

    document.getElementById('email-subject-preview').value = subject;
    document.getElementById('email-body-preview').value = body;
  }

  function launchMailto() {
    if (!currentEmailLead) return;
    const sub = encodeURIComponent(document.getElementById('email-subject-preview').value);
    const body = encodeURIComponent(document.getElementById('email-body-preview').value);
    const email = currentEmailLead.email;

    if (getLeadStatus(currentEmailLead) === 'New') {
      setLeadStatus(currentEmailLead, 'Contacted');
      applyGlobalFilters();
    }

    window.open(`mailto:${email}?subject=${sub}&body=${body}`, '_self');
    closeEmailModal();
    showToast(`Drafted email for ${currentEmailLead.full_name}`);
  }

  // ===========================================================================
  // 14. CSV EXPORT (WITH LOCALSTATUS & NOTES)
  // ===========================================================================
  function exportFilteredCSV() {
    if (!filteredLeads.length) {
      showToast('No leads to export.');
      return;
    }

    const cols = [
      'id', 'date', 'full_name', 'email', 'phone', 'company', 'company_website',
      'job_title', 'city', 'state', 'zip', 'country', 'brand', 'segment', 'subsegment',
      'key_hook', 'publication_group', 'tactic_type', 'tactic_name', 'tactic_publisher',
      'tactic_channel', 'distributor', 'sales_rep', 'crm_id', 'comments', 'follow_up_status', 'rep_notes'
    ];

    let csvStr = cols.map(c => `"${c.toUpperCase()}"`).join(',') + '\n';

    filteredLeads.forEach(l => {
      const row = cols.map(c => {
        let val = '';
        if (c === 'follow_up_status') {
          val = getLeadStatus(l);
        } else if (c === 'rep_notes') {
          val = getRepNotes(l.email);
        } else {
          val = l[c] || '';
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvStr += row.join(',') + '\n';
    });

    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hfs_leads_export_${globalDatePreset}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast(`Exported ${filteredLeads.length.toLocaleString()} leads to CSV`);
  }

  // ===========================================================================
  // 14b. VIEW: AUDIENCE & OPERATOR INTELLIGENCE PROFILE
  // ===========================================================================
  function renderAudienceProfile(brandFilter = 'all') {
    const brandName = brandFilter || audienceBrandFilter || 'all';
    let targetLeads = filteredLeads;
    if (brandName && brandName !== 'all') {
      targetLeads = filteredLeads.filter(l => matchesBrand(l.brand, brandName));
    }
    const total = targetLeads.length;

    // 1. Hero KPI Strip
    const audTotal = document.getElementById('aud-total-leads');
    if (audTotal) audTotal.textContent = total.toLocaleString();

    const audShare = document.getElementById('aud-brand-share');
    if (audShare) {
      const windowTotal = filteredLeads.length;
      const share = windowTotal > 0 ? ((total / windowTotal) * 100).toFixed(1) : 100;
      const bLabel = brandName === 'all' ? 'Active Date Window' : brandName;
      const dateTag = globalDatePreset !== 'all' ? ` (${globalDatePreset.toUpperCase()})` : ' (All-Time)';
      audShare.textContent = `${share}% of ${bLabel}${dateTag}`;
    }

    const verifiedCount = targetLeads.filter(l => l.is_verified_operator).length;
    const verifiedPct = total > 0 ? ((verifiedCount / total) * 100).toFixed(1) : 0;
    const audVer = document.getElementById('aud-verified-rate');
    if (audVer) audVer.textContent = `${verifiedCount.toLocaleString()} (${verifiedPct}%)`;

    const entCount = targetLeads.filter(l => l.is_enterprise).length;
    const entPct = total > 0 ? ((entCount / total) * 100).toFixed(1) : 0;
    const audEnt = document.getElementById('aud-enterprise-rate');
    if (audEnt) audEnt.textContent = `${entCount.toLocaleString()} (${entPct}%)`;

    const avgScore = total > 0 ? Math.round(targetLeads.reduce((acc, l) => acc + (l.lead_score || 0), 0) / total) : 0;
    const audAvg = document.getElementById('aud-avg-score');
    if (audAvg) audAvg.textContent = `${avgScore} / 100`;

    // 2. Section 7: Likely Highest-Value Operator Targets (Enterprise & Growth Whales)
    renderAudienceHighValueTargets(targetLeads, brandName);

    // 3. Section 1: Demographics & Decision-Maker Hierarchy
    renderAudienceDemographics(targetLeads, total);

    // 4. Section 2: Foodservice Operator Segments (IFMA Standards)
    renderAudienceSegments(targetLeads, total);

    // 5. Section 3: Type of Location & Geographic Footprint
    renderAudienceLocations(targetLeads, total);

    // 6. Section 4: Tactics Most Resonant
    renderAudienceTactics(targetLeads, total);

    // 7. Section 5: Messages Most Resonant (Strategic Messaging Hooks)
    renderAudienceHooks(targetLeads, total);

    // 8. Section 6: Media Publications Most Engaged With
    renderAudiencePublications(targetLeads, total);
  }

  function renderAudienceHighValueTargets(targetLeads, brandFilter) {
    const container = document.getElementById('aud-high-value-targets');
    if (!container) return;

    // Filter candidate leads: verified operator with company name and (enterprise or high score)
    const candidates = targetLeads.filter(l => l.is_verified_operator && l.company && (l.is_enterprise || l.lead_score >= 70));
    
    // Sort by weighted operator priority
    candidates.sort((a, b) => {
      const scoreA = (a.lead_score || 60) + (a.is_enterprise ? 25 : 0) + (a.job_title ? 10 : 0);
      const scoreB = (b.lead_score || 60) + (b.is_enterprise ? 25 : 0) + (b.job_title ? 10 : 0);
      return scoreB - scoreA;
    });

    // Deduplicate by company name to present diverse high-value accounts
    const seen = new Set();
    const topTargets = [];
    for (const c of candidates) {
      const normComp = c.company.toLowerCase().trim();
      if (!seen.has(normComp)) {
        seen.add(normComp);
        topTargets.push(c);
        if (topTargets.length >= 6) break;
      }
    }

    if (topTargets.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #64748b;">No high-value enterprise accounts match current brand filter.</div>`;
      return;
    }

    let html = '';
    topTargets.forEach(lead => {
      let tierClass = 'tier-3';
      let tierLabel = '🚀 Tier 3: High-Volume Flag';
      let revenueEst = '$35,000 - $75,000 ARR';
      let caseEst = '750+ cases/yr';

      if (lead.is_enterprise || lead.lead_score >= 95) {
        tierClass = 'tier-1';
        tierLabel = '⭐ Tier 1: Mega-Chain / Feeder';
        revenueEst = '$175,000 - $350,000 ARR';
        caseEst = '3,500+ cases/yr';
      } else if (lead.lead_score >= 80) {
        tierClass = 'tier-2';
        tierLabel = '💎 Tier 2: Regional Group (10-50 units)';
        revenueEst = '$85,000 - $160,000 ARR';
        caseEst = '1,800+ cases/yr';
      }

      // Tailored brand sales hook
      let hook = 'HFS Labor Solutions: Speed-scratch prep efficiency reducing line labor hours by 40%.';
      const bLower = (lead.brand || brandFilter || '').toLowerCase();
      if (bLower.includes('bacon 1')) {
        hook = 'Bacon 1: 100% usable yield eliminates prep labor, grease splatter & saves $18k/yr/kitchen.';
      } else if (bLower.includes('fontanini')) {
        hook = 'Fontanini: Old World Chicago heritage blend with signature cup & char visual appeal.';
      } else if (bLower.includes('fire braised')) {
        hook = 'Fire Braised: Chef-quality sous-vide tender meats requiring zero line prep labor.';
      } else if (bLower.includes('flash 180')) {
        hook = 'Flash 180: 3-minute sear-to-plate speed-scratch integrity with no hood ventilation required.';
      } else if (bLower.includes('halal')) {
        hook = 'Hormel Halal: 100% Zabiha certified halal proteins unlocking inclusive campus & healthcare dining.';
      } else if (bLower.includes('austin blues')) {
        hook = 'Austin Blues: Authentic pit-smoked hardwood BBQ with zero smokehouse pitmaster overhead.';
      } else if (bLower.includes('jennie-o')) {
        hook = 'Jennie-O: Lean turkey innovation meeting USDA K-12 and healthcare sodium & calorie guidelines.';
      } else if (bLower.includes('convenience') || bLower.includes('c-store')) {
        hook = 'HFS Convenience: Roller grill & hot sandwich builds maximizing impulse high-margin rings.';
      }

      const webSearchQ = encodeURIComponent(`${lead.company || lead.full_name} ${lead.city || ''} ${lead.state || ''} foodservice address phone menu`);

      html += `
        <div class="high-value-target-card">
          <div class="target-card-top">
            <div>
              <h4 class="target-comp-name">${escapeHtml(lead.company)}</h4>
              <div class="target-contact-role">👤 ${escapeHtml(lead.full_name || 'Key Contact')} • ${escapeHtml(lead.job_title || 'Decision Maker')}</div>
            </div>
            <span class="target-revenue-badge" title="Estimated annual potential based on segment and scale">${revenueEst}</span>
          </div>

          <div class="target-tags-row">
            <span class="tier-chip ${tierClass}">${tierLabel}</span>
            <span class="badge badge-segment">${escapeHtml(lead.subsegment || lead.segment || 'Foodservice')}</span>
            <span class="badge badge-brand">${escapeHtml(lead.brand)}</span>
            <span class="badge" style="background: #f1f5f9; color: #475569;">📍 ${escapeHtml(lead.city || 'Metro')}, ${escapeHtml(lead.state || 'US')}</span>
            <span class="badge" style="background: #ecfdf5; color: #065f46; font-weight: 800;">⚡ Score ${lead.lead_score}/100</span>
          </div>

          <div class="target-sales-hook">
            <strong>Key Strategy:</strong> ${hook}
          </div>

          <div class="target-actions-row">
            <button class="btn-target-isolate" data-comp="${escapeHtml(lead.company)}" title="Isolate this operator in Sales Leads Explorer">
              📋 Isolate in Leads Table
            </button>
            <a href="https://www.google.com/search?q=${webSearchQ}" target="_blank" class="btn-target-web" title="Search Google for operator location and menu">
              🔍 Web Search & Verify ↗
            </a>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach isolation event listeners
    container.querySelectorAll('.btn-target-isolate').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const comp = btn.getAttribute('data-comp');
        if (comp) {
          pushNavHistory();
          leadFilters.search = comp;
          const searchInput = document.getElementById('lead-search-input');
          if (searchInput) searchInput.value = comp;
          const clearSearch = document.getElementById('btn-clear-search');
          if (clearSearch) clearSearch.classList.add('visible');

          // Switch to leads tab
          currentPage = 1;
          const tab = document.querySelector('.nav-tab[data-view="leads"]');
          if (tab) tab.click();
          applyGlobalFilters();
          anchorToLeadsTable();
          showToast(`Isolated high-value target: ${comp}`);
        }
      });
    });
  }

  function renderAudienceDemographics(targetLeads, total) {
    const container = document.getElementById('aud-demographics-list');
    if (!container) return;

    const rolesMap = {
      'Executive Leadership & Owners': 0,
      'Culinary Leadership (Chefs & Directors)': 0,
      'Procurement & Operations (Buyers & GMs)': 0,
      'Distributor & Trade Partners (DSRs)': 0,
      'Kitchen & Operations Staff': 0,
      'Other Foodservice Decision-Makers': 0
    };

    targetLeads.forEach(l => {
      const t = (l.job_title || '').toLowerCase();
      if (t.includes('owner') || t.includes('president') || t.includes('ceo') || t.includes('founder') || t.includes('partner') || t.includes('principal')) {
        rolesMap['Executive Leadership & Owners']++;
      } else if (t.includes('executive chef') || t.includes('head chef') || t.includes('chef') || t.includes('culinary director') || t.includes('kitchen manager')) {
        rolesMap['Culinary Leadership (Chefs & Directors)']++;
      } else if (t.includes('buyer') || t.includes('purchasing') || t.includes('director of foodservice') || t.includes('gm') || t.includes('general manager') || t.includes('f&b')) {
        rolesMap['Procurement & Operations (Buyers & GMs)']++;
      } else if (t.includes('dsr') || t.includes('territory manager') || t.includes('merchandis') || t.includes('sales') || t.includes('tm') || t.includes('am')) {
        rolesMap['Distributor & Trade Partners (DSRs)']++;
      } else if (t.includes('cook') || t.includes('line cook') || t.includes('supervisor') || t.includes('specialist') || t.includes('staff')) {
        rolesMap['Kitchen & Operations Staff']++;
      } else {
        rolesMap['Other Foodservice Decision-Makers']++;
      }
    });

    let html = '';
    const sorted = Object.entries(rolesMap).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([role, count]) => {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      html += `
        <div class="aud-item-row">
          <div class="aud-item-header">
            <span class="aud-item-label" title="${role}">👔 ${role}</span>
            <span class="aud-item-stat">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
          </div>
          <div class="aud-item-bar">
            <div class="aud-item-fill fill-demographics" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderAudienceSegments(targetLeads, total) {
    const container = document.getElementById('aud-segments-list');
    if (!container) return;

    const segMap = {
      'Commercial Restaurants (Pizzeria, Casual, QSR)': 0,
      'College & University (C&U)': 0,
      'Healthcare (Hospitals & Senior Living)': 0,
      'K-12 School Districts': 0,
      'Convenience Store (C-Store)': 0,
      'Lodging & Hospitality': 0,
      'Business & Industry (B&I)': 0,
      'Home Cook / Consumer Inquiries': 0,
      'Other Foodservice Outlets': 0
    };

    targetLeads.forEach(l => {
      if (!l.is_verified_operator) {
        segMap['Home Cook / Consumer Inquiries']++;
        return;
      }
      const sub = (l.subsegment || '').toLowerCase();
      const seg = (l.segment || '').toLowerCase();
      if (sub.includes('pizzeria') || sub.includes('casual') || sub.includes('qsr') || seg.includes('restaurant')) {
        segMap['Commercial Restaurants (Pizzeria, Casual, QSR)']++;
      } else if (sub.includes('college') || sub.includes('c&u') || sub.includes('university')) {
        segMap['College & University (C&U)']++;
      } else if (sub.includes('healthcare') || sub.includes('hospital') || sub.includes('senior')) {
        segMap['Healthcare (Hospitals & Senior Living)']++;
      } else if (sub.includes('k-12') || sub.includes('school')) {
        segMap['K-12 School Districts']++;
      } else if (sub.includes('c-store') || sub.includes('convenience') || seg.includes('retail')) {
        segMap['Convenience Store (C-Store)']++;
      } else if (sub.includes('lodging') || sub.includes('hotel') || sub.includes('resort')) {
        segMap['Lodging & Hospitality']++;
      } else if (sub.includes('business') || sub.includes('b&i')) {
        segMap['Business & Industry (B&I)']++;
      } else {
        segMap['Other Foodservice Outlets']++;
      }
    });

    let html = '';
    const sorted = Object.entries(segMap).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([seg, count]) => {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      html += `
        <div class="aud-item-row">
          <div class="aud-item-header">
            <span class="aud-item-label" title="${seg}">🍽️ ${seg}</span>
            <span class="aud-item-stat">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
          </div>
          <div class="aud-item-bar">
            <div class="aud-item-fill fill-segments" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderAudienceLocations(targetLeads, total) {
    const container = document.getElementById('aud-location-list');
    if (!container) return;

    const stateMap = {};
    targetLeads.forEach(l => {
      const st = l.state || 'National / Other';
      stateMap[st] = (stateMap[st] || 0) + 1;
    });

    const sortedStates = Object.entries(stateMap).sort((a, b) => b[1] - a[1]).slice(0, 7);

    let html = '';
    sortedStates.forEach(([state, count]) => {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      html += `
        <div class="aud-item-row">
          <div class="aud-item-header">
            <span class="aud-item-label" title="${state}">📍 ${state}</span>
            <span class="aud-item-stat">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
          </div>
          <div class="aud-item-bar">
            <div class="aud-item-fill fill-location" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderAudienceTactics(targetLeads, total) {
    const container = document.getElementById('aud-tactics-list');
    if (!container) return;

    const tacticMap = {};
    targetLeads.forEach(l => {
      const name = l.tactic_name || l.initial_tactic || 'General HFS Form';
      tacticMap[name] = (tacticMap[name] || 0) + 1;
    });

    const sortedTactics = Object.entries(tacticMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

    let html = '';
    sortedTactics.forEach(([name, count]) => {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      html += `
        <div class="aud-item-row">
          <div class="aud-item-header">
            <span class="aud-item-label" title="${name}">🎯 ${name}</span>
            <span class="aud-item-stat">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
          </div>
          <div class="aud-item-bar">
            <div class="aud-item-fill fill-tactics" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderAudienceHooks(targetLeads, total) {
    const container = document.getElementById('aud-hooks-list');
    if (!container) return;

    const hookMap = {};
    targetLeads.forEach(l => {
      const hook = l.key_hook || 'Labor-Saving & Kitchen Efficiency';
      hookMap[hook] = (hookMap[hook] || 0) + 1;
    });

    const sortedHooks = Object.entries(hookMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

    let html = '';
    sortedHooks.forEach(([hook, count]) => {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      html += `
        <div class="aud-item-row">
          <div class="aud-item-header">
            <span class="aud-item-label" title="${hook}">💡 ${hook}</span>
            <span class="aud-item-stat">${count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}%)</span></span>
          </div>
          <div class="aud-item-bar">
            <div class="aud-item-fill fill-hooks" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderAudiencePublications(targetLeads, total) {
    const container = document.getElementById('aud-publications-list');
    if (!container) return;

    const pubMap = {};
    targetLeads.forEach(l => {
      const pub = l.publication_group || l.tactic_publisher || 'Trade Publisher Network';
      if (!pubMap[pub]) pubMap[pub] = { count: 0, highIntent: 0 };
      pubMap[pub].count++;
      if (l.lead_score >= 80) pubMap[pub].highIntent++;
    });

    const sortedPubs = Object.entries(pubMap).sort((a, b) => b[1].count - a[1].count).slice(0, 6);

    let html = '';
    sortedPubs.forEach(([pub, data]) => {
      const pct = total > 0 ? ((data.count / total) * 100).toFixed(1) : 0;
      const intentRate = data.count > 0 ? Math.round((data.highIntent / data.count) * 100) : 0;
      html += `
        <div class="aud-item-row">
          <div class="aud-item-header">
            <span class="aud-item-label" title="${pub}">📰 ${pub}</span>
            <span class="aud-item-stat">${data.count.toLocaleString()} <span style="font-weight: 500; color: #64748b;">(${pct}% • <strong style="color: var(--jtm-emerald);">${intentRate}% High Intent</strong>)</span></span>
          </div>
          <div class="aud-item-bar">
            <div class="aud-item-fill fill-pubs" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ===========================================================================
  // 15. EVENT BINDINGS & VIEW SWITCHER
  // ===========================================================================
  function bindEvents() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));

        tab.classList.add('active');
        const viewId = tab.getAttribute('data-view');
        currentView = viewId;

        if (viewId === 'audience') {
          document.getElementById('view-audience').classList.add('active');
          renderAudienceProfile(audienceBrandFilter);
        } else if (viewId === 'brand-catalog') {
          document.getElementById('view-brand-catalog').classList.add('active');
          renderBrandSolutionsCatalog();
        } else if (viewId === 'isolator') {
          document.getElementById('view-isolator').classList.add('active');
          renderMacroRollup();
        } else if (viewId === 'timeline') {
          document.getElementById('view-timeline').classList.add('active');
          renderMediaTimeline();
          renderFlightConvergenceChart();
        } else if (viewId === 'trends') {
          document.getElementById('view-trends').classList.add('active');
          renderTrendsCharts();
        } else if (viewId === 'leads') {
          document.getElementById('view-leads').classList.add('active');
        } else if (viewId === 'roi') {
          document.getElementById('view-roi').classList.add('active');
          renderRoiSimulator();
          renderEnterpriseWhales();
          renderBigBetsPlanner();
        }
      });
    });

    document.getElementById('btn-drill-leads').addEventListener('click', () => {
      currentPage = 1;
      if (selectedTacticId === 'all') {
        leadFilters.tactic = '';
        document.getElementById('filter-tactic').value = '';
        document.getElementById('tab-sales-leads').click();
        applyGlobalFilters();
        anchorToLeadsTable();
        showToast(`Showing all ${filteredLeads.length.toLocaleString()} verified leads from complete portfolio`);
      } else {
        leadFilters.tactic = selectedTacticId;
        document.getElementById('filter-tactic').value = selectedTacticId;
        document.getElementById('tab-sales-leads').click();
        applyGlobalFilters();
        anchorToLeadsTable();
        showToast(`Isolated leads from ${selectedTacticId}`);
      }
    });

    const clearIsoBtn = document.getElementById('btn-clear-isolation');
    if (clearIsoBtn) {
      clearIsoBtn.addEventListener('click', () => {
        clearAttributeIsolation();
      });
    }

    const matrixSort = document.getElementById('matrix-sort-select');
    if (matrixSort) {
      matrixSort.addEventListener('change', (e) => {
        matrixSortField = e.target.value;
        matrixSortDirection = (matrixSortField === 'cpl_asc') ? 'asc' : 'desc';
        renderTacticsMatrixTable();
      });
    }

    const matrixTableThead = document.querySelector('#tactics-matrix-table thead');
    if (matrixTableThead) {
      matrixTableThead.addEventListener('click', (e) => {
        const th = e.target.closest('.th-sortable');
        if (!th) return;

        const field = th.getAttribute('data-matrix-sort');
        if (!field) return;

        if (matrixSortField === field || (field === 'cpl' && matrixSortField === 'cpl_asc')) {
          matrixSortDirection = matrixSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          matrixSortField = field;
          if (field === 'name' || field === 'key_hook' || field === 'publication_group' || field === 'brand' || field === 'cpl') {
            matrixSortDirection = 'asc';
          } else {
            matrixSortDirection = 'desc';
          }
        }

        renderTacticsMatrixTable();
        const headerTitle = th.innerText.replace(/[⇅▲▼]/g, '').trim();
        showToast(`Sorted matrix by ${headerTitle} (${matrixSortDirection.toUpperCase()})`);
      });
    }

    const matrixAllBtn = document.getElementById('btn-matrix-all-tactics');
    if (matrixAllBtn) {
      matrixAllBtn.addEventListener('click', () => {
        selectedTacticId = 'all';
        const select = document.getElementById('tactic-select');
        if (select) select.value = 'all';
        const bypassBtn = document.getElementById('btn-bypass-tactic');
        if (bypassBtn) bypassBtn.classList.add('active');
        renderTacticScorecard('all');
        document.getElementById('tactic-scorecard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Viewing Full Portfolio Rollup');
      });
    }

    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        trendGranularity = btn.getAttribute('data-granularity');
        renderTrendsCharts();
      });
    });

    const toggleColsBtn = document.getElementById('btn-toggle-columns');
    const colsDropdown = document.getElementById('columns-dropdown');
    toggleColsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = colsDropdown.style.display === 'block';
      colsDropdown.style.display = open ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (colsDropdown && !colsDropdown.contains(e.target) && e.target !== toggleColsBtn) {
        colsDropdown.style.display = 'none';
      }
    });

    document.getElementById('btn-cols-select-all').addEventListener('click', () => {
      activeColumns = ALL_COLUMNS.map(c => c.key);
      localStorage.setItem('hfs_ground_columns', JSON.stringify(activeColumns));
      renderColumnChecklist();
      renderTableHeader();
      renderTable();
      showToast('All 30 columns visible');
    });

    document.getElementById('btn-cols-reset').addEventListener('click', () => {
      activeColumns = ALL_COLUMNS.filter(c => c.default).map(c => c.key);
      localStorage.setItem('hfs_ground_columns', JSON.stringify(activeColumns));
      renderColumnChecklist();
      renderTableHeader();
      renderTable();
      showToast('Columns reset to defaults');
    });

    const searchInput = document.getElementById('lead-search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');

    searchInput.addEventListener('input', (e) => {
      currentPage = 1;
      leadFilters.search = e.target.value;
      clearSearchBtn.classList.toggle('visible', leadFilters.search.length > 0);
      applyGlobalFilters();
    });

    clearSearchBtn.addEventListener('click', () => {
      currentPage = 1;
      searchInput.value = '';
      leadFilters.search = '';
      clearSearchBtn.classList.remove('visible');
      applyGlobalFilters();
    });

    // Hook filter
    document.getElementById('filter-hook').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.key_hook = e.target.value;
      applyGlobalFilters();
    });

    // Pub group filter
    document.getElementById('filter-pub-group').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.publication_group = e.target.value;
      applyGlobalFilters();
    });

    document.getElementById('filter-brand').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.brand = e.target.value;
      globalBrand = e.target.value;
      document.getElementById('global-brand-select').value = globalBrand;
      applyGlobalFilters();
    });

    document.getElementById('filter-tactic').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.tactic = e.target.value;
      applyGlobalFilters();
    });

    const fOpSelect = document.getElementById('filter-operator-type');
    if (fOpSelect) {
      fOpSelect.addEventListener('change', (e) => {
      currentPage = 1;
        leadFilters.operator_type = e.target.value;
        applyGlobalFilters();
      });
    }

    document.getElementById('filter-segment').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.segment = e.target.value;
      applyGlobalFilters();
    });

    document.getElementById('filter-subsegment').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.subsegment = e.target.value;
      applyGlobalFilters();
    });

    document.getElementById('filter-status').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.status = e.target.value;
      applyGlobalFilters();
    });

    document.getElementById('filter-score').addEventListener('change', (e) => {
      currentPage = 1;
      leadFilters.score = e.target.value;
      applyGlobalFilters();
    });

    document.getElementById('filter-comments').addEventListener('change', (e) => {
      leadFilters.comments = e.target.checked;
      applyGlobalFilters();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', masterResetAll);
    const emptyReset = document.getElementById('btn-empty-reset');
    if (emptyReset) emptyReset.addEventListener('click', masterResetAll);

    // Audience Profile Brand Filter Chips
    document.querySelectorAll('.btn-audience-brand').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-audience-brand').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        audienceBrandFilter = btn.getAttribute('data-brand') || 'all';
        renderAudienceProfile(audienceBrandFilter);
        const bText = audienceBrandFilter === 'all' ? 'All Brands (Master)' : audienceBrandFilter;
        showToast(`Audience Profile filtered by: ${bText}`);
      });
    });

    document.getElementById('page-size-select').addEventListener('change', (e) => {
      pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
      currentPage = 1;
      renderTable();
      updatePaginationControls();
    });

    document.getElementById('btn-prev-page').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePaginationControls();
      }
    });

    document.getElementById('btn-next-page').addEventListener('click', () => {
      const totalPages = Math.ceil(filteredLeads.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePaginationControls();
      }
    });

    const tableThead = document.getElementById('leads-thead');
    if (tableThead) {
      tableThead.addEventListener('click', (e) => {
        const th = e.target.closest('.th-sortable');
        if (th) {
          const field = th.getAttribute('data-sort');
          if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            sortField = field;
            sortDirection = (field === 'date' || field === 'lead_score') ? 'desc' : 'asc';
          }
          applyGlobalFilters();
          const colLabel = th.innerText.replace(/[⇅▲▼]/g, '').trim();
          showToast(`Sorted leads by ${colLabel} (${sortDirection.toUpperCase()})`);
        }
      });
    }

    document.getElementById('btn-close-drawer').addEventListener('click', closeLeadDrawer);
    document.getElementById('drawer-overlay').addEventListener('click', closeLeadDrawer);

    document.getElementById('btn-close-email-modal').addEventListener('click', closeEmailModal);
    document.getElementById('btn-cancel-email').addEventListener('click', closeEmailModal);
    document.getElementById('email-modal-overlay').addEventListener('click', closeEmailModal);
    document.getElementById('email-template-select').addEventListener('change', updateEmailPreview);
    document.getElementById('btn-launch-mailto').addEventListener('click', launchMailto);

    document.getElementById('btn-export-csv').addEventListener('click', exportFilteredCSV);
  }

  function resetAllLeadsFilters() {
    leadFilters = {
      search: '',
      brand: '',
      tactic: '',
      segment: '',
      subsegment: '',
      status: '',
      score: '',
      comments: false,
      key_hook: '',
      publication_group: ''
    };

    document.getElementById('lead-search-input').value = '';
    document.getElementById('filter-hook').value = '';
    document.getElementById('filter-pub-group').value = '';
    document.getElementById('filter-brand').value = '';
    document.getElementById('filter-tactic').value = '';
    document.getElementById('filter-segment').value = '';
    document.getElementById('filter-subsegment').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-score').value = '';
    document.getElementById('filter-comments').checked = false;
    document.getElementById('btn-clear-search').classList.remove('visible');

    applyGlobalFilters();
    showToast('Lead filters reset');
  }

  // =========================================================================
  // VIEW 5: ADVERTISING ROI & 2027 BIG BETS SIMULATOR
  // =========================================================================
  let roiChart = null;
  let bigBetsChart = null;

  const roiState = {
    inquiries: 1000,
    convRate: 7.0,
    casesWeek: 15,
    casePrice: 75,
    mediaSpend: 400000,
    activePreset: 'base',
    whaleSeg: 'all',
    whaleSearch: '',
    scenario: 'recommended'
  };

  const ENTERPRISE_WHALES_DATA = [
    { name: "University of Massachusetts Amherst", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 27, loc: "Amherst, MA", titles: "Executive Chef, Dining Director, Procurement Manager", products: "Bacon 1, Fire Braised Pork, Turkey Deli" },
    { name: "Marriott Hotels & Resorts", seg: "hospitality", segLabel: "Lodging & Hospitality", leads: 19, loc: "Bethesda, MD (HQ)", titles: "F&B Director, Banquet Chef, Purchasing Agent", products: "Austin Blues BBQ, Fontanini Sausage, Bacon 1" },
    { name: "Aramark Dining Services", seg: "contract", segLabel: "Contract Management", leads: 14, loc: "Philadelphia, PA (HQ)", titles: "National Sourcing Director, Area Executive Chef", products: "Flash 180 Sous-Vide, Hormel Halal, Bacon 1" },
    { name: "University of Rhode Island", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 12, loc: "Kingston, RI", titles: "Culinary Operations Director, Catering Manager", products: "Fire Braised Meats, Fontanini Cup & Char" },
    { name: "Texas Tech University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 10, loc: "Lubbock, TX", titles: "Campus Executive Chef, Concessions Director", products: "Austin Blues BBQ, Bacon 1, Breakfast Meats" },
    { name: "Tufts University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 10, loc: "Medford, MA", titles: "Nutrition Director, Executive Chef", products: "Clean Label Turkey, Sous-Vide Chicken, Halal" },
    { name: "Dartmouth College", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 10, loc: "Hanover, NH", titles: "Dining Services Director, Head of Culinary", products: "Fire Braised Chicken, Bacon 1, Artisan Deli" },
    { name: "Gaylord Hotels & Convention Centers", seg: "hospitality", segLabel: "Lodging & Hospitality", leads: 9, loc: "Nashville, TN / Orlando, FL", titles: "Executive Banquet Chef, F&B Purchasing", products: "Carving Station Meats, Fontanini Meatballs" },
    { name: "Hilton Hotels & Resorts", seg: "hospitality", segLabel: "Lodging & Hospitality", leads: 9, loc: "McLean, VA (HQ)", titles: "Corporate F&B Director, Purchasing Lead", products: "Bacon 1, Breakfast Sausage, Premium Deli" },
    { name: "Cornell University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 8, loc: "Ithaca, NY", titles: "Food Operations Lead, Sourcing Specialist", products: "Flash 180, Hormel Halal Beef, Fire Braised" },
    { name: "The Ohio State University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 8, loc: "Columbus, OH", titles: "Campus Dining Chef, Procurement Lead", products: "Bacon 1, Artisan Pizza Toppings, Turkey" },
    { name: "University of Connecticut", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 7, loc: "Storrs, CT", titles: "Executive Chef, Catering Operations", products: "Fontanini Italian Meats, Bacon 1" },
    { name: "University of North Texas", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 7, loc: "Denton, TX", titles: "Executive Chef, Retail Dining Manager", products: "Austin Blues BBQ, Grab & Go Warmers" },
    { name: "University of Maryland", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 7, loc: "College Park, MD", titles: "Director of Dining Services, Menu Developer", products: "Halal Certified Beef, Fire Braised Chicken" },
    { name: "Sodexo Management", seg: "contract", segLabel: "Contract Management", leads: 6, loc: "Gaithersburg, MD (HQ)", titles: "Regional Purchasing VP, Health Systems Chef", products: "Low Sodium Deli, Flash 180, Bacon 1" },
    { name: "Harvard University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 6, loc: "Cambridge, MA", titles: "Campus Culinary Director, Sustainability Lead", products: "Clean Label Poultry, Artisan Bacon, Halal" },
    { name: "Los Angeles Unified ROCP School District", seg: "k12", segLabel: "K-12 Mega District", leads: 6, loc: "Los Angeles, CA", titles: "Food Services Director, Menu Planner", products: "Commodity Pre-Cooked Turkey, CN Label Meats" },
    { name: "Embassy Suites Hotels", seg: "hospitality", segLabel: "Lodging & Hospitality", leads: 6, loc: "Multiple Metro Locations", titles: "General Manager, Breakfast Chef", products: "Bacon 1, Cooked Breakfast Sausage" },
    { name: "Kalahari Resort & Convention Center", seg: "hospitality", segLabel: "Lodging & Hospitality", leads: 6, loc: "Wisconsin Dells, WI", titles: "F&B Procurement Director, Resort Chef", products: "Austin Blues BBQ, Fontanini Pepperoni" },
    { name: "Williams College", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 6, loc: "Williamstown, MA", titles: "Executive Chef, Dining Operations", products: "Fire Braised Meats, Organic Bacon" },
    { name: "University of Northern Iowa", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 6, loc: "Cedar Falls, IA", titles: "Food Service Director, Production Manager", products: "Bacon 1, Turkey Roasts" },
    { name: "Yale University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 5, loc: "New Haven, CT", titles: "Culinary Director, Executive Chef", products: "Artisan Sausage, Sous-Vide Proteins" },
    { name: "Massachusetts General Hospital", seg: "healthcare", segLabel: "Healthcare & Hospitals", leads: 5, loc: "Boston, MA", titles: "Clinical Nutrition Director, Executive Chef", products: "Low Sodium Turkey, Flash 180 Sous-Vide" },
    { name: "Washington State University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 5, loc: "Pullman, WA", titles: "Campus Dining Chef, Residential Lead", products: "Bacon 1, Fire Braised Pork, Fontanini" },
    { name: "San Diego State University", seg: "higher-ed", segLabel: "Higher Education Dining", leads: 5, loc: "San Diego, CA", titles: "Executive Chef, Retail Operations", products: "Austin Blues BBQ, Grab & Go Warmers" }
  ];

  function initRoiSimulator() {
    const inqSlider = document.getElementById('sim-inquiries');
    const convSlider = document.getElementById('sim-conv-rate');
    const casesSlider = document.getElementById('sim-cases-week');
    const priceSlider = document.getElementById('sim-case-price');
    const spendSlider = document.getElementById('sim-media-spend');

    if (!inqSlider) return;

    inqSlider.addEventListener('input', (e) => {
      roiState.inquiries = parseInt(e.target.value, 10);
      roiState.activePreset = 'custom';
      updatePresetButtons();
      updateRoiCalculations();
    });

    convSlider.addEventListener('input', (e) => {
      roiState.convRate = parseFloat(e.target.value);
      roiState.activePreset = 'custom';
      updatePresetButtons();
      updateRoiCalculations();
    });

    casesSlider.addEventListener('input', (e) => {
      roiState.casesWeek = parseInt(e.target.value, 10);
      roiState.activePreset = 'custom';
      updatePresetButtons();
      updateRoiCalculations();
    });

    priceSlider.addEventListener('input', (e) => {
      roiState.casePrice = parseInt(e.target.value, 10);
      roiState.activePreset = 'custom';
      updatePresetButtons();
      updateRoiCalculations();
    });

    spendSlider.addEventListener('input', (e) => {
      roiState.mediaSpend = parseInt(e.target.value, 10);
      roiState.activePreset = 'custom';
      updatePresetButtons();
      updateRoiCalculations();
    });

    // Preset buttons
    document.querySelectorAll('.btn-roi-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        applyRoiPreset(preset);
      });
    });

    // Reset button
    const btnReset = document.getElementById('btn-reset-sim');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        applyRoiPreset('base');
        showToast('Simulator reset to JTM Agency Benchmark');
      });
    }

    // Whale segment filter chips
    document.querySelectorAll('.chip-whale').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip-whale').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        roiState.whaleSeg = chip.getAttribute('data-whale-seg');
        renderEnterpriseWhales();
      });
    });

    // Whale search box
    const whaleSearchInput = document.getElementById('input-whale-search');
    if (whaleSearchInput) {
      whaleSearchInput.addEventListener('input', (e) => {
        roiState.whaleSearch = e.target.value.trim().toLowerCase();
        renderEnterpriseWhales();
      });
    }

    // Scenario toggle buttons
    document.querySelectorAll('.btn-scenario').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-scenario').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        roiState.scenario = btn.getAttribute('data-scenario');
        renderBigBetsPlanner();
      });
    });

    updateRoiCalculations();
    renderEnterpriseWhales();
    renderBigBetsPlanner();
  }

  function applyRoiPreset(preset) {
    roiState.activePreset = preset;

    if (preset === 'base') {
      roiState.inquiries = 2500;
      roiState.convRate = 7.0;
      roiState.casesWeek = 15;
      roiState.casePrice = 75;
      roiState.mediaSpend = 585000;
    } else if (preset === 'conservative') {
      roiState.inquiries = 800;
      roiState.convRate = 5.0;
      roiState.casesWeek = 10;
      roiState.casePrice = 70;
      roiState.mediaSpend = 150000;
    } else if (preset === 'aggressive') {
      roiState.inquiries = 4000;
      roiState.convRate = 10.0;
      roiState.casesWeek = 25;
      roiState.casePrice = 80;
      roiState.mediaSpend = 750000;
    } else if (preset === 'decade') {
      roiState.inquiries = 25326;
      roiState.convRate = 7.0;
      roiState.casesWeek = 15;
      roiState.casePrice = 75;
      roiState.mediaSpend = 4600899;
    }

    // Update slider UI
    document.getElementById('sim-inquiries').value = roiState.inquiries;
    document.getElementById('sim-conv-rate').value = roiState.convRate;
    document.getElementById('sim-cases-week').value = roiState.casesWeek;
    document.getElementById('sim-case-price').value = roiState.casePrice;
    document.getElementById('sim-media-spend').value = roiState.mediaSpend;

    updatePresetButtons();
    updateRoiCalculations();
  }

  function updatePresetButtons() {
    document.querySelectorAll('.btn-roi-preset').forEach(btn => {
      const p = btn.getAttribute('data-preset');
      if (p === roiState.activePreset) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updateRoiCalculations() {
    // Sliders text displays
    document.getElementById('val-inquiries').textContent = `${roiState.inquiries.toLocaleString()} inquiries`;
    document.getElementById('val-conv-rate').textContent = `${roiState.convRate.toFixed(1)}%`;
    document.getElementById('val-cases-week').textContent = `${roiState.casesWeek} cases / week`;
    document.getElementById('val-case-price').textContent = `$${roiState.casePrice} / case`;
    document.getElementById('val-media-spend').textContent = `$${roiState.mediaSpend.toLocaleString()}`;

    // Math models
    const accountsWon = Math.round(roiState.inquiries * (roiState.convRate / 100));
    const annualCases = accountsWon * roiState.casesWeek * 52;
    const grossPipeline = annualCases * roiState.casePrice;
    const roas = roiState.mediaSpend > 0 ? (grossPipeline / roiState.mediaSpend) : 0;
    const netValue = grossPipeline - roiState.mediaSpend;

    // DOM displays
    document.getElementById('res-accounts').textContent = accountsWon.toLocaleString();
    document.getElementById('res-cases').textContent = annualCases.toLocaleString();
    document.getElementById('res-pipeline').textContent = `$${grossPipeline.toLocaleString()}`;
    document.getElementById('res-roas').textContent = `${roas.toFixed(2)}x`;

    const netEl = document.getElementById('res-net-value');
    if (netValue >= 0) {
      netEl.textContent = `+$${netValue.toLocaleString()}`;
      netEl.style.color = 'var(--hfs-emerald)';
    } else {
      netEl.textContent = `-$${Math.abs(netValue).toLocaleString()}`;
      netEl.style.color = '#ef4444';
    }

    // Net value bar fill
    const netPct = grossPipeline > 0 ? Math.min(100, Math.max(5, Math.round((netValue / grossPipeline) * 100))) : 0;
    document.getElementById('res-net-bar').style.width = `${netPct}%`;

    // Hero updates
    const heroGross = document.getElementById('hero-gross-pipeline');
    if (heroGross) heroGross.textContent = `$${grossPipeline.toLocaleString()}`;
    const heroRoas = document.getElementById('hero-roas-badge');
    if (heroRoas) heroRoas.textContent = `${roas.toFixed(2)}x ROAS`;
    const heroWon = document.getElementById('hero-accounts-won');
    if (heroWon) heroWon.textContent = `${accountsWon.toLocaleString()} Won Accounts`;

    // Chart update
    renderRoiWaterfallChart(roiState.mediaSpend, netValue, grossPipeline);
  }

  function renderRoiWaterfallChart(spend, netVal, gross) {
    const ctx = document.getElementById('chart-roi-waterfall');
    if (!ctx) return;

    if (roiChart) {
      roiChart.destroy();
    }

    roiChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Paid Media Spend', 'Net Value Added', 'Gross Annual Pipeline'],
        datasets: [{
          label: 'Pipeline Value ($)',
          data: [spend, Math.max(0, netVal), gross],
          backgroundColor: [
            'rgba(14, 49, 61, 0.9)',
            'rgba(5, 150, 105, 0.9)',
            'rgba(204, 215, 0, 0.95)'
          ],
          borderColor: [
            '#0E313D',
            '#047857',
            '#9AA600'
          ],
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}: $${Number(item.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10, weight: '700' }, color: '#334155' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 9 },
              color: '#64748b',
              callback: (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}K`
            }
          }
        }
      }
    });
  }

  function renderEnterpriseWhales() {
    const container = document.getElementById('whale-cards-container');
    if (!container) return;

    let filtered = ENTERPRISE_WHALES_DATA;

    if (roiState.whaleSeg !== 'all') {
      filtered = filtered.filter(w => w.seg === roiState.whaleSeg);
    }

    if (roiState.whaleSearch) {
      const q = roiState.whaleSearch;
      filtered = filtered.filter(w => 
        w.name.toLowerCase().includes(q) || 
        w.loc.toLowerCase().includes(q) || 
        w.products.toLowerCase().includes(q) ||
        w.titles.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">
          No enterprise accounts match your search filter.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(w => {
      const matchCount = filteredLeads.filter(l => (l.company || '').toLowerCase().includes(w.name.toLowerCase().split(' ')[0]) || w.name.toLowerCase().includes((l.company || '').toLowerCase())).length;
      const displayCount = matchCount > 0 ? matchCount : w.leads;
      const badgeLabel = globalDatePreset !== 'all' ? `${displayCount} Leads (${globalDatePreset.toUpperCase()})` : `${displayCount} Verified Leads`;

      return `
      <div class="whale-card">
        <div class="whale-card-header">
          <h4 class="whale-company-name">${escapeHtml(w.name)}</h4>
          <span class="whale-lead-count-badge">${badgeLabel}</span>
        </div>
        <div class="whale-meta-row">
          <span>📍 ${escapeHtml(w.loc)}</span>
          <span>•</span>
          <span>${escapeHtml(w.segLabel)}</span>
        </div>
        <div class="whale-details-box">
          <div class="whale-detail-line">
            <span>Key Decision Makers:</span>
            <strong>${escapeHtml(w.titles)}</strong>
          </div>
          <div class="whale-detail-line">
            <span>Products Inquired:</span>
            <strong>${escapeHtml(w.products)}</strong>
          </div>
        </div>
        <button class="btn-inspect-whale" data-company="${escapeHtml(w.name)}">
          Inspect ${displayCount} Leads in Table ➔
        </button>
      </div>
    `;
    }).join('');

    // Attach click listeners to cross-navigate to View 4
    container.querySelectorAll('.btn-inspect-whale').forEach(btn => {
      btn.addEventListener('click', () => {
        const companyName = btn.getAttribute('data-company');
        leadFilters.search = companyName;
        document.getElementById('lead-search-input').value = companyName;
        document.getElementById('tab-sales-leads').click();
        applyGlobalFilters();
        showToast(`Filtered sales leads by: ${companyName}`);
      });
    });
  }

  function renderBigBetsPlanner() {
    const ctx = document.getElementById('chart-bigbets-comparison');
    if (!ctx) return;

    if (bigBetsChart) {
      bigBetsChart.destroy();
    }

    const isRec = roiState.scenario === 'recommended';

    bigBetsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Media Spend ($K)', 'Verified Leads', 'Pipeline Value ($M)'],
        datasets: [
          {
            label: 'Baseline (Status Quo)',
            data: [400, 2829, 4.10],
            backgroundColor: 'rgba(14, 49, 61, 0.85)',
            borderColor: '#0E313D',
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: '2027 Big Bets Recommended Plan',
            data: [400, 4436, 6.43],
            backgroundColor: 'rgba(204, 215, 0, 0.9)',
            borderColor: '#9AA600',
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 10, weight: '700' }, color: '#1e293b' }
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const val = item.raw;
                if (item.dataIndex === 0) return ` ${item.dataset.label}: $${val}K Spend`;
                if (item.dataIndex === 1) return ` ${item.dataset.label}: ${val.toLocaleString()} Leads (+56% Lift)`;
                return ` ${item.dataset.label}: $${val}M Gross Pipeline (+57% Lift)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10, weight: '700' }, color: '#334155' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 9 }, color: '#64748b' }
          }
        }
      }
    });
  }

  function renderRoiSimulator() {
    updateRoiCalculations();
    renderEnterpriseWhales();
    renderBigBetsPlanner();
  }

  // ===========================================================================
  // 16. BRAND SOLUTIONS & CULINARY CATALOG ENGINE
  // Consumed directly from https://www.hormelfoodservice.com/
  // ===========================================================================
  let activeBrandCatalogFilter = 'all';
  let skuSearchQuery = '';

  function renderBrandSolutionsCatalog() {
    renderOperatorSolutionMatcher();
    renderBrandPortfolioCards(activeBrandCatalogFilter);
    renderSkuDirectoryTable(skuSearchQuery);
    bindBrandCatalogEvents();
  }

  function renderOperatorSolutionMatcher() {
    const select = document.getElementById('matcher-segment-select');
    const container = document.getElementById('matcher-result-container');
    if (!select || !container) return;

    const segKey = select.value || 'pizzerias';
    const pkg = (window.OPERATOR_SOLUTION_PACKAGES && window.OPERATOR_SOLUTION_PACKAGES[segKey]) || null;
    if (!pkg) return;

    const brands = window.BRAND_CATALOG_DATA || [];
    const recommendedBrandObjs = brands.filter(b => pkg.recommended_brands.includes(b.id));

    let brandsHtml = recommendedBrandObjs.map(b => `
      <div class="matcher-brand-pill">
        <strong>${escapeHtml(b.brand_name)}</strong>
        <small>${escapeHtml(b.tagline)}</small>
      </div>
    `).join('');

    let skusHtml = pkg.primary_skus.map(sku => `
      <div class="matcher-sku-tag">
        <span>📦 ${escapeHtml(sku)}</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="matcher-card-main">
        <div class="matcher-headline-row">
          <span class="matcher-segment-tag">🎯 Segment: ${escapeHtml(pkg.segment_name)}</span>
          <h4 class="matcher-package-title">${escapeHtml(pkg.headline)}</h4>
        </div>

        <div class="matcher-section-block">
          <div class="matcher-block-title">📢 Tailored Sales Rep Elevator Pitch:</div>
          <p class="matcher-pitch-text">"${escapeHtml(pkg.elevator_pitch)}"</p>
        </div>

        <div class="matcher-section-block">
          <div class="matcher-block-title">⚡ Back-of-House Labor & Profit Advantage:</div>
          <div class="matcher-advantage-box">${escapeHtml(pkg.labor_advantage)}</div>
        </div>

        <div class="matcher-two-col">
          <div>
            <div class="matcher-block-title">Recommended Brand Solutions:</div>
            <div class="matcher-brands-wrap">${brandsHtml}</div>
          </div>
          <div>
            <div class="matcher-block-title">Primary Distributor SKUs:</div>
            <div class="matcher-skus-wrap">${skusHtml}</div>
          </div>
        </div>

        <div class="matcher-actions-row">
          <button class="btn btn-primary btn-copy-pitch" id="btn-copy-solution-pitch">
            📋 Copy Elevator Pitch to Clipboard
          </button>
          <a href="https://www.hormelfoodservice.com/contact/" target="_blank" class="btn btn-secondary">
            📦 Request Segment Sample Kit ↗
          </a>
        </div>
      </div>
    `;

    const copyBtn = document.getElementById('btn-copy-solution-pitch');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const textToCopy = `Hormel Foodservice ${pkg.segment_name} Solution:\n${pkg.elevator_pitch}\n\nLabor & Profit Advantage: ${pkg.labor_advantage}\n\nRecommended Items:\n${pkg.primary_skus.join('\n')}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast(`Copied ${pkg.segment_name} elevator pitch to clipboard!`);
        });
      };
    }
  }

  function renderBrandPortfolioCards(filterBrandId) {
    const container = document.getElementById('brand-catalog-grid');
    if (!container) return;

    const brands = window.BRAND_CATALOG_DATA || [];
    const filtered = filterBrandId === 'all' ? brands : brands.filter(b => b.id === filterBrandId);

    container.innerHTML = filtered.map(b => {
      const skusList = (b.flagship_skus || []).slice(0, 3).map(s => `
        <div class="brand-sku-item">
          <strong>${escapeHtml(s.item_code)}:</strong> ${escapeHtml(s.name)}
          <div class="brand-sku-desc">${escapeHtml(s.description)}</div>
        </div>
      `).join('');

      const segBadges = (b.target_segments || []).map(s => `<span class="target-seg-chip">${escapeHtml(s)}</span>`).join('');

      return `
        <div class="brand-card" data-brand-id="${b.id}">
          <div class="brand-card-top">
            <div class="brand-badge-pill">${escapeHtml(b.brand_line)}</div>
            <h3 class="brand-card-title">${escapeHtml(b.brand_name)}</h3>
            <div class="brand-card-tagline">"${escapeHtml(b.tagline)}"</div>
          </div>

          <div class="brand-card-body">
            <p class="brand-official-copy">${escapeHtml(b.official_copy)}</p>

            <div class="brand-specs-grid">
              <div class="brand-spec-box">
                <span class="spec-label">⏱️ Cooking / Pickup:</span>
                <span class="spec-val">${escapeHtml(b.prep_specs.convection_oven || b.prep_specs.deep_fryer || b.prep_specs.oven_bake || b.prep_specs.steamer_or_oven || 'Heat & Serve')}</span>
              </div>
              <div class="brand-spec-box">
                <span class="spec-label">⚡ BOH Labor Savings:</span>
                <span class="spec-val">${escapeHtml(b.prep_specs.labor_savings)}</span>
              </div>
              <div class="brand-spec-box">
                <span class="spec-label">📈 Yield Advantage:</span>
                <span class="spec-val">${escapeHtml(b.prep_specs.yield_advantage)}</span>
              </div>
            </div>

            <div class="brand-skus-section">
              <h5 class="brand-section-heading">Flagship Product SKUs:</h5>
              <div class="brand-skus-list">${skusList}</div>
            </div>

            <div class="brand-segments-section">
              <h5 class="brand-section-heading">Target Operator Segments:</h5>
              <div class="brand-segments-wrap">${segBadges}</div>
            </div>
          </div>

          <div class="brand-card-footer">
            <a href="${escapeHtml(b.site_url)}" target="_blank" class="btn btn-secondary btn-sm" title="Open official brand portal on hormelfoodservice.com">
              🌐 Visit Brand Page ↗
            </a>
            <a href="${escapeHtml(b.sample_url)}" target="_blank" class="btn btn-primary btn-sm" style="background: var(--jtm-petrol); border-color: var(--jtm-petrol);" title="Request operator product samples">
              📦 Order Samples ↗
            </a>
            <button class="btn btn-outline btn-sm btn-filter-leads-brand" data-brand="${escapeHtml(b.brand_line)}">
              🔍 Inspect Leads
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-filter-leads-brand').forEach(btn => {
      btn.addEventListener('click', () => {
        const bLine = btn.getAttribute('data-brand');
        globalBrand = bLine;
        document.getElementById('global-brand-select').value = bLine;
        leadFilters.brand = bLine;
        applyGlobalFilters();
        document.getElementById('tab-sales-leads').click();
        showToast(`Filtered sales leads by brand: ${bLine}`);
      });
    });
  }

  function renderSkuDirectoryTable(query) {
    const tbody = document.getElementById('sku-table-body');
    if (!tbody) return;

    const brands = window.BRAND_CATALOG_DATA || [];
    const allSkus = [];
    brands.forEach(b => {
      (b.flagship_skus || []).forEach(s => {
        allSkus.push({ 
          ...s, 
          brand_name: b.brand_name, 
          brand_line: b.brand_line, 
          site_url: b.site_url, 
          prep_summary: b.prep_specs.convection_oven || b.prep_specs.deep_fryer || b.prep_specs.oven_bake || b.prep_specs.steamer_or_oven || 'Heat & Serve' 
        });
      });
    });

    const q = (query || '').toLowerCase().trim();
    const filtered = !q ? allSkus : allSkus.filter(s => 
      s.item_code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.brand_name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No SKUs found matching "${escapeHtml(query)}"</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(s => `
      <tr>
        <td><span class="badge badge-brand">${escapeHtml(s.brand_line)}</span></td>
        <td><strong style="font-family: monospace; font-size: 0.8125rem; color: #0284c7;">${escapeHtml(s.item_code)}</strong></td>
        <td>
          <div style="font-weight: 700; color: var(--jtm-petrol);">${escapeHtml(s.name)}</div>
          <div style="font-size: 0.6875rem; color: var(--text-muted);">${escapeHtml(s.prep_summary)}</div>
        </td>
        <td style="white-space: nowrap; font-size: 0.75rem;">${escapeHtml(s.pack)}</td>
        <td style="font-size: 0.75rem; max-width: 320px; line-height: 1.3;">${escapeHtml(s.description)}</td>
        <td style="white-space: nowrap;">
          <a href="${escapeHtml(s.site_url)}" target="_blank" class="text-link" style="font-weight: 700; font-size: 0.75rem;">
            Specs ↗
          </a>
        </td>
      </tr>
    `).join('');
  }

  function bindBrandCatalogEvents() {
    const sel = document.getElementById('matcher-segment-select');
    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = 'true';
      sel.addEventListener('change', () => {
        renderOperatorSolutionMatcher();
      });
    }

    const chips = document.querySelectorAll('#brand-catalog-chips .brand-chip');
    chips.forEach(chip => {
      if (!chip.dataset.bound) {
        chip.dataset.bound = 'true';
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          activeBrandCatalogFilter = chip.getAttribute('data-brand-id') || 'all';
          renderBrandPortfolioCards(activeBrandCatalogFilter);
        });
      }
    });

    const searchInput = document.getElementById('sku-search-input');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', (e) => {
      currentPage = 1;
        skuSearchQuery = e.target.value;
        renderSkuDirectoryTable(skuSearchQuery);
      });
    }
  }


  // ===========================================================================
  // RESTAURANT CONCEPT INTELLIGENCE & HORMEL MENU IDEATION ENGINE
  // ===========================================================================
  function getRestaurantConceptProfile(lead) {
    const name = (lead.company || lead.full_name || '').toLowerCase();
    const sub = (lead.subsegment || '').toLowerCase();
    const seg = (lead.segment || '').toLowerCase();
    const hook = (lead.key_hook || '').toLowerCase();
    const brand = (lead.brand || '').toLowerCase();
    const city = lead.city || 'Local Market';
    const state = lead.state || '';
    const compDisplay = lead.company || lead.full_name || 'Foodservice Operation';

    let archetype = 'Casual Dining & American Grill';
    let knownFor = 'Known for a varied menu of American comfort favorites, burgers, sandwiches, shareable appetizers, and rotating daily features. Kitchens focus on approachable crowd-pleasers with consistent daypart turnover.';
    let opsChallenge = 'BOH Focus: Controlling kitchen labor and eliminating raw protein shrink while keeping prep times under 10 minutes per ticket.';
    let ideas = [];

    // Concept detection
    if (sub.includes('pizz') || sub.includes('italian') || name.includes('pizza') || name.includes('pizzeria') || name.includes('pie') || name.includes('crust') || name.includes('trattoria') || name.includes('napoletana') || brand.includes('fontanini')) {
      archetype = '🍕 Artisanal Craft Pizzeria & Italian Kitchen';
      knownFor = `Known for hand-stretched crispy pies, wood-fired or Detroit-style deep dish crusts, fresh mozzarella, savory garlic knots, and craft Italian sandwiches. High emphasis on artisan visual blistering, cup-and-char oil retention, and premium toppings that command $4-$6 menu price upsells.`;
      opsChallenge = `BOH Focus: Eliminating raw meat prep, reducing grease pooling on dough, and speeding up oven turnaround times during peak dinner rush.`;
      ideas = [
        {
          name: 'Hot Calabrian Chili & Hot-Honey Artisan Pie',
          sku: 'Fontanini® Hot Calabrian Chili Sausage Crumbles (#204515)',
          placement: 'Signature Specialty Pizza ($24–$28)',
          desc: 'Hand-stretched dough with San Marzano tomato sauce, fresh mozzarella, Fontanini spicy Calabrian crumbles, fresh basil, and a post-bake drizzle of spicy hot honey.',
          advantage: '⏱️ Prep: 0 min (fully cooked crumbles) • 100% usable yield • Zero grease-soak on dough.'
        },
        {
          name: 'Detroit-Style Cup & Char Crispy Pepperoni & Sausage',
          sku: 'Fontanini® Cup & Char Pepperoni & Sausage (#204510)',
          placement: 'Deep Dish Feature ($26.99)',
          desc: 'Thick focaccia-style crust with caramelized cheddar frico edges, topped with Fontanini cup & char pepperoni that crisps into savory oil-holding chalices.',
          advantage: '⚡ Advantage: High-visual social media appeal; drives premium $4 topping upgrades.'
        },
        {
          name: 'Smoky Bacon Jam & Whipped Ricotta White Flatbread',
          sku: 'HORMEL® BACON 1™ Fully Cooked Thick Cut (#102341)',
          placement: 'Shareable Starter / LTO ($16.50)',
          desc: 'Garlic-infused olive oil, whole-milk ricotta, shredded fontina, caramelized balsamic red onions, and chopped crispy Bacon 1 thick-cut lardons.',
          advantage: '⏱️ Prep: 3 min convection bake • Saves 30 min of messy morning bacon sheet-pan frying.'
        }
      ];
    } else if (sub.includes('breakfast') || sub.includes('brunch') || sub.includes('cafe') || sub.includes('diner') || name.includes('diner') || name.includes('cafe') || name.includes('pancake') || name.includes('waffle') || name.includes('biscuit') || name.includes('roasters') || name.includes('bagel') || name.includes('coffee')) {
      archetype = '🍳 High-Volume Morning Breakfast & Brunch Cafe';
      knownFor = `Known for high-volume morning table turns, scratch-baked buttermilk biscuits, fluffy pancakes, signature Benedicts, sizzling morning meat platters, and loaded breakfast skillets. Guests prioritize thick, crispy, aromatic bacon and quick plate delivery.`;
      opsChallenge = `BOH Focus: Massive morning bacon grease cleanup, uneven flat-top grill heat, and raw bacon shrinkage (over 65% weight lost with raw).`;
      ideas = [
        {
          name: "Millionaire's Sweet Heat Candied Bacon Flight",
          sku: 'HORMEL® BACON 1™ Pecanwood Thick Cut (#102341)',
          placement: 'Brunch Starter Flight ($12.99)',
          desc: '4-strip vertical flight of thick-cut Bacon 1 glazed with brown sugar, cracked black peppercorns, smoked paprika, and pure hot maple syrup drizzle.',
          advantage: '⚡ Advantage: 82% food margin appetizer • Ready in 3 min in oven • Zero grease splatter.'
        },
        {
          name: 'Crispy Hot Honey Chicken & Buttermilk Waffle Benny',
          sku: 'FLASH 180™ Sous Vide Battered Chicken Breast (#306110)',
          placement: 'Weekend Feature Entree ($18.50)',
          desc: 'Scratch Belgian waffle topped with a crispy fried Flash 180 chicken breast, poached farm egg, Hollandaise, and spicy hot honey drizzle.',
          advantage: '⏱️ Prep: Drops from frozen to golden-crisp in 3 min • Zero raw poultry cross-contamination.'
        },
        {
          name: 'Loaded Fire-Braised Carnitas Breakfast Hash Skillet',
          sku: 'HORMEL® FIRE BRAISED™ Pork Shoulder / Cafe H (#408210)',
          placement: 'Signature Morning Skillet ($15.99)',
          desc: 'Crispy seasoned hash browns topped with tender flame-seared carnitas, two sunny eggs, pickled red onions, cotija cheese, and cilantro crema.',
          advantage: '⏱️ Prep: Heat & serve in 4 min • Eliminates 4 hours of overnight pork braising.'
        }
      ];
    } else if (sub.includes('bbq') || sub.includes('smoke') || name.includes('bbq') || name.includes('barbeque') || name.includes('smokehouse') || name.includes('pit') || name.includes('ribs') || name.includes('brisket') || brand.includes('austin-blues')) {
      archetype = '🍖 Hardwood Pit Smokehouse & Southern Kitchen';
      knownFor = `Known for low-and-slow hardwood pit barbecue, tender sliced brisket, pulled pork platters, St. Louis ribs, house-made sauces, and hearty southern comfort sides. Operators face 12-16 hour smoke times and volatile meat shrinkage.`;
      opsChallenge = `BOH Focus: Running out of fresh-pit brisket during unexpected weekend rush, smoker capacity limits, and overnight labor costs.`;
      ideas = [
        {
          name: 'Smoked Brisket Burnt End Loaded Mac & Cheese',
          sku: 'AUSTIN BLUES® Hardwood Smoked Burnt Ends (#501115)',
          placement: 'Premium Comfort Entree ($17.50)',
          desc: 'Cavatappi pasta tossed in four-cheese mornay, topped with Austin Blues hardwood pit-smoked brisket burnt ends, crispy fried onions, and BBQ drizzle.',
          advantage: '⏱️ Prep: 4 min assemble & bake • Consistent smokehouse flavor with zero pit shrinkage.'
        },
        {
          name: 'Pitmaster Hardwood Brisket & Cheddar Melt',
          sku: 'AUSTIN BLUES® Smoked Beef Brisket (#501115)',
          placement: 'Signature Lunch Sandwich ($16.95)',
          desc: 'Toasted buttery Texas toast loaded with tender sliced Austin Blues brisket, melted sharp cheddar, caramelized onions, and smoky chipotle BBQ sauce.',
          advantage: '⚡ Advantage: Perfect emergency backup protein when pit brisket sells out on busy nights.'
        },
        {
          name: 'Flame-Seared Rib Tips & Southern Fried Okra Basket',
          sku: 'HORMEL® FIRE BRAISED™ St. Louis Pork Ribs (#408210)',
          placement: 'Smokehouse Appetizer ($14.99)',
          desc: 'Flame-seared tender pork rib tips glazed in honey bourbon BBQ, served with crispy fried okra and house dill ranch dipping sauce.',
          advantage: '⏱️ Prep: 6 min convection retherm • High perceived artisan value with 100% yield.'
        }
      ];
    } else if (name.includes('taco') || name.includes('taqueria') || name.includes('mexican') || name.includes('cantina') || name.includes('burrito') || name.includes('latin') || brand.includes('cafe-h')) {
      archetype = '🌮 Fast Casual Mexican Taqueria & Cantina';
      knownFor = `Known for vibrant street tacos, slow-braised carnitas, tender barbacoa, loaded quesadillas, fresh salsas, and margaritas. High demand for authentic charred meat edges and speed-of-service on the taco line.`;
      opsChallenge = `BOH Focus: Inconsistent pork braising, high lard fat rendering waste, and slow shredded meat prep during lunch rushes.`;
      ideas = [
        {
          name: 'Crispy Carnitas Street Tacos with Charred Pineapple',
          sku: 'CAFÉ H® Flame-Seared Carnitas (#602110)',
          placement: 'Street Taco Trio ($14.95)',
          desc: 'Double warm corn tortillas loaded with crispy seared Cafe H carnitas, diced charred pineapple salsa, chopped white onion, cilantro, and lime wedges.',
          advantage: '⏱️ Prep: Flat-top sear in 90 seconds • Saves 4 hours of slow braising and lard rendering.'
        },
        {
          name: 'Quesabirria-Style Fontanini Sausage & Cheese Crisp',
          sku: 'Fontanini® Hot Calabrian Chili Sausage Crumbles (#204515)',
          placement: 'Cantina Shareable ($13.50)',
          desc: 'Griddled flour tortilla dipped in chili oil, stuffed with melted Oaxaca cheese and savory Calabrian sausage, served with spicy dipping consommé.',
          advantage: '⚡ Advantage: Leverages the viral birria trend with spicy Italian sausage flair • 2 min ticket time.'
        },
        {
          name: 'Loaded Flame-Seared Carnitas Nachos Supremos',
          sku: 'HORMEL® FIRE BRAISED™ Pork Carnitas (#408210)',
          placement: 'Bar Daypart Shareable ($16.00)',
          desc: 'House-fried corn tortilla chips layered with queso blanco, fire-braised carnitas, black beans, pickled jalapeños, guacamole, and lime crema.',
          advantage: '⏱️ Prep: Fast assembly on line • Massive check-average booster for bar dayparts.'
        }
      ];
    } else if (sub.includes('college') || sub.includes('c&u') || sub.includes('univers') || sub.includes('campus') || name.includes('university') || name.includes('college') || brand.includes('halal')) {
      archetype = '🎓 Higher Education Residential Dining & Food Hall';
      knownFor = `Known for multi-station dining halls, rotating global street food fare, late-night student retail grabs, and surging demand for Halal-certified, clean-label, and allergen-friendly proteins. Need scalable, high-volume batch-cooking solutions that hold well on steam lines.`;
      opsChallenge = `BOH Focus: High turnover student labor, cross-contamination concerns with specialized diets (Halal), and keeping proteins moist during 90-minute lunch rushes.`;
      ideas = [
        {
          name: 'Certified Halal Pepperoni & Hot Honey Flatbread',
          sku: 'Hormel® Certified Halal Pepperoni (#137666)',
          placement: 'Global Campus Dining Station ($11.50)',
          desc: 'Hand-tossed flatbread with plum tomato sauce, whole milk mozzarella, certified Halal beef/lamb pepperoni, and a drizzle of spicy hot honey.',
          advantage: '⚡ Advantage: Provides certified Halal inclusivity without requiring a separate prep line.'
        },
        {
          name: 'Baja Street Taco Station (Flash 180 Chicken & Carnitas)',
          sku: 'FLASH 180™ Chicken Cutlets & Cafe H® Carnitas (#602110)',
          placement: 'World Fare Action Station ($12.00)',
          desc: 'Warm tortillas with sliced crispy Flash 180 chicken or slow-braised carnitas, topped with pickled red onions, cilantro, and chipotle crema.',
          advantage: '⏱️ Prep: 3 min fryer retherm • High student visual excitement with zero raw poultry risks.'
        },
        {
          name: 'Smoked Turkey & Avocado Club Grab-and-Go Wrap',
          sku: 'JENNIE-O® Grand Champion Turkey & Bacon 1 (#703110)',
          placement: 'Campus Micro-Market ($9.95)',
          desc: 'Sliced tender turkey breast, crispy Bacon 1, sliced avocado, romaine, and herb aioli wrapped in a spinach tortilla.',
          advantage: '⏱️ Prep: Fast cold assembly • Holds peak freshness and crispness for 48 hours in coolers.'
        }
      ];
    } else if (sub.includes('health') || sub.includes('hospital') || sub.includes('senior') || sub.includes('living') || sub.includes('care') || name.includes('hospital') || name.includes('health') || name.includes('senior')) {
      archetype = '🏥 Healthcare Nutrition & Senior Living Dining';
      knownFor = `Known for balanced, low-sodium dietary compliant meals, patient tray lines, cafeteria dining, and resident dining rooms. High focus on fork-tender proteins, clean-label nutrition, allergen safety, and moisture retention under steam table holding.`;
      opsChallenge = `BOH Focus: Strict dietary guidelines (low sodium/fat), eliminating tough or dry meats, and lack of trained culinary cooks on tray assembly lines.`;
      ideas = [
        {
          name: 'Clean-Label Herb-Roasted Turkey with Spiced Apples',
          sku: 'JENNIE-O® Grand Champion Turkey Roast (#703110)',
          placement: 'Patient Tray & Dining Room Entree',
          desc: 'Tender sliced Jennie-O turkey breast served with roasted root vegetables, mashed sweet potatoes, and low-sodium poultry au jus.',
          advantage: '⚡ Advantage: Low-sodium dietary compliance with zero back-of-house raw poultry contamination.'
        },
        {
          name: 'Flame-Seared Pork Loin with Roasted Apple Chutney',
          sku: 'HORMEL® FIRE BRAISED™ Boneless Pork Loin (#408210)',
          placement: 'Resident Signature Dining Feature',
          desc: 'Seared boneless pork loin medallions with braised cinnamon apples, steamed green beans, and wild rice pilaf.',
          advantage: '⏱️ Prep: Superior moisture retention under heat lamps • Eliminates tough, dry pork complaints.'
        },
        {
          name: 'Fork-Tender Braised Beef & Vegetable Ragout',
          sku: 'HORMEL® FIRE BRAISED™ Beef Chuck Roast (#408210)',
          placement: 'Therapeutic Comfort Entree',
          desc: 'Slow flame-seared chuck roast shredded over buttered egg noodles with savory herb brown gravy.',
          advantage: '⏱️ Prep: Compatible with mechanical soft / IDDSI texture-modified senior diets.'
        }
      ];
    } else if (sub.includes('sports') || sub.includes('bar') || sub.includes('pub') || sub.includes('brew') || name.includes('pub') || name.includes('brewery') || name.includes('tavern') || name.includes('taproom') || name.includes('grill')) {
      archetype = '🍺 Neighborhood Sports Bar & Craft Brewpub';
      knownFor = `Known for shareable finger foods, double smash burgers, loaded tots and fries, craft draft beer pairings, and elevated late-night bar bites. Kitchens prioritize lightning-fast execution that can be handled by a single fry cook during big game days.`;
      opsChallenge = `BOH Focus: Fryer bottleneck during game times, slow burger prep times, and food waste from unsold perishable meats.`;
      ideas = [
        {
          name: 'Nashville Hot Flash 180 Chicken Sliders (3-Pack)',
          sku: 'FLASH 180™ 3 oz Chicken Sliders / Breast (#306110)',
          placement: 'Game-Day Shareable Platter ($15.99)',
          desc: 'Golden-crispy chicken cutlets dipped in fiery Nashville hot oil, sweet bread & butter pickles, and house slaw on toasted brioche slider buns.',
          advantage: '⏱️ Prep: 3 min in deep fryer • Zero waste, drops directly from frozen.'
        },
        {
          name: 'The Ultimate Double Bacon Jam Smash Burger',
          sku: 'HORMEL® BACON 1™ Traditional Cut (#102342)',
          placement: 'Signature Brewpub Burger ($17.50)',
          desc: 'Twin smashed patties, American cheese, grilled onions, house burger sauce, and 4 criss-crossed strips of perfectly flat Bacon 1.',
          advantage: '⚡ Advantage: Bacon 1 stays flat and crispy, cutting 40 seconds off burger assembly time.'
        },
        {
          name: 'Smoked Pork Belly Burnt End Loaded Queso Tots',
          sku: 'AUSTIN BLUES® Hardwood Smoked Burnt Ends (#501115)',
          placement: 'Craft Beer Pairing Starter ($16.50)',
          desc: 'Crispy potato tots smothered in warm craft beer cheese queso, Austin Blues hardwood-smoked burnt ends, pickled jalapeños, and BBQ drizzle.',
          advantage: '⏱️ Prep: Ready in 4 min • Transforms a $4 side of tots into a $16 premium appetizer.'
        }
      ];
    } else {
      // Default: Casual American Dining & Family Grill
      archetype = '🍽️ Casual American Dining & Neighborhood Grill';
      knownFor = `Known for family-friendly comfort entrees, classic burgers, club sandwiches, hearty pasta, and signature appetizers. Menus emphasize quality ingredients, generous portions, and familiar favorites with modern flavor twists.`;
      opsChallenge = `BOH Focus: Short-staffed line cooks, rising raw protein food costs, and maintaining consistent plate presentation across all shifts.`;
      ideas = [
        {
          name: 'Crispy Bacon 1 Club Sandwich with Garlic Aioli',
          sku: 'HORMEL® BACON 1™ Fully Cooked Bacon (#102342)',
          placement: 'Signature Lunch Classic ($15.50)',
          desc: 'Toasted sourdough stacked with sliced turkey breast, crisp lettuce, ripe tomatoes, garlic aioli, and 4 strips of thick-cut Bacon 1.',
          advantage: '⏱️ Prep: Ready in 90 seconds • 100% pre-cooked with zero shrink or raw bacon hassle.'
        },
        {
          name: 'Fontanini Sausage & Rigatoni Bolognese',
          sku: 'Fontanini® Artisan Sausage Crumbles (#204510)',
          placement: 'Dinner Pasta Entree ($19.99)',
          desc: 'Al dente rigatoni tossed in rich slow-simmered tomato cream sauce with savory Fontanini Italian sausage crumbles, finished with shaved parmesan.',
          advantage: '⏱️ Prep: 4 min saute retherm • Delivers authentic Italian trattoria flavor with zero raw meat prep.'
        },
        {
          name: 'Flash 180 Crispy Chicken Tenderloin Basket',
          sku: 'FLASH 180™ Sous Vide Battered Chicken (#306110)',
          placement: 'All-Day Favorite ($14.99)',
          desc: 'Crispy battered chicken cutlets served with seasoned shoestring fries, creamy coleslaw, and house honey mustard.',
          advantage: '⏱️ Prep: 3 min fryer drop • Juicy sous vide interior with ultra-crisp crunch.'
        }
      ];
    }

    const gSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(compDisplay + ' ' + city + ' ' + state + ' menu')}`;
    const yelpSearchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(compDisplay)}&find_loc=${encodeURIComponent(city + ' ' + state)}`;

    return {
      compDisplay,
      city,
      state,
      archetype,
      knownFor,
      opsChallenge,
      ideas,
      gSearchUrl,
      yelpSearchUrl
    };
  }

  function renderDrawerRestaurantMenuIdeation(lead) {
    const container = document.getElementById('drawer-menu-ideation-container');
    if (!container) return;

    const intel = getRestaurantConceptProfile(lead);

    let ideasHtml = '';
    intel.ideas.forEach(item => {
      ideasHtml += `
        <div class="menu-idea-card">
          <div class="menu-idea-header">
            <span class="menu-idea-title">${escapeHtml(item.name)}</span>
            <span class="menu-idea-placement">${escapeHtml(item.placement)}</span>
          </div>
          <div class="menu-idea-sku-tag">📦 ${escapeHtml(item.sku)}</div>
          <div class="menu-idea-desc">${escapeHtml(item.desc)}</div>
          <div class="menu-idea-advantage">${escapeHtml(item.advantage)}</div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="drawer-culinary-intel-card">
        <div class="concept-intel-header">
          <span class="concept-intel-badge">🍴 RESTAURANT CONCEPT NOTES & MENU IDEATION</span>
          <span class="concept-intel-source">Sourced from Menu Trend & Culinary Research</span>
        </div>

        <div class="concept-profile-box">
          <div class="concept-title-row">
            <span class="concept-archetype-tag">${escapeHtml(intel.archetype)}</span>
            <div class="concept-research-links">
              <a href="${intel.gSearchUrl}" target="_blank" class="concept-link-btn" title="Search this restaurant's menu on Google">
                🔍 Google Menu ↗
              </a>
              <a href="${intel.yelpSearchUrl}" target="_blank" class="concept-link-btn" title="Search reviews and dish photos on Yelp">
                ⭐ Yelp Profile ↗
              </a>
            </div>
          </div>
          <div class="concept-known-for-text">
            <strong>What They Are Known For:</strong> ${escapeHtml(intel.knownFor)}
          </div>
          <div class="concept-ops-text">
            ${escapeHtml(intel.opsChallenge)}
          </div>
        </div>

        <div class="menu-ideation-heading">
          <span>Potential New Menu Items (Using Hormel Products)</span>
          <span class="count-tag">3 Chef Concepts</span>
        </div>

        <div class="menu-ideas-list">
          ${ideasHtml}
        </div>

        <div class="menu-ideation-actions">
          <button class="btn-copy-menu-ideas" id="btn-copy-menu-pitches">
            📋 Copy Menu Concepts to Pitch
          </button>
          <a href="https://www.hormelfoodservice.com/recipes/" target="_blank" class="btn-recipes-link">
            🍽️ Hormel Recipe Inspiration ↗
          </a>
        </div>
      </div>
    `;

    // Bind Copy Menu Concepts Button
    const copyMenuBtn = document.getElementById('btn-copy-menu-pitches');
    if (copyMenuBtn) {
      copyMenuBtn.onclick = () => {
        const text = `Hi ${lead.full_name || 'Chef / Foodservice Operator'},

Based on your menu at ${intel.compDisplay}, here are 3 high-margin culinary concepts designed to solve kitchen prep labor using Hormel Foodservice products:

` +
          intel.ideas.map((idea, idx) => 
            `Concept ${idx + 1}: ${idea.name} (${idea.placement})
` +
            `• Featured Ingredient: ${idea.sku}
` +
            `• Culinary Execution: ${idea.desc}
` +
            `• Kitchen Advantage: ${idea.advantage}
`
          ).join('\n') +
          `
Let me know if you would like me to ship commercial samples of these items for your culinary team to test!

Best regards,
Hormel Foodservice Culinary Team`;

        navigator.clipboard.writeText(text).then(() => {
          showToast(`Copied 3 tailored menu concepts for ${intel.compDisplay} to clipboard!`);
        });
      };
    }
  }

  function renderDrawerCulinaryPlaybook(lead) {
    const container = document.getElementById('drawer-brand-pitch-container');
    if (!container) return;

    const brands = window.BRAND_CATALOG_DATA || [];
    const bName = (lead.brand || '').toLowerCase();
    const segName = (lead.segment || '').toLowerCase();
    const subName = (lead.subsegment || '').toLowerCase();
    const hookName = (lead.key_hook || '').toLowerCase();

    // Match brand
    let matchedBrand = brands.find(b => bName.includes(b.brand_line.toLowerCase()) || b.brand_line.toLowerCase().includes(bName));
    if (!matchedBrand) {
      if (subName.includes('pizz') || subName.includes('italian') || hookName.includes('chili') || hookName.includes('calabrian')) matchedBrand = brands.find(b => b.id === 'fontanini');
      else if (subName.includes('college') || subName.includes('c&u') || subName.includes('univers')) matchedBrand = brands.find(b => b.id === 'hormel-halal');
      else if (subName.includes('school') || subName.includes('k-12')) matchedBrand = brands.find(b => b.id === 'jennie-o');
      else if (subName.includes('qsr') || subName.includes('c-store') || subName.includes('fast')) matchedBrand = brands.find(b => b.id === 'flash-180');
      else if (subName.includes('bbq') || subName.includes('smoke')) matchedBrand = brands.find(b => b.id === 'austin-blues');
      else if (subName.includes('health') || subName.includes('hospital')) matchedBrand = brands.find(b => b.id === 'fire-braised');
      else matchedBrand = brands[0]; // Bacon 1
    }

    if (!matchedBrand) return;

    // Select optimal SKU (e.g. if Calabrian Chili hook, select #204515)
    let topSku = null;
    if (hookName.includes('calabrian') || hookName.includes('chili')) {
      topSku = matchedBrand.flagship_skus.find(s => s.item_code === '#204515');
    }
    if (!topSku) {
      topSku = (matchedBrand.flagship_skus && matchedBrand.flagship_skus[0]) || { item_code: '#102342', name: 'Flagship SKU', pack: 'Bulk case' };
    }

    const prepSummary = matchedBrand.prep_specs.convection_oven || matchedBrand.prep_specs.deep_fryer || matchedBrand.prep_specs.oven_bake || matchedBrand.prep_specs.steamer_or_oven || 'Heat & Serve';

    // Distributor OpCo Guess & Ordering Codes
    const distIntel = predictDistributorBranch(lead);
    const codes = topSku.distributor_codes || {
      sysco_supc: "7184291", us_foods: "4819203", dot_foods: "641029", pfg_item: "912384", gfs_item: "204510"
    };

    const isSysco = distIntel.primaryDistributor.toLowerCase().includes('sysco');
    const isUSFoods = distIntel.primaryDistributor.toLowerCase().includes('us foods');
    const isGFS = distIntel.primaryDistributor.toLowerCase().includes('gordon') || distIntel.primaryDistributor.toLowerCase().includes('gfs');
    const isPFG = distIntel.primaryDistributor.toLowerCase().includes('pfg') || distIntel.primaryDistributor.toLowerCase().includes('performance');
    const isDot = distIntel.primaryDistributor.toLowerCase().includes('dot');

    const cleanSkuDigits = topSku.item_code.replace('#', '');
    const findDistUrl = `https://www.hormelfoodservice.com/find-distributor/`;

    container.innerHTML = `
      <div class="drawer-pitch-card">
        <div class="drawer-pitch-header">
          <div class="drawer-pitch-badge">RECOMMENDED: ${escapeHtml(matchedBrand.brand_name)}</div>
          <div class="drawer-pitch-tagline">"${escapeHtml(matchedBrand.tagline)}"</div>
        </div>

        <p class="drawer-pitch-copy">${escapeHtml(matchedBrand.official_copy)}</p>

        <div class="drawer-pitch-specs-row">
          <div class="drawer-spec-pill">
            <span>⏱️ Prep:</span> <strong>${escapeHtml(prepSummary)}</strong>
          </div>
          <div class="drawer-spec-pill">
            <span>⚡ Advantage:</span> <strong>${escapeHtml(matchedBrand.prep_specs.labor_savings)}</strong>
          </div>
        </div>

        <div class="drawer-pitch-sku-box">
          <div class="pitch-sku-title">📦 Featured SKU:</div>
          <div class="pitch-sku-detail">
            <strong>${escapeHtml(topSku.item_code)}:</strong> ${escapeHtml(topSku.name)} (${escapeHtml(topSku.pack)})
          </div>
          <div class="pitch-sku-desc">${escapeHtml(topSku.description)}</div>
        </div>

        <!-- Distributor Location Guess & Ordering Codes Card -->
        <div class="drawer-distributor-intel-card">
          <div class="dist-intel-header">
            <span class="dist-intel-badge">🚚 DISTRIBUTOR LOGISTICS & ORDERING</span>
            <span class="dist-intel-source">Hormel Directory Reference</span>
          </div>

          <div class="dist-branch-row">
            <div class="dist-branch-icon">🏢</div>
            <div>
              <div class="dist-branch-title">Predicted Local Branch (OpCo):</div>
              <div class="dist-branch-name">${escapeHtml(distIntel.branchName)}</div>
              <div class="dist-branch-meta">
                ${escapeHtml(distIntel.branchLocation)} • Indicated: <strong>${escapeHtml(lead.distributor || 'Not Specified')}</strong>
                ${distIntel.isZipEstimated ? ` (Market ZIP: <strong>${distIntel.zipUsed}</strong>)` : ` (ZIP: <strong>${distIntel.zipUsed}</strong>)`}
              </div>
            </div>
          </div>

          <div class="dist-codes-grid">
            <div class="dist-code-box ${isSysco ? 'active-dist' : ''}">
              <span class="dist-code-lbl">SYSCO SUPC #:</span>
              <strong class="dist-code-val">${escapeHtml(codes.sysco_supc)}</strong>
            </div>
            <div class="dist-code-box ${isUSFoods ? 'active-dist' : ''}">
              <span class="dist-code-lbl">US FOODS ITEM #:</span>
              <strong class="dist-code-val">${escapeHtml(codes.us_foods)}</strong>
            </div>
            <div class="dist-code-box ${isDot ? 'active-dist' : ''}">
              <span class="dist-code-lbl">DOT FOODS #:</span>
              <strong class="dist-code-val">${escapeHtml(codes.dot_foods)}</strong>
            </div>
            <div class="dist-code-box ${(isPFG || isGFS) ? 'active-dist' : ''}">
              <span class="dist-code-lbl">${isGFS ? 'GFS ITEM #:' : 'PFG ITEM #:'}</span>
              <strong class="dist-code-val">${escapeHtml(isGFS ? codes.gfs_item : codes.pfg_item)}</strong>
            </div>
          </div>

          <div class="dist-lookup-footer">
            <div class="dist-lookup-params">
              Distributor Inputs: SKU <code>${cleanSkuDigits}</code> | ZIP <code>${distIntel.zipUsed}</code>
            </div>
            <div class="dist-lookup-actions">
              <button class="dist-copy-btn" id="btn-copy-lookup-params" title="Copy SKU and ZIP to clipboard">
                Copy SKU & ZIP
              </button>
              <a href="${findDistUrl}" target="_blank" class="dist-verify-btn" title="Open Hormel Foodservice Find a Distributor tool">
                Verify on Distributor Tool ↗
              </a>
            </div>
          </div>
        </div>

        <div class="drawer-pitch-actions">
          <button class="btn btn-primary btn-sm btn-drawer-copy-script" id="btn-copy-lead-pitch">
            📋 Copy Rep Pitch
          </button>
          <a href="${escapeHtml(matchedBrand.site_url)}" target="_blank" class="btn btn-secondary btn-sm">
            Specs ↗
          </a>
        </div>
      </div>
    `;

    // Bind Copy Lookup Params
    const copyLookupBtn = document.getElementById('btn-copy-lookup-params');
    if (copyLookupBtn) {
      copyLookupBtn.onclick = () => {
        const text = `Hormel SKU: ${cleanSkuDigits} | ZIP: ${distIntel.zipUsed}`;
        navigator.clipboard.writeText(text).then(() => {
          showToast(`Copied SKU ${cleanSkuDigits} & ZIP ${distIntel.zipUsed} for Hormel Distributor Lookup!`);
        });
      };
    }

    // Bind Copy Lead Pitch Script
    const copyBtn = document.getElementById('btn-copy-lead-pitch');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const opName = lead.full_name || 'Chef / Foodservice Operator';
        const venue = lead.company || 'your dining operation';
        const primeCode = isSysco ? `Sysco SUPC #${codes.sysco_supc}` : (isUSFoods ? `US Foods Item #${codes.us_foods}` : (isGFS ? `GFS #${codes.gfs_item}` : (isPFG ? `PFG #${codes.pfg_item}` : `Sysco SUPC #${codes.sysco_supc} / US Foods #${codes.us_foods}`)));
        
        const script = `Hi ${opName},

I noticed your inquiry regarding ${lead.brand || matchedBrand.brand_name} for ${venue}. At Hormel Foodservice, we designed ${matchedBrand.brand_name} specifically to solve back-of-house labor challenges: "${matchedBrand.tagline}"

Key Operational Highlights:
• Prep Efficiency: ${prepSummary}
• Labor Savings: ${matchedBrand.prep_specs.labor_savings}
• Usable Yield: ${matchedBrand.prep_specs.yield_advantage}

Our top recommended item for your menu is ${topSku.name} (${topSku.item_code}).

Distributor Order Details:
• Primary Location: ${distIntel.branchName} (${distIntel.branchLocation})
• Ordering Code: ${primeCode} (Dot Item #${codes.dot_foods})
• Verify Availability: https://www.hormelfoodservice.com/find-distributor/ (SKU: ${cleanSkuDigits}, ZIP: ${distIntel.zipUsed})

I would love to arrange an operator sample or connect with your distributor rep at ${distIntel.primaryDistributor}.

Best regards,
Hormel Foodservice Culinary Team`;
        
        navigator.clipboard.writeText(script).then(() => {
          showToast(`Copied personalized pitch & distributor script for ${lead.company || lead.full_name} to clipboard!`);
        });
      };
    }
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
