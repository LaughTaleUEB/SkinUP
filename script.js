// CS2 Trade-Up Analyzer - Client JavaScript
const CRATES_URL = './crates.json';
const COLLECTIONS_URL = './collections.json';

// App State (cached in memory on initial load)
let cachedCrates = [];
let cachedCases = [];
let cachedCollections = []; // All 93 weapon collections supporting trade-up
let cachedWeeklyDrops = []; // 5 active weekly drop pool containers
let cachedLimitedEdition = null; // Limited Edition Item collection
let activeCollection = null;
let activeCase = null;
let activeWeeklyDrop = null;
let activeLimitedEdition = null;
let currentModalSkin = null;
let activeWearMode = 'normal'; // 'normal' or 'stattrak'

// Active weekly drop pool container names
const WEEKLY_DROP_NAMES = [
    'Sealed Dead Hand Terminal',
    'Sealed Genesis Terminal',
    'Kilowatt Case',
    'Revolution Case',
    'Dreams & Nightmares Case'
];

// Helper for HTML Escaping
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Wear Condition Standard Ranges
const WEAR_RANGES = [
    { code: 'fn', name: 'Factory New', min: 0.00, max: 0.07, cssClass: 'fn' },
    { code: 'mw', name: 'Minimal Wear', min: 0.07, max: 0.15, cssClass: 'mw' },
    { code: 'ft', name: 'Field-Tested', min: 0.15, max: 0.38, cssClass: 'ft' },
    { code: 'ww', name: 'Well-Worn', min: 0.38, max: 0.45, cssClass: 'ww' },
    { code: 'bs', name: 'Battle-Scarred', min: 0.45, max: 1.00, cssClass: 'bs' }
];

// DOM Elements
const collectionList = document.getElementById('collection-list');
const casesList = document.getElementById('cases-list');
const weeklyDropsList = document.getElementById('weekly-drops-list');
const limitedEditionList = document.getElementById('limited-edition-list');

const skinModal = document.getElementById('skin-modal');
const closeModalBtn = document.getElementById('close-modal');

// Container Overlay Modal Elements
const containerModal = document.getElementById('container-modal');
const closeContainerModalBtn = document.getElementById('close-container-modal');
const containerModalTitle = document.getElementById('container-modal-title');
const containerModalCount = document.getElementById('container-modal-count');
const containerModalType = document.getElementById('container-modal-type');
const containerModalIconImg = document.getElementById('container-modal-icon-img');
const containerModalBody = document.getElementById('container-modal-body');
const containerSkinsList = document.getElementById('container-skins-list');

let isContainerModalOpen = false;
let activeContainerItem = null;

// Filter DOM Elements
const filterCost = document.getElementById('filter-cost');
const filterCollection = document.getElementById('filter-collection');
const filterRarity = document.getElementById('filter-rarity');
const filterMinProfit = document.getElementById('filter-min-profit');
const filterMinSuccess = document.getElementById('filter-min-success');
const filterStattrak = document.getElementById('filter-stattrak');
const sortBySelect = document.getElementById('sort-by');
const btnFilter = document.getElementById('btn-filter');
const btnReset = document.getElementById('btn-reset');
const tradeUpResults = document.getElementById('trade-up-results');

// Tab Navigation Elements
const navTabs = document.querySelectorAll('.nav-tab');
const collectionsSection = document.getElementById('collections-section');
const tradeUpsSection = document.getElementById('trade-ups-section');
const heroOverviewSection = document.getElementById('hero-overview-section');
const divider1 = document.getElementById('divider-1');
const divider2 = document.getElementById('divider-2');

// Modal Elements
const modalSkinName = document.getElementById('modal-skin-name');
const modalWeapon = document.getElementById('modal-weapon');
const modalRarity = document.getElementById('modal-rarity');
const modalFloat = document.getElementById('modal-float');
const modalImageContainer = document.getElementById('modal-image-container');
const modalWearConditions = document.getElementById('modal-wear-conditions');

// Lenis Smooth Scroll Instance & State
let lenis = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchLocalData();
    setupEventListeners();
    initSmoothScroll();
    setupSearchLogic();
    setupProgressIndicatorClicks();
    // Run initial scroll transition calculation
    handleContinuousScrollTransitions();
});

// Initialize Lenis Momentum Smooth Scroll
function initSmoothScroll() {
    if (typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 0.95,
            touchMultiplier: 1.5,
            infinite: false,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        lenis.on('scroll', () => {
            handleContinuousScrollTransitions();
        });
    }

    // Always keep native scroll listener as well for robustness
    window.addEventListener('scroll', () => {
        handleContinuousScrollTransitions();
    }, { passive: true });

    window.addEventListener('resize', () => {
        handleContinuousScrollTransitions();
    }, { passive: true });
}

// Continuous Scroll-Driven Transitions (Proportional to Scroll Distance)
function handleContinuousScrollTransitions() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const header = document.getElementById('main-header');
    const brandEl = document.querySelector('.header-brand');

    // 1. Header & Floating Compact Navbar Transformation
    if (header) {
        if (scrollY > 30) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    }

    if (brandEl) {
        // Smooth 1:1 proportional brand fade & translate on initial scroll (0px -> 70px)
        const brandFactor = Math.max(0, Math.min(1, scrollY / 70));
        brandEl.style.opacity = (1 - brandFactor).toFixed(3);
        brandEl.style.transform = `translateY(-${(brandFactor * 24).toFixed(1)}px)`;
        brandEl.style.pointerEvents = brandFactor > 0.8 ? 'none' : 'auto';
    }

    // 2. Continuous Proportional Scene Transitions for Each Section
    const sections = [
        document.getElementById('hero-overview-section'),
        document.getElementById('collections-section'),
        document.getElementById('trade-ups-section'),
        document.getElementById('beta-notice-section')
    ].filter(Boolean);

    if (sections.length === 0) return;

    const vh = window.innerHeight || 800;
    const viewportCenter = vh / 2;
    let dominantSec = sections[0];
    let minDistance = Infinity;

    sections.forEach(sec => {
        const rect = sec.getBoundingClientRect();

        // 1. If section is completely below viewport: hidden until scrolled to
        if (rect.top >= vh) {
            sec.style.opacity = '0';
            sec.style.transform = 'translateY(60px)';
            sec.style.filter = 'brightness(0.60)';
            sec.style.pointerEvents = 'none';
            return;
        }

        // 2. If section is completely above viewport: hidden
        if (rect.bottom <= 0) {
            sec.style.opacity = '0';
            sec.style.transform = 'translateY(-50px)';
            sec.style.filter = 'brightness(0.60)';
            sec.style.pointerEvents = 'none';
            return;
        }

        // Calculate entrance when entering from below
        let opacity = 1.0;
        let translateY = 0;
        let brightness = 1.0;

        if (rect.top > vh * 0.15) {
            const enterProgress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * 0.85)));
            const eased = enterProgress * enterProgress * (3 - 2 * enterProgress);
            opacity = eased;
            translateY = (1 - eased) * 60;
            brightness = 0.60 + 0.40 * eased;
        }

        // Calculate exit when scrolling past top
        if (rect.bottom < vh * 0.55) {
            const exitProgress = Math.max(0, Math.min(1, rect.bottom / (vh * 0.55)));
            const eased = exitProgress * exitProgress * (3 - 2 * exitProgress);
            opacity = Math.min(opacity, eased);
            translateY = (1 - eased) * -45;
            brightness = Math.min(brightness, 0.60 + 0.40 * eased);
        }

        sec.style.opacity = opacity.toFixed(3);
        sec.style.transform = `translateY(${translateY.toFixed(1)}px)`;
        sec.style.filter = `brightness(${brightness.toFixed(3)})`;
        sec.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none';

        // Dominant section detection
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(vh, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const secCenter = rect.top + Math.min(rect.height, vh) / 2;
        const dist = Math.abs(secCenter - viewportCenter);

        if (visibleHeight > 80 && dist < minDistance) {
            minDistance = dist;
            dominantSec = sec;
        }
    });

    // 3. Smooth Active Tab Indicator Sync
    if (dominantSec) {
        updateActiveNavOnSection(dominantSec.id);
    }

    // 4. Update Top-Center Page Scroll Progress Indicator
    updatePageScrollProgress();
}

// Dynamic Multi-Segment Page Scroll Progress Indicator (Color-Coded by Part)
function updatePageScrollProgress() {
    const progressTrack = document.getElementById('progress-track');
    if (!progressTrack) return;

    const sectionsConfig = [
        { id: 'hero-overview-section', segmentClass: '.segment-hero' },
        { id: 'collections-section', segmentClass: '.segment-collections' },
        { id: 'trade-ups-section', segmentClass: '.segment-tradeups' },
        { id: 'beta-notice-section', segmentClass: '.segment-beta' }
    ];

    const sectionElements = sectionsConfig.map(s => document.getElementById(s.id)).filter(Boolean);
    if (sectionElements.length === 0) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const vh = window.innerHeight || 800;
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const maxScroll = Math.max(1, docHeight - vh);

    // 1. Calculate section scroll spans and dynamically assign segment proportional widths
    const sectionMetrics = [];
    let totalSpan = 0;

    // Build seamless chained scroll boundaries
    const thresholds = [0];
    for (let i = 1; i < sectionElements.length; i++) {
        thresholds.push(Math.max(thresholds[i - 1] + 100, sectionElements[i].offsetTop - vh * 0.5));
    }
    thresholds.push(maxScroll);

    sectionElements.forEach((sec, idx) => {
        const start = thresholds[idx];
        const end = thresholds[idx + 1];
        const span = Math.max(80, end - start);
        
        sectionMetrics.push({
            sec,
            start,
            end,
            span,
            segmentEl: progressTrack.querySelector(sectionsConfig[idx].segmentClass)
        });
        totalSpan += span;
    });

    // 2. Adjust segment flex widths proportionally so each segment length represents its scroll distance
    sectionMetrics.forEach(m => {
        if (m.segmentEl) {
            const flexRatio = Math.max(0.1, (m.span / totalSpan) * 100);
            m.segmentEl.style.flex = `${flexRatio.toFixed(2)} 1 0%`;
        }
    });

    // 3. Check if at very top or very bottom
    if (scrollY <= 0) {
        sectionMetrics.forEach(m => {
            if (!m.segmentEl) return;
            const fillEl = m.segmentEl.querySelector('.segment-fill');
            if (fillEl) fillEl.style.width = '0%';
        });
        return;
    }

    const isAtBottom = (scrollY + vh >= docHeight - 15) || (scrollY >= maxScroll - 15);
    if (isAtBottom) {
        sectionMetrics.forEach(m => {
            if (!m.segmentEl) return;
            const fillEl = m.segmentEl.querySelector('.segment-fill');
            if (fillEl) fillEl.style.width = '100%';
        });
        return;
    }

    // 4. Update fill progress for each segment along the seamless threshold continuum
    sectionMetrics.forEach(m => {
        if (!m.segmentEl) return;
        const fillEl = m.segmentEl.querySelector('.segment-fill');
        if (!fillEl) return;

        let fillPct = 0;
        if (scrollY <= m.start) {
            fillPct = 0;
        } else if (scrollY >= m.end) {
            fillPct = 100;
        } else {
            fillPct = Math.min(100, Math.max(0, ((scrollY - m.start) / (m.end - m.start)) * 100));
        }

        fillEl.style.width = `${fillPct.toFixed(1)}%`;
    });
}

// Progress Indicator Segment Click Navigation
function setupProgressIndicatorClicks() {
    const track = document.getElementById('progress-track');
    if (!track) return;

    track.querySelectorAll('.progress-segment').forEach(seg => {
        seg.addEventListener('click', () => {
            const targetId = seg.getAttribute('data-section');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                if (lenis) {
                    lenis.scrollTo(targetEl, { offset: -90, duration: 1.1 });
                } else {
                    const top = targetEl.getBoundingClientRect().top + (window.pageYOffset || window.scrollY) - 90;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            }
        });
    });
}

// Filter out non-weapon cosmetic packs (stickers, charms, graffiti, patches, agents, limited edition)
function isTradeUpWeaponCollection(col) {
    if (!col || !col.contains || col.contains.length === 0) return false;
    const nameLower = (col.name || '').toLowerCase();

    // Exclude Limited Edition Item (has its own dedicated tab)
    if (nameLower === 'limited edition item' || col.id === 'collection-set-xpshop-wpn-01') return false;

    // Exclude non-weapon cosmetic packs by collection name
    const cosmeticKeywords = ['sticker', 'charm', 'graffiti', 'patch', 'agent'];
    if (cosmeticKeywords.some(kw => nameLower.includes(kw))) return false;

    // Exclude collections whose items contain non-weapon cosmetics
    const nonWeaponIdPrefixes = ['sticker-', 'keychain-', 'graffiti-', 'agent-', 'patch-'];
    if (col.contains.some(item => item && item.id && nonWeaponIdPrefixes.some(p => item.id.startsWith(p)))) {
        return false;
    }

    return true;
}

// Deduplicate Items by Name: Ensure each skin appears strictly ONCE based on its base name
function deduplicateItemsByName(items) {
    if (!Array.isArray(items)) return [];
    return items.filter((item, index, self) => {
        if (!item) return false;
        const nameKey = item.name || item.id;
        if (!nameKey) return false;
        return index === self.findIndex((t) => t && (t.name || t.id) === nameKey);
    });
}

// Fetch and Parse Local CS2 Data (crates.json & collections.json)
async function fetchLocalData() {
    try {
        const [cratesRes, collectionsRes] = await Promise.all([
            fetch(CRATES_URL),
            fetch(COLLECTIONS_URL)
        ]);

        if (!cratesRes.ok) throw new Error(`HTTP error loading crates.json: ${cratesRes.status}`);
        if (!collectionsRes.ok) throw new Error(`HTTP error loading collections.json: ${collectionsRes.status}`);

        cachedCrates = await cratesRes.json();
        const rawCollections = await collectionsRes.json();

        // Deduplicate items in crates and collections by base name
        cachedCrates.forEach(c => {
            if (c.contains) c.contains = deduplicateItemsByName(c.contains);
            if (c.contains_rare) c.contains_rare = deduplicateItemsByName(c.contains_rare);
        });
        rawCollections.forEach(c => {
            if (c.contains) c.contains = deduplicateItemsByName(c.contains);
            if (c.contains_rare) c.contains_rare = deduplicateItemsByName(c.contains_rare);
        });

        // 1. Cases Tab: filter crates for type === "Case"
        cachedCases = cachedCrates.filter(c => c && c.type === 'Case');

        // 2. Weekly Drops Tab: active weekly drop pool containers
        cachedWeeklyDrops = WEEKLY_DROP_NAMES.map(name => {
            return cachedCrates.find(c => c && c.name && c.name.toLowerCase() === name.toLowerCase());
        }).filter(Boolean);

        // 3. Limited Edition Tab: find "Limited Edition Item"
        cachedLimitedEdition = rawCollections.find(c => c.name === 'Limited Edition Item' || c.id === 'collection-set-xpshop-wpn-01');

        // Flag Limited Edition skins with can_trade_up: false and is_trade_up_eligible: false
        if (cachedLimitedEdition && cachedLimitedEdition.contains) {
            cachedLimitedEdition.contains.forEach(skin => {
                skin.can_trade_up = false;
                skin.is_trade_up_eligible = false;
            });
        }

        // 4. Collections Tab: only actual weapon skin collections that support trade-up contracts
        cachedCollections = rawCollections.filter(isTradeUpWeaponCollection);

        // Flag all regular weapon skins as eligible for trade-up contracts
        cachedCollections.forEach(c => {
            c.contains?.forEach(skin => {
                skin.can_trade_up = true;
                skin.is_trade_up_eligible = true;
            });
        });
        cachedCases.forEach(c => {
            c.contains?.forEach(skin => {
                skin.can_trade_up = true;
                skin.is_trade_up_eligible = true;
            });
            c.contains_rare?.forEach(skin => {
                skin.can_trade_up = true;
                skin.is_trade_up_eligible = true;
            });
        });
        cachedWeeklyDrops.forEach(c => {
            c.contains?.forEach(skin => {
                skin.can_trade_up = true;
                skin.is_trade_up_eligible = true;
            });
            c.contains_rare?.forEach(skin => {
                skin.can_trade_up = true;
                skin.is_trade_up_eligible = true;
            });
        });

        console.log(`Loaded: ${cachedCollections.length} trade-up collections, ${cachedCases.length} cases, ${cachedWeeklyDrops.length} weekly drops, 1 limited edition.`);

        // Batch render each tab's container cards into DOM
        renderCollectionsList(cachedCollections);
        renderCasesList(cachedCases);
        renderWeeklyDropsList(cachedWeeklyDrops);
        renderLimitedEdition(cachedLimitedEdition);

        // Populate trade-up collections filter options
        populateTradeUpCollections(cachedCollections);
    } catch (err) {
        console.error('Failed to load local skin datasets:', err);
    }
}

// Render Collections List (using DocumentFragment batch DOM update)
function renderCollectionsList(collections) {
    const listEl = document.getElementById('collection-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const fragment = document.createDocumentFragment();

    collections.forEach(col => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.setAttribute('data-id', col.id);

        const count = col.contains ? col.contains.length : 0;
        const imgUrl = col.image || '';

        card.innerHTML = `
            <div class="collection-icon">
                <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(col.name)}" loading="lazy" decoding="async" onError="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
                <span style="display:none;">📁</span>
            </div>
            <div class="collection-info">
                <h3>${escapeHtml(col.name)}</h3>
                <p>${count} Skins • Tap to view</p>
            </div>
        `;

        card.addEventListener('click', () => toggleCollection(col.id));
        fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
}

// Render Cases List (using DocumentFragment batch DOM update)
function renderCasesList(cases) {
    const listEl = document.getElementById('cases-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const fragment = document.createDocumentFragment();

    cases.forEach(caseItem => {
        const card = document.createElement('div');
        card.className = 'collection-card case-card';
        card.setAttribute('data-id', caseItem.id);

        const count = caseItem.contains ? caseItem.contains.length : 0;
        const imgUrl = caseItem.image || '';

        card.innerHTML = `
            <div class="collection-icon case-icon">
                <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(caseItem.name)}" loading="lazy" decoding="async" onError="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
                <span style="display:none;">📦</span>
            </div>
            <div class="collection-info">
                <h3>${escapeHtml(caseItem.name)}</h3>
                <p>${count} Items • Tap to view</p>
            </div>
        `;

        card.addEventListener('click', () => toggleCase(caseItem.id));
        fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
}

// Render Weekly Drops List (using DocumentFragment batch DOM update)
function renderWeeklyDropsList(drops) {
    const listEl = document.getElementById('weekly-drops-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const fragment = document.createDocumentFragment();

    drops.forEach(item => {
        const card = document.createElement('div');
        card.className = 'collection-card case-card';
        card.setAttribute('data-id', item.id);

        const count = item.contains ? item.contains.length : 0;
        const imgUrl = item.image || '';

        card.innerHTML = `
            <div class="collection-icon case-icon">
                <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onError="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
                <span style="display:none;">📦</span>
            </div>
            <div class="collection-info">
                <h3>${escapeHtml(item.name)}</h3>
                <p>${count} Items • Tap to view</p>
            </div>
        `;

        card.addEventListener('click', () => toggleWeeklyDrop(item.id));
        fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
}

// Render Limited Edition Tab (Shows collection card)
function renderLimitedEdition(limitedCol) {
    const listEl = document.getElementById('limited-edition-list');
    if (!listEl || !limitedCol) return;
    listEl.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'collection-card';
    card.setAttribute('data-id', limitedCol.id);

    const count = limitedCol.contains ? limitedCol.contains.length : 4;
    const imgUrl = limitedCol.image || '';

    card.innerHTML = `
        <div class="collection-icon">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(limitedCol.name)}" loading="lazy" decoding="async" onError="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
            <span style="display:none;">📁</span>
        </div>
        <div class="collection-info">
            <h3>${escapeHtml(limitedCol.name)}</h3>
            <p>${count} Skins • Non-Trade-up</p>
        </div>
    `;

    card.addEventListener('click', () => toggleLimitedEdition(limitedCol.id));
    listEl.appendChild(card);
}

// Event Listeners
function setupEventListeners() {
    // Header Navigation Tabs switching
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Overview Card Action buttons
    document.querySelectorAll('[data-action-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-action-tab');
            switchTab(targetTab);
        });
    });

    // Close Skin Modal Events
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    if (skinModal) {
        skinModal.addEventListener('click', (e) => {
            if (e.target === skinModal) closeModal();
        });
    }

    // Close Container Overlay Modal Events
    if (closeContainerModalBtn) {
        closeContainerModalBtn.addEventListener('click', closeContainerModal);
    }

    if (containerModal) {
        containerModal.addEventListener('click', (e) => {
            if (e.target === containerModal || e.target.classList.contains('container-modal-backdrop')) {
                closeContainerModal();
            }
        });
    }

    // Allow uninhibited mouse wheel scrolling inside modals without interference from global window listeners
    if (containerModal) {
        containerModal.addEventListener('wheel', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    if (skinModal) {
        skinModal.addEventListener('wheel', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    // Escape Key Handler for Modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (skinModal && !skinModal.classList.contains('hidden')) {
                closeModal();
            } else if (containerModal && !containerModal.classList.contains('hidden')) {
                closeContainerModal();
            }
        }
    });

    // Filter Buttons
    if (btnFilter) {
        btnFilter.addEventListener('click', handleFilterSubmit);
    }

    if (btnReset) {
        btnReset.addEventListener('click', handleFilterReset);
    }

    // Modal Wear Mode Tabs (Normal / StatTrak)
    document.querySelectorAll('.wear-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.getAttribute('data-wear-mode');
            setWearMode(mode);
        });
    });

    // Sub-nav Tabs (Collections / Cases / Weekly Drops / Limited Edition)
    document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const subtab = tab.getAttribute('data-subtab');
            switchSubTab(subtab);
        });
    });
}

// Switch Sub-Tab (Collections / Cases / Weekly Drops / Limited Edition)
function switchSubTab(subtab) {
    document.querySelectorAll('.sub-tab').forEach(tab => {
        if (tab.getAttribute('data-subtab') === subtab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const tabContents = {
        'collections': document.getElementById('collections-tab-content'),
        'cases': document.getElementById('cases-tab-content'),
        'weekly-drops': document.getElementById('weekly-drops-tab-content'),
        'limited-edition': document.getElementById('limited-edition-tab-content')
    };

    // Show selected tab, hide all others
    for (const key in tabContents) {
        if (tabContents[key]) {
            if (key === subtab) {
                tabContents[key].classList.remove('hidden');
            } else {
                tabContents[key].classList.add('hidden');
            }
        }
    }

    // Re-apply search filter for newly activated tab
    const searchInput = document.getElementById('collections-search-input');
    if (searchInput && searchInput.value.trim() !== '') {
        filterCollectionsAndCases(searchInput.value.trim().toLowerCase());
    }
}

// Collapsible Search Box & Dynamic Live Filter
function setupSearchLogic() {
    const searchContainer = document.getElementById('subnav-search-container');
    const searchBtn = document.getElementById('search-toggle-btn');
    const searchInput = document.getElementById('collections-search-input');

    if (!searchContainer || !searchBtn || !searchInput) return;

    // Toggle expansion on button click
    searchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = searchContainer.classList.contains('expanded');
        if (isExpanded) {
            if (searchInput.value.trim() === '') {
                searchContainer.classList.remove('expanded');
            } else {
                searchInput.focus();
            }
        } else {
            searchContainer.classList.add('expanded');
            setTimeout(() => searchInput.focus(), 100);
        }
    });

    // Expand on input focus
    searchInput.addEventListener('focus', () => {
        searchContainer.classList.add('expanded');
    });

    // Collapse when clicking outside if input is empty
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target) && searchInput.value.trim() === '') {
            searchContainer.classList.remove('expanded');
        }
    });

    // Live search filtering as user types
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        filterCollectionsAndCases(query);
    });
}

function filterCollectionsAndCases(query) {
    const lists = [
        document.getElementById('collection-list'),
        document.getElementById('cases-list'),
        document.getElementById('weekly-drops-list'),
        document.getElementById('limited-edition-list')
    ].filter(Boolean);

    lists.forEach(list => {
        const cards = list.querySelectorAll('.collection-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const titleEl = card.querySelector('h3');
            const titleText = titleEl ? titleEl.textContent.toLowerCase() : '';

            if (query === '' || titleText.includes(query)) {
                card.classList.remove('hidden');
                visibleCount++;
            } else {
                card.classList.add('hidden');
            }
        });

        // Display empty search result notice if no items match query
        let noticeEl = list.querySelector('.empty-search-notice');
        if (visibleCount === 0 && query !== '') {
            if (!noticeEl) {
                noticeEl = document.createElement('div');
                noticeEl.className = 'empty-search-notice';
                noticeEl.innerHTML = `
                    <div class="search-icon-dim">🔍</div>
                    <p><strong>"${escapeHtml(query)}"</strong> ile eşleşen sonuç bulunamadı.</p>
                `;
                list.appendChild(noticeEl);
            } else {
                noticeEl.querySelector('p').innerHTML = `<strong>"${escapeHtml(query)}"</strong> ile eşleşen sonuç bulunamadı.`;
                noticeEl.classList.remove('hidden');
            }
        } else if (noticeEl) {
            noticeEl.classList.add('hidden');
        }
    });
}

// Set Wear Mode (Normal / StatTrak) for Modal
function setWearMode(mode) {
    activeWearMode = mode;
    document.querySelectorAll('.wear-tab').forEach(tab => {
        if (tab.getAttribute('data-wear-mode') === mode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (currentModalSkin) {
        renderWearConditions(currentModalSkin, activeWearMode);
    }
}

// Switch Active Tab View via Smooth Continuous Scrolling
function switchTab(targetTab) {
    let targetSection = heroOverviewSection;
    if (targetTab === 'collections') {
        targetSection = collectionsSection;
    } else if (targetTab === 'tradeups') {
        targetSection = tradeUpsSection;
    }

    if (!targetSection) return;

    if (lenis) {
        lenis.scrollTo(targetSection, {
            offset: -85,
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        });
    } else {
        const top = targetSection.getBoundingClientRect().top + (window.pageYOffset || window.scrollY) - 85;
        window.scrollTo({
            top,
            behavior: 'smooth'
        });
    }
}

// Automatically sync navbar tab highlighting based on current dominant section
function updateActiveNavOnSection(sectionId) {
    let activeTabKey = 'all';
    if (sectionId === 'collections-section') activeTabKey = 'collections';
    else if (sectionId === 'trade-ups-section' || sectionId === 'beta-notice-section') activeTabKey = 'tradeups';

    navTabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === activeTabKey) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// Open Container Modal (Overlay View for Cases / Collections / Weekly Drops / Limited Edition)
function openContainerModal(containerItem, containerType = 'Collection') {
    if (!containerItem || !containerModal) return;

    activeContainerItem = containerItem;
    isContainerModalOpen = true;

    // Fixed Header Elements
    const titleEl = document.getElementById('container-modal-title');
    const countEl = document.getElementById('container-modal-count');
    const typeEl = document.getElementById('container-modal-type');
    const iconImg = document.getElementById('container-modal-icon-img');
    const modalBody = document.getElementById('container-modal-body');
    const skinsListEl = document.getElementById('container-skins-list');

    if (titleEl) {
        titleEl.textContent = containerItem.name || 'Container';
    }

    const uniqueContains = deduplicateItemsByName(containerItem.contains || []);
    const uniqueRare = deduplicateItemsByName(containerItem.contains_rare || []);

    const regCount = uniqueContains.length;
    const rareCount = uniqueRare.length;
    
    let countText = `${regCount} Skins`;
    if (rareCount > 0) {
        countText = `${regCount} Skins + Rare Special Items`;
    }
    if (countEl) {
        countEl.textContent = countText;
    }

    if (typeEl) {
        typeEl.textContent = containerType;
        typeEl.setAttribute('data-type', containerType.toLowerCase().replace(/\s+/g, '-'));
    }

    if (iconImg) {
        if (containerItem.image) {
            iconImg.src = containerItem.image;
            iconImg.alt = containerItem.name || '';
            iconImg.style.display = 'block';
        } else {
            iconImg.style.display = 'none';
        }
    }

    // Highlight active card in grid
    document.querySelectorAll('.collection-card').forEach(card => {
        if (card.getAttribute('data-id') === containerItem.id) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Render skins inside the modal list
    renderSkinsDetailedView(uniqueContains, uniqueRare, skinsListEl);

    // Reset internal modal scroll position to top
    if (modalBody) {
        modalBody.scrollTop = 0;
    }

    // Prevent background scrolling strictly via overflow hidden
    document.body.style.overflow = 'hidden';

    // Show overlay modal
    containerModal.classList.remove('hidden');
    containerModal.setAttribute('aria-hidden', 'false');
}

// Close Container Modal
function closeContainerModal() {
    if (!containerModal) return;

    containerModal.classList.add('hidden');
    containerModal.setAttribute('aria-hidden', 'true');
    isContainerModalOpen = false;
    activeContainerItem = null;

    // Remove active highlight on collection cards
    document.querySelectorAll('.collection-card').forEach(card => {
        card.classList.remove('active');
    });

    // If single skin modal was open, close it too
    if (skinModal && !skinModal.classList.contains('hidden')) {
        skinModal.classList.add('hidden');
        currentModalSkin = null;
    }

    // Restore background scrolling and exact scroll position
    document.body.style.overflow = '';
}

function toggleCollection(collectionId) {
    const col = cachedCollections.find(c => c.id === collectionId);
    if (!col) return;
    openContainerModal(col, 'Collection');
}

function toggleCase(caseId) {
    const caseItem = cachedCases.find(c => c.id === caseId);
    if (!caseItem) return;
    openContainerModal(caseItem, 'Case');
}

function toggleWeeklyDrop(containerId) {
    const item = cachedWeeklyDrops.find(c => c.id === containerId);
    if (!item) return;
    openContainerModal(item, 'Weekly Drop');
}

function toggleLimitedEdition(collectionId) {
    const col = cachedLimitedEdition;
    if (!col) return;
    openContainerModal(col, 'Limited Edition');
}

// Rarity Order Weights (Higher = More Rare)
const RARITY_WEIGHTS = {
    'extraordinary': 100,
    'star': 100,
    '★': 100,
    'gold': 100,
    'covert': 90,
    'classified': 80,
    'restricted': 70,
    'mil-spec grade': 60,
    'mil-spec': 60,
    'industrial grade': 50,
    'industrial': 50,
    'consumer grade': 40,
    'consumer': 40
};

function getSkinRarityWeight(skin) {
    if (!skin) return 0;
    if (isKnifeOrGlove(skin)) return 100;
    const rarityName = skin.rarity && skin.rarity.name ? skin.rarity.name.toLowerCase() : '';
    for (const key in RARITY_WEIGHTS) {
        if (rarityName.includes(key)) {
            return RARITY_WEIGHTS[key];
        }
    }
    return 0;
}

function isKnifeOrGlove(skin) {
    if (!skin) return false;
    if (skin.name && skin.name.startsWith('★')) return true;
    if (skin.category && (skin.category.name === 'Knives' || skin.category.name === 'Gloves')) return true;
    if (skin.weapon && skin.weapon.name && (skin.weapon.name.toLowerCase().includes('knife') || skin.weapon.name.toLowerCase().includes('bayonet') || skin.weapon.name.toLowerCase().includes('karambit') || skin.weapon.name.toLowerCase().includes('daggers') || skin.weapon.name.toLowerCase().includes('gloves'))) return true;
    if (skin.rarity && skin.rarity.name && (skin.rarity.name.toLowerCase().includes('extraordinary') || skin.rarity.name.toLowerCase().includes('star'))) return true;
    return false;
}

// Render Detailed View for Selected Item (Single batch append with DocumentFragment)
function renderSkinsDetailedView(contains, contains_rare, targetContainer) {
    if (!targetContainer) return;
    targetContainer.innerHTML = '';

    // Deduplicate items strictly by base name to ensure each skin appears strictly ONCE
    const uniqueRare = deduplicateItemsByName(contains_rare);
    const uniqueRegular = deduplicateItemsByName(contains);

    const hasRare = uniqueRare.length > 0;
    const hasRegular = uniqueRegular.length > 0;

    if (!hasRare && !hasRegular) {
        targetContainer.innerHTML = '<p class="no-skins">Bu grupta skin bulunamadı.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    // 1. If contains_rare exists and has items: Render Gold Banner
    if (hasRare) {
        const goldSection = document.createElement('div');
        goldSection.className = 'gold-rarity-section';

        const uniqueId = 'rare-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

        const goldCard = document.createElement('div');
        goldCard.className = 'skin-card gold-special-card has-items';
        goldCard.setAttribute('data-knives-target', uniqueId);

        goldCard.innerHTML = `
            <div class="rarity-bar gold-bar"></div>
            <div class="skin-image-wrapper">
                <div class="gold-star-emblem">★</div>
            </div>
            <div class="skin-weapon" style="color: #ffd700; font-weight: 700;">★ RARE SPECIAL ITEM</div>
            <div class="skin-name" style="color: #ffd700;">
                Knives &amp; Gloves
            </div>
            <div class="skin-rarity-tag gold-rarity-tag">
                ★ GOLD (${uniqueRare.length} ITEMS) <span class="expand-arrow">▼ Eşyaları Göster</span>
            </div>
        `;

        const knivesGrid = document.createElement('div');
        knivesGrid.className = 'knives-subgrid hidden';
        knivesGrid.id = uniqueId;

        // Sort rare items alphabetically by name
        const sortedRare = [...uniqueRare].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        sortedRare.forEach(rareSkin => {
            const knifeCard = createSkinCard(rareSkin);
            knivesGrid.appendChild(knifeCard);
        });

        goldCard.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            const gridEl = document.getElementById(uniqueId);
            if (!gridEl) return;

            const isHidden = gridEl.classList.contains('hidden');
            const arrowEl = this.querySelector('.expand-arrow');
            if (isHidden) {
                gridEl.classList.remove('hidden');
                this.classList.add('expanded');
                if (arrowEl) arrowEl.textContent = '▲ Eşyaları Gizle';
                setTimeout(() => {
                    gridEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            } else {
                gridEl.classList.add('hidden');
                this.classList.remove('expanded');
                if (arrowEl) arrowEl.textContent = '▼ Eşyaları Göster';
            }
        });

        goldSection.appendChild(goldCard);
        goldSection.appendChild(knivesGrid);
        fragment.appendChild(goldSection);
    }

    // 2. Regular skins sorted by rarity descending (Covert -> Consumer), then by name
    if (hasRegular) {
        const sortedSkins = [...uniqueRegular].sort((a, b) => {
            const weightA = getSkinRarityWeight(a);
            const weightB = getSkinRarityWeight(b);
            if (weightB !== weightA) {
                return weightB - weightA;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        sortedSkins.forEach(skin => {
            const card = createSkinCard(skin);
            fragment.appendChild(card);
        });
    }

    // Batch append to target container
    targetContainer.appendChild(fragment);
}

// Create Skin Card Component
function createSkinCard(skin) {
    const rarityColor = skin.rarity && skin.rarity.color ? skin.rarity.color : '#b0c3d9';
    const rarityName = skin.rarity && skin.rarity.name ? skin.rarity.name : 'Consumer Grade';

    // Base name directly from JSON
    const baseName = skin.name || 'Unknown Skin';

    // Trade-up eligibility flag
    const canTradeUp = skin.can_trade_up !== false && skin.is_trade_up_eligible !== false;

    // Parse weapon and display title cleanly
    let weaponName = skin.weapon ? skin.weapon.name : '';
    let cleanSkinName = baseName;

    if (!weaponName && baseName.includes(' | ')) {
        const parts = baseName.split(' | ');
        weaponName = parts[0];
        cleanSkinName = parts[1];
    } else if (weaponName && cleanSkinName.startsWith(weaponName + ' | ')) {
        cleanSkinName = cleanSkinName.replace(weaponName + ' | ', '');
    } else if (weaponName && cleanSkinName.startsWith('★ ' + weaponName + ' | ')) {
        cleanSkinName = cleanSkinName.replace('★ ' + weaponName + ' | ', '');
    } else if (!weaponName && baseName.startsWith('★')) {
        weaponName = '★ Knife / Glove';
    }

    const card = document.createElement('div');
    card.className = 'skin-card';
    card.setAttribute('data-market-hash-name', baseName);
    card.setAttribute('data-can-trade-up', canTradeUp ? 'true' : 'false');

    // Apply skin.rarity.color dynamically to borders and hover glows
    card.style.borderColor = `${rarityColor}40`;
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = rarityColor;
        card.style.boxShadow = `0 14px 28px rgba(0, 0, 0, 0.55), 0 0 20px ${rarityColor}45`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = `${rarityColor}40`;
        card.style.boxShadow = '';
    });

    const nonTradeUpBadge = !canTradeUp ? `<div style="font-size: 0.65rem; color: #fb7185; background: rgba(251, 113, 133, 0.15); border: 1px solid rgba(251, 113, 133, 0.35); padding: 0.12rem 0.45rem; border-radius: 4px; margin-top: 0.25rem; font-weight: 700; letter-spacing: 0.04em;">NON-TRADEUP</div>` : '';

    card.innerHTML = `
        <div class="rarity-bar" style="background-color: ${rarityColor}"></div>
        <div class="skin-image-wrapper">
            <img src="${escapeHtml(skin.image)}" alt="${escapeHtml(baseName)}" loading="lazy" decoding="async" onError="this.src='https://via.placeholder.com/150/111726/ffffff?text=CS2+Skin'">
        </div>
        <div class="skin-weapon">${escapeHtml(weaponName)}</div>
        <div class="skin-name" title="${escapeHtml(baseName)}">
            <span class="skin-base-title">${escapeHtml(cleanSkinName)}</span>
        </div>
        ${nonTradeUpBadge}
        <div class="skin-price">$ --</div>
        <div class="skin-rarity-tag" style="color: ${rarityColor}; background: ${rarityColor}18; border: 1px solid ${rarityColor}40; box-shadow: 0 0 8px ${rarityColor}20;">
            ${escapeHtml(rarityName)}
        </div>
    `;

    card.addEventListener('click', (e) => {
        e.stopPropagation();
        openSkinModal(skin);
    });

    return card;
}

// Open Skin Modal (Bilgi Balonu) with Dynamic Rarity Theming
function openSkinModal(skin) {
    document.body.style.overflow = 'hidden';
    currentModalSkin = skin;
    activeWearMode = 'normal';

    // Reset wear tabs UI
    document.querySelectorAll('.wear-tab').forEach(tab => {
        if (tab.getAttribute('data-wear-mode') === 'normal') {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const baseName = skin.name || 'Unknown Skin';
    let weaponName = skin.weapon ? skin.weapon.name : '';
    if (!weaponName && baseName.includes(' | ')) {
        weaponName = baseName.split(' | ')[0];
    } else if (!weaponName && baseName.startsWith('★')) {
        weaponName = '★ Knife / Glove';
    }

    const rarityName = skin.rarity && skin.rarity.name ? skin.rarity.name : 'Consumer Grade';
    const rarityColor = skin.rarity && skin.rarity.color ? skin.rarity.color : '#b0c3d9';

    const minFloatVal = skin.min_float !== null && skin.min_float !== undefined ? skin.min_float : 0.00;
    const maxFloatVal = skin.max_float !== null && skin.max_float !== undefined ? skin.max_float : 1.00;

    // Display base name strictly without phase variants or pills
    modalSkinName.textContent = baseName;

    // Apply Dynamic Rarity Color Theme to Backdrop and Modal
    skinModal.style.background = `radial-gradient(circle at center, ${rarityColor}35 0%, rgba(5, 7, 13, 0.88) 75%)`;

    const modalContent = skinModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.borderColor = `${rarityColor}70`;
        modalContent.style.boxShadow = `0 25px 65px -10px ${rarityColor}45, inset 0 1px 0 ${rarityColor}50`;
    }

    if (modalImageContainer) {
        modalImageContainer.style.background = `radial-gradient(circle at center, ${rarityColor}30 0%, transparent 75%)`;
        modalImageContainer.innerHTML = `<img src="${escapeHtml(skin.image)}" alt="${escapeHtml(baseName)}" loading="lazy" decoding="async">`;
    }

    // Trade-up eligibility display in modal
    const canTradeUp = skin.can_trade_up !== false && skin.is_trade_up_eligible !== false;
    const tradeUpStatusHtml = canTradeUp 
        ? `<span style="color: #4ade80; font-weight: 700;">Eligible</span>` 
        : `<span style="color: #fb7185; font-weight: 700;">Not Eligible (Limited Edition)</span>`;

    const modalDetailsEl = skinModal.querySelector('.modal-details');
    if (modalDetailsEl) {
        modalDetailsEl.innerHTML = `
            <p><strong>Weapon:</strong> <span id="modal-weapon">${escapeHtml(weaponName)}</span></p>
            <p><strong>Rarity:</strong> <span id="modal-rarity"><span class="rarity-pill" style="background-color: ${rarityColor}; box-shadow: 0 0 12px ${rarityColor}60;">${escapeHtml(rarityName)}</span></span></p>
            <p><strong>Float Aralığı:</strong> <span id="modal-float">${minFloatVal.toFixed(2)} – ${maxFloatVal.toFixed(2)}</span></p>
            <p><strong>Trade-Up Status:</strong> ${tradeUpStatusHtml}</p>
        `;
    }

    // Render Wear Conditions with $ -- price placeholder
    renderWearConditions(skin, activeWearMode);

    skinModal.classList.remove('hidden');
}

// Render Wear Conditions with Float Range Clamping & Price Placeholder
function renderWearConditions(skin, mode) {
    if (!skin || !modalWearConditions) return;

    // If StatTrak mode selected and skin explicitly does not have StatTrak
    if (mode === 'stattrak' && skin.stattrak === false) {
        modalWearConditions.innerHTML = `
            <div class="no-stattrak-notice">
                <span>⚠️ Bu skin için StatTrak™ versiyonu bulunmamaktadır.</span>
            </div>
        `;
        return;
    }

    const skinMin = skin.min_float !== null && skin.min_float !== undefined ? skin.min_float : 0.00;
    const skinMax = skin.max_float !== null && skin.max_float !== undefined ? skin.max_float : 1.00;

    const wearRowsHtml = [];

    WEAR_RANGES.forEach(wear => {
        const effMin = Math.max(wear.min, skinMin);
        const effMax = Math.min(wear.max, skinMax);

        // If condition does not exist for this skin float range, skip rendering completely
        if (effMax - effMin <= 0.0001) {
            return;
        }

        wearRowsHtml.push(`
            <div class="wear-row">
                <div class="wear-left">
                    <span class="badge ${wear.cssClass}">${wear.code.toUpperCase()}</span>
                    <div class="wear-info">
                        <span class="wear-name">${wear.name}</span>
                        <span class="wear-range">${effMin.toFixed(2)} – ${effMax.toFixed(2)}</span>
                    </div>
                </div>
                <div class="wear-right">
                    <span class="wear-price">$ --</span>
                </div>
            </div>
        `);
    });

    if (wearRowsHtml.length === 0) {
        modalWearConditions.innerHTML = `
            <div class="no-stattrak-notice">
                <span>Aşınmışlık verisi bulunamadı.</span>
            </div>
        `;
    } else {
        modalWearConditions.innerHTML = wearRowsHtml.join('');
    }
}

// Close Skin Modal
function closeModal() {
    skinModal.classList.add('hidden');
    currentModalSkin = null;

    // Only restore body scrolling if container modal is NOT open
    if (!isContainerModalOpen) {
        document.body.style.overflow = '';
    }
}

// Filter Action Handling
function handleFilterSubmit() {
    const costVal = filterCost ? filterCost.value : 'All Costs';
    const collVal = filterCollection ? filterCollection.value : 'All Collections';
    const rarityVal = filterRarity ? filterRarity.value : 'All Rarities';
    const sortVal = sortBySelect ? sortBySelect.value : 'Newest First';

    tradeUpResults.innerHTML = `
        <div class="beta-notice">
            <div class="beta-notice-icon">
                <img src="skinup-icon.png" alt="SkinUp Icon" class="notice-skinup-icon">
            </div>
            <h3>Filtrelenmiş Trade-Up Listesi</h3>
            <p><strong>Filtreler:</strong> ${collVal} | ${rarityVal} | ${costVal} | Sıralama: ${sortVal}</p>
            <p><em>Beta aşaması: Karlı trade-up hesaplama algoritması ve market fiyat entegrasyonu formül tanımı sonrası aktif edilecektir.</em></p>
        </div>
    `;
}

// Filter Reset Handling
function handleFilterReset() {
    if (filterCost) filterCost.selectedIndex = 0;
    if (filterCollection) filterCollection.selectedIndex = 0;
    if (filterRarity) filterRarity.selectedIndex = 0;
    if (filterMinProfit) filterMinProfit.value = '';
    if (filterMinSuccess) filterMinSuccess.value = '';
    if (filterStattrak) filterStattrak.selectedIndex = 0;
    if (sortBySelect) sortBySelect.selectedIndex = 0;

    tradeUpResults.innerHTML = `
        <div class="beta-notice" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; max-width: 850px; margin: 0 auto;">
            <div class="beta-notice-icon" style="display: flex; align-items: center; justify-content: center; width: 100%; margin-bottom: 1rem;">
                <img src="skinup-icon.png" alt="SkinUp Icon" class="notice-skinup-icon">
            </div>
            <p class="beta-notice-text" style="text-align: center; width: 100%; margin: 0 auto; display: block;"><em style="text-align: center; display: inline-block;">Beta aşaması: Karlı trade-up algoritması ve fiyatlar henüz sisteme entegre edilmemiştir.</em></p>
        </div>
    `;
}

// Populate Trade Up Collections Filter Dropdown with All Local Collections
function populateTradeUpCollections(collections) {
    if (!filterCollection || !collections || collections.length === 0) return;
    const currentVal = filterCollection.value;
    filterCollection.innerHTML = '<option>All Collections</option>' +
        collections.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
    if (currentVal && [...filterCollection.options].some(o => o.value === currentVal)) {
        filterCollection.value = currentVal;
    }
}
