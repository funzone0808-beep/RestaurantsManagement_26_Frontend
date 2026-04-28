"use strict";

window.APP_STATE = {
  hotel: null,
  menu: null,
  testimonials: [],
  gallery: [],
  heroScene: {},
  loadingScreen: {},
  theme: {},
  activeHotelSlug: null,
  orderContext: {
    orderType: "standard",
    tableNumber: "",
    orderSource: "website",
    qrContextToken: "",
    addToOrderId: "",
    addToken: ""
  }
};

// const API_BASE = "http://localhost:5000/api";
// const TENANT_API_BASE = `${API_BASE}/tenant`;
// const PUBLIC_API_BASE = `${API_BASE}/public`;

const HOTEL_SLUG_STORAGE_KEY = "hotel_platform_last_hotel_slug";

function normalizeHotelSlug(value) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function getStoredHotelSlug() {
  try {
    return normalizeHotelSlug(window.localStorage?.getItem(HOTEL_SLUG_STORAGE_KEY));
  } catch {
    return "";
  }
}

function rememberHotelSlug(slug) {
  const normalizedSlug = normalizeHotelSlug(slug);

  if (!normalizedSlug) return;

  try {
    window.localStorage?.setItem(HOTEL_SLUG_STORAGE_KEY, normalizedSlug);
  } catch {
    // Storage can be unavailable in private browsing; query/domain routing still works.
  }
}

function getRuntimeDefaultHotelSlug() {
  return (
    normalizeHotelSlug(window.APP_RUNTIME_CONFIG?.DEFAULT_HOTEL_SLUG) ||
    getStoredHotelSlug()
  );
}

function getDefaultApiBaseUrl() {
  const hostname = window.location.hostname;
  const isLocalHost =
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");
  const baseUrl =
    isLocalHost || !window.location.origin || window.location.origin === "null"
      ? "http://localhost:5000"
      : window.location.origin;

  return `${baseUrl.replace(/\/+$/, "")}/api`;
}

const API_BASE =
  window.APP_RUNTIME_CONFIG?.API_BASE_URL || getDefaultApiBaseUrl();

const TENANT_API_BASE = `${API_BASE}/tenant`;
const PUBLIC_API_BASE = `${API_BASE}/public`;
const SUPPORTED_THEME_SECTION_ORDER = [
  "about",
  "menu",
  "reservation",
  "events",
  "gallery",
  "testimonials",
  "contact"
];
const SUPPORTED_THEME_HERO_LAYOUT_VARIANTS = ["default", "split", "stacked"];
const SUPPORTED_GALLERY_LAYOUT_VARIANTS = ["standard", "large", "tall", "wide"];
const MENU_CATEGORY_ALIASES = {
  starter: "starters",
  starters: "starters",
  appetizer: "starters",
  appetizers: "starters",
  snack: "starters",
  snacks: "starters",
  main: "mains",
  mains: "mains",
  maincourse: "mains",
  maincourses: "mains",
  dessert: "desserts",
  desserts: "desserts",
  sweet: "desserts",
  sweets: "desserts",
  drink: "drinks",
  drinks: "drinks",
  beverage: "drinks",
  beverages: "drinks"
};
const SUPPORTED_HERO_SCENE_PRESETS = [
  "default",
  "luxury",
  "warm",
  "minimal",
  "family"
];
const SUPPORTED_HERO_SCENE_TEMPLATES = [
  "default",
  "orbital",
  "sculptural",
  "constellation"
];
const SUPPORTED_HERO_SCENE_MODEL_PRESETS = [
  "none",
  "coffee-cup",
  "plated-dish",
  "dessert",
  "service-cloche"
];
const DEFAULT_HERO_SCENE_CONFIG = {
  enabled: true,
  template: "default",
  modelPreset: "none",
  preset: "default",
  toneMappingExposure: 1.2,
  cameraDistance: 12,
  ambientLightIntensity: 0.5,
  goldLightIntensity: 3.5,
  warmLightIntensity: 2.5,
  rimLightIntensity: 0.8,
  particleCount: 280
};
const DEFAULT_LOADING_SCREEN_CONFIG = {
  logoPrimaryText: "H",
  logoSecondaryText: "SR",
  tagline: "Preparing your experience...",
  backgroundColor: "",
  accentColor: "",
  textColor: "",
  backgroundImageUrl: ""
};
const HERO_SCENE_PRESET_DEFAULTS = {
  default: {},
  luxury: {
    toneMappingExposure: 1.35,
    cameraDistance: 11.5,
    ambientLightIntensity: 0.45,
    goldLightIntensity: 4.4,
    warmLightIntensity: 2.1,
    rimLightIntensity: 1
  },
  warm: {
    toneMappingExposure: 1.28,
    cameraDistance: 11.8,
    ambientLightIntensity: 0.65,
    goldLightIntensity: 3.7,
    warmLightIntensity: 3.4,
    rimLightIntensity: 0.65
  },
  minimal: {
    toneMappingExposure: 1.05,
    cameraDistance: 13.2,
    ambientLightIntensity: 0.38,
    goldLightIntensity: 2.6,
    warmLightIntensity: 1.6,
    rimLightIntensity: 0.55
  },
  family: {
    toneMappingExposure: 1.22,
    cameraDistance: 12.4,
    ambientLightIntensity: 0.72,
    goldLightIntensity: 3.1,
    warmLightIntensity: 3.05,
    rimLightIntensity: 0.72
  }
};


function getHotelSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("hotel");
}

function normalizeOrderContextParam(value, maxLength = 80) {
  const text = typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
    : "";
  return text.slice(0, maxLength);
}

function getOrderContextFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const tableNumber = normalizeOrderContextParam(
    params.get("table") || params.get("tableNumber"),
    80
  );

  if (!tableNumber) {
    return {
      orderType: "standard",
      tableNumber: "",
      orderSource: "website",
      qrContextToken: "",
      addToOrderId: "",
      addToken: ""
    };
  }

  const addToOrderId = normalizeOrderContextParam(
    params.get("addToOrder") || params.get("parentOrder") || params.get("orderId"),
    120
  );
  const addToken = normalizeOrderContextParam(
    params.get("addToken") || params.get("trackingToken"),
    200
  );
  const qrContextToken = normalizeOrderContextParam(
    params.get("qctx") || params.get("qrContextToken"),
    2000
  );

  return {
    orderType: "dine-in",
    tableNumber,
    orderSource: normalizeOrderContextParam(params.get("source"), 40) || "qr",
    qrContextToken,
    addToOrderId,
    addToken
  };
}

function isLocalhost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  );
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeThemeString(value, maxLength = 80) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate && candidate.length <= maxLength ? candidate : "";
}

function normalizeThemePreset(value, allowedValues) {
  const candidate = normalizeThemeString(value, 50).toLowerCase();
  return allowedValues.includes(candidate) ? candidate : "";
}

function normalizeThemeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function normalizeThemePercentage(value, fallback = null) {
  const candidate = Number(value);

  if (!Number.isFinite(candidate)) {
    return fallback;
  }

  return Math.min(Math.max(candidate, 0), 100);
}

function normalizeThemeSectionOrder(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();

  return value.reduce((orderedSections, item) => {
    const candidate = normalizeThemeString(item, 40).toLowerCase();

    if (!SUPPORTED_THEME_SECTION_ORDER.includes(candidate) || seen.has(candidate)) {
      return orderedSections;
    }

    seen.add(candidate);
    orderedSections.push(candidate);
    return orderedSections;
  }, []);
}

function normalizeThemeGroup(rawGroup, allowedKeys) {
  if (!isPlainObject(rawGroup)) return {};

  return allowedKeys.reduce((nextGroup, key) => {
    const value = normalizeThemeString(rawGroup[key]);
    if (value) {
      nextGroup[key] = value;
    }
    return nextGroup;
  }, {});
}

function normalizeThemeTextGroup(rawGroup, allowedKeys, maxLength = 120) {
  if (!isPlainObject(rawGroup)) return {};

  return allowedKeys.reduce((nextGroup, key) => {
    const value = normalizeThemeString(rawGroup[key], maxLength);
    if (value) {
      nextGroup[key] = value;
    }
    return nextGroup;
  }, {});
}

function normalizeLoadingScreenConfig(rawLoadingScreen) {
  const loadingScreen = normalizeHotelProfileJsonObject(rawLoadingScreen);

  return {
    logoPrimaryText:
      normalizeHotelProfileStringField(loadingScreen.logoPrimaryText, 40) ||
      DEFAULT_LOADING_SCREEN_CONFIG.logoPrimaryText,
    logoSecondaryText:
      normalizeHotelProfileStringField(loadingScreen.logoSecondaryText, 80) ||
      DEFAULT_LOADING_SCREEN_CONFIG.logoSecondaryText,
    tagline:
      normalizeHotelProfileStringField(loadingScreen.tagline, 160) ||
      DEFAULT_LOADING_SCREEN_CONFIG.tagline,
    backgroundColor: normalizeHotelProfileStringField(
      loadingScreen.backgroundColor,
      80
    ),
    accentColor: normalizeHotelProfileStringField(loadingScreen.accentColor, 80),
    textColor: normalizeHotelProfileStringField(loadingScreen.textColor, 80),
    backgroundImageUrl: normalizeHotelProfileStringField(
      loadingScreen.backgroundImageUrl,
      2000
    )
  };
}

function normalizeTheme(rawTheme) {
  if (!isPlainObject(rawTheme)) {
    return {};
  }

  const normalizedTheme = {};
  const colors = normalizeThemeGroup(rawTheme.colors, [
    "primary",
    "primaryLight",
    "primaryDark",
    "background",
    "backgroundAlt",
    "text",
    "textMuted"
  ]);
  const radius = normalizeThemeGroup(rawTheme.radius, ["base", "small"]);
  const typographyPreset = normalizeThemePreset(rawTheme.typography?.preset, [
    "default",
    "system"
  ]);
  const heroLayoutVariant = normalizeThemePreset(
    rawTheme.hero?.layoutVariant,
    SUPPORTED_THEME_HERO_LAYOUT_VARIANTS
  );
  const containerPreset = normalizeThemePreset(rawTheme.layout?.containerPreset, [
    "compact",
    "default",
    "wide"
  ]);
  const buttonPreset = normalizeThemePreset(rawTheme.buttons?.preset, [
    "default",
    "solid",
    "crisp"
  ]);
  const upiDiscountPercent = normalizeThemePercentage(
    rawTheme.payment?.upiDiscountPercent,
    null
  );
  const deliveryCharge = normalizeFiniteNumber(
    rawTheme.payment?.deliveryCharge,
    null,
    { min: 0, max: 100000 }
  );
  const contentSource = isPlainObject(rawTheme.content) ? rawTheme.content : {};
  const navLabels = normalizeThemeTextGroup(
    contentSource.navLabels,
    ["about", "menu", "gallery", "events", "testimonials", "contact", "reservation"],
    80
  );
  const menuCategories = normalizeThemeTextGroup(
    contentSource.menuCategories,
    ["starters", "mains", "desserts", "drinks"],
    80
  );
  const menuSection = normalizeThemeTextGroup(
    contentSource.menuSection,
    ["eyebrow", "title", "subtitle", "fullEyebrow", "fullTitle", "fullSubtitle", "viewFullMenu"],
    320
  );
  const ctaLabels = normalizeThemeTextGroup(
    contentSource.ctaLabels,
    [
      "heroPrimary",
      "heroReservation",
      "aboutReservation",
      "cartButton",
      "menuScrollHint",
      "loadMore",
      "loadMoreHint"
    ],
    160
  );
  const footerLabels = normalizeThemeTextGroup(
    contentSource.footerLabels,
    [
      "exploreHeading",
      "about",
      "menu",
      "gallery",
      "events",
      "reviews",
      "reservationsHeading",
      "bookTable",
      "privateDining",
      "contact",
      "openingHoursHeading",
      "findUsHeading",
      "copyrightSuffix"
    ],
    160
  );
  const aboutVisibility = normalizeThemeBoolean(rawTheme.sections?.about);
  const eventsVisibility = normalizeThemeBoolean(rawTheme.sections?.events);
  const galleryVisibility = normalizeThemeBoolean(rawTheme.sections?.gallery);
  const sectionOrder = normalizeThemeSectionOrder(rawTheme.sections?.order);
  const reservationVisibility = normalizeThemeBoolean(rawTheme.sections?.reservation);
  const testimonialsVisibility = normalizeThemeBoolean(rawTheme.sections?.testimonials);
  const loadingScreen = normalizeLoadingScreenConfig(rawTheme.loadingScreen);

  if (Object.keys(colors).length) {
    normalizedTheme.colors = colors;
  }

  if (Object.keys(radius).length) {
    normalizedTheme.radius = radius;
  }

  if (typographyPreset) {
    normalizedTheme.typography = { preset: typographyPreset };
  }

  if (heroLayoutVariant) {
    normalizedTheme.hero = { layoutVariant: heroLayoutVariant };
  }

  if (containerPreset) {
    normalizedTheme.layout = { containerPreset };
  }

  if (buttonPreset) {
    normalizedTheme.buttons = { preset: buttonPreset };
  }

  if (upiDiscountPercent !== null || deliveryCharge !== null) {
    normalizedTheme.payment = {};

    if (upiDiscountPercent !== null) {
      normalizedTheme.payment.upiDiscountPercent = upiDiscountPercent;
    }

    if (deliveryCharge !== null) {
      normalizedTheme.payment.deliveryCharge = deliveryCharge;
    }
  }

  if (
    Object.keys(navLabels).length ||
    Object.keys(menuCategories).length ||
    Object.keys(menuSection).length ||
    Object.keys(ctaLabels).length ||
    Object.keys(footerLabels).length
  ) {
    normalizedTheme.content = {};

    if (Object.keys(navLabels).length) {
      normalizedTheme.content.navLabels = navLabels;
    }

    if (Object.keys(menuCategories).length) {
      normalizedTheme.content.menuCategories = menuCategories;
    }

    if (Object.keys(menuSection).length) {
      normalizedTheme.content.menuSection = menuSection;
    }

    if (Object.keys(ctaLabels).length) {
      normalizedTheme.content.ctaLabels = ctaLabels;
    }

    if (Object.keys(footerLabels).length) {
      normalizedTheme.content.footerLabels = footerLabels;
    }
  }

  normalizedTheme.loadingScreen = loadingScreen;

  if (
    aboutVisibility !== null ||
    eventsVisibility !== null ||
    galleryVisibility !== null ||
    sectionOrder.length ||
    reservationVisibility !== null ||
    testimonialsVisibility !== null
  ) {
    normalizedTheme.sections = {};

    if (aboutVisibility !== null) {
      normalizedTheme.sections.about = aboutVisibility;
    }

    if (eventsVisibility !== null) {
      normalizedTheme.sections.events = eventsVisibility;
    }

    if (galleryVisibility !== null) {
      normalizedTheme.sections.gallery = galleryVisibility;
    }

    if (sectionOrder.length) {
      normalizedTheme.sections.order = sectionOrder;
    }

    if (reservationVisibility !== null) {
      normalizedTheme.sections.reservation = reservationVisibility;
    }

    if (testimonialsVisibility !== null) {
      normalizedTheme.sections.testimonials = testimonialsVisibility;
    }
  }

  return normalizedTheme;
}

function normalizeGalleryLayoutVariant(value) {
  const candidate = normalizeThemeString(value, 20).toLowerCase();
  return SUPPORTED_GALLERY_LAYOUT_VARIANTS.includes(candidate)
    ? candidate
    : "standard";
}

function normalizeGalleryItem(rawItem) {
  if (!isPlainObject(rawItem)) {
    return null;
  }

  const imageUrl = normalizeThemeString(rawItem.imageUrl, 2000);

  if (!imageUrl) {
    return null;
  }

  return {
    id: rawItem.id ?? "",
    imageUrl,
    storagePath: normalizeThemeString(rawItem.storagePath, 500),
    alt: normalizeThemeString(rawItem.alt, 300),
    layoutVariant: normalizeGalleryLayoutVariant(rawItem.layoutVariant),
    sortOrder: Number.isFinite(Number(rawItem.sortOrder))
      ? Number(rawItem.sortOrder)
      : 0
  };
}

function normalizeGallery(rawGallery) {
  if (!Array.isArray(rawGallery)) {
    return [];
  }

  return rawGallery
    .map((item) => normalizeGalleryItem(item))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeTestimonialItem(rawItem) {
  if (!isPlainObject(rawItem)) {
    return null;
  }

  const text = normalizeThemeString(rawItem.text, 4000);
  const name = normalizeThemeString(rawItem.name, 300);

  if (!text || !name) {
    return null;
  }

  return {
    id: rawItem.id ?? "",
    hotelSlug: normalizeThemeString(rawItem.hotelSlug, 200),
    text,
    name,
    role: normalizeThemeString(rawItem.role, 300),
    stars: Math.max(1, Math.min(5, Math.round(Number(rawItem.stars || 5)))),
    avatar: normalizeThemeString(rawItem.avatar, 2000)
  };
}

function normalizeTestimonials(rawTestimonials) {
  if (!Array.isArray(rawTestimonials)) {
    return [];
  }

  return rawTestimonials.map((item) => normalizeTestimonialItem(item)).filter(Boolean);
}

function normalizePublicMenuCategoryKey(value) {
  const candidate = normalizeThemeString(value, 80).toLowerCase();

  if (!candidate) {
    return "";
  }

  const compactCandidate = candidate.replace(/[^a-z]/g, "");

  return MENU_CATEGORY_ALIASES[compactCandidate] || candidate;
}

function normalizePublicMenu(rawMenu) {
  if (!isPlainObject(rawMenu)) {
    return {};
  }

  return Object.entries(rawMenu).reduce((normalizedMenu, [rawCategory, rawItems]) => {
    if (!Array.isArray(rawItems) || !rawItems.length) {
      return normalizedMenu;
    }

    const categoryKey = normalizePublicMenuCategoryKey(rawCategory);
    if (!categoryKey) {
      return normalizedMenu;
    }

    if (!normalizedMenu[categoryKey]) {
      normalizedMenu[categoryKey] = [];
    }

    normalizedMenu[categoryKey].push(...rawItems);
    return normalizedMenu;
  }, {});
}

function normalizeHotelProfileJsonObject(value) {
  return isPlainObject(value) ? { ...value } : {};
}

function normalizeHotelProfileStringField(value, maxLength = 2000) {
  return normalizeThemeString(value, maxLength);
}

function normalizeHotelProfileArrayField(value, nestedKey = "") {
  if (Array.isArray(value)) {
    return value;
  }

  if (isPlainObject(value) && nestedKey && Array.isArray(value[nestedKey])) {
    return value[nestedKey];
  }

  return [];
}

function normalizeHotelProfileStringArrayField(
  value,
  nestedKey = "",
  maxLength = 2000
) {
  return normalizeHotelProfileArrayField(value, nestedKey)
    .map((item) => normalizeHotelProfileStringField(item, maxLength))
    .filter(Boolean);
}

function normalizeHotelProfileObjectArrayField(value, nestedKey = "") {
  return normalizeHotelProfileArrayField(value, nestedKey)
    .filter((item) => isPlainObject(item))
    .map((item) => ({ ...item }));
}

function normalizeFiniteNumber(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  const candidate = Number(value);

  if (!Number.isFinite(candidate)) {
    return fallback;
  }

  return Math.min(Math.max(candidate, min), max);
}

function normalizeIntegerNumber(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  return Math.round(
    normalizeFiniteNumber(value, fallback, {
      min,
      max
    })
  );
}

function normalizeHeroScenePreset(value) {
  const candidate = normalizeThemeString(value, 50).toLowerCase();
  return SUPPORTED_HERO_SCENE_PRESETS.includes(candidate)
    ? candidate
    : DEFAULT_HERO_SCENE_CONFIG.preset;
}

function normalizeHeroSceneTemplate(value) {
  const candidate = normalizeThemeString(value, 50).toLowerCase();
  return SUPPORTED_HERO_SCENE_TEMPLATES.includes(candidate)
    ? candidate
    : DEFAULT_HERO_SCENE_CONFIG.template;
}

function normalizeHeroSceneModelPreset(value) {
  const candidate = normalizeThemeString(value, 50).toLowerCase();
  return SUPPORTED_HERO_SCENE_MODEL_PRESETS.includes(candidate)
    ? candidate
    : DEFAULT_HERO_SCENE_CONFIG.modelPreset;
}

function getHeroScenePresetDefaults(preset) {
  return {
    ...DEFAULT_HERO_SCENE_CONFIG,
    ...(HERO_SCENE_PRESET_DEFAULTS[preset] || {})
  };
}

function normalizeHeroSceneConfig(rawScene) {
  const scene = normalizeHotelProfileJsonObject(rawScene);
  const template = normalizeHeroSceneTemplate(scene.template);
  const modelPreset = normalizeHeroSceneModelPreset(scene.modelPreset);
  const preset = normalizeHeroScenePreset(scene.preset);
  const presetDefaults = getHeroScenePresetDefaults(preset);

  return {
    enabled:
      typeof scene.enabled === "boolean" ? scene.enabled : DEFAULT_HERO_SCENE_CONFIG.enabled,
    template,
    modelPreset,
    preset,
    toneMappingExposure: normalizeFiniteNumber(
      scene.toneMappingExposure,
      presetDefaults.toneMappingExposure,
      { min: 0.2, max: 3 }
    ),
    cameraDistance: normalizeFiniteNumber(
      scene.cameraDistance,
      presetDefaults.cameraDistance,
      { min: 6, max: 24 }
    ),
    ambientLightIntensity: normalizeFiniteNumber(
      scene.ambientLightIntensity,
      presetDefaults.ambientLightIntensity,
      { min: 0, max: 4 }
    ),
    goldLightIntensity: normalizeFiniteNumber(
      scene.goldLightIntensity,
      presetDefaults.goldLightIntensity,
      { min: 0, max: 8 }
    ),
    warmLightIntensity: normalizeFiniteNumber(
      scene.warmLightIntensity,
      presetDefaults.warmLightIntensity,
      { min: 0, max: 8 }
    ),
    rimLightIntensity: normalizeFiniteNumber(
      scene.rimLightIntensity,
      presetDefaults.rimLightIntensity,
      { min: 0, max: 4 }
    ),
    particleCount: normalizeIntegerNumber(
      scene.particleCount,
      presetDefaults.particleCount,
      { min: 0, max: 600 }
    )
  };
}

function normalizeAboutContent(rawAbout) {
  const about = normalizeHotelProfileJsonObject(rawAbout);

  return {
    ...about,
    paragraphs: normalizeHotelProfileStringArrayField(about.paragraphs, "paragraphs", 2000),
    primaryImageUrl: normalizeHotelProfileStringField(about.primaryImageUrl, 2000),
    primaryImageAlt: normalizeHotelProfileStringField(about.primaryImageAlt, 300),
    primaryImageStoragePath: normalizeHotelProfileStringField(
      about.primaryImageStoragePath,
      500
    ),
    secondaryImageUrl: normalizeHotelProfileStringField(about.secondaryImageUrl, 2000),
    secondaryImageAlt: normalizeHotelProfileStringField(about.secondaryImageAlt, 300),
    secondaryImageStoragePath: normalizeHotelProfileStringField(
      about.secondaryImageStoragePath,
      500
    )
  };
}

function normalizeHeroContent(rawHero) {
  const hero = normalizeHotelProfileJsonObject(rawHero);
  const legacyStatsGroup = normalizeHotelProfileJsonObject(hero.stats);

  return {
    ...hero,
    titleLine1:
      normalizeHotelProfileStringField(hero.titleLine1, 200) ||
      normalizeHotelProfileStringField(legacyStatsGroup.titleLine1, 200),
    titleLine2:
      normalizeHotelProfileStringField(hero.titleLine2, 200) ||
      normalizeHotelProfileStringField(legacyStatsGroup.titleLine2, 200),
    titleLine3:
      normalizeHotelProfileStringField(hero.titleLine3, 200) ||
      normalizeHotelProfileStringField(legacyStatsGroup.titleLine3, 200),
    backgroundImageUrl: normalizeHotelProfileStringField(
      hero.backgroundImageUrl,
      2000
    ),
    backgroundImageAlt: normalizeHotelProfileStringField(
      hero.backgroundImageAlt,
      300
    ),
    stats: normalizeHotelProfileObjectArrayField(hero.stats, "stats"),
    scene: normalizeHeroSceneConfig(hero.scene)
  };
}

function normalizeEventsContent(rawEvents) {
  const events = normalizeHotelProfileJsonObject(rawEvents);
  const legacyCardsGroup = normalizeHotelProfileJsonObject(events.cards);

  return {
    ...events,
    eyebrow:
      normalizeHotelProfileStringField(events.eyebrow, 200) ||
      normalizeHotelProfileStringField(legacyCardsGroup.eyebrow, 200),
    title:
      normalizeHotelProfileStringField(events.title, 200) ||
      normalizeHotelProfileStringField(legacyCardsGroup.title, 200),
    subtitle:
      normalizeHotelProfileStringField(events.subtitle, 600) ||
      normalizeHotelProfileStringField(legacyCardsGroup.subtitle, 600),
    cards: normalizeHotelProfileObjectArrayField(events.cards, "cards")
  };
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error(`Failed to fetch ${url}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.json();
}

function waitForNextFetchAttempt(delayMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
  });
}

async function fetchJsonWithRetry(
  url,
  { retries = 0, retryDelayMs = 250, timeoutMs = 0 } = {}
) {
  let attempt = 0;

  while (true) {
    let controller = null;
    let timeoutId = null;

    try {
      if (timeoutMs > 0 && typeof AbortController !== "undefined") {
        controller = new AbortController();
        timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      }

      const response = await fetch(url, controller ? { signal: controller.signal } : undefined);

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const error = new Error(`Failed to fetch ${url}`);
        error.status = response.status;
        error.url = url;
        throw error;
      }

      return response.json();
    } catch (error) {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      const status = Number(error?.status || 0);
      const isAbortError = error?.name === "AbortError";
      const isRetryable = isAbortError || !status || status >= 500;

      if (attempt >= retries || !isRetryable) {
        throw error;
      }

      attempt += 1;
      await waitForNextFetchAttempt(retryDelayMs);
    }
  }
}

const STARTUP_FETCH_OPTIONS = Object.freeze({
  retries: 1,
  retryDelayMs: 250,
  timeoutMs: 6000
});

async function resolveHotelSlug() {
  const querySlug = normalizeHotelSlug(getHotelSlugFromQuery());
  if (querySlug) {
    rememberHotelSlug(querySlug);
    return querySlug;
  }

  const host = window.location.hostname;
  const fallbackSlug = getRuntimeDefaultHotelSlug();

  if (isLocalhost(host)) {
    if (fallbackSlug) return fallbackSlug;
    throw new Error("Hotel slug is required. Use ?hotel=your-hotel-slug or set APP_RUNTIME_CONFIG.DEFAULT_HOTEL_SLUG.");
  }

  try {
    const result = await fetchJsonWithRetry(
      `${TENANT_API_BASE}/resolve?host=${encodeURIComponent(host)}`,
      STARTUP_FETCH_OPTIONS
    );
    const resolvedSlug = normalizeHotelSlug(result.hotel?.slug);

    if (resolvedSlug) {
      rememberHotelSlug(resolvedSlug);
      return resolvedSlug;
    }

    if (fallbackSlug) return fallbackSlug;
    throw new Error(`No hotel tenant resolved for host ${host}.`);
  } catch (error) {
    if (fallbackSlug) {
      console.warn("Falling back to configured hotel slug:", error);
      return fallbackSlug;
    }

    throw error;
  }
}

function mapHotelProfileToFrontendShape(rawHotel) {
  const about = normalizeAboutContent(rawHotel.about);
  const hero = normalizeHeroContent(rawHotel.hero);
  const events = normalizeEventsContent(rawHotel.events);

  return {
    slug: rawHotel.hotel_slug,
    hotelName: rawHotel.hotel_name,
    tagline: rawHotel.tagline,
    ownerWhatsAppNumber: rawHotel.owner_whatsapp_number,
    ownerUpiId: rawHotel.owner_upi_id,
    gstPercent: Number(rawHotel.gst_percent || 5),
    contact: rawHotel.contact || {},
    branding: rawHotel.branding || {},
    theme: normalizeTheme(rawHotel.theme),
    hero,
    about,
    features: rawHotel.features || [],
    events,
    reservation: rawHotel.reservation || {},
    contactSection: rawHotel.contact_section || {},
    location: rawHotel.location || {},
    footer: rawHotel.footer || {},
    social: rawHotel.social || {}
  };
}

async function loadAppData({
  includeGallery = true,
  includeTestimonials = true
} = {}) {
  const hotelSlug = await resolveHotelSlug();

  const galleryPromise = includeGallery
    ? fetchJson(`${PUBLIC_API_BASE}/gallery/${hotelSlug}`)
        .then((galleryResult) => normalizeGallery(galleryResult.gallery))
        .catch((error) => {
          console.warn("Failed to load gallery data. Falling back to empty gallery.", error);
          return [];
        })
    : Promise.resolve([]);

  const testimonialsPromise = includeTestimonials
    ? fetchJson(`${PUBLIC_API_BASE}/testimonials/${hotelSlug}`)
        .then((testimonialsResult) => normalizeTestimonials(testimonialsResult.testimonials))
        .catch((error) => {
          console.warn(
            "Failed to load testimonials data. Falling back to empty testimonials.",
            error
          );
          return [];
        })
    : Promise.resolve([]);

  const [hotelResult, menuResult] = await Promise.all([
    fetchJsonWithRetry(`${PUBLIC_API_BASE}/hotel/${hotelSlug}`, STARTUP_FETCH_OPTIONS),
    fetchJsonWithRetry(`${PUBLIC_API_BASE}/menu/${hotelSlug}`, STARTUP_FETCH_OPTIONS)
  ]);
  const [gallery, testimonials] = await Promise.all([galleryPromise, testimonialsPromise]);

  const hotel = mapHotelProfileToFrontendShape(hotelResult.hotel);
  const normalizedMenu = normalizePublicMenu(menuResult.menu);

  window.APP_STATE.hotel = hotel;
  window.APP_STATE.gallery = gallery;
  window.APP_STATE.testimonials = testimonials;
  window.APP_STATE.heroScene = hotel.hero?.scene || { ...DEFAULT_HERO_SCENE_CONFIG };
  window.APP_STATE.menu = normalizedMenu;
  window.APP_STATE.theme = hotel.theme || {};
  window.APP_STATE.loadingScreen = hotel.theme?.loadingScreen || {
    ...DEFAULT_LOADING_SCREEN_CONFIG
  };
  window.APP_STATE.activeHotelSlug = hotelSlug;
  rememberHotelSlug(hotelSlug);
  window.APP_STATE.orderContext = getOrderContextFromQuery();

  return window.APP_STATE;
}
