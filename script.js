// CS2 Trade-Up Analyzer - Client JavaScript
const API_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';

// App State
let allSkins = [];
let harlequinSkins = [];
let dreamsNightmaresSkins = [];
let activeCollection = null;
let activeCase = null;
let currentModalSkin = null;
let activeWearMode = 'normal'; // 'normal' or 'stattrak'

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
const harlequinCard = document.getElementById('harlequin-card');
const skinsContainer = document.getElementById('skins-container');
const skinsList = document.getElementById('skins-list');
const dreamsCard = document.getElementById('dreams-card');
const caseSkinsContainer = document.getElementById('case-skins-container');
const caseSkinsList = document.getElementById('case-skins-list');
const skinModal = document.getElementById('skin-modal');
const closeModalBtn = document.getElementById('close-modal');

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
    fetchSkinData();
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

// Fetch CS2 Skins Data from API
async function fetchSkinData() {
    try {
        harlequinCard.style.opacity = '0.6';
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('API fetch error');
        allSkins = await response.json();

        // Filter skins belonging to Harlequin Collection
        harlequinSkins = allSkins.filter(s =>
            s.collections && s.collections.some(c => c.name.toLowerCase().includes('harlequin'))
        );

        // Filter skins belonging to Dreams & Nightmares Case
        dreamsNightmaresSkins = allSkins.filter(s =>
            (s.crates && s.crates.some(c => c.name.toLowerCase().includes('dreams & nightmares'))) ||
            (s.collections && s.collections.some(c => c.name.toLowerCase().includes('dreams & nightmares')))
        );

        harlequinCard.style.opacity = '1';
        console.log(`Loaded ${allSkins.length} skins, Harlequin count: ${harlequinSkins.length}, Dreams & Nightmares count: ${dreamsNightmaresSkins.length}`);
    } catch (err) {
        console.error('Failed to load skin data:', err);
        // Fallback demo data if offline/network issue
        loadFallbackData();
    }
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

    // Collection click event
    if (harlequinCard) {
        harlequinCard.addEventListener('click', () => {
            toggleCollection('harlequin');
        });
    }

    // Case click event
    if (dreamsCard) {
        dreamsCard.addEventListener('click', () => {
            toggleCase('dreams-nightmares');
        });
    }

    // Close Modal Events
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    if (skinModal) {
        skinModal.addEventListener('click', (e) => {
            if (e.target === skinModal) closeModal();
        });
    }

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

    // Sub-nav Tabs (Collections / Cases)
    document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const subtab = tab.getAttribute('data-subtab');
            switchSubTab(subtab);
        });
    });
}

// Switch Sub-Tab (Collections / Cases)
function switchSubTab(subtab) {
    document.querySelectorAll('.sub-tab').forEach(tab => {
        if (tab.getAttribute('data-subtab') === subtab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const collectionsTabContent = document.getElementById('collections-tab-content');
    const casesTabContent = document.getElementById('cases-tab-content');
    const harlequinCardEl = harlequinCard || document.getElementById('harlequin-card');
    const dreamsCardEl = dreamsCard || document.getElementById('dreams-card');
    const skinsContainerEl = skinsContainer || document.getElementById('skins-container');
    const caseSkinsContainerEl = caseSkinsContainer || document.getElementById('case-skins-container');

    if (subtab === 'collections') {
        if (collectionsTabContent) collectionsTabContent.classList.remove('hidden');
        if (casesTabContent) casesTabContent.classList.add('hidden');
        // Reset case active
        activeCase = null;
        if (dreamsCardEl) dreamsCardEl.classList.remove('active');
        if (caseSkinsContainerEl) {
            caseSkinsContainerEl.classList.remove('expanded');
            caseSkinsContainerEl.classList.add('hidden');
        }
    } else if (subtab === 'cases') {
        if (collectionsTabContent) collectionsTabContent.classList.add('hidden');
        if (casesTabContent) casesTabContent.classList.remove('hidden');
        // Reset collection active
        activeCollection = null;
        if (harlequinCardEl) harlequinCardEl.classList.remove('active');
        if (skinsContainerEl) {
            skinsContainerEl.classList.remove('expanded');
            skinsContainerEl.classList.add('hidden');
        }
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
    const collectionList = document.getElementById('collection-list');
    if (!collectionList) return;

    const cards = collectionList.querySelectorAll('.collection-card');
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
    let noticeEl = collectionList.querySelector('.empty-search-notice');
    if (visibleCount === 0 && query !== '') {
        if (!noticeEl) {
            noticeEl = document.createElement('div');
            noticeEl.className = 'empty-search-notice';
            noticeEl.innerHTML = `
                <div class="search-icon-dim">🔍</div>
                <p><strong>"${query}"</strong> ile eşleşen koleksiyon veya kasa bulunamadı.</p>
            `;
            collectionList.appendChild(noticeEl);
        } else {
            noticeEl.querySelector('p').innerHTML = `<strong>"${query}"</strong> ile eşleşen koleksiyon veya kasa bulunamadı.`;
            noticeEl.classList.remove('hidden');
        }
    } else if (noticeEl) {
        noticeEl.classList.add('hidden');
    }
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

// Toggle Collection Skins View (Smooth Single-Item Accordion)
function toggleCollection(collectionId) {
    const harlequinCardEl = harlequinCard || document.getElementById('harlequin-card');
    const skinsContainerEl = skinsContainer || document.getElementById('skins-container');
    const skinsListEl = skinsList || document.getElementById('skins-list');
    const dreamsCardEl = dreamsCard || document.getElementById('dreams-card');
    const caseSkinsContainerEl = caseSkinsContainer || document.getElementById('case-skins-container');

    // Collapse case if open
    if (activeCase) {
        activeCase = null;
        if (dreamsCardEl) dreamsCardEl.classList.remove('active');
        if (caseSkinsContainerEl) {
            caseSkinsContainerEl.classList.remove('expanded');
            setTimeout(() => {
                if (!activeCase) caseSkinsContainerEl.classList.add('hidden');
            }, 350);
        }
    }

    if (activeCollection === collectionId) {
        // Toggle collapse
        activeCollection = null;
        if (harlequinCardEl) harlequinCardEl.classList.remove('active');
        if (skinsContainerEl) {
            skinsContainerEl.classList.remove('expanded');
            setTimeout(() => {
                if (!activeCollection) skinsContainerEl.classList.add('hidden');
            }, 350);
        }
    } else {
        // Expand
        activeCollection = collectionId;
        if (harlequinCardEl) harlequinCardEl.classList.add('active');
        renderSkins(harlequinSkins, skinsListEl);
        if (skinsContainerEl) {
            skinsContainerEl.classList.remove('hidden');
            requestAnimationFrame(() => {
                skinsContainerEl.classList.add('expanded');
            });
            if (lenis && harlequinCardEl) {
                lenis.scrollTo(harlequinCardEl, { offset: -90, duration: 0.8 });
            }
        }
    }
}

// Toggle Case Skins View (Smooth Single-Item Accordion)
function toggleCase(caseId) {
    const dreamsCardEl = dreamsCard || document.getElementById('dreams-card');
    const caseSkinsContainerEl = caseSkinsContainer || document.getElementById('case-skins-container');
    const caseSkinsListEl = caseSkinsList || document.getElementById('case-skins-list');
    const harlequinCardEl = harlequinCard || document.getElementById('harlequin-card');
    const skinsContainerEl = skinsContainer || document.getElementById('skins-container');

    // Collapse collection if open
    if (activeCollection) {
        activeCollection = null;
        if (harlequinCardEl) harlequinCardEl.classList.remove('active');
        if (skinsContainerEl) {
            skinsContainerEl.classList.remove('expanded');
            setTimeout(() => {
                if (!activeCollection) skinsContainerEl.classList.add('hidden');
            }, 350);
        }
    }

    if (activeCase === caseId) {
        // Toggle collapse
        activeCase = null;
        if (dreamsCardEl) dreamsCardEl.classList.remove('active');
        if (caseSkinsContainerEl) {
            caseSkinsContainerEl.classList.remove('expanded');
            setTimeout(() => {
                if (!activeCase) caseSkinsContainerEl.classList.add('hidden');
            }, 350);
        }
    } else {
        // Expand
        activeCase = caseId;
        if (dreamsCardEl) dreamsCardEl.classList.add('active');
        renderSkins(dreamsNightmaresSkins, caseSkinsListEl);
        if (caseSkinsContainerEl) {
            caseSkinsContainerEl.classList.remove('hidden');
            requestAnimationFrame(() => {
                caseSkinsContainerEl.classList.add('expanded');
            });
            if (lenis && dreamsCardEl) {
                lenis.scrollTo(dreamsCardEl, { offset: -90, duration: 0.8 });
            }
        }
    }
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

// Render Skin Cards Grid (Sorted by Rarity: Most Rare at Top, Least Rare at Bottom)
function renderSkins(skins, targetContainer = skinsList) {
    if (!targetContainer) return;
    targetContainer.innerHTML = '';

    if (!skins || skins.length === 0) {
        targetContainer.innerHTML = '<p class="no-skins">Bu grupta skin bulunamadı.</p>';
        return;
    }

    // Separate knives/gloves from regular skins
    const knifeSkins = skins.filter(s => isKnifeOrGlove(s));
    const regularSkins = skins.filter(s => !isKnifeOrGlove(s));

    // Sort regular skins by rarity weight descending (en ender en üstte, en yaygın en altta)
    regularSkins.sort((a, b) => {
        const weightA = getSkinRarityWeight(a);
        const weightB = getSkinRarityWeight(b);
        if (weightB !== weightA) {
            return weightB - weightA;
        }
        return a.name.localeCompare(b.name);
    });

    // 1. Render Single Gold Rarity Card at the top of the collection
    const goldSection = document.createElement('div');
    goldSection.className = 'gold-rarity-section';

    const hasKnives = knifeSkins.length > 0;
    
    // Use a unique ID so we can find elements reliably
    const uniqueId = 'knives-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    const goldCard = document.createElement('div');
    goldCard.className = `skin-card gold-special-card ${hasKnives ? 'has-items' : 'empty-gold-card'}`;
    goldCard.setAttribute('data-knives-target', uniqueId);

    goldCard.innerHTML = `
        <div class="rarity-bar gold-bar"></div>
        <div class="skin-image-wrapper">
            <div class="gold-star-emblem ${hasKnives ? '' : 'dim-star'}">★</div>
        </div>
        <div class="skin-weapon" style="color: #ffd700; font-weight: 700;">★ RARE SPECIAL ITEM</div>
        <div class="skin-name" style="color: ${hasKnives ? '#ffd700' : 'var(--text-muted)'};">
            Bıçaklar & Eldivenler
        </div>
        <div class="skin-rarity-tag gold-rarity-tag ${hasKnives ? '' : 'empty-gold-tag'}">
            ★ GOLD (${knifeSkins.length} EŞYA) ${hasKnives ? '<span class="expand-arrow">▼ Bıçakları Göster</span>' : ''}
        </div>
    `;

    if (hasKnives) {
        const knivesGrid = document.createElement('div');
        knivesGrid.className = 'knives-subgrid hidden';
        knivesGrid.id = uniqueId;

        // Phase display order priority
        const phasePriority = {
            'Emerald': 1,
            'Ruby': 2,
            'Sapphire': 3,
            'Black Pearl': 4,
            'Phase 1': 5,
            'Phase 2': 6,
            'Phase 3': 7,
            'Phase 4': 8
        };

        // Render knife items inside subgrid sorted by name and phase
        knifeSkins.sort((a, b) => {
            const nameCmp = a.name.localeCompare(b.name);
            if (nameCmp !== 0) return nameCmp;
            const pA = a.phase ? (phasePriority[a.phase] || 50) : 99;
            const pB = b.phase ? (phasePriority[b.phase] || 50) : 99;
            return pA - pB;
        }).forEach(skin => {
            const knifeCard = createSkinCard(skin);
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
                if (arrowEl) arrowEl.textContent = '▲ Bıçakları Gizle';
                setTimeout(() => {
                    gridEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            } else {
                gridEl.classList.add('hidden');
                this.classList.remove('expanded');
                if (arrowEl) arrowEl.textContent = '▼ Bıçakları Göster';
            }
        });

        goldSection.appendChild(goldCard);
        goldSection.appendChild(knivesGrid);
    } else {
        // Empty gold card (0 EŞYA): clicking does NOT open/expand any subgrid
        goldCard.style.cursor = 'default';
        goldSection.appendChild(goldCard);
    }

    targetContainer.appendChild(goldSection);

    // 2. Render regular skins in sorted order (most rare to least rare)
    regularSkins.forEach(skin => {
        const card = createSkinCard(skin);
        targetContainer.appendChild(card);
    });
}

function createSkinCard(skin) {
    const rarityColor = skin.rarity ? skin.rarity.color : '#b0c3d9';
    const rarityName = skin.rarity ? skin.rarity.name : 'Unknown';
    const weaponName = skin.weapon ? skin.weapon.name : '';

    // Handle clean display name without redundant weapon name
    let cleanSkinName = skin.name;
    if (weaponName && cleanSkinName.startsWith(weaponName + ' | ')) {
        cleanSkinName = cleanSkinName.replace(weaponName + ' | ', '');
    } else if (weaponName && cleanSkinName.startsWith('★ ' + weaponName + ' | ')) {
        cleanSkinName = '★ ' + cleanSkinName.replace('★ ' + weaponName + ' | ', '');
    } else if (cleanSkinName.includes(' | ')) {
        const parts = cleanSkinName.split(' | ');
        cleanSkinName = (skin.name.startsWith('★') ? '★ ' : '') + parts[1];
    }

    const phase = skin.phase;
    const phaseClass = phase ? `phase-${phase.toLowerCase().replace(/\s+/g, '-')}` : '';
    const phaseBadgeHtml = phase ? `<span class="skin-phase-badge ${phaseClass}">${phase}</span>` : '';

    const card = document.createElement('div');
    card.className = 'skin-card';
    card.innerHTML = `
        <div class="rarity-bar" style="background-color: ${rarityColor}"></div>
        <div class="skin-image-wrapper">
            <img src="${skin.image}" alt="${skin.name}" loading="lazy" onError="this.src='https://via.placeholder.com/150/111726/ffffff?text=CS2+Skin'">
        </div>
        <div class="skin-weapon">${weaponName}</div>
        <div class="skin-name" title="${skin.name}${phase ? ' (' + phase + ')' : ''}">
            <span class="skin-base-title">${cleanSkinName}</span>
            ${phaseBadgeHtml}
        </div>
        <div class="skin-rarity-tag" style="color: ${rarityColor}; background: ${rarityColor}18; border: 1px solid ${rarityColor}40">
            ${rarityName}
        </div>
    `;

    card.addEventListener('click', () => openSkinModal(skin));
    return card;
}

// Open Skin Modal (Bilgi Balonu) with Dynamic Rarity Theming
function openSkinModal(skin) {
    if (lenis) lenis.stop();
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

    const weaponName = skin.weapon ? skin.weapon.name : '';
    const skinTitle = skin.name ? skin.name : 'Unknown Skin';
    const rarityName = skin.rarity ? skin.rarity.name : 'Consumer Grade';
    const rarityColor = skin.rarity ? skin.rarity.color : '#b0c3d9';

    const minFloatVal = skin.min_float !== null && skin.min_float !== undefined ? skin.min_float : 0.00;
    const maxFloatVal = skin.max_float !== null && skin.max_float !== undefined ? skin.max_float : 1.00;

    const phase = skin.phase;
    const phaseClass = phase ? `phase-${phase.toLowerCase().replace(/\s+/g, '-')}` : '';
    
    if (phase) {
        modalSkinName.innerHTML = `${skinTitle} <span class="modal-phase-pill ${phaseClass}">${phase}</span>`;
    } else {
        modalSkinName.textContent = skinTitle;
    }

    modalWeapon.textContent = weaponName;

    // Phase / Variant Row in Modal Details
    const modalPhaseRow = document.getElementById('modal-phase-row');
    const modalPhase = document.getElementById('modal-phase');
    if (modalPhaseRow && modalPhase) {
        if (phase) {
            modalPhase.textContent = phase;
            modalPhase.className = `phase-badge ${phaseClass}`;
            modalPhaseRow.classList.remove('hidden');
        } else {
            modalPhaseRow.classList.add('hidden');
        }
    }

    // Apply Dynamic Rarity Color Theme to Backdrop and Modal
    skinModal.style.background = `radial-gradient(circle at center, ${rarityColor}35 0%, rgba(5, 7, 13, 0.88) 75%)`;
    
    const modalContent = skinModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.borderColor = `${rarityColor}70`;
        modalContent.style.boxShadow = `0 25px 65px -10px ${rarityColor}45, inset 0 1px 0 ${rarityColor}50`;
    }

    if (modalImageContainer) {
        modalImageContainer.style.background = `radial-gradient(circle at center, ${rarityColor}30 0%, transparent 75%)`;
    }

    // Rarity with Pill and Glow
    modalRarity.innerHTML = `<span class="rarity-pill" style="background-color: ${rarityColor}; box-shadow: 0 0 12px ${rarityColor}60;">${rarityName}</span>`;
    modalFloat.textContent = `${minFloatVal.toFixed(2)} – ${maxFloatVal.toFixed(2)}`;

    // Modal Image
    modalImageContainer.innerHTML = `<img src="${skin.image}" alt="${skinTitle}">`;

    // Render Wear Conditions based on mode and clamped floats
    renderWearConditions(skin, activeWearMode);

    skinModal.classList.remove('hidden');
}

// Render Wear Conditions with Float Range Clamping & Price Placeholder (Reference 2 Inspired)
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

        // If condition does not exist for this skin float range, skip rendering completely!
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
                    <span class="wear-price">$</span>
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
    if (lenis) lenis.start();
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

// Fallback Data if network fails (Includes sample Knife item to verify Gold Card)
function loadFallbackData() {
    harlequinSkins = [
        {
            name: "★ Karambit | Gamma Doppler",
            weapon: { name: "Karambit" },
            category: { name: "Knives" },
            rarity: { name: "Extraordinary", color: "#ffd700" },
            min_float: 0.00,
            max_float: 0.08,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIX14lY7q5F5k8d9yD24E-iW0oFf2M43x2T9kZ3W-0YhE6c29b-M504_S249339Z8ZpXqDUp7XoT9C29S4e3wz3y780W_3Z6z-F29D"
        },
        {
            name: "AWP | Exothermic",
            weapon: { name: "AWP" },
            rarity: { name: "Restricted", color: "#8847ff" },
            min_float: 0,
            max_float: 0.7,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf9Tte0PSneqF6L-KYMXeR1e1-tfJWQyC0nQlp4W7Xzd-qcH_DO1N0W5FzQuEP5kW8ltfnM-q24wzYgt0RmC_7jSlL5jErvbgX7dER8Q"
        },
        {
            name: "M4A1-S | Party Animal",
            weapon: { name: "M4A1-S" },
            rarity: { name: "Classified", color: "#d32ce6" },
            min_float: 0,
            max_float: 0.6,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XuWbwcuyMESA4Fdl-4nnpU7iQA3-kKnr8ytd6s29Y6FhJeScACnDkL8j6LU8GS3mwUh24G-Bno2tIymeblMgC5R3F-ECsBK6k4XuN-Lh-UWA3P3GyEv9"
        }
    ];

    dreamsNightmaresSkins = [
        {
            name: "AK-47 | Nightwish",
            weapon: { name: "AK-47" },
            rarity: { name: "Covert", color: "#eb4b4b" },
            min_float: 0.00,
            max_float: 1.00,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIX04lP-0-L6r3q0H2XdVJx-5CV-03cWyblwG6b4Sse7P2neqD6A0-1oXedzM-KkfT_V230mRl91WeH1m4j0NWWUPwwsCsR6S_8F40W8k4PnNei_01fZ5H5yH5w"
        },
        {
            name: "MP9 | Starlight Protector",
            weapon: { name: "MP9" },
            rarity: { name: "Covert", color: "#eb4b4b" },
            min_float: 0.00,
            max_float: 0.80,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGI71S-z3Vbvwx8-0H2XdVJx-5CV-03cWyblwG6b4ScW7OW3gqg6N9-2f22h8NqfkeznV2-omQVx7Wu-InImuJS2ZPAohAt9wS-cK5hbtksbmPL660wS_5X5xD-2n0jY"
        },
        {
            name: "Dual Berettas | Melondrama",
            weapon: { name: "Dual Berettas" },
            rarity: { name: "Classified", color: "#d32ce6" },
            min_float: 0.00,
            max_float: 1.00,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJK-2Fi5XeWfxNu0H2XdVJx-5CV-03cWyblwG6b4Ss-6PyLpqAG93-1mX-F9NeT_fjvTzChd6i8wWW2EmsuuP2qZPAggWsZyTOAK5BCxlNflM-mwsAGIiomSjC2k1nI-132d3eU"
        },
        {
            name: "M4A1-S | Night Terror",
            weapon: { name: "M4A1-S" },
            rarity: { name: "Restricted", color: "#8847ff" },
            min_float: 0.00,
            max_float: 0.70,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIz-X-3_V-eTwdy0H2XdVJx-5CV-03cWyblwG6b4SsW-PW3vqw2O5--dXOd7NeD9bDTbWjlhWn1zXG3dmoL1NH-QOVN9CsRwFeIK7BLpk9fmN--wsQOM2opGzi-k-Gf_sH6lC-_n"
        },
        {
            name: "USP-S | Ticket to Hell",
            weapon: { name: "USP-S" },
            rarity: { name: "Restricted", color: "#8847ff" },
            min_float: 0.00,
            max_float: 0.40,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKy3l-_X-XbxN-0H2XdVJx-5CV-03cWyblwG6b4S8a5OXLm-QWN2-2eF-V7NeT_eTvX2-olRlx_W-71mtmndCmVdQ99WZp1F-MCtEGwkd3jMei8s1fajNox3n7rgnkfvHw72H3n0Dk"
        },
        {
            name: "★ Butterfly Knife | Gamma Doppler",
            weapon: { name: "Butterfly Knife" },
            category: { name: "Knives" },
            rarity: { name: "Covert", color: "#eb4b4b" },
            min_float: 0.00,
            max_float: 0.08,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Z-ua6bbZrLOmsD2qvxONzouBlSxa-lA8lvziMgIr9HifOOV5kFJp2Ee9b4Rntm4GxY7_ntQHc2o1DmH6r3Hgcv3w4t-pXU6ZzrPHQjQnfcepq0dwfRJw"
        },
        {
            name: "★ Falchion Knife | Lore",
            weapon: { name: "Falchion Knife" },
            category: { name: "Knives" },
            rarity: { name: "Covert", color: "#eb4b4b" },
            min_float: 0.00,
            max_float: 0.65,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1P7vG6YadsLM-QG1iY1OBio-xoQRa_mg8ijDGMnYftb3qfPQZyWJtyFuNe4BG5ktDuY-ritleIid1Hynir3H9KvH055btRV6s7uvqAU_ahZxI"
        },
        {
            name: "★ Shadow Daggers | Autotronic",
            weapon: { name: "Shadow Daggers" },
            category: { name: "Knives" },
            rarity: { name: "Covert", color: "#eb4b4b" },
            min_float: 0.00,
            max_float: 0.85,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1L-uGmV6N-H-CGHW-vwPtiv_V7QCe6liIrujqNjsGrIH2fOFJxX5F1TeICsRe8x4ezY-vj7gHc2N9HxHir3HhK7Cds5L4AT-N7rU0zpOnr"
        },
        {
            name: "★ Huntsman Knife | Freehand",
            weapon: { name: "Huntsman Knife" },
            category: { name: "Knives" },
            rarity: { name: "Covert", color: "#eb4b4b" },
            min_float: 0.00,
            max_float: 0.48,
            image: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1P7vG6YadsLM-SA1idwPx9teVWWjmMzE0YvzSCkpu3cC-Wald2A5tyFu9esxDpktO2Nrzq4wzaiYlGzXmo3SxIuHw65bsLU71lpPPkJkZySA"
        }
    ];
}
