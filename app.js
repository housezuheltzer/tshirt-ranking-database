/* ==========================================================================
   Tshirt Ranking Database - Application Script (Tweaked Edition)
   ========================================================================== */

// 1. GARMENTS dataset is now separated and loaded from data.js for better modularity and scalability.

// Precompute dynamic Value Index and clean knit types
GARMENTS.forEach(g => {
  g.value_index = (g.price_aud > 0)
    ? parseFloat(((g.engineering_score / g.price_aud) * 100).toFixed(1))
    : null;
  if (g.knit_type) {
    g.knit_type = g.knit_type.replace(/\bjersey\b/gi, '').replace(/\s+/g, ' ').trim();
  }
});

// 2. Global Limits declaration & Dynamic limits calculation
const LIMITS = {
  weightMin: 100,
  weightMax: 300,
  valueIndexMin: 0,
  valueIndexMax: 150
};

function calculateLimits() {
  if (GARMENTS.length === 0) {
    LIMITS.weightMin = 100;
    LIMITS.weightMax = 300;
    LIMITS.valueIndexMin = 0;
    LIMITS.valueIndexMax = 150;
    return;
  }

  let minW = Math.min(...GARMENTS.map(g => g.weight_gsm));
  let maxW = Math.max(...GARMENTS.map(g => g.weight_gsm));
  if (minW === maxW) {
    minW = Math.max(0, minW - 50);
    maxW = maxW + 50;
  }
  LIMITS.weightMin = Math.floor(minW / 10) * 10;
  LIMITS.weightMax = Math.ceil(maxW / 10) * 10;

  const validValueIndices = GARMENTS.map(g => g.value_index).filter(v => v !== null && isFinite(v));
  let minV = validValueIndices.length > 0 ? Math.min(...validValueIndices) : 0;
  let maxV = validValueIndices.length > 0 ? Math.max(...validValueIndices) : 150;
  if (minV === maxV) {
    minV = Math.max(0, minV - 20);
    maxV = maxV + 20;
  }
  LIMITS.valueIndexMin = Math.floor(minV / 5) * 5;
  LIMITS.valueIndexMax = Math.ceil(maxV / 5) * 5;
}

calculateLimits();

function isUnknownValue(val) {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'unknown' || s === 'unspecified';
  }
  return false;
}

// 3. Tweaked State Management Object supporting multiselect lists
const STATE = {
  searchQuery: '',
  currency: 'AUD', // default currency
  filters: {
    brand: [],
    fit: [],
    origin: [],
    fiberClass: [],
    knitType: [],
    scoreMin: 0,
    scoreMax: 10,
    confidenceMin: 0,
    confidenceMax: 100,
    weightMin: LIMITS.weightMin,
    weightMax: LIMITS.weightMax,
    valueIndexMin: LIMITS.valueIndexMin,
    valueIndexMax: LIMITS.valueIndexMax
  },
  sort: {
    column: 'final_score_10',
    direction: 'desc'
  },
  selectedId: null,      // Active detailed drawer profile
  pinnedIds: [],         // IDs checked/selected for comparison (min 2, max 4)
  visibleColumns: [
    'brand',
    'item_name',
    'fit',
    'knit_type',
    'country_of_origin',
    'weight_gsm',
    'price_aud',
    'engineering_score',
    'value_index',
    'confidence_score',
    'final_score_10'
  ]
};

// Available optional columns catalog (for toggling)
const ALL_COLUMNS = {
  brand: "Brand",
  item_name: "ITEM",
  fit: "Fit",
  fabric_composition: "Composition",
  specific_cotton_type: "Fiber",
  yarn_count: "Yarn",
  knit_type: "Knit",
  country_of_origin: "Origin",
  weight_gsm: "Weight",
  price_aud: "Price",
  engineering_score: "Engineering",
  value_index: "Value",
  confidence_score: "Confidence",
  final_score_10: "Rating",
  dye_method: "Dye Method",
  collar_recovery: "Collar Recovery",
  side_seams: "Side Seams",
  shoulder_seam_position: "Shoulder Seam",
  sanforised: "Sanforized",
  last_verified_at: "Last Audited"
};

const ALL_COLUMNS_SINGULAR = {
  brand: "Brands",
  fit: "Fits",
  origin: "Origins",
  fiberClass: "Fiber Classes",
  knitType: "Knit Types"
};

// ==========================================================================
// Initialization and Theme Engine
// ==========================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const btn = document.getElementById('theme-toggle-btn');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    if (btn) btn.innerHTML = '<i class="ri-sun-line"></i>';
  } else if (savedTheme === 'dark') {
    document.body.classList.remove('light-mode');
    if (btn) btn.innerHTML = '<i class="ri-moon-line"></i>';
  } else {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    if (prefersLight) {
      document.body.classList.add('light-mode');
      if (btn) btn.innerHTML = '<i class="ri-sun-line"></i>';
    } else {
      document.body.classList.remove('light-mode');
      if (btn) btn.innerHTML = '<i class="ri-moon-line"></i>';
    }
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = isLight ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
  }
  triggerStateUpdate();
}

// Modal open/close actions for Methodology disclaimer
function openMethodologyModal() {
  const modal = document.getElementById('methodology-modal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeMethodologyModal() {
  const modal = document.getElementById('methodology-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Currency utilities and exchange rates
const EXCHANGE_RATES = {
  AUD: 1.0,
  USD: 0.66,
  EUR: 0.61,
  GBP: 0.52,
  JPY: 103.0,
  CAD: 0.90
};

const CURRENCY_SYMBOLS = {
  AUD: "$",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "$"
};

function formatPrice(priceAud) {
  const currency = STATE.currency || 'AUD';
  const rate = EXCHANGE_RATES[currency] || 1.0;
  const sym = CURRENCY_SYMBOLS[currency] || "$";
  const converted = priceAud * rate;
  if (currency === 'JPY') {
    return `${sym}${Math.round(converted).toLocaleString()}`;
  }
  return `${sym}${converted.toFixed(0)}`;
}

function changeCurrency(curr) {
  STATE.currency = curr;
  const select = document.getElementById('currency-select');
  if (select) select.value = curr;
  triggerStateUpdate();
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize light/dark theme icon status
  initTheme();

  // Sync state from URL bar
  syncStateFromUrl();

  // Populate custom multiselect panels
  populateMultiSelects();

  // Setup static inputs
  setupEventListeners();

  // Initial rendering loops
  renderAll();

  // Set 3D perspective mouse hover glares
  setup3dGlareEffects();
});

// ==========================================================================
// URL State Serialization
// ==========================================================================

function syncStateToUrl() {
  const params = new URLSearchParams();

  if (STATE.searchQuery) params.set('q', STATE.searchQuery);
  
  // Filters
  Object.keys(STATE.filters).forEach(key => {
    const val = STATE.filters[key];
    if (Array.isArray(val)) {
      if (val.length > 0) {
        params.set(`f_${key}`, val.join(','));
      }
    } else {
      let isDefault = false;
      if (key === 'scoreMin' && val === 0) isDefault = true;
      if (key === 'scoreMax' && val === 10) isDefault = true;
      if (key === 'confidenceMin' && val === 0) isDefault = true;
      if (key === 'confidenceMax' && val === 100) isDefault = true;
      if (key === 'weightMin' && val === LIMITS.weightMin) isDefault = true;
      if (key === 'weightMax' && val === LIMITS.weightMax) isDefault = true;
      if (key === 'valueIndexMin' && val === LIMITS.valueIndexMin) isDefault = true;
      if (key === 'valueIndexMax' && val === LIMITS.valueIndexMax) isDefault = true;

      if (!isDefault && val !== '' && val !== false) {
        params.set(`f_${key}`, val);
      }
    }
  });

  // Sorting
  params.set('sort_col', STATE.sort.column);
  params.set('sort_dir', STATE.sort.direction);

  // Drawer selected profile ID
  if (STATE.selectedId) params.set('selected', STATE.selectedId);

  // Compare pinned items
  if (STATE.pinnedIds.length > 0) {
    params.set('compare', STATE.pinnedIds.join(','));
  }

  // Active columns
  params.set('cols', STATE.visibleColumns.join(','));

  // Currency
  if (STATE.currency && STATE.currency !== 'AUD') {
    params.set('currency', STATE.currency);
  }

  const newRelativePathQuery = window.location.pathname + '?' + params.toString();
  window.history.replaceState(null, '', newRelativePathQuery);
}

function syncStateFromUrl() {
  const params = new URLSearchParams(window.location.search);

  if (params.has('q')) STATE.searchQuery = params.get('q');

  // Filters
  Object.keys(STATE.filters).forEach(key => {
    const paramName = `f_${key}`;
    if (params.has(paramName)) {
      const val = params.get(paramName);
      if (Array.isArray(STATE.filters[key])) {
        STATE.filters[key] = val.split(',').filter(x => x);
      } else if (key.endsWith('Min') || key.endsWith('Max')) {
        STATE.filters[key] = key.startsWith('score') ? parseFloat(val) : parseInt(val, 10);
      } else {
        STATE.filters[key] = val;
      }
    } else {
      // Default fallback if not in URL
      if (key === 'scoreMin') STATE.filters[key] = 0;
      if (key === 'scoreMax') STATE.filters[key] = 10;
      if (key === 'confidenceMin') STATE.filters[key] = 0;
      if (key === 'confidenceMax') STATE.filters[key] = 100;
      if (key === 'weightMin') STATE.filters[key] = LIMITS.weightMin;
      if (key === 'weightMax') STATE.filters[key] = LIMITS.weightMax;
      if (key === 'valueIndexMin') STATE.filters[key] = LIMITS.valueIndexMin;
      if (key === 'valueIndexMax') STATE.filters[key] = LIMITS.valueIndexMax;
    }
  });

  // Sorting
  if (params.has('sort_col')) STATE.sort.column = params.get('sort_col');
  if (params.has('sort_dir')) STATE.sort.direction = params.get('sort_dir');

  // Drawer Selection
  if (params.has('selected')) STATE.selectedId = params.get('selected');

  // Pinned Items
  if (params.has('compare')) {
    STATE.pinnedIds = params.get('compare').split(',').filter(id => id);
  }

  // Columns visibility array list
  if (params.has('cols')) {
    STATE.visibleColumns = params.get('cols').split(',').filter(c => ALL_COLUMNS[c]);
  }

  // Currency
  if (params.has('currency')) {
    STATE.currency = params.get('currency');
  } else {
    STATE.currency = 'AUD';
  }
  const select = document.getElementById('currency-select');
  if (select) select.value = STATE.currency;
}

// ==========================================================================
// Custom Multiselect Checkbox Controllers
// ==========================================================================

function toggleMultiDropdown(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isActive = container.classList.contains('active');
  
  // Close all other dropdowns first
  document.querySelectorAll('.multiselect-container').forEach(c => {
    c.classList.remove('active');
  });

  if (!isActive) {
    container.classList.add('active');
  }
}

function populateMultiSelects() {
  const brands = new Set();
  const fits = new Set();
  const origins = new Set();
  const fibers = new Set();
  const knits = new Set();

  GARMENTS.forEach(g => {
    if (g.brand) brands.add(g.brand);
    if (g.fit) {
      if (Array.isArray(g.fit)) {
        g.fit.forEach(f => fits.add(f));
      } else {
        fits.add(g.fit);
      }
    }
    if (g.country_of_origin) origins.add(g.country_of_origin);
    if (g.fibre_class) fibers.add(g.fibre_class);
    if (g.knit_type) knits.add(g.knit_type);
  });

  renderMultiOptions('multi-brand', 'brand', Array.from(brands).sort());
  renderMultiOptions('multi-fit', 'fit', Array.from(fits).sort());
  renderMultiOptions('multi-origin', 'origin', Array.from(origins).sort());
  renderMultiOptions('multi-fiber', 'fiberClass', Array.from(fibers).sort());
  renderMultiOptions('multi-knit', 'knitType', Array.from(knits).sort());
}

function renderMultiOptions(containerId, stateKey, optionsList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const dropdown = container.querySelector('.multiselect-dropdown');
  if (!dropdown) return;

  dropdown.innerHTML = '';

  optionsList.forEach(opt => {
    const label = document.createElement('label');
    label.className = 'multiselect-option';
    
    // Stop click events on label from bubbling
    label.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = opt;
    checkbox.checked = STATE.filters[stateKey].includes(opt);
    
    checkbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        if (!STATE.filters[stateKey].includes(opt)) {
          STATE.filters[stateKey].push(opt);
        }
      } else {
        const idx = STATE.filters[stateKey].indexOf(opt);
        if (idx > -1) {
          STATE.filters[stateKey].splice(idx, 1);
        }
      }
      updateTriggerLabel(containerId, stateKey, ALL_COLUMNS_SINGULAR[stateKey]);
      triggerStateUpdate();
    });

    const text = document.createElement('span');
    text.textContent = opt;

    label.appendChild(checkbox);
    label.appendChild(text);
    dropdown.appendChild(label);
  });

  updateTriggerLabel(containerId, stateKey, ALL_COLUMNS_SINGULAR[stateKey]);
}

function updateTriggerLabel(containerId, stateKey, pluralLabel) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const labelEl = container.querySelector('.trigger-label');
  if (!labelEl) return;

  const selections = STATE.filters[stateKey];
  if (selections.length === 0) {
    labelEl.textContent = `All ${pluralLabel}`;
    labelEl.style.opacity = '0.7';
  } else if (selections.length <= 2) {
    labelEl.textContent = selections.join(', ');
    labelEl.style.opacity = '1';
  } else {
    labelEl.textContent = `${selections.length} selected`;
    labelEl.style.opacity = '1';
  }
}

// Global click handler to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.multiselect-container')) {
    document.querySelectorAll('.multiselect-container').forEach(c => {
      c.classList.remove('active');
    });
  }
  
  // Columns dropdown
  const colBtn = document.getElementById('col-dropdown-btn');
  const colMenu = document.getElementById('col-dropdown-menu');
  if (colBtn && colMenu && !colBtn.contains(e.target) && !colMenu.contains(e.target)) {
    colMenu.classList.remove('active');
  }
});

// ==========================================================================
// Event Listeners Binding
// ==========================================================================

function updateSliderLabelAndTrack(type) {
  const minInput = document.getElementById(`filter-${type}-min`);
  const maxInput = document.getElementById(`filter-${type}-max`);
  const selectedEl = document.getElementById(`slider-${type}-selected`);
  const labelEl = document.getElementById(`${type}-val-label`);
  if (!minInput || !maxInput) return;

  const minVal = parseFloat(minInput.value);
  const maxVal = parseFloat(maxInput.value);
  const minLimit = parseFloat(minInput.min);
  const maxLimit = parseFloat(minInput.max);

  if (selectedEl) {
    const pctMin = ((minVal - minLimit) / (maxLimit - minLimit)) * 100;
    const pctMax = ((maxVal - minLimit) / (maxLimit - minLimit)) * 100;
    selectedEl.style.left = pctMin + '%';
    selectedEl.style.width = (pctMax - pctMin) + '%';
  }

  if (labelEl) {
    if (type === 'weight') {
      labelEl.textContent = `${minVal}g - ${maxVal}g`;
    } else if (type === 'score') {
      labelEl.textContent = `${minVal.toFixed(1)} - ${maxVal.toFixed(1)}`;
    } else if (type === 'confidence') {
      labelEl.textContent = `${minVal}% - ${maxVal}%`;
    } else {
      labelEl.textContent = `${minVal} - ${maxVal}`;
    }
  }
}

function setupEventListeners() {
  document.getElementById('search-input').value = STATE.searchQuery;
  
  // Set dynamic bounds on range inputs in DOM
  const wMinInput = document.getElementById('filter-weight-min');
  const wMaxInput = document.getElementById('filter-weight-max');
  if (wMinInput && wMaxInput) {
    wMinInput.min = LIMITS.weightMin;
    wMinInput.max = LIMITS.weightMax;
    wMaxInput.min = LIMITS.weightMin;
    wMaxInput.max = LIMITS.weightMax;
  }

  const vMinInput = document.getElementById('filter-value-index-min');
  const vMaxInput = document.getElementById('filter-value-index-max');
  if (vMinInput && vMaxInput) {
    vMinInput.min = LIMITS.valueIndexMin;
    vMinInput.max = LIMITS.valueIndexMax;
    vMaxInput.min = LIMITS.valueIndexMin;
    vMaxInput.max = LIMITS.valueIndexMax;
  }

  // Clamping state filters to actual limits in case URL state was loaded before or had values out of bounds
  STATE.filters.weightMin = Math.max(LIMITS.weightMin, Math.min(LIMITS.weightMax, STATE.filters.weightMin));
  STATE.filters.weightMax = Math.max(LIMITS.weightMin, Math.min(LIMITS.weightMax, STATE.filters.weightMax));
  STATE.filters.valueIndexMin = Math.max(LIMITS.valueIndexMin, Math.min(LIMITS.valueIndexMax, STATE.filters.valueIndexMin));
  STATE.filters.valueIndexMax = Math.max(LIMITS.valueIndexMin, Math.min(LIMITS.valueIndexMax, STATE.filters.valueIndexMax));

  // Hydrate slider inputs with active states
  if (wMinInput) wMinInput.value = STATE.filters.weightMin;
  if (wMaxInput) wMaxInput.value = STATE.filters.weightMax;
  if (vMinInput) vMinInput.value = STATE.filters.valueIndexMin;
  if (vMaxInput) vMaxInput.value = STATE.filters.valueIndexMax;
  
  document.getElementById('filter-score-min').value = STATE.filters.scoreMin;
  document.getElementById('filter-score-max').value = STATE.filters.scoreMax;
  
  document.getElementById('filter-confidence-min').value = STATE.filters.confidenceMin;
  document.getElementById('filter-confidence-max').value = STATE.filters.confidenceMax;

  // Render range labels and track fills
  updateSliderLabelAndTrack('weight');
  updateSliderLabelAndTrack('value-index');
  updateSliderLabelAndTrack('score');
  updateSliderLabelAndTrack('confidence');

  // Search input change
  document.getElementById('search-input').addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value.trim();
    triggerStateUpdate();
  });

  // Bind range sliders
  const bindDualSliderEvents = (type, isFloat = false) => {
    const minInput = document.getElementById(`filter-${type}-min`);
    const maxInput = document.getElementById(`filter-${type}-max`);
    
    if (!minInput || !maxInput) return;

    minInput.addEventListener('input', (e) => {
      let val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
      let maxVal = isFloat ? parseFloat(maxInput.value) : parseInt(maxInput.value, 10);
      
      if (val > maxVal) {
        minInput.value = maxVal;
        val = maxVal;
      }
      
      if (type === 'weight') STATE.filters.weightMin = val;
      else if (type === 'value-index') STATE.filters.valueIndexMin = val;
      else if (type === 'score') STATE.filters.scoreMin = val;
      else if (type === 'confidence') STATE.filters.confidenceMin = val;

      updateSliderLabelAndTrack(type);
      triggerStateUpdate();
    });

    maxInput.addEventListener('input', (e) => {
      let val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
      let minVal = isFloat ? parseFloat(minInput.value) : parseInt(minInput.value, 10);
      
      if (val < minVal) {
        maxInput.value = minVal;
        val = minVal;
      }
      
      if (type === 'weight') STATE.filters.weightMax = val;
      else if (type === 'value-index') STATE.filters.valueIndexMax = val;
      else if (type === 'score') STATE.filters.scoreMax = val;
      else if (type === 'confidence') STATE.filters.confidenceMax = val;

      updateSliderLabelAndTrack(type);
      triggerStateUpdate();
    });
  };

  bindDualSliderEvents('weight');
  bindDualSliderEvents('value-index');
  bindDualSliderEvents('score', true);
  bindDualSliderEvents('confidence');

  // Mobile Filter Toggle Button click handler
  const filterToggle = document.getElementById('mobile-filter-toggle');
  if (filterToggle) {
    filterToggle.addEventListener('click', toggleMobileFilters);
  }

  // Sidebar Clear Filters Button click handler
  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    clearAllFilters();
  });

  // Escape key closes panels and modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailDrawer();
      closeMethodologyModal();
      document.getElementById('compare-tray').classList.remove('active');
    }
  });

  // Table horizontal scroll controls
  const scrollContainer = document.getElementById('table-scroll-container');
  const scrollLeftBtn = document.getElementById('scroll-left-btn');
  const scrollRightBtn = document.getElementById('scroll-right-btn');

  if (scrollContainer && scrollLeftBtn && scrollRightBtn) {
    scrollContainer.addEventListener('scroll', updateTableScrollButtons);
    window.addEventListener('resize', updateTableScrollButtons);

    scrollLeftBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: -240, behavior: 'smooth' });
    });

    scrollRightBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: 240, behavior: 'smooth' });
    });
  }
}

function clearAllFilters() {
  STATE.searchQuery = '';
  STATE.filters.brand = [];
  STATE.filters.fit = [];
  STATE.filters.origin = [];
  STATE.filters.fiberClass = [];
  STATE.filters.knitType = [];
  STATE.filters.weightMin = LIMITS.weightMin;
  STATE.filters.weightMax = LIMITS.weightMax;
  STATE.filters.valueIndexMin = LIMITS.valueIndexMin;
  STATE.filters.valueIndexMax = LIMITS.valueIndexMax;
  STATE.filters.scoreMin = 0;
  STATE.filters.scoreMax = 10;
  STATE.filters.confidenceMin = 0;
  STATE.filters.confidenceMax = 100;

  // Hydrate UI elements
  document.getElementById('search-input').value = '';
  document.getElementById('filter-weight-min').value = LIMITS.weightMin;
  document.getElementById('filter-weight-max').value = LIMITS.weightMax;
  document.getElementById('filter-value-index-min').value = LIMITS.valueIndexMin;
  document.getElementById('filter-value-index-max').value = LIMITS.valueIndexMax;
  document.getElementById('filter-score-min').value = 0;
  document.getElementById('filter-score-max').value = 10;
  document.getElementById('filter-confidence-min').value = 0;
  document.getElementById('filter-confidence-max').value = 100;

  // Update slider labels and track lines
  updateSliderLabelAndTrack('weight');
  updateSliderLabelAndTrack('value-index');
  updateSliderLabelAndTrack('score');
  updateSliderLabelAndTrack('confidence');

  // Re-render multi-selects visual check marks
  populateMultiSelects();

  triggerStateUpdate();
}

function triggerStateUpdate() {
  syncStateToUrl();
  renderAll();
}

// ==========================================================================
// RENDER PIPELINE
// ==========================================================================

function renderAll() {
  const filteredData = getProcessedGarments();

  // Render table content
  renderTable(filteredData);

  // Update clear filters count button
  updateClearFiltersButton();

  // Keep details drawer updated if active
  if (STATE.selectedId) {
    updateDetailDrawerContent();
  }

  // Keep compare matrix grid updated
  updateCompareMatrix();

  // Column checkbox list
  renderColumnCheckboxes();
}

function getProcessedGarments() {
  let data = [...GARMENTS];

  // Search Filter
  if (STATE.searchQuery) {
    const q = STATE.searchQuery.toLowerCase();
    data = data.filter(g => 
      g.brand.toLowerCase().includes(q) ||
      g.item_name.toLowerCase().includes(q) ||
      g.country_of_origin.toLowerCase().includes(q) ||
      g.specific_cotton_type.toLowerCase().includes(q)
    );
  }

  // Multiselect dropdown selections
  if (STATE.filters.brand.length > 0) {
    data = data.filter(g => STATE.filters.brand.includes(g.brand));
  }
  if (STATE.filters.fit.length > 0) {
    data = data.filter(g => {
      if (Array.isArray(g.fit)) {
        return g.fit.some(f => STATE.filters.fit.includes(f));
      }
      return STATE.filters.fit.includes(g.fit);
    });
  }
  if (STATE.filters.origin.length > 0) {
    data = data.filter(g => STATE.filters.origin.includes(g.country_of_origin));
  }
  if (STATE.filters.fiberClass.length > 0) {
    data = data.filter(g => STATE.filters.fiberClass.includes(g.fibre_class));
  }
  if (STATE.filters.knitType.length > 0) {
    data = data.filter(g => STATE.filters.knitType.includes(g.knit_type));
  }

  // Sliders
  data = data.filter(g => g.weight_gsm >= STATE.filters.weightMin && g.weight_gsm <= STATE.filters.weightMax);
  data = data.filter(g => g.value_index === null || (g.value_index >= STATE.filters.valueIndexMin && g.value_index <= STATE.filters.valueIndexMax));
  data = data.filter(g => g.final_score_10 >= STATE.filters.scoreMin && g.final_score_10 <= STATE.filters.scoreMax);
  data = data.filter(g => g.confidence_score >= STATE.filters.confidenceMin && g.confidence_score <= STATE.filters.confidenceMax);

  // Sorting
  const sortCol = STATE.sort.column;
  const isAsc = STATE.sort.direction === 'asc';

  data.sort((a, b) => {
    let valA = a[sortCol];
    let valB = b[sortCol];

    if (isUnknownValue(valA)) valA = isAsc ? 999999 : -999999;
    if (isUnknownValue(valB)) valB = isAsc ? 999999 : -999999;

    if (typeof valA === 'string') {
      return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    return isAsc ? valA - valB : valB - valA;
  });

  return data;
}



function updateClearFiltersButton() {
  const clearBtn = document.getElementById('clear-filters-btn');
  const clearTxt = document.getElementById('clear-filters-text');
  if (!clearBtn || !clearTxt) return;

  let activeCount = 0;
  if (STATE.searchQuery) activeCount++;
  if (STATE.filters.brand.length > 0) activeCount++;
  if (STATE.filters.fit.length > 0) activeCount++;
  if (STATE.filters.origin.length > 0) activeCount++;
  if (STATE.filters.fiberClass.length > 0) activeCount++;
  if (STATE.filters.knitType.length > 0) activeCount++;
  if (STATE.filters.scoreMin > 0 || STATE.filters.scoreMax < 10) activeCount++;
  if (STATE.filters.confidenceMin > 0 || STATE.filters.confidenceMax < 100) activeCount++;
  if (STATE.filters.weightMin > LIMITS.weightMin || STATE.filters.weightMax < LIMITS.weightMax) activeCount++;
  if (STATE.filters.valueIndexMin > LIMITS.valueIndexMin || STATE.filters.valueIndexMax < LIMITS.valueIndexMax) activeCount++;

  clearTxt.textContent = `Clear Filters (${activeCount})`;

  const mobileBadge = document.getElementById('mobile-filter-badge');
  if (mobileBadge) {
    if (activeCount > 0) {
      mobileBadge.textContent = activeCount;
      mobileBadge.style.display = 'inline-flex';
    } else {
      mobileBadge.style.display = 'none';
    }
  }
  
  if (activeCount === 0) {
    clearBtn.disabled = true;
    clearBtn.style.opacity = '0.4';
  } else {
    clearBtn.disabled = false;
    clearBtn.style.opacity = '1';
  }
}

function renderColumnCheckboxes() {
  const menu = document.getElementById('col-dropdown-menu');
  if (!menu) return;

  menu.innerHTML = '';
  Object.keys(ALL_COLUMNS).forEach(key => {
    const isChecked = STATE.visibleColumns.includes(key);
    const item = document.createElement('label');
    item.className = 'dropdown-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = isChecked;
    input.className = 'checkbox-input';
    
    // Prevent brand and item_name from being untoggled (structural sticky alignment constraint)
    if (key === 'brand' || key === 'item_name') {
      input.disabled = true;
    }

    input.addEventListener('change', () => {
      toggleColumnVisibility(key);
    });

    const span = document.createElement('span');
    span.textContent = ALL_COLUMNS[key];

    item.appendChild(input);
    item.appendChild(span);
    menu.appendChild(item);
  });
}

function toggleColumnVisibility(colKey) {
  const idx = STATE.visibleColumns.indexOf(colKey);
  if (idx > -1) {
    if (STATE.visibleColumns.length > 2) {
      STATE.visibleColumns.splice(idx, 1);
    }
  } else {
    // Preserve predefined order of ALL_COLUMNS when adding back
    const activeKeys = Object.keys(ALL_COLUMNS).filter(key => 
      STATE.visibleColumns.includes(key) || key === colKey
    );
    STATE.visibleColumns = activeKeys;
  }
  triggerStateUpdate();
}

function toggleColDropdown() {
  const dropdownMenu = document.getElementById('col-dropdown-menu');
  if (dropdownMenu) {
    dropdownMenu.classList.toggle('active');
  }
}

// Renders the primary Data Table contents
function renderTable(data) {
  const headerRow = document.getElementById('table-header-row');
  const tbody = document.getElementById('table-body');
  const scrollContainer = document.getElementById('table-scroll-container');

  if (!headerRow || !tbody) return;

  // 1. Render Headers
  headerRow.innerHTML = '';
  
  // Sticky Column 1: Order index indicator
  const idxTh = document.createElement('th');
  idxTh.textContent = '#';
  idxTh.style.cursor = 'default';
  headerRow.appendChild(idxTh);

  // Dynamic headers
  STATE.visibleColumns.forEach(colKey => {
    const th = document.createElement('th');
    th.textContent = ALL_COLUMNS[colKey];
    
    // Add column key class (e.g. col-value-index, col-item-name, etc.)
    th.classList.add('col-' + colKey.replace(/_/g, '-'));

    if (['price_aud', 'engineering_score', 'weight_gsm', 'value_index', 'confidence_score', 'final_score_10'].includes(colKey)) {
      th.classList.add('col-num');
    }

    if (STATE.sort.column === colKey) {
      th.classList.add(STATE.sort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }

    th.addEventListener('click', () => {
      handleHeaderSort(colKey);
    });

    headerRow.appendChild(th);
  });

  // Action Column: View drawer link
  const viewTh = document.createElement('th');
  viewTh.className = 'col-details';
  viewTh.textContent = 'Details';
  viewTh.style.cursor = 'default';
  headerRow.appendChild(viewTh);

  // 2. Render Rows
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${STATE.visibleColumns.length + 2}" style="padding: 0;">
          <div class="empty-state-container">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="empty-state-title">No garments match filters</div>
            <div class="empty-state-desc">Try resetting your sliders or custom options.</div>
          </div>
        </td>
      </tr>
    `;
    
    document.getElementById('visible-count').textContent = '0';
    document.getElementById('total-count').textContent = GARMENTS.length.toString();
    return;
  }

  data.forEach((g) => {
    const tr = document.createElement('tr');
    tr.id = `row-${g.id}`;
    
    // Find the original 1-indexed order location of this SKU in the dataset
    const originalIndex = GARMENTS.findIndex(item => item.id === g.id) + 1;

    // Highlight row if selected for comparison matrix
    const isSelected = STATE.pinnedIds.includes(g.id);
    if (isSelected) {
      tr.classList.add('selected');
    }

    // click row toggles selection for compare matrix (except views/links)
    tr.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('.view-record-btn')) {
        return;
      }
      toggleCompareSelection(g.id);
    });

    // Hover focus-blur hooks
    tr.addEventListener('mouseenter', () => {
      scrollContainer.classList.add('has-hovered-row');
      tr.classList.add('is-hovered');
    });

    tr.addEventListener('mouseleave', () => {
      scrollContainer.classList.remove('has-hovered-row');
      tr.classList.remove('is-hovered');
    });

    // Sticky Column 1: Order index
    const idxTd = document.createElement('td');
    idxTd.className = 'col-num';
    idxTd.style.textAlign = 'center';
    idxTd.textContent = String(originalIndex).padStart(3, '0');
    tr.appendChild(idxTd);

    // Visible data cells
    STATE.visibleColumns.forEach(colKey => {
      const td = document.createElement('td');
      let val = g[colKey];

      // Add column key class (e.g. col-value-index, col-item-name, etc.)
      td.classList.add('col-' + colKey.replace(/_/g, '-'));

      if (isUnknownValue(val)) {
        td.innerHTML = `<span class="field-status status-unknown">UNKNOWN</span>`;
      } else if (colKey === 'brand') {
        td.innerHTML = `
          <div class="brand-cell-content" style="display: flex; align-items: center; gap: 8px;">
            <div class="brand-icon-container" data-brand="${val.toLowerCase().replace(/\s+/g, '-')}">
              <img src="images/logos/${val.toLowerCase().replace(/\s+/g, '-')}.png" 
                   alt="" 
                   class="brand-icon-img"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'; this.parentElement.classList.add('fallback-active');" />
              <span class="brand-icon-fallback">${val.charAt(0)}</span>
            </div>
            <span>${val}</span>
          </div>
        `;
      } else if (colKey === 'item_name') {
        td.innerHTML = `
          <span>${val}</span>
          <a href="${g.product_url}" target="_blank" class="external-link-btn" title="Open product page" onclick="event.stopPropagation()">
            <i class="ri-external-link-line"></i>
          </a>
        `;
      } else if (colKey === 'fit' && Array.isArray(val)) {
        td.textContent = val.join(' / ');
      } else if (colKey === 'price_aud') {
        td.classList.add('col-num');
        td.textContent = formatPrice(val);
      } else if (colKey === 'engineering_score') {
        td.classList.add('col-num');
        td.textContent = `${val}/100`;
      } else if (colKey === 'weight_gsm') {
        td.classList.add('col-num');
        td.textContent = `${val}g`;
      } else if (colKey === 'value_index') {
        td.classList.add('col-num');
        td.textContent = val.toFixed(1);
      } else if (colKey === 'confidence_score') {
        td.classList.add('col-num');
        td.textContent = `${val}%`;
      } else if (colKey === 'final_score_10') {
        td.classList.add('col-num');
        td.style.fontWeight = '700';
        const numVal = parseFloat(val);
        if (numVal >= 8.0) {
          td.innerHTML = `<span class="rating-badge rating-high">${val.toFixed(1)}</span>`;
        } else if (numVal < 5.0) {
          td.innerHTML = `<span class="rating-badge rating-low">${val.toFixed(1)}</span>`;
        } else {
          td.innerHTML = `<span class="rating-badge rating-medium">${val.toFixed(1)}</span>`;
        }
      } else {
        td.textContent = val;
      }

      tr.appendChild(td);
    });

    // Column: View Details trigger
    const viewTd = document.createElement('td');
    viewTd.className = 'col-details';
    viewTd.innerHTML = `
      <button class="view-record-btn" title="View Details" onclick="openDetailDrawer('${g.id}')" style="background: none; border: none; padding: 4px; cursor: pointer; color: var(--text-400); display: flex; align-items: center; justify-content: center; width: 100%; transition: color 0.2s ease;">
        <i class="ri-information-line" style="font-size: 18px;"></i>
      </button>
    `;
    tr.appendChild(viewTd);

    tbody.appendChild(tr);
  });

  document.getElementById('visible-count').textContent = data.length.toString();
  document.getElementById('total-count').textContent = GARMENTS.length.toString();
  setTimeout(updateTableScrollButtons, 50);
}

function updateTableScrollButtons() {
  const scrollContainer = document.getElementById('table-scroll-container');
  const scrollLeftBtn = document.getElementById('scroll-left-btn');
  const scrollRightBtn = document.getElementById('scroll-right-btn');
  const edgeLeft = document.getElementById('scroll-edge-left');
  const edgeRight = document.getElementById('scroll-edge-right');

  if (scrollContainer) {
    const scrollLeft = scrollContainer.scrollLeft;
    const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;

    if (scrollLeftBtn) scrollLeftBtn.disabled = scrollLeft <= 2;
    if (scrollRightBtn) scrollRightBtn.disabled = scrollLeft >= maxScrollLeft - 2;

    // Show/hide edge gradients based on scroll availability
    if (edgeLeft) {
      edgeLeft.style.opacity = scrollLeft > 2 ? '1' : '0';
    }
    if (edgeRight) {
      edgeRight.style.opacity = scrollLeft < maxScrollLeft - 2 ? '1' : '0';
    }
  }
}

function handleHeaderSort(colKey) {
  if (STATE.sort.column === colKey) {
    STATE.sort.direction = STATE.sort.direction === 'desc' ? 'asc' : 'desc';
  } else {
    STATE.sort.column = colKey;
    STATE.sort.direction = 'desc';
  }
  triggerStateUpdate();
}

// ==========================================================================
// Compare Matrix Logic
// ==========================================================================

function toggleCompareSelection(garmentId) {
  const idx = STATE.pinnedIds.indexOf(garmentId);
  if (idx > -1) {
    STATE.pinnedIds.splice(idx, 1);
  } else {
    if (STATE.pinnedIds.length >= 4) {
      alert("Comparison limit reached: Please unselect a garment before adding another.");
      return;
    }
    STATE.pinnedIds.push(garmentId);
  }

  // Update Compare Trigger Button state
  const compareBtn = document.getElementById('compare-btn');
  if (compareBtn) {
    if (STATE.pinnedIds.length >= 2) {
      compareBtn.disabled = false;
      compareBtn.classList.remove('btn-secondary');
    } else {
      compareBtn.disabled = true;
      compareBtn.classList.add('btn-secondary');
    }
  }

  // Update counts badge
  document.getElementById('compare-items-count').textContent = STATE.pinnedIds.length + ' selected';

  triggerStateUpdate();
}

function clearPinnedGarments() {
  STATE.pinnedIds = [];
  const compareBtn = document.getElementById('compare-btn');
  if (compareBtn) {
    compareBtn.disabled = true;
    compareBtn.classList.add('btn-secondary');
  }
  document.getElementById('compare-items-count').textContent = '0 selected';
  document.getElementById('compare-tray').classList.remove('active');
  
  triggerStateUpdate();
}

function toggleCompareTray() {
  const tray = document.getElementById('compare-tray');
  if (STATE.pinnedIds.length < 2) {
    alert("Please select 2 to 4 garments from the table first to compare.");
    return;
  }
  tray.classList.toggle('active');
  updateCompareMatrix();
}

function updateCompareMatrix() {
  const grid = document.getElementById('compare-matrix-grid');
  if (!grid || STATE.pinnedIds.length === 0) return;

  const pinnedItems = STATE.pinnedIds.map(id => GARMENTS.find(g => g.id === id)).filter(Boolean);
  if (pinnedItems.length === 0) return;

  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `160px repeat(${pinnedItems.length}, 1fr)`;

  const rows = [
    { label: "Garment", key: "header_card" },
    { label: "Final Rating", key: "final_score_10", type: "score" },
    { label: "Engineering", key: "engineering_score", type: "score" },
    { label: "Price", key: "price_aud", type: "price" },
    { label: "Weight", key: "weight_gsm", type: "weight" },
    { label: "Value", key: "value_index", type: "score" },
    { label: "Composition", key: "fabric_composition" },
    { label: "Fiber Class", key: "fibre_class" },
    { label: "Fiber", key: "specific_cotton_type" },
    { label: "Yarn", key: "yarn_count" },
    { label: "Knit", key: "knit_type" },
    { label: "Geometries", key: "geometry" },
    { label: "Side Seams", key: "side_seams" },
    { label: "Collar Recovery", key: "collar_recovery" },
    { label: "Shrink Control", key: "pre_shrunk" },
    { label: "Disclosure", key: "disclosure_score", type: "disclosure" }
  ];

  const getHighlightIndex = (rowKey, items) => {
    if (rowKey === 'final_score_10' || rowKey === 'engineering_score' || rowKey === 'value_index' || rowKey === 'disclosure_score') {
      const vals = items.map(it => it[rowKey]);
      const maxVal = Math.max(...vals);
      return items.findIndex(it => it[rowKey] === maxVal);
    }
    if (rowKey === 'price_aud') {
      const vals = items.map(it => it[rowKey]);
      const minVal = Math.min(...vals);
      return items.findIndex(it => it[rowKey] === minVal);
    }
    if (rowKey === 'weight_gsm') {
      // Light vs heavy depends on body preference, we omit default highlights here
      return -1;
    }
    return -1;
  };

  rows.forEach(rowDef => {
    const labelCell = document.createElement('div');
    labelCell.className = 'compare-cell compare-cell-header';
    labelCell.textContent = rowDef.label;
    grid.appendChild(labelCell);

    const highlightIdx = getHighlightIndex(rowDef.key, pinnedItems);

    pinnedItems.forEach((g, idx) => {
      const cell = document.createElement('div');
      cell.className = 'compare-cell';

      if (idx === highlightIdx) {
        cell.classList.add('top-spec-highlight');
      }

      if (rowDef.key === 'header_card') {
        cell.className = 'compare-cell compare-cell-garment-header';
        cell.innerHTML = `
          <div class="brand">${g.brand}</div>
          <div class="name">${g.item_name}</div>
        `;
      } else if (rowDef.key === 'geometry') {
        cell.innerHTML = `Shoulder: ${g.shoulder_seam_position}<br>Armhole: ${g.armhole_height}`;
      } else if (rowDef.type === 'score') {
        cell.className = 'compare-cell compare-cell-score';
        cell.textContent = g[rowDef.key];
      } else if (rowDef.type === 'price') {
        cell.textContent = formatPrice(g[rowDef.key]);
      } else if (rowDef.type === 'weight') {
        cell.textContent = `${g[rowDef.key]} GSM`;
      } else if (rowDef.type === 'disclosure') {
        cell.textContent = `${g[rowDef.key]} out of 15`;
      } else {
        const val = g[rowDef.key];
        if (isUnknownValue(val)) {
          cell.innerHTML = `<span class="field-status status-unknown">UNKNOWN</span>`;
        } else {
          cell.textContent = val;
        }
      }

      grid.appendChild(cell);
    });
  });
}

// ==========================================================================
// Profile Details Drawer Content Render
// ==========================================================================

function openDetailDrawer(garmentId) {
  STATE.selectedId = garmentId;
  syncStateToUrl();

  document.getElementById('detail-drawer').classList.add('active');
  document.getElementById('drawer-backdrop').classList.add('active');

  updateDetailDrawerContent();
}

function closeDetailDrawer() {
  STATE.selectedId = null;
  syncStateToUrl();

  document.getElementById('detail-drawer').classList.remove('active');
  document.getElementById('drawer-backdrop').classList.remove('active');
}

function updateDetailDrawerContent() {
  const g = GARMENTS.find(item => item.id === STATE.selectedId);
  if (!g) return;

  // Header meta
  document.getElementById('detail-brand').textContent = g.brand;
  document.getElementById('detail-name').textContent = g.item_name;

  // Visual Image trigger
  const imgEl = document.getElementById('detail-image');
  const placeholderEl = document.getElementById('detail-image-placeholder');
  
  if (g.image) {
    imgEl.src = g.image;
    imgEl.style.display = 'block';
    placeholderEl.style.display = 'none';
    
    imgEl.onerror = () => {
      imgEl.style.display = 'none';
      placeholderEl.style.display = 'flex';
    };
  } else {
    imgEl.style.display = 'none';
    placeholderEl.style.display = 'flex';
  }

  // Score Hero Cards
  document.getElementById('detail-final-score').textContent = g.final_score_10.toFixed(1);
  document.getElementById('detail-eng-score').textContent = g.engineering_score;
  document.getElementById('detail-conf-score').textContent = g.confidence_score + '%';

  // Hard gate rejection warnings
  const banner = document.getElementById('detail-rejection-banner');
  const reasonText = document.getElementById('detail-rejection-reason');
  if (g.hard_rejection_flag) {
    banner.style.display = 'block';
    reasonText.textContent = g.rejection_reason;
  } else {
    banner.style.display = 'none';
  }

  // Sub-scores compound fills
  const fillBar = (barId, valId, val) => {
    const fill = document.getElementById(barId);
    const text = document.getElementById(valId);
    if (fill && text) {
      fill.style.width = '0%';
      text.textContent = val;
      setTimeout(() => {
        const maxMap = {
          fiber: 30,
          knit: 20,
          geom: 20,
          stab: 15,
          disc: 15
        };
        const key = barId.replace('bar-fill-', '');
        const pct = (val / maxMap[key]) * 100;
        fill.style.width = pct + '%';
      }, 50);
    }
  };

  fillBar('bar-fill-fiber', 'bar-val-fiber', g.fibre_yarn_score);
  fillBar('bar-fill-knit', 'bar-val-knit', g.knit_dye_score);
  fillBar('bar-fill-geom', 'bar-val-geom', g.geometry_score);
  fillBar('bar-fill-stab', 'bar-val-stab', g.stability_score);
  fillBar('bar-fill-disc', 'bar-val-disc', g.disclosure_score);

  // Technical Specs Fields
  const renderSpec = (elementId, value, isStatusCheck = false) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (isUnknownValue(value)) {
      el.innerHTML = `<span class="field-status status-unknown">UNKNOWN</span>`;
      el.classList.add('unknown');
    } else {
      el.classList.remove('unknown');
      if (isStatusCheck && value === 'Verified') {
        el.innerHTML = `<span>${value}</span> <span class="field-status status-verified">✓</span>`;
      } else if (Array.isArray(value)) {
        el.textContent = value.join(' / ');
      } else {
        el.textContent = value;
      }
    }
  };

  const formattedConverted = formatPrice(g.price_aud);
  renderSpec('spec-price', `$${g.retail_price} ${g.currency} (~${formattedConverted})`);
  renderSpec('spec-fit', g.fit);
  renderSpec('spec-composition', g.fabric_composition);
  renderSpec('spec-cotton-type', g.specific_cotton_type);
  renderSpec('spec-yarn-count', `${g.yarn_count} (${g.yarn_ply}-ply)`);
  renderSpec('spec-yarn-spin', g.yarn_spin_method);
  renderSpec('spec-knit-type', g.knit_type);
  renderSpec('spec-weight', g.weight_gsm ? `${g.weight_gsm} GSM` : 'unknown');
  renderSpec('spec-origin', g.country_of_origin);
  renderSpec('spec-side-seams', g.side_seams);
  renderSpec('spec-shoulder-seam', g.shoulder_seam_position);
  renderSpec('spec-neck-structure', g.rear_neck_structure);
  renderSpec('spec-collar', g.collar_recovery);
  renderSpec('spec-shrinkage', g.pre_shrunk);
  renderSpec('spec-last-verified', g.last_verified_at);

  // Anomalies check
  const flagsBox = document.getElementById('detail-flags-box');
  const flagsList = document.getElementById('detail-flags-list');
  flagsList.innerHTML = '';
  
  const anomalies = [];
  
  if (g.tubular_flag && isUnknownValue(g.pre_shrunk)) {
    anomalies.push("Tubular build lacks verified stabilization (high risk of seam spiraling).");
  }
  if (g.dry_clean_only_flag) {
    anomalies.push("Dry-clean only rating indicates chemical coating dependency or extreme fabric instability.");
  }
  if (g.specific_cotton_type.toLowerCase().includes('egyptian') && g.fibre_verified.toLowerCase().includes('unverified')) {
    anomalies.push("Egyptian cotton origin assertion is uncertified (unverified crop supply claims).");
  }
  if (g.yarn_spin_method === 'Open-end') {
    anomalies.push("Open-end spinning produces low-tier staple cohesion (highly prone to pilling and holes).");
  }
  if (g.combed === 'Carded') {
    anomalies.push("Carded yarns contain short-staple debris, generating a rough and abrasive surface feel.");
  }
  if (g.disclosure_score < 5) {
    anomalies.push("Supply chain tracing withheld (zero audits provided for manufacturing locations).");
  }

  if (anomalies.length > 0) {
    if (flagsBox) flagsBox.classList.add('has-anomalies');
    anomalies.forEach(flag => {
      const li = document.createElement('li');
      li.className = 'red-flag-item';
      li.textContent = flag;
      flagsList.appendChild(li);
    });
  } else {
    if (flagsBox) flagsBox.classList.remove('has-anomalies');
    const li = document.createElement('li');
    li.className = 'clean-flag-item';
    li.textContent = "No severe anomalies or material compromises detected.";
    flagsList.appendChild(li);
  }

  // Notes and links
  document.getElementById('detail-notes').textContent = g.analyst_notes;

  const linksContainer = document.getElementById('detail-source-links');
  linksContainer.innerHTML = '';
  
  const pushLink = (url, label) => {
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.className = 'source-link';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = label;
      linksContainer.appendChild(a);
    }
  };

  pushLink(g.product_url, "Official Product Page");
  pushLink(g.source_url_1, "Verified Source 1");
  pushLink(g.source_url_2, "Verified Source 2");
  pushLink(g.source_url_3, "Verified Source 3");
}

// ==========================================================================
// Micro-interactions (3D Card Glare Mouse Effect)
// ==========================================================================

function setup3dGlareEffects() {
  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.glare-card');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        const pctX = (x / rect.width) * 100;
        const pctY = (y / rect.height) * 100;
        
        const ry = ((pctX - 50) / 50) * 3;
        const rx = ((pctY - 50) / 50) * -2;
        
        card.style.setProperty('--x', `${pctX}%`);
        card.style.setProperty('--y', `${pctY}%`);
        card.style.setProperty('--rx', `${rx}deg`);
        card.style.setProperty('--ry', `${ry}deg`);
      } else {
        card.style.setProperty('--rx', `0deg`);
        card.style.setProperty('--ry', `0deg`);
      }
    });
  });
}

// Collapsible Mobile Filters toggle state handler
function toggleMobileFilters() {
  const content = document.getElementById('sidebar-collapsible-content');
  const toggleBtn = document.getElementById('mobile-filter-toggle');
  if (!content || !toggleBtn) return;

  const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
  const newExpanded = !isExpanded;

  toggleBtn.setAttribute('aria-expanded', newExpanded);
  if (newExpanded) {
    content.classList.add('is-expanded');
  } else {
    content.classList.remove('is-expanded');
  }
}
