/* ═══════════════════════════════════════════════════════ 
   HOTEL PLATFORM — MAIN JAVASCRIPT
   Existing UI + Food Cart + Event Booking + WhatsApp Flow
   ═══════════════════════════════════════════════════════ */

"use strict";

/* ── Helpers ─────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
let USER_LOCATION = "Not shared";

function getRuntimeBooleanConfig(key, fallback = false) {
  const value = window.APP_RUNTIME_CONFIG?.[key];

  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return fallback;
}

function getRuntimeTextConfig(key, fallback = "") {
  const value = window.APP_RUNTIME_CONFIG?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getDefaultBackendBaseUrl() {
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

  return baseUrl.replace(/\/+$/, "");
}

let CONFIG = {
  HOTEL_NAME: "",
  OWNER_WHATSAPP_NUMBER: "",
  OWNER_UPI_ID: "",
  GST_PERCENT: 5,
  DEFAULT_UPI_DISCOUNT_PERCENT: 10,
  PAYMENT_GATEWAY_ENABLED: getRuntimeBooleanConfig("PAYMENT_GATEWAY_ENABLED", false),
  PAYMENT_GATEWAY_PROVIDER: getRuntimeTextConfig("PAYMENT_GATEWAY_PROVIDER", "razorpay"),
  PAYMENT_GATEWAY_CHECKOUT_ENABLED: getRuntimeBooleanConfig(
    "PAYMENT_GATEWAY_CHECKOUT_ENABLED",
    false
  ),
  PAYMENT_GATEWAY_SCRIPT_URL: getRuntimeTextConfig(
    "PAYMENT_GATEWAY_SCRIPT_URL",
    "https://checkout.razorpay.com/v1/checkout.js"
  ),
  // API_BASE_URL: "http://127.0.0.1:5000"
  API_BASE_URL:
  window.APP_RUNTIME_CONFIG?.BACKEND_BASE_URL || getDefaultBackendBaseUrl()
};
let PAYMENT_GATEWAY_READINESS = null;
let paymentGatewayReadinessPromise = null;

const DEFAULT_THEME_BRIDGE = {
  "--gold": "#c9a84c",
  "--gold-light": "#e8d08a",
  "--gold-dark": "#a07830",
  "--cream": "#fbf8f3",
  "--cream-dark": "#f3ede3",
  "--text": "#333333",
  "--text-muted": "#6b6b6b",
  "--font-display": "\"Cormorant Garamond\", Georgia, serif",
  "--font-body": "\"Jost\", sans-serif",
  "--radius": "16px",
  "--radius-sm": "8px",
  "--container-max": "1280px",
  "--btn-radius": "100px",
  "--btn-primary-bg": "linear-gradient(135deg, var(--gold-dark), var(--gold))",
  "--btn-primary-border": "1px solid transparent",
  "--btn-primary-shadow": "0 4px 20px rgba(201, 168, 76, 0.35)",
  "--btn-primary-shadow-hover": "0 8px 30px rgba(201, 168, 76, 0.45)",
  "--btn-outline-border": "1.5px solid rgba(255, 255, 255, 0.6)",
  "--btn-outline-hover-border": "var(--white)",
  "--btn-outline-hover-bg": "rgba(255, 255, 255, 0.08)"
};

const THEME_FONT_PRESETS = {
  default: {
    display: "\"Cormorant Garamond\", Georgia, serif",
    body: "\"Jost\", sans-serif"
  },
  system: {
    display: "Georgia, serif",
    body: "system-ui, sans-serif"
  }
};

const THEME_CONTAINER_PRESETS = {
  compact: "1120px",
  default: "1280px",
  wide: "1440px"
};

const THEME_BUTTON_PRESETS = {
  default: {
    "--btn-radius": "100px",
    "--btn-primary-bg": "linear-gradient(135deg, var(--gold-dark), var(--gold))",
    "--btn-primary-border": "1px solid transparent",
    "--btn-primary-shadow": "0 4px 20px rgba(201, 168, 76, 0.35)",
    "--btn-primary-shadow-hover": "0 8px 30px rgba(201, 168, 76, 0.45)",
    "--btn-outline-border": "1.5px solid rgba(255, 255, 255, 0.6)",
    "--btn-outline-hover-border": "var(--white)",
    "--btn-outline-hover-bg": "rgba(255, 255, 255, 0.08)"
  },
  solid: {
    "--btn-radius": "14px",
    "--btn-primary-bg": "var(--gold)",
    "--btn-primary-border": "1px solid var(--gold-dark)",
    "--btn-primary-shadow": "0 4px 16px rgba(201, 168, 76, 0.28)",
    "--btn-primary-shadow-hover": "0 8px 24px rgba(201, 168, 76, 0.36)",
    "--btn-outline-border": "1px solid var(--gold)",
    "--btn-outline-hover-border": "var(--gold)",
    "--btn-outline-hover-bg": "rgba(201, 168, 76, 0.12)"
  },
  crisp: {
    "--btn-radius": "8px",
    "--btn-primary-bg": "linear-gradient(135deg, var(--gold), var(--gold-light))",
    "--btn-primary-border": "1px solid var(--gold-dark)",
    "--btn-primary-shadow": "0 4px 18px rgba(160, 120, 48, 0.28)",
    "--btn-primary-shadow-hover": "0 8px 26px rgba(160, 120, 48, 0.4)",
    "--btn-outline-border": "1.5px solid rgba(255, 255, 255, 0.75)",
    "--btn-outline-hover-border": "var(--gold-light)",
    "--btn-outline-hover-bg": "rgba(255, 255, 255, 0.14)"
  }
};

const THEME_HERO_LAYOUT_CLASSNAMES = [
  "hero-layout-split",
  "hero-layout-stacked"
];

function getMenuData() {
  return window.APP_STATE?.menu || {};
}

function getMenuCategories() {
  return Object.keys(getMenuData());
}

function getMenuItemsByCategory(category) {
  const menuData = getMenuData();
  return Array.isArray(menuData[category]) ? menuData[category] : [];
}

function getCurrentMenuCategory() {
  const gridCategory = $("#menuGrid")?.dataset.activeCategory;
  if (gridCategory) return gridCategory;

  const activeTabCategory = $(".menu-tab.active")?.dataset.cat;
  if (activeTabCategory) return activeTabCategory;

  const categories = getMenuCategories();
  if (categories.includes("starters")) return "starters";

  return categories[0] || "starters";
}

function applyHotelConfigFromState() {
  const hotel = window.APP_STATE?.hotel;
  if (!hotel) return;

  CONFIG = {
    HOTEL_NAME: hotel.hotelName || "",
    OWNER_WHATSAPP_NUMBER: hotel.ownerWhatsAppNumber || "",
    OWNER_UPI_ID: hotel.ownerUpiId || "",
    GST_PERCENT: Number(hotel.gstPercent || 5),
    DEFAULT_UPI_DISCOUNT_PERCENT: 10,
    PAYMENT_GATEWAY_ENABLED: getRuntimeBooleanConfig("PAYMENT_GATEWAY_ENABLED", false),
    PAYMENT_GATEWAY_PROVIDER: getRuntimeTextConfig("PAYMENT_GATEWAY_PROVIDER", "razorpay"),
    PAYMENT_GATEWAY_CHECKOUT_ENABLED: getRuntimeBooleanConfig(
      "PAYMENT_GATEWAY_CHECKOUT_ENABLED",
      false
    ),
    PAYMENT_GATEWAY_SCRIPT_URL: getRuntimeTextConfig(
      "PAYMENT_GATEWAY_SCRIPT_URL",
      "https://checkout.razorpay.com/v1/checkout.js"
    ),
    // API_BASE_URL: "http://127.0.0.1:5000"
    API_BASE_URL:
  window.APP_RUNTIME_CONFIG?.BACKEND_BASE_URL || getDefaultBackendBaseUrl()
  };
  PAYMENT_GATEWAY_READINESS = null;
  paymentGatewayReadinessPromise = null;
}

function getActiveHotelName() {
  const configuredHotelName =
    typeof CONFIG?.HOTEL_NAME === "string" ? CONFIG.HOTEL_NAME.trim() : "";

  if (configuredHotelName) {
    return configuredHotelName;
  }

  const stateHotelName =
    typeof window.APP_STATE?.hotel?.hotelName === "string"
      ? window.APP_STATE.hotel.hotelName.trim()
      : "";

  return stateHotelName;
}

function normalizeOrderContextText(value = "", maxLength = 80) {
  const text = typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
    : "";
  return text.slice(0, maxLength);
}

function getActiveOrderContext(rawContext = window.APP_STATE?.orderContext || {}) {
  const context = rawContext || {};
  const tableNumber = normalizeOrderContextText(context.tableNumber, 80);
  const orderType =
    typeof context.orderType === "string" && context.orderType.trim()
      ? normalizeOrderContextText(context.orderType, 40)
      : tableNumber
        ? "dine-in"
        : "standard";
  const orderSource =
    typeof context.orderSource === "string" && context.orderSource.trim()
      ? normalizeOrderContextText(context.orderSource, 40)
      : tableNumber
        ? "qr"
        : "website";
  const addToOrderId = normalizeOrderContextText(
    context.addToOrderId || context.addToOrder || context.parentOrderId,
    120,
  );
  const addToken = normalizeOrderContextText(
    context.addToken || context.trackingToken,
    200,
  );
  const qrContextToken = normalizeOrderContextText(
    context.qrContextToken || context.qctx,
    2000,
  );

  return {
    orderType,
    tableNumber,
    orderSource,
    qrContextToken,
    addToOrderId,
    addToken
  };
}

function hasDineInOrderContext(context = getActiveOrderContext()) {
  return context.orderType === "dine-in" && !!context.tableNumber;
}

function hasActiveOrderAddonContext(context = getActiveOrderContext()) {
  return hasDineInOrderContext(context) && !!context.addToOrderId && !!context.addToken;
}

function getEffectiveCustomerAddress(value, context = getActiveOrderContext()) {
  const address = typeof value === "string" ? value.trim() : "";
  if (address || !hasDineInOrderContext(context)) return address;

  return `Dine-in table ${context.tableNumber}`;
}

function syncOrderContextUI() {
  const checkoutForm = document.getElementById("checkoutForm");
  if (!checkoutForm) return;

  const context = getActiveOrderContext();
  let notice = document.getElementById("orderContextNotice");
  const addressField = document.getElementById("orderAddressField");
  const addressInput = document.getElementById("orderAddress");
  const addressLabel = document.querySelector('label[for="orderAddress"]');

  checkoutForm.dataset.orderType = context.orderType;
  checkoutForm.dataset.orderSource = context.orderSource;
  checkoutForm.dataset.tableNumber = context.tableNumber;
  checkoutForm.dataset.addToOrderId = context.addToOrderId || "";

  if (addressInput && !addressInput.dataset.originalPlaceholder) {
    addressInput.dataset.originalPlaceholder =
      addressInput.getAttribute("placeholder") || "";
  }

  if (addressLabel && !addressLabel.dataset.originalText) {
    addressLabel.dataset.originalText = addressLabel.textContent || "";
  }

  if (!hasDineInOrderContext(context)) {
    if (notice) notice.remove();
    if (addressField) {
      addressField.hidden = false;
    }
    if (addressInput) {
      if (!addressInput.value && addressInput.dataset.websiteValue) {
        addressInput.value = addressInput.dataset.websiteValue;
      }
      addressInput.required = true;
      addressInput.placeholder =
        addressInput.dataset.originalPlaceholder || "Enter full address";
    }
    if (addressLabel) {
      addressLabel.textContent =
        addressLabel.dataset.originalText || "Delivery Address *";
    }
    return;
  }

  if (addressField) {
    addressField.hidden = true;
  }

  if (addressInput) {
    if (addressInput.value) {
      addressInput.dataset.websiteValue = addressInput.value;
    }
    addressInput.value = "";
    addressInput.required = false;
    addressInput.placeholder = `Optional note for table ${context.tableNumber}`;
  }

  if (addressLabel) {
    addressLabel.textContent = "Table Note / Address (optional)";
  }

  if (!notice) {
    notice = document.createElement("div");
    notice.id = "orderContextNotice";
    notice.className = "order-context-notice";
    notice.setAttribute("aria-live", "polite");
    checkoutForm.prepend(notice);
  }

  const isAddonContext = hasActiveOrderAddonContext(context);

  notice.innerHTML = `
    <span class="order-context-kicker">${isAddonContext ? "Adding to active table order" : "Dine-in QR order"}</span>
    <strong>Table ${escapeHTML(context.tableNumber)}</strong>
    <small>${isAddonContext ? `New items will be saved as an add-on for order #${escapeHTML(context.addToOrderId)}.` : "We detected this table link. Delivery address is hidden for dine-in ordering, and you can still add a special note below."}</small>
  `;
}

function clearCheckoutAddressState(form = document.getElementById("checkoutForm")) {
  const checkoutForm = form || document.getElementById("checkoutForm");
  if (!checkoutForm) return;

  const addressInput = checkoutForm.querySelector("#orderAddress");
  if (addressInput?.dataset) {
    delete addressInput.dataset.websiteValue;
  }

  syncOrderContextUI();
}

function syncTableCartResumeNotice() {
  const existingNotice = document.getElementById("tableCartResumeNotice");
  const context = getActiveOrderContext();
  const hasActiveTableCart =
    hasDineInOrderContext(context) && Array.isArray(CART) && CART.length > 0;

  if (!hasActiveTableCart) {
    if (existingNotice) existingNotice.remove();
    return;
  }

  const menuSection = document.getElementById("menu");
  const anchor =
    menuSection?.querySelector(".menu-cart-toolbar") ||
    menuSection?.querySelector("#menuGrid") ||
    menuSection?.querySelector(".menu-tabs");

  if (!menuSection || !anchor?.parentElement) return;

  const totalQty = CART.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const itemLabel = totalQty === 1 ? "item" : "items";
  let notice = existingNotice;

  if (!notice) {
    notice = document.createElement("div");
    notice.id = "tableCartResumeNotice";
    notice.className = "table-cart-resume-notice";
    notice.setAttribute("aria-live", "polite");
  }

  notice.innerHTML = `
    <span class="order-context-kicker">Active table cart</span>
    <strong>Table ${escapeHTML(context.tableNumber)} - ${totalQty} ${itemLabel} ready</strong>
    <small>This cart is saved only for this table on this browser. It clears after checkout or when it becomes stale.</small>
  `;

  anchor.parentElement.insertBefore(notice, anchor);
}

function getValidThemeColor(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return "";

  if (window.CSS && typeof window.CSS.supports === "function") {
    return window.CSS.supports("color", candidate) ? candidate : "";
  }

  return candidate;
}

function getValidThemeRadius(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return "";

  if (window.CSS && typeof window.CSS.supports === "function") {
    return window.CSS.supports("border-radius", candidate) ? candidate : "";
  }

  return candidate;
}

function getThemeFontPreset(value) {
  const presetKey = typeof value === "string" ? value.trim().toLowerCase() : "";
  return THEME_FONT_PRESETS[presetKey] || THEME_FONT_PRESETS.default;
}

function getThemeContainerMax(value) {
  const presetKey = typeof value === "string" ? value.trim().toLowerCase() : "";
  return THEME_CONTAINER_PRESETS[presetKey] || THEME_CONTAINER_PRESETS.default;
}

function getThemeButtonPreset(value) {
  const presetKey = typeof value === "string" ? value.trim().toLowerCase() : "";
  return THEME_BUTTON_PRESETS[presetKey] || THEME_BUTTON_PRESETS.default;
}

function getThemeHeroLayoutVariant(value) {
  const presetKey = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (presetKey === "split" || presetKey === "stacked") {
    return presetKey;
  }

  return "default";
}

function applyHeroLayoutVariantFromState() {
  const layoutVariant = getThemeHeroLayoutVariant(window.APP_STATE?.theme?.hero?.layoutVariant);
  const heroSection = document.getElementById("hero");

  document.body.dataset.heroLayoutVariant = layoutVariant;

  THEME_HERO_LAYOUT_CLASSNAMES.forEach((className) => {
    document.body.classList.toggle(className, className === `hero-layout-${layoutVariant}`);
  });

  if (!heroSection) return;

  heroSection.dataset.heroLayoutVariant = layoutVariant;

  THEME_HERO_LAYOUT_CLASSNAMES.forEach((className) => {
    heroSection.classList.toggle(className, className === `hero-layout-${layoutVariant}`);
  });
}

function applyThemeFromState() {
  const root = document.documentElement;
  const themeColors = window.APP_STATE?.theme?.colors || {};
  const themeRadius = window.APP_STATE?.theme?.radius || {};
  const themeTypography = window.APP_STATE?.theme?.typography || {};
  const themeLayout = window.APP_STATE?.theme?.layout || {};
  const themeButtons = window.APP_STATE?.theme?.buttons || {};
  const fontPreset = getThemeFontPreset(themeTypography.preset);
  const buttonPreset = getThemeButtonPreset(themeButtons.preset);

  if (!root) return;

  const bridge = {
    "--gold": getValidThemeColor(themeColors.primary) || DEFAULT_THEME_BRIDGE["--gold"],
    "--gold-light":
      getValidThemeColor(themeColors.primaryLight) ||
      DEFAULT_THEME_BRIDGE["--gold-light"],
    "--gold-dark":
      getValidThemeColor(themeColors.primaryDark) ||
      DEFAULT_THEME_BRIDGE["--gold-dark"],
    "--cream":
      getValidThemeColor(themeColors.background) || DEFAULT_THEME_BRIDGE["--cream"],
    "--cream-dark":
      getValidThemeColor(themeColors.backgroundAlt) ||
      DEFAULT_THEME_BRIDGE["--cream-dark"],
    "--text":
      getValidThemeColor(themeColors.text) || DEFAULT_THEME_BRIDGE["--text"],
    "--text-muted":
      getValidThemeColor(themeColors.textMuted) ||
      DEFAULT_THEME_BRIDGE["--text-muted"],
    "--font-display": fontPreset.display || DEFAULT_THEME_BRIDGE["--font-display"],
    "--font-body": fontPreset.body || DEFAULT_THEME_BRIDGE["--font-body"],
    "--radius":
      getValidThemeRadius(themeRadius.base) || DEFAULT_THEME_BRIDGE["--radius"],
    "--radius-sm":
      getValidThemeRadius(themeRadius.small) ||
      DEFAULT_THEME_BRIDGE["--radius-sm"],
    "--container-max":
      getThemeContainerMax(themeLayout.containerPreset) ||
      DEFAULT_THEME_BRIDGE["--container-max"]
  };

  Object.assign(bridge, buttonPreset);

  Object.entries(bridge).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

function getLoaderFallbackText(el) {
  if (!el) return "";

  if (!el.dataset.fallbackText) {
    el.dataset.fallbackText = el.textContent || "";
  }

  return el.dataset.fallbackText;
}

function applyLoadingScreenFromState() {
  const loader = $("#loader");
  if (!loader) return;

  const loadingScreen = window.APP_STATE?.loadingScreen || {};
  const logoPrimary = $(".loader-a", loader);
  const logoSecondary = $(".loader-urum", loader);
  const tagline = $(".loader-tagline", loader);
  const bar = $("#loaderBar");
  const nextBackgroundColor = getValidThemeColor(loadingScreen.backgroundColor);
  const nextAccentColor = getValidThemeColor(loadingScreen.accentColor);
  const nextTextColor = getValidThemeColor(loadingScreen.textColor);

  const nextPrimary =
    (typeof loadingScreen.logoPrimaryText === "string" &&
      loadingScreen.logoPrimaryText.trim()) ||
    getLoaderFallbackText(logoPrimary);
  const nextSecondary =
    (typeof loadingScreen.logoSecondaryText === "string" &&
      loadingScreen.logoSecondaryText.trim()) ||
    getLoaderFallbackText(logoSecondary);
  const nextTagline =
    (typeof loadingScreen.tagline === "string" && loadingScreen.tagline.trim()) ||
    getLoaderFallbackText(tagline);

  if (logoPrimary) {
    logoPrimary.textContent = nextPrimary;
  }

  if (logoSecondary) {
    logoSecondary.textContent = nextSecondary;
  }

  if (tagline) {
    tagline.textContent = nextTagline;
  }

  if (nextBackgroundColor) {
    loader.style.background = nextBackgroundColor;
  } else {
    loader.style.removeProperty("background");
  }

  if (logoPrimary) {
    if (nextAccentColor) {
      logoPrimary.style.color = nextAccentColor;
    } else {
      logoPrimary.style.removeProperty("color");
    }
  }

  if (bar) {
    if (nextAccentColor) {
      bar.style.background = nextAccentColor;
    } else {
      bar.style.removeProperty("background");
    }
  }

  if (logoSecondary) {
    if (nextTextColor) {
      logoSecondary.style.color = nextTextColor;
    } else {
      logoSecondary.style.removeProperty("color");
    }
  }

  if (tagline) {
    if (nextTextColor) {
      tagline.style.color = nextTextColor;
    } else {
      tagline.style.removeProperty("color");
    }
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || "";
}

function getSeoText(value, maxLength = 320) {
  const text = typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";

  return text.slice(0, maxLength);
}

function setMetaContent(selector, value) {
  const el = document.querySelector(selector);
  const content = getSeoText(value, 500);

  if (!el || !content) return;

  el.setAttribute("content", content);
}

function applySeoFromHotel(hotel = {}) {
  const hotelName = getSeoText(hotel.hotelName, 150) || "Hotel";
  const isMenuPage = document.body.classList.contains("menu-page");
  const pageTitle = isMenuPage ? `${hotelName} | Full Menu` : hotelName;
  const fallbackDescription = isMenuPage
    ? `Browse the full menu for ${hotelName} with cart and ordering options.`
    : `Discover ${hotelName} dining, menu, reservations, gallery, reviews, and contact details.`;
  const description =
    getSeoText(hotel.footer?.description, 320) ||
    getSeoText(hotel.tagline, 320) ||
    fallbackDescription;

  document.title = pageTitle;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', pageTitle);
  setMetaContent('meta[property="og:description"]', description);
}

function getThemeContentConfig() {
  const content = window.APP_STATE?.theme?.content;
  return content && typeof content === "object" ? content : {};
}

function getThemeContentText(groupName, key) {
  const group = getThemeContentConfig()[groupName];
  const value = group && typeof group === "object" ? group[key] : "";
  return typeof value === "string" ? value.trim() : "";
}

function setTextIfConfigured(selector, value) {
  const el = document.querySelector(selector);
  if (!el || !value) return;

  el.textContent = value;
}

function applyNavLabelsFromState() {
  document.querySelectorAll("[data-nav-label]").forEach((link) => {
    const label = getThemeContentText("navLabels", link.dataset.navLabel);
    if (label) {
      link.textContent = label;
    }
  });
}

function applyMenuSectionCopyFromState() {
  const menuSection = getThemeContentConfig().menuSection || {};
  const isMenuPage = document.body.classList.contains("menu-page");
  const eyebrow = isMenuPage
    ? menuSection.fullEyebrow || menuSection.eyebrow
    : menuSection.eyebrow;
  const title = isMenuPage
    ? menuSection.fullTitle || menuSection.title
    : menuSection.title;
  const subtitle = isMenuPage
    ? menuSection.fullSubtitle || menuSection.subtitle
    : menuSection.subtitle;

  setTextIfConfigured("#menuSectionEyebrow", eyebrow);
  setTextIfConfigured("#menuSectionTitle", title);
  setTextIfConfigured("#menuSectionSubtitle", subtitle);
  setTextIfConfigured("[data-menu-action-label='viewFullMenu']", menuSection.viewFullMenu);
}

function applyMenuCategoryLabelsFromState() {
  document.querySelectorAll("[data-menu-tab-label]").forEach((labelEl) => {
    const label = getThemeContentText("menuCategories", labelEl.dataset.menuTabLabel);
    if (label) {
      labelEl.textContent = label;
    }
  });
}

function applyCtaLabelsFromState() {
  document.querySelectorAll("[data-cta-label]").forEach((labelEl) => {
    const label = getThemeContentText("ctaLabels", labelEl.dataset.ctaLabel);
    if (label) {
      labelEl.textContent = label;
    }
  });
}

function applyFooterLabelsFromState() {
  document.querySelectorAll("[data-footer-label]").forEach((labelEl) => {
    const label = getThemeContentText("footerLabels", labelEl.dataset.footerLabel);
    if (label) {
      labelEl.textContent = label;
    }
  });
}

function applyContentLabelsFromState() {
  applyNavLabelsFromState();
  applyMenuSectionCopyFromState();
  applyMenuCategoryLabelsFromState();
  applyCtaLabelsFromState();
  applyFooterLabelsFromState();
}

function getConfiguredMenuCategoryLabel(category) {
  return getThemeContentText("menuCategories", category);
}

function getConfiguredCtaLabel(key) {
  return getThemeContentText("ctaLabels", key);
}

function formatConfiguredCountLabel(template, count, fallback) {
  if (!template) {
    return fallback;
  }

  return template.replace(/\{count\}/g, String(count));
}

function renderHeroStats(stats = []) {
  const wrap = document.getElementById("heroStats");
  if (!wrap) return;

  wrap.innerHTML = stats
    .map((stat, index) => {
      const divider =
        index < stats.length - 1
          ? `<div class="stat-divider" aria-hidden="true"></div>`
          : "";

      return `
        <div class="stat">
          <span class="stat-num">${escapeHTML(stat.value || "")}</span>
          <span class="stat-label">${escapeHTML(stat.label || "")}</span>
        </div>
        ${divider}
      `;
    })
    .join("");
}
function renderAboutParagraphs(paragraphs = []) {
  const wrap = document.getElementById("aboutParagraphs");
  if (!wrap) return;

  wrap.innerHTML = (paragraphs || [])
    .map(
      (text) => `
        <p class="about-desc reveal-text">
          ${escapeHTML(text || "")}
        </p>
      `
    )
    .join("");
}

function renderAboutFeatures(features = []) {
  const wrap = document.getElementById("aboutFeatures");
  if (!wrap) return;

  wrap.innerHTML = (features || [])
    .map(
      (feature) => `
        <div class="about-feature reveal-text">
          <i class="${feature.icon || "fas fa-star"}" aria-hidden="true"></i>
          <div>
            <strong>${escapeHTML(feature.title || "")}</strong>
            <span>${escapeHTML(feature.value || "")}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function applyAboutImageSource(image, { src = "", alt = "" } = {}) {
  if (!image) return;

  if (!image.dataset.fallbackSrc) {
    image.dataset.fallbackSrc = image.getAttribute("src") || "";
  }

  if (!image.dataset.fallbackAlt) {
    image.dataset.fallbackAlt = image.getAttribute("alt") || "";
  }

  const nextSrc = src ? normalizeImagePath(src) : image.dataset.fallbackSrc;
  const nextAlt = alt || image.dataset.fallbackAlt || "";

  if (nextSrc) {
    image.setAttribute("src", nextSrc);
  }

  image.setAttribute("alt", nextAlt);
}

function renderAboutImages(about = {}) {
  const mainImage = document.querySelector(".about-img-main img");
  const subImage = document.querySelector(".about-img-sub img");

  applyAboutImageSource(mainImage, {
    src: about.primaryImageUrl,
    alt: about.primaryImageAlt
  });

  applyAboutImageSource(subImage, {
    src: about.secondaryImageUrl,
    alt: about.secondaryImageAlt
  });
}

function renderHeroBackgroundImage(hero = {}) {
  const heroSection = document.getElementById("hero");
  const heroImage = document.getElementById("heroBackgroundImage");
  if (!heroSection || !heroImage) return;

  const imageUrl = normalizeImagePath(hero.backgroundImageUrl || "");
  const imageAlt = hero.backgroundImageAlt || "";
  const sceneEnabled = hero.scene?.enabled !== false;
  const shouldShow = !sceneEnabled && Boolean(imageUrl);

  heroSection.dataset.heroBackgroundImage = shouldShow ? "true" : "false";
  heroImage.hidden = !shouldShow;

  if (!shouldShow) {
    heroImage.removeAttribute("src");
    heroImage.setAttribute("alt", "");
    return;
  }

  heroImage.setAttribute("src", imageUrl);
  heroImage.setAttribute("alt", imageAlt || "Hero background image");
}

const ORDERABLE_HOMEPAGE_SECTION_IDS = [
  "about",
  "menu",
  "reservation",
  "events",
  "gallery",
  "testimonials",
  "contact"
];

function setSectionVisibility(sectionId, isVisible) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  section.hidden = !isVisible;
  section.setAttribute("aria-hidden", isVisible ? "false" : "true");
}

function linkPointsToSection(link, sectionId) {
  const rawHref = link.getAttribute("href") || "";
  if (!rawHref || !rawHref.includes("#")) return false;

  if (rawHref.startsWith("#")) {
    return rawHref.slice(1) === sectionId;
  }

  try {
    return new URL(rawHref, window.location.href).hash === `#${sectionId}`;
  } catch (error) {
    return false;
  }
}

function getSectionLinkVisibilityTarget(link) {
  const listItem = link.closest("li");
  if (listItem && listItem.querySelectorAll("a").length === 1) {
    return listItem;
  }

  return link;
}

function setSectionLinkVisibility(sectionId, isVisible) {
  document.querySelectorAll("a[href*='#']").forEach((link) => {
    if (!linkPointsToSection(link, sectionId)) return;

    const target = getSectionLinkVisibilityTarget(link);
    target.hidden = !isVisible;
    target.setAttribute("aria-hidden", isVisible ? "false" : "true");
  });
}

function setReservationCtaVisibility(isVisible) {
  document
    .querySelectorAll('#hero a[href="#reservation"], #about a[href="#reservation"]')
    .forEach((link) => {
      link.hidden = !isVisible;
      link.setAttribute("aria-hidden", isVisible ? "false" : "true");
      link.style.display = isVisible ? "" : "none";
    });
}

function applySectionVisibilityFromState() {
  const sectionTheme = window.APP_STATE?.theme?.sections || {};
  const reservationVisible = sectionTheme.reservation !== false;

  setSectionVisibility("about", sectionTheme.about !== false);
  setSectionVisibility("events", sectionTheme.events !== false);
  setSectionVisibility("gallery", sectionTheme.gallery !== false);
  setSectionVisibility("reservation", reservationVisible);
  setSectionVisibility("testimonials", sectionTheme.testimonials !== false);

  setSectionLinkVisibility("about", sectionTheme.about !== false);
  setSectionLinkVisibility("events", sectionTheme.events !== false);
  setSectionLinkVisibility("gallery", sectionTheme.gallery !== false);
  setSectionLinkVisibility("reservation", reservationVisible);
  setSectionLinkVisibility("testimonials", sectionTheme.testimonials !== false);
  setReservationCtaVisibility(reservationVisible);
}

function applySectionOrderFromState() {
  const heroSection = document.getElementById("hero");
  const parent = heroSection?.parentElement;
  const sectionTheme = window.APP_STATE?.theme?.sections || {};
  const configuredOrder = Array.isArray(sectionTheme.order) ? sectionTheme.order : [];

  if (!heroSection || !parent) return;

  const orderedSectionIds = [
    ...configuredOrder,
    ...ORDERABLE_HOMEPAGE_SECTION_IDS.filter((sectionId) => !configuredOrder.includes(sectionId))
  ];

  let insertionPoint = heroSection;

  orderedSectionIds.forEach((sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section || section.parentElement !== parent) return;

    insertionPoint.insertAdjacentElement("afterend", section);
    insertionPoint = section;
  });
}

function renderHotelContent() {
  const hotel = window.APP_STATE?.hotel;
  if (!hotel) return;

  applyHeroLayoutVariantFromState();

  applySeoFromHotel(hotel);
  applyContentLabelsFromState();

  setText("brandPrimary", hotel.branding?.logoTextPrimary);
  setText("brandSecondary", hotel.branding?.logoTextSecondary);

  setText("heroTitleLine1", hotel.hero?.titleLine1);
  setText("heroTitleLine2", hotel.hero?.titleLine2);
  setText("heroTitleLine3", hotel.hero?.titleLine3);
  setText("heroTagline", hotel.tagline);
  renderHeroBackgroundImage(hotel.hero || {});

  renderHeroStats(hotel.hero?.stats || []);

  setText("aboutEyebrow", hotel.about?.eyebrow);
  renderAboutImages(hotel.about || {});
 
  const aboutTitleEl = document.getElementById("aboutTitle");
if (aboutTitleEl) {
  const fullTitle = hotel.about?.title || hotel.hotelName || "";
  const words = fullTitle.trim().split(" ");
  if (words.length >= 2) {
    const firstPart = words.slice(0, -1).join(" ");
    const lastPart = words[words.length - 1];
    aboutTitleEl.innerHTML = `${escapeHTML(firstPart)}<br/><em>${escapeHTML(lastPart)}</em>`;
  } else {
    aboutTitleEl.textContent = fullTitle;
  }
  console.log("APP_STATE:", window.APP_STATE);
}


  renderAboutParagraphs(hotel.about?.paragraphs || []);
  renderAboutFeatures(hotel.about?.features || []);
  renderGallerySection();
  GalleryLightbox.init();
  renderEventsSection();
  renderReservationSection();
  renderContactSection();
  renderFooterSection();
  applySectionOrderFromState();
  applySectionVisibilityFromState();

  initReveal(document.getElementById("about"));
  initReveal(document.getElementById("events"));

  const navLogo = document.querySelector(".nav-logo");
if (navLogo) {
  navLogo.setAttribute("aria-label", `${hotel.hotelName || "Hotel"} home`);
}

}

const CART_STORAGE_KEY = "hsr_food_cart_v1";
const ORDER_TRACKING_STORAGE_KEY = "hsr_recent_order_tracking_v1";
const ORDER_TRACKING_DISMISS_STORAGE_KEY = "hsr_recent_order_tracking_dismissed_v1";
const ORDER_TRACKING_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const ORDER_TRACKING_CLOSED_STATUSES = new Set(["completed", "cancelled", "payment_failed"]);
const TABLE_CART_STALE_WINDOW_MS = 4 * 60 * 60 * 1000;
let CART = [];

function normalizeCartStoragePart(value, fallback = "default") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getCartStorageKey(orderContext = getActiveOrderContext()) {
  const hotelSlug = normalizeCartStoragePart(getActiveHotelSlug(), "hotel");
  const keyParts = [CART_STORAGE_KEY, hotelSlug];

  if (hasDineInOrderContext(orderContext)) {
    keyParts.push("table", normalizeCartStoragePart(orderContext.tableNumber, "unknown-table"));
  } else {
    keyParts.push("website");
  }

  return keyParts
    .map((part) => encodeURIComponent(String(part).trim()))
    .join(":");
}

function getTableCartStoragePayload(items = CART, orderContext = getActiveOrderContext()) {
  return {
    items: normalizeCartItems(items),
    savedAt: new Date().toISOString(),
    tableNumber: orderContext.tableNumber || "",
    orderType: orderContext.orderType || "dine-in",
    orderSource: orderContext.orderSource || "qr"
  };
}

function getFreshStoredTableCartItems(storedCart, orderContext = getActiveOrderContext()) {
  if (!storedCart) return [];

  if (Array.isArray(storedCart)) {
    // Legacy table carts did not include timestamps, so they cannot be proven safe for table turnover.
    return null;
  }

  if (!storedCart || typeof storedCart !== "object" || !Array.isArray(storedCart.items)) {
    return null;
  }

  const storedTableNumber = normalizeOrderContextText(storedCart.tableNumber, 80);
  const savedAt = new Date(storedCart.savedAt || "").getTime();
  const isFresh =
    Number.isFinite(savedAt) &&
    Date.now() - savedAt <= TABLE_CART_STALE_WINDOW_MS;

  if (storedTableNumber !== orderContext.tableNumber || !isFresh) {
    return null;
  }

  return storedCart.items;
}

/* ── Shared Helpers ─────────────────────────────────── */
function formatCurrency(value) {
  return `₹${Number(value).toFixed(0)}`;
}

function cleanPhone(value = "") {
  return String(value).replace(/\D/g, "");
}

function ownerWhatsAppLink(message) {
  return `https://wa.me/${cleanPhone(CONFIG.OWNER_WHATSAPP_NUMBER)}?text=${encodeURIComponent(message)}`;
}

const FALLBACK_IMAGE = {
  altSuffix: "Image unavailable",
};

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value = "") {
  return escapeHTML(value);
}

function isLikelyRemoteUrl(src = "") {
  return /^https?:\/\//i.test(String(src));
}

function normalizeImagePath(src = "") {
  if (!src) return "";
  const trimmed = String(src).trim();
  if (isLikelyRemoteUrl(trimmed)) return trimmed;
  return trimmed.startsWith("/")
    ? trimmed
    : `./${trimmed.replace(/^\.?\//, "")}`;
}

function createImageMarkup({ src, alt, badge, name }) {
  const safeSrc = normalizeImagePath(src);
  const safeAlt = escapeAttr(alt || name || FALLBACK_IMAGE.altSuffix);
  const safeName = escapeHTML(name || "Menu item");

  return `
    <div class="menu-card-img">
      <div class="media-frame is-loading" data-image-frame>
        <img
          class="media-frame__img"
          data-menu-image
          src="${escapeAttr(safeSrc)}"
          alt="${safeAlt}"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        />
        <div class="media-frame__fallback" aria-hidden="true">
          <div>
            <i class="fas fa-image"></i>
            <span>${safeName}</span>
          </div>
        </div>
      </div>
      ${badge ? `<span class="menu-card-badge">${escapeHTML(badge)}</span>` : ""}
    </div>
  `;
}

function initManagedImages(scope = document) {
  const images = $$("[data-menu-image]", scope);

  images.forEach((img) => {
    const frame = img.closest("[data-image-frame]");
    if (!frame) return;

    let handled = false;

    const markLoaded = () => {
      if (handled) return;
      handled = true;
      frame.classList.remove("is-loading");
      frame.classList.add("is-loaded");
    };

    const markError = () => {
      if (handled) return;
      handled = true;
      frame.classList.remove("is-loading");
      frame.classList.add("has-error");
      img.setAttribute("aria-hidden", "true");
      img.alt = "";
    };

    img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", markError, { once: true });

    if (img.complete) {
      if (img.naturalWidth > 0) {
        markLoaded();
      } else {
        markError();
      }
    }
  });
}

function getGalleryItemClassName(layoutVariant = "standard") {
  const classNames = ["gallery-item"];

  if (layoutVariant === "large") {
    classNames.push("gallery-item--large");
  } else if (layoutVariant === "tall") {
    classNames.push("gallery-item--tall");
  } else if (layoutVariant === "wide") {
    classNames.push("gallery-item--wide");
  }

  return classNames.join(" ");
}

function renderGallerySection() {
  const galleryGrid = document.querySelector("#gallery .gallery-grid");
  const galleryItems = window.APP_STATE?.gallery || [];

  if (!galleryGrid) return;

  if (!galleryGrid.dataset.staticMarkup) {
    galleryGrid.dataset.staticMarkup = galleryGrid.innerHTML;
  }

  if (!galleryItems.length) {
    galleryGrid.innerHTML = galleryGrid.dataset.staticMarkup;
    return;
  }

  galleryGrid.innerHTML = galleryItems
    .map((item, index) => {
      const imageUrl = normalizeImagePath(item.imageUrl || "");
      const alt = escapeAttr(item.alt || `Gallery image ${index + 1}`);

      return `
        <div class="${getGalleryItemClassName(item.layoutVariant)}" role="listitem">
          <img src="${escapeAttr(imageUrl)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
          <div class="gallery-overlay"><i class="fas fa-expand" aria-hidden="true"></i></div>
        </div>
      `;
    })
    .join("");
}

const WhatsAppFallback = (() => {
  let modal;
  let fallbackLink;
  let lastFocused;

  function ensureNodes() {
    modal = modal || $("#waFallbackModal");
    fallbackLink = fallbackLink || $("#waFallbackLink");
    return !!modal && !!fallbackLink;
  }

  function showCustomAlert(message) {
    let existingAlert = document.querySelector(".custom-popup-alert");
    if (existingAlert) {
      existingAlert.remove();
    }

    const alertBox = document.createElement("div");
    alertBox.className = "custom-popup-alert";
    alertBox.innerHTML = `
    <div class="custom-popup-alert__content">
      <span class="custom-popup-alert__icon">⚠️</span>
      <p class="custom-popup-alert__text">${message}</p>
    </div>
  `;

    document.body.appendChild(alertBox);

    requestAnimationFrame(() => {
      alertBox.classList.add("show");
    });

    setTimeout(() => {
      alertBox.classList.remove("show");
      alertBox.classList.add("hide");

      setTimeout(() => {
        alertBox.remove();
      }, 400);
    }, 6000);
  }

  function open(link) {
    if (!ensureNodes()) {
      showCustomAlert(
        "If WhatsApp does not open, please enable pop-ups and try again. If Done Ignore this",
      );
      return;
    }

    lastFocused = document.activeElement;
    fallbackLink.href = link;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    fallbackLink.focus();
  }

  function close() {
    if (!ensureNodes()) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function bind() {
    if (!ensureNodes()) return;

    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-wa-close]")) {
        close();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && !modal.hidden) {
        close();
      }
    });
  }

  return { bind, open, close };
})();

function normalizeTestimonialsData(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const text = typeof item.text === "string" ? item.text.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const role = typeof item.role === "string" ? item.role.trim() : "";
      const avatar = normalizeImagePath(item.avatar || item.image || "");
      const stars = Math.max(1, Math.min(5, Math.round(Number(item.stars || 5))));

      if (!text || !name) return null;

      return {
        text,
        name,
        role,
        avatar,
        stars
      };
    })
    .filter(Boolean);
}

function renderTestimonialsSection(testimonials = window.APP_STATE?.testimonials || []) {
  const track = $("#testimonialsTrack");
  const dotsWrap = $("#testiDots");
  const prevBtn = $("#testPrev");
  const nextBtn = $("#testNext");
  const safeTestimonials = normalizeTestimonialsData(testimonials);

  if (!track || !dotsWrap) return;

  track.innerHTML = "";
  dotsWrap.innerHTML = "";
  track.style.transform = "";

  const hasMultipleTestimonials = safeTestimonials.length > 1;

  [prevBtn, nextBtn].forEach((button) => {
    if (!button) return;
    button.hidden = !hasMultipleTestimonials;
    button.setAttribute("aria-hidden", hasMultipleTestimonials ? "false" : "true");
  });

  dotsWrap.hidden = !hasMultipleTestimonials;
  dotsWrap.setAttribute("aria-hidden", hasMultipleTestimonials ? "false" : "true");

  if (!safeTestimonials.length) {
    return;
  }

  safeTestimonials.forEach((testimonial, index) => {
    const stars = "★".repeat(testimonial.stars) + "☆".repeat(5 - testimonial.stars);
    const card = document.createElement("div");
    card.className = "testi-card";
    card.setAttribute("role", "tabpanel");
    card.setAttribute("aria-label", `Testimonial ${index + 1}`);
    card.innerHTML = `
      <div class="testi-quote" aria-hidden="true">"</div>
      <p class="testi-text">${escapeHTML(testimonial.text)}</p>
      <div class="testi-author">
        <div class="testi-avatar">
          <img src="${escapeAttr(testimonial.avatar)}" alt="${escapeAttr(testimonial.name)}" loading="lazy" />
        </div>
        <div class="testi-stars" aria-label="${testimonial.stars} out of 5 stars">${stars}</div>
        <strong class="testi-name">${escapeHTML(testimonial.name)}</strong>
        <span class="testi-role">${escapeHTML(testimonial.role)}</span>
      </div>
    `;
    track.appendChild(card);
  });

  let currentIndex = 0;

  function goTo(index) {
    currentIndex = (index + safeTestimonials.length) % safeTestimonials.length;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    $$(".testi-dot", dotsWrap).forEach((currentDot, dotIndex) => {
      currentDot.classList.toggle("active", dotIndex === currentIndex);
    });
  }

  safeTestimonials.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "testi-dot" + (index === 0 ? " active" : "");
    dot.setAttribute("role", "listitem");
    dot.setAttribute("aria-label", `Go to testimonial ${index + 1}`);
    dot.addEventListener("click", () => {
      goTo(index);
    });
    dotsWrap.appendChild(dot);
  });

  if (prevBtn) {
    prevBtn.onclick = () => goTo(currentIndex - 1);
  }

  if (nextBtn) {
    nextBtn.onclick = () => goTo(currentIndex + 1);
  }
}

function setTestimonialReviewFormVisibility(isVisible) {
  const wrap = $("#testimonialReviewWrap");
  const openBtn = $("#openTestimonialReviewBtn");

  if (!wrap || !openBtn) return;

  wrap.hidden = !isVisible;
  wrap.setAttribute("aria-hidden", isVisible ? "false" : "true");
  openBtn.setAttribute("aria-expanded", isVisible ? "true" : "false");

  if (isVisible) {
    wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function handleTestimonialReviewSubmit(e) {
  e.preventDefault();

  const form = e.target;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const hotelName = getActiveHotelName();
  const hotelSlug = getActiveHotelSlug();
  const name =
    form.querySelector('[name="name"], #testimonialReviewName')?.value.trim() || "";
  const role =
    form.querySelector('[name="role"], #testimonialReviewRole')?.value.trim() || "";
  const text =
    form.querySelector('[name="text"], #testimonialReviewText')?.value.trim() || "";
  const stars = Number(
    form.querySelector('[name="stars"], #testimonialReviewStars')?.value || 5
  );
  const submitButton = form.querySelector('button[type="submit"]');

  if (!hotelName || !hotelSlug) {
    showToast("Hotel context is unavailable right now. Please refresh and try again.");
    return;
  }

  if (!name || !text || !Number.isFinite(stars)) {
    showToast("Please fill all required review details.");
    return;
  }

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting review...";
    }

    const result = await saveTestimonialReview({
      hotelName,
      hotelSlug,
      name,
      role,
      text,
      stars
    });

    form.reset();
    const starsInput = form.querySelector("#testimonialReviewStars");
    if (starsInput) {
      starsInput.value = "5";
    }
    setTestimonialReviewFormVisibility(false);
    showToast(
      result?.message || "Review submitted successfully. It will appear after approval."
    );
  } catch (error) {
    console.error("Testimonial review submit failed:", error);
    showToast(error.message || "Failed to submit review. Please try again.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Review";
    }
  }
}

function bindTestimonialReviewForm() {
  const openBtn = $("#openTestimonialReviewBtn");
  const cancelBtn = $("#cancelTestimonialReviewBtn");
  const form = $("#testimonialReviewForm");

  if (openBtn && openBtn.dataset.boundClick !== "true") {
    openBtn.addEventListener("click", () => {
      setTestimonialReviewFormVisibility(true);
      const firstInput = $("#testimonialReviewName");
      if (firstInput) {
        firstInput.focus();
      }
    });
    openBtn.dataset.boundClick = "true";
  }

  if (cancelBtn && cancelBtn.dataset.boundClick !== "true") {
    cancelBtn.addEventListener("click", () => {
      form?.reset();
      const starsInput = $("#testimonialReviewStars");
      if (starsInput) {
        starsInput.value = "5";
      }
      setTestimonialReviewFormVisibility(false);
    });
    cancelBtn.dataset.boundClick = "true";
  }

  if (!form || form.dataset.boundSubmit === "true") return;

  form.addEventListener("submit", handleTestimonialReviewSubmit);
  form.dataset.boundSubmit = "true";
}

function tryOpenExternalLink(url) {
  let popup = null;

  try {
    popup = window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    popup = null;
  }

  const blocked = !popup || popup.closed || typeof popup.closed === "undefined";

  if (blocked) {
    WhatsAppFallback.open(url);
    return false;
  }

  return true;
}

function openWhatsAppSafely(url) {
  if (!url) {
    console.error("WhatsApp URL missing");
    return;
  }

  return tryOpenExternalLink(url);
}

function getOrderTrackingUrl(tracking = {}) {
  const orderId = String(tracking.orderId || "").trim();
  const hotelSlug = String(tracking.hotelSlug || getActiveHotelSlug() || "").trim();
  const token = String(tracking.token || "").trim();
  const path = String(tracking.path || "").trim();

  if (!path && (!orderId || !hotelSlug || !token)) {
    return "";
  }

  const trackingPath = path || `order-tracking.html?hotel=${encodeURIComponent(hotelSlug)}&order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`;

  try {
    return new URL(trackingPath, window.location.href).toString();
  } catch {
    return trackingPath;
  }
}

function rememberOrderTracking(tracking = {}) {
  const trackingUrl = getOrderTrackingUrl(tracking);
  const orderId = String(tracking.orderId || "").trim();
  const hotelSlug = String(tracking.hotelSlug || getActiveHotelSlug() || "").trim();
  const token = String(tracking.token || "").trim();
  const activeOrderContext = getActiveOrderContext();
  const tableNumber = normalizeOrderContextText(
    tracking.tableNumber ||
      tracking.table_number ||
      tracking.orderContext?.tableNumber ||
      activeOrderContext.tableNumber,
    80,
  );
  const orderType = normalizeOrderContextText(
    tracking.orderType ||
      tracking.order_type ||
      tracking.orderContext?.orderType ||
      activeOrderContext.orderType,
    40,
  );
  const orderSource = normalizeOrderContextText(
    tracking.orderSource ||
      tracking.order_source ||
      tracking.orderContext?.orderSource ||
      activeOrderContext.orderSource,
    40,
  );

  if (!trackingUrl || !orderId || !hotelSlug || !token) {
    return null;
  }

  const trackingRecord = {
    orderId,
    hotelSlug,
    token,
    url: trackingUrl,
    orderType,
    tableNumber,
    orderSource,
    savedAt: new Date().toISOString()
  };

  try {
    const storageKey = getOrderTrackingRecordStorageKey(hotelSlug);
    const dismissStorageKey = getOrderTrackingDismissStorageKey(hotelSlug);

    if (!storageKey) return trackingRecord;
    sessionStorage.setItem(storageKey, JSON.stringify(trackingRecord));
    localStorage.removeItem(storageKey);
    if (dismissStorageKey) sessionStorage.removeItem(dismissStorageKey);
  } catch {
    // Tracking remains available through the visible link even if storage is blocked.
  }

  return trackingRecord;
}

function removeRecentOrderTrackingShortcut() {
  document.getElementById("recentOrderTrackingShortcut")?.remove();
}

function getOrderTrackingRecordStorageKey(hotelSlug = getActiveHotelSlug()) {
  const normalizedHotelSlug = String(hotelSlug || "").trim();
  return normalizedHotelSlug ? `${ORDER_TRACKING_STORAGE_KEY}:${normalizedHotelSlug}` : "";
}

function getOrderTrackingDismissStorageKey(hotelSlug = getActiveHotelSlug()) {
  const normalizedHotelSlug = String(hotelSlug || "").trim();
  return normalizedHotelSlug ? `${ORDER_TRACKING_DISMISS_STORAGE_KEY}:${normalizedHotelSlug}` : "";
}

function removeStoredOrderTrackingRecord(hotelSlug = getActiveHotelSlug()) {
  const normalizedHotelSlug = String(hotelSlug || "").trim();
  if (!normalizedHotelSlug) return;
  const storageKey = getOrderTrackingRecordStorageKey(normalizedHotelSlug);
  const dismissStorageKey = getOrderTrackingDismissStorageKey(normalizedHotelSlug);

  try {
    if (storageKey) {
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    }
    if (dismissStorageKey) sessionStorage.removeItem(dismissStorageKey);
  } catch {
    // Cleaning recent tracking state is best-effort only.
  }
}

function isClosedOrderTrackingStatus(status = "") {
  return ORDER_TRACKING_CLOSED_STATUSES.has(String(status || "").trim().toLowerCase());
}

function getRecentOrderTrackingRecord() {
  const hotelSlug = String(getActiveHotelSlug() || "").trim();
  if (!hotelSlug) return null;

  try {
    const storageKey = getOrderTrackingRecordStorageKey(hotelSlug);
    const dismissStorageKey = getOrderTrackingDismissStorageKey(hotelSlug);
    const rawRecord = storageKey ? sessionStorage.getItem(storageKey) : "";
    if (storageKey && !rawRecord) {
      localStorage.removeItem(storageKey);
    }
    if (!rawRecord) return null;

    const record = JSON.parse(rawRecord);
    const orderId = String(record?.orderId || "").trim();
    const recordHotelSlug = String(record?.hotelSlug || "").trim();
    const token = String(record?.token || "").trim();
    const url = String(record?.url || "").trim();
    const savedAt = new Date(record?.savedAt || "").getTime();
    const status = String(record?.status || "").trim();
    const orderType = normalizeOrderContextText(record?.orderType || record?.order_type, 40);
    const tableNumber = normalizeOrderContextText(record?.tableNumber || record?.table_number, 80);
    const orderSource = normalizeOrderContextText(record?.orderSource || record?.order_source, 40);
    const activeOrderContext = getActiveOrderContext();
    const isExpired =
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > ORDER_TRACKING_RECENT_WINDOW_MS;

    if (
      hasDineInOrderContext(activeOrderContext) &&
      tableNumber !== activeOrderContext.tableNumber
    ) {
      return null;
    }

    if (
      !orderId ||
      recordHotelSlug !== hotelSlug ||
      !token ||
      !url ||
      isExpired ||
      isClosedOrderTrackingStatus(status)
    ) {
      removeStoredOrderTrackingRecord(hotelSlug);
      return null;
    }

    const dismissedOrderId = dismissStorageKey
      ? sessionStorage.getItem(dismissStorageKey)
      : "";

    if (dismissedOrderId === orderId) {
      return null;
    }

    return {
      orderId,
      hotelSlug: recordHotelSlug,
      token,
      url,
      savedAt: record.savedAt || "",
      orderType,
      tableNumber,
      orderSource,
      status
    };
  } catch {
    return null;
  }
}

async function validateRecentOrderTrackingShortcut(trackingRecord = {}) {
  const hotelSlug = String(trackingRecord.hotelSlug || "").trim();
  const orderId = String(trackingRecord.orderId || "").trim();
  const token = String(trackingRecord.token || "").trim();

  if (!hotelSlug || !orderId || !token) return;

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/api/order-tracking/${encodeURIComponent(hotelSlug)}/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`
    );

    if (response.status === 404 || response.status === 410) {
      removeStoredOrderTrackingRecord(hotelSlug);
      removeRecentOrderTrackingShortcut();
      return;
    }

    const data = await response.json().catch(() => ({}));
    const status = data?.order?.status || "";

    if (response.ok && data?.success !== false && isClosedOrderTrackingStatus(status)) {
      removeStoredOrderTrackingRecord(hotelSlug);
      removeRecentOrderTrackingShortcut();
    }
  } catch {
    // If the network is unavailable, keep the shortcut instead of hiding a valid order.
  }
}

function renderRecentOrderTrackingShortcut() {
  const trackingRecord = getRecentOrderTrackingRecord();
  removeRecentOrderTrackingShortcut();

  if (!trackingRecord) return;
  validateRecentOrderTrackingShortcut(trackingRecord);

  const shortcut = document.createElement("div");
  shortcut.id = "recentOrderTrackingShortcut";
  shortcut.className = "recent-order-tracking-shortcut";
  shortcut.innerHTML = `
    <a href="${escapeAttr(trackingRecord.url)}" class="recent-order-tracking-shortcut__link" aria-label="Track recent order ${escapeAttr(trackingRecord.orderId)}">
      <span class="recent-order-tracking-shortcut__icon"><i class="fas fa-receipt" aria-hidden="true"></i></span>
      <span>
        <small>Recent order</small>
        <strong>Track #${escapeHTML(trackingRecord.orderId)}</strong>
      </span>
    </a>
    <button type="button" class="recent-order-tracking-shortcut__close" aria-label="Hide recent order tracking">&times;</button>
  `;

  shortcut
    .querySelector(".recent-order-tracking-shortcut__close")
    ?.addEventListener("click", () => {
      try {
        const dismissStorageKey = getOrderTrackingDismissStorageKey(trackingRecord.hotelSlug);
        if (dismissStorageKey) sessionStorage.setItem(dismissStorageKey, trackingRecord.orderId);
      } catch {
        // Hiding the shortcut is non-critical.
      }

      shortcut.remove();
    });

  document.body.appendChild(shortcut);
}

function showOrderTrackingPrompt(tracking = {}, message = "Your order was saved. You can now track it live.") {
  const trackingRecord = rememberOrderTracking(tracking);
  if (!trackingRecord) return;

  removeRecentOrderTrackingShortcut();
  let prompt = document.getElementById("orderTrackingPrompt");

  if (!prompt) {
    prompt = document.createElement("div");
    prompt.id = "orderTrackingPrompt";
    prompt.className = "order-tracking-prompt glass-card";
    prompt.setAttribute("role", "status");
    prompt.setAttribute("aria-live", "polite");
    document.body.appendChild(prompt);
  }

  prompt.innerHTML = `
    <div class="order-tracking-prompt__content">
      <span class="order-tracking-prompt__kicker">Order #${escapeHTML(trackingRecord.orderId)}</span>
      <strong>${escapeHTML(message)}</strong>
    </div>
    <div class="order-tracking-prompt__actions">
      <a class="btn btn-primary" href="${escapeAttr(trackingRecord.url)}" target="_blank" rel="noopener noreferrer">Track Order</a>
      <button type="button" class="order-tracking-prompt__close" aria-label="Dismiss tracking link">&times;</button>
    </div>
  `;

  prompt.hidden = false;
  prompt.classList.add("is-visible");

  prompt
    .querySelector(".order-tracking-prompt__close")
    ?.addEventListener("click", () => {
      prompt.classList.remove("is-visible");
      prompt.hidden = true;
      renderRecentOrderTrackingShortcut();
    }, { once: true });
}

function flattenMenuData() {
  const menuData = getMenuData();

  return Object.entries(menuData).flatMap(([category, items]) =>
    items.map((item) => ({ ...item, category }))
  );
}

function findMenuItemById(id) {
  return flattenMenuData().find((item) => item.id === id);
}

function normalizeCartNumber(value, fallback = 0) {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : fallback;
}

function normalizeCartItem(rawItem) {
  if (!rawItem || typeof rawItem !== "object") return null;

  const rawId = typeof rawItem.id === "string" ? rawItem.id.trim() : "";
  const menuItem = rawId ? findMenuItemById(rawId) : null;
  const id = rawId || menuItem?.id || "";
  const name =
    (typeof rawItem.name === "string" && rawItem.name.trim()) ||
    menuItem?.name ||
    "";
  const qty = Math.max(1, Math.trunc(normalizeCartNumber(rawItem.qty, 1)));
  const price = normalizeCartNumber(
    rawItem.price,
    Number.isFinite(Number(menuItem?.price)) ? Number(menuItem.price) : 0,
  );

  if (!id || !name) return null;

  return {
    id,
    name,
    price,
    qty,
    image:
      (typeof rawItem.image === "string" && rawItem.image.trim()) ||
      menuItem?.image ||
      "",
  };
}

function normalizeCartItems(items = []) {
  return Array.isArray(items)
    ? items.map((item) => normalizeCartItem(item)).filter(Boolean)
    : [];
}

function loadCart() {
  const orderContext = getActiveOrderContext();
  const storageKey = getCartStorageKey(orderContext);

  try {
    const rawCart = localStorage.getItem(storageKey);
    if (!rawCart) {
      CART = [];
      return;
    }

    const storedCart = JSON.parse(rawCart);

    if (hasDineInOrderContext(orderContext)) {
      const tableCartItems = getFreshStoredTableCartItems(storedCart, orderContext);

      if (tableCartItems === null) {
        localStorage.removeItem(storageKey);
        CART = [];
        return;
      }

      CART = normalizeCartItems(tableCartItems);
      return;
    }

    CART = normalizeCartItems(Array.isArray(storedCart) ? storedCart : storedCart?.items || []);
  } catch {
    CART = [];
  }
}

function saveCart() {
  const orderContext = getActiveOrderContext();
  const storageKey = getCartStorageKey(orderContext);
  CART = normalizeCartItems(CART);

  try {
    if (!CART.length) {
      localStorage.removeItem(storageKey);
      return;
    }

    const storagePayload = hasDineInOrderContext(orderContext)
      ? getTableCartStoragePayload(CART, orderContext)
      : CART;

    localStorage.setItem(storageKey, JSON.stringify(storagePayload));
  } catch {
    // Cart storage is best-effort; the in-memory cart remains available for this page.
  }
}

function getCartItem(id) {
  return CART.find((item) => item.id === id);
}

function getItemQty(id) {
  return getCartItem(id)?.qty || 0;
}

function addToCart(itemId) {
  const menuItem = findMenuItemById(itemId);
  if (!menuItem) return;

  const existing = getCartItem(itemId);
  if (existing) {
    existing.qty += 1;
  } else {
    CART.push({
      id: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      qty: 1,
      image: menuItem.image,
    });
  }

  saveCart();
  updateCartUI();
  renderMenu(getCurrentMenuCategory());
}

function updateCartQty(itemId, delta) {
  const item = getCartItem(itemId);
  if (!item) return;

  item.qty += delta;

  if (item.qty <= 0) {
    CART = CART.filter((i) => i.id !== itemId);
  }

  saveCart();
  updateCartUI();
  renderMenu(getCurrentMenuCategory());
}

function removeFromCart(itemId) {
  CART = CART.filter((item) => item.id !== itemId);
  saveCart();
  updateCartUI();
  renderMenu(getCurrentMenuCategory());
}

function calculateCartTotals(items = CART) {
  const safeItems = normalizeCartItems(items);
  const orderContext = getActiveOrderContext();
  const subtotal = safeItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const gst = Math.round((subtotal * Number(CONFIG.GST_PERCENT || 5)) / 100);
  const deliveryCharge = getWebsiteDeliveryCharge(orderContext);
  const total = subtotal + gst + deliveryCharge;
  return { subtotal, gst, deliveryCharge, total };
}

function shouldApplyWebsiteDeliveryCharge(orderContext = getActiveOrderContext()) {
  return !hasDineInOrderContext(getActiveOrderContext(orderContext));
}

function getConfiguredDeliveryCharge() {
  const candidate = Number(window.APP_STATE?.theme?.payment?.deliveryCharge);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 0;
}

function getWebsiteDeliveryCharge(orderContext = getActiveOrderContext()) {
  return shouldApplyWebsiteDeliveryCharge(orderContext) ? getConfiguredDeliveryCharge() : 0;
}

function getUpiDiscountPercent() {
  const candidate = Number(window.APP_STATE?.theme?.payment?.upiDiscountPercent);

  if (Number.isFinite(candidate)) {
    return Math.min(Math.max(candidate, 0), 100);
  }

  return Number(CONFIG.DEFAULT_UPI_DISCOUNT_PERCENT || 10);
}

function formatDiscountPercent(percent) {
  const safePercent = Number.isFinite(Number(percent)) ? Number(percent) : 0;

  return Number.isInteger(safePercent)
    ? `${safePercent}%`
    : `${safePercent.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function calculatePayableAmounts(items = CART) {
  const { subtotal, gst, deliveryCharge, total: normalTotal } = calculateCartTotals(items);
  const upiDiscountPercent = getUpiDiscountPercent();
  const gpayDiscount = Math.round((normalTotal * upiDiscountPercent) / 100);
  const gpayFinalTotal = Math.max(0, normalTotal - gpayDiscount);

  return {
    subtotal,
    gst,
    deliveryCharge,
    normalTotal,
    upiDiscountPercent,
    gpayDiscount,
    gpayFinalTotal,
  };
}

function buildUpiLink(amount) {
  const params = new URLSearchParams({
    pa: CONFIG.OWNER_UPI_ID || "",
    pn: getActiveHotelName() || "Hotel",
    tn: "Food Order",
    am: Number(amount || 0).toFixed(0),
    cu: "INR",
  });

  return `upi://pay?${params.toString()}`;
}

function isLikelyMobileUpiDevice() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isTouchIpad =
    platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;

  return /Android|iPhone|iPad|iPod/i.test(userAgent) || isTouchIpad;
}

function revealUpiFallbackBox() {
  const fallbackBox = document.getElementById("upiFallbackBox");

  if (fallbackBox) {
    fallbackBox.hidden = false;
  }
}

async function copyOwnerUpiIdToClipboard() {
  const upiId = CONFIG.OWNER_UPI_ID || "";

  if (!upiId || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(upiId);
    return true;
  } catch {
    return false;
  }
}

async function showManualUpiFallback(message) {
  revealUpiFallbackBox();
  const copied = await copyOwnerUpiIdToClipboard();

  showToast(copied ? `${message} UPI ID copied.` : message);
}

function buildOrderSummaryText({
  customerName,
  customerPhone,
  customerAddress,
  customerTableNote,
  locationLink,
  paymentMethod,
  note,
  paymentConfirmed,
  items = CART,
  orderContext = getActiveOrderContext(),
}) {
  const safeItems = normalizeCartItems(items);
  const { subtotal, gst, deliveryCharge, normalTotal, upiDiscountPercent, gpayDiscount, gpayFinalTotal } =
    calculatePayableAmounts(safeItems);

  const isUpi = paymentMethod === "UPI";
  const isOnlineGateway = paymentMethod === "ONLINE_GATEWAY";
  const hotelName = getActiveHotelName();
  const activeOrderContext = getActiveOrderContext(orderContext);

  const lines = [
  `Order Summary - ${hotelName || "Hotel"}`,
  `━━━━━━━━━━━━━━━━━━━━━━`,
  `Name: ${customerName}`,
  `Phone: ${customerPhone}`,
];

  if (hasDineInOrderContext(activeOrderContext)) {
    lines.push("Order Type: Dine-in");
    if (hasActiveOrderAddonContext(activeOrderContext)) {
      lines.push(`Add-on For Order: #${activeOrderContext.addToOrderId}`);
    }
    lines.push(`Table: ${activeOrderContext.tableNumber}`);
    lines.push(
      `Source: ${activeOrderContext.orderSource === "qr" ? "QR code" : activeOrderContext.orderSource}`,
    );
    lines.push(`Table Note: ${customerTableNote || "Not provided"}`);
  } else {
    lines.push(`Address: ${customerAddress || "Not provided"}`);
    lines.push(`Location: ${locationLink || "Not shared"}`);
  }
  lines.push("");

  safeItems.forEach((item) => {
    lines.push(
      ` ${item.name} ×${item.qty} = ${formatCurrency(item.price * item.qty)}`,
    );
  });

  lines.push("");
  lines.push(` Subtotal = ${formatCurrency(subtotal)}`);
  lines.push(` GST = ${formatCurrency(gst)}`);
  if (deliveryCharge > 0) {
    lines.push(` Delivery Charge = ${formatCurrency(deliveryCharge)}`);
  }

  if (isUpi) {
    lines.push(` Original Total = ${formatCurrency(normalTotal)}`);
    lines.push(
      ` Google Pay Discount (${formatDiscountPercent(upiDiscountPercent)}) = -${formatCurrency(gpayDiscount)}`,
    );
    lines.push(` Final Paid Amount = ${formatCurrency(gpayFinalTotal)}`);
    lines.push(" Payment Method = Google Pay / UPI");
    lines.push(` UPI ID = ${CONFIG.OWNER_UPI_ID}`);
    lines.push(
      ` Payment Status = ${paymentConfirmed ? "Confirmed" : "Pending"}`,
    );
  } else if (isOnlineGateway) {
    lines.push(` Total = ${formatCurrency(normalTotal)}`);
    lines.push(" Payment Method = Secure Online Payment");
    lines.push(
      ` Payment Status = ${paymentConfirmed ? "Paid (Verified)" : "Pending Gateway Payment"}`,
    );
  } else {
    lines.push(` Total = ${formatCurrency(normalTotal)}`);
    lines.push(" Payment Method = COD");
  }

  if (note) {
    lines.push("");
    lines.push(` Note = ${note}`);
  }

  return lines.join("\n");
}

function buildEventMessage({
  name,
  phone,
  eventType,
  date,
  guests,
  specialRequirements
}) {
  return `*New Event Inquiry*

 Name: ${name}
 Phone: ${phone}
 Event Type: ${eventType}
 Date: ${date}
 Guests: ${guests || "Not specified"}
 Requirements: ${specialRequirements || "None"}

Please review and confirm.`;
}

async function handleEventInquirySubmit(e) {
  e.preventDefault();

  const form = e.target;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const name = form.querySelector('[name="name"], #eventName')?.value.trim();
  const phone = form.querySelector('[name="phone"], #eventPhone')?.value.trim();
  const eventType = form.querySelector('[name="eventType"], [name="type"], #eventType')?.value.trim();
  const date = form.querySelector('[name="date"], #eventDate')?.value.trim();
  const guests = form.querySelector('[name="guests"], #eventGuests')?.value.trim();
  const specialRequirements =
    form.querySelector('[name="specialRequirements"], [name="message"], #eventRequirements, #specialRequirements')
      ?.value.trim() || "";

  if (!name || !phone || !eventType || !date) {
    showToast("Please fill all required event details.");
    return;
  }

  const payload = getEventInquiryPayload({
    name,
    phone,
    eventType,
    date,
    guests,
    specialRequirements
  });

  try {
    await saveInquiry(payload);

    const message = buildEventMessage({
      name,
      phone,
      eventType,
      date,
      guests,
      specialRequirements
    });

    ownerWhatsAppLink(message);

    form.reset();
    showToast("Event inquiry saved successfully.");
  } catch (error) {
    console.error("Event inquiry save failed:", error);
    showToast("Failed to save inquiry. Please try again.");
  }
}

function bindEventInquiryForm() {
  const form =
    document.getElementById("eventForm") ||
    document.getElementById("eventInquiryForm");

  if (!form || form.dataset.boundSubmit === "true") return;

  form.addEventListener("submit", handleEventInquirySubmit);
  form.dataset.boundSubmit = "true";
}

async function handleReservationSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const success = document.getElementById("resSuccess");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const name = form.querySelector('[name="name"], #reservationName, #reserveName')?.value.trim();
  const phone = form.querySelector('[name="phone"], #reservationPhone, #reservePhone')?.value.trim();
  const date = form.querySelector('[name="date"], #reservationDate, #reserveDate')?.value.trim();
  const time = form.querySelector('[name="time"], #reservationTime, #reserveTime')?.value.trim();
  const guests = form.querySelector('[name="guests"], #reservationGuests, #reserveGuests')?.value.trim();
  const note =
    form.querySelector('[name="note"], [name="notes"], #reservationNote, #reserveNote')?.value.trim() || "";

  if (!name || !phone || !date || !time || !guests) {
    showToast("Please fill all required reservation details.");
    return;
  }

  const payload = getReservationPayload({
    name,
    phone,
    date,
    time,
    guests,
    note
  });

  try {
    await saveReservation(payload);

    form.reset();
    showToast("Reservation saved successfully.");

    if (success) {
      form.style.display = "none";
      success.hidden = false;

      setTimeout(() => {
        success.hidden = true;
        form.style.display = "block";
      }, 5000);
    }
  } catch (error) {
    console.error("Reservation save failed:", error);
    showToast("Failed to save reservation. Please try again.");
  }
}

function bindReservationForm() {
  const form =
    document.getElementById("reservationForm") ||
    document.getElementById("tableReservationForm");

  if (!form || form.dataset.boundSubmit === "true") return;

  const dateInput = form.querySelector('#reservationDate, #reserveDate, input[type="date"]');
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
  }

  form.addEventListener("submit", handleReservationSubmit);
  form.dataset.boundSubmit = "true";
}

async function postJSON(url, payload) {
  const res = await fetch(`${CONFIG.API_BASE_URL}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const validationMessages = Array.isArray(data.errors) && data.errors.length
      ? data.errors
      : Array.isArray(data.details)
        ? data.details.map((detail) => detail?.message).filter(Boolean)
        : [];
    const validationDetails = validationMessages.length
      ? ` (${validationMessages.join("; ")})`
      : "";
    const error = new Error(`${data.message || "Request failed"}${validationDetails}`);
    error.status = res.status;
    error.response = data;
    throw error;
  }

  return data;
}

function showToast(message) {
  let toast = $("#globalToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "globalToast";
    toast.className = "global-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function openCartDrawer() {
  const drawer = $("#cartDrawer");
  const backdrop = $("#cartBackdrop");
  if (!drawer || !backdrop) return;

  drawer.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCartDrawer() {
  const drawer = $("#cartDrawer");
  const backdrop = $("#cartBackdrop");
  if (!drawer || !backdrop) return;

  drawer.hidden = true;
  backdrop.hidden = true;
  document.body.style.overflow = "";
}

function updateCartUI() {
  const cartItemsWrap = $("#cartItems");
  const subtotalEl = $("#cartSubtotal");
  const gstEl = $("#cartGst");
  const deliveryChargeRowEl = $("#cartDeliveryChargeRow");
  const deliveryChargeEl = $("#cartDeliveryCharge");
  const totalEl = $("#cartTotal");
  const countEl = $("#cartCount");
  const floatingCountEl = $("#floatingCartCount");
  const previewEl = $("#orderPreview");
  const gstPercentLabel = $("#gstPercentLabel");

  const { subtotal, gst, deliveryCharge, normalTotal, gpayDiscount, gpayFinalTotal } =
    calculatePayableAmounts();

  const selectedPaymentMethod =
    $('input[name="paymentMethod"]:checked')?.value || "COD";
  const totalQty = CART.reduce((sum, item) => sum + item.qty, 0);

  if (countEl) countEl.textContent = totalQty;
  if (floatingCountEl) floatingCountEl.textContent = totalQty;
  if (gstPercentLabel) gstPercentLabel.textContent = CONFIG.GST_PERCENT || 5;
  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (gstEl) gstEl.textContent = formatCurrency(gst);
  if (deliveryChargeRowEl) {
    deliveryChargeRowEl.hidden = !(deliveryCharge > 0);
  }
  if (deliveryChargeEl) {
    deliveryChargeEl.textContent = formatCurrency(deliveryCharge);
  }
  if (totalEl) {
    totalEl.textContent = formatCurrency(
      selectedPaymentMethod === "UPI" ? gpayFinalTotal : normalTotal,
    );
  }
  syncTableCartResumeNotice();
  if (!cartItemsWrap) return;

  if (!CART.length) {
    cartItemsWrap.innerHTML = `<p class="cart-empty-text">Your cart is empty.</p>`;
    if (previewEl) previewEl.textContent = "No order yet.";
    return;
  }

  cartItemsWrap.innerHTML = CART.map(
    (item) => `
    <div class="cart-item-card">
      <div class="cart-item-top">
        <div>
          <h5>${escapeHTML(item.name)}</h5>
          <span>${formatCurrency(item.price)} each</span>
        </div>
        <strong>${formatCurrency(item.qty * item.price)}</strong>
      </div>

      <div class="cart-item-actions">
        <div class="qty-inline">
          <button type="button" class="qty-btn" data-cart-minus="${escapeAttr(item.id)}" aria-label="Decrease quantity">−</button>
          <span>${item.qty}</span>
          <button type="button" class="qty-btn" data-cart-plus="${escapeAttr(item.id)}" aria-label="Increase quantity">+</button>
        </div>

        <button type="button" class="remove-item-btn" data-remove-item="${escapeAttr(item.id)}">
          Remove Item
        </button>
      </div>
    </div>
  `,
  ).join("");
}

function bindCartDelegation() {
  const cartItemsWrap = $("#cartItems");
  if (!cartItemsWrap) return;

  cartItemsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.cartMinus) {
      updateCartQty(btn.dataset.cartMinus, -1);
      return;
    }

    if (btn.dataset.cartPlus) {
      updateCartQty(btn.dataset.cartPlus, 1);
      return;
    }

    if (btn.dataset.removeItem) {
      removeFromCart(btn.dataset.removeItem);
    }
  });
}

/* ════════════════════════════════════════════════════════
   1. LOADING SCREEN
   ════════════════════════════════════════════════════════ */
(function initLoader() {
  const loader = $("#loader");
  const bar = $("#loaderBar");
  if (!loader || !bar) return;

  let progress = 0;
  let finished = false;

  const finishLoader = () => {
    if (finished) return;
    finished = true;
    clearInterval(interval);
    bar.style.width = "100%";

    setTimeout(() => {
      loader.classList.add("hidden");
      document.body.style.overflow = "";
      document
        .querySelectorAll("[data-anim]")
        .forEach((el) => el.classList.add("anim-ready"));
    }, 180);
  };

  const interval = setInterval(() => {
    const maxProgress = document.body.classList.contains("app-ready") ? 100 : 92;
    progress += Math.random() * 18;
    if (progress >= maxProgress) progress = maxProgress;
    bar.style.width = progress + "%";

    if (progress === 100) finishLoader();
  }, 100);

  document.addEventListener("app:ready", finishLoader, { once: true });
  document.body.style.overflow = "hidden";
})();

/* ════════════════════════════════════════════════════════
   2. CUSTOM CURSOR
   ════════════════════════════════════════════════════════ */
(function initCursor() {
  const dot = $("#cursorDot");
  const ring = $("#cursorRing");
  if (!dot || !ring) return;
  if (window.innerWidth <= 768) return;

  let mx = -100,
    my = -100;
  let rx = -100,
    ry = -100;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  function animCursor() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;

    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(animCursor);
  }

  animCursor();

  const hoverEls = $$(
    "a, button, .menu-tab, .gallery-item, .testi-btn, .event-card",
  );
  hoverEls.forEach((el) => {
    el.addEventListener("mouseenter", () => ring.classList.add("hovered"));
    el.addEventListener("mouseleave", () => ring.classList.remove("hovered"));
  });
})();

/* ════════════════════════════════════════════════════════
   3. NAVBAR
   ════════════════════════════════════════════════════════ */
(function initNavbar() {
  const navbar = $("#navbar");
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  if (!navbar) return;

  window.addEventListener(
    "scroll",
    () => {
      navbar.classList.toggle("scrolled", window.scrollY > 40);
    },
    { passive: true },
  );

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("open");
      toggle.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen);
    });

    $$(".nav-link", links).forEach((link) => {
      link.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", false);
      });
    });

    document.addEventListener("click", (e) => {
      if (!navbar.contains(e.target)) {
        links.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", false);
      }
    });
  }
})();

/* ════════════════════════════════════════════════════════
   4. SCROLL PROGRESS
   ════════════════════════════════════════════════════════ */
(function initScrollProgress() {
  const bar = $("#scrollProgress");
  if (!bar) return;

  window.addEventListener(
    "scroll",
    () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = Math.min((window.scrollY / total) * 100, 100);
      bar.style.width = pct + "%";
      bar.setAttribute("aria-valuenow", Math.round(pct));
    },
    { passive: true },
  );
})();

/* ════════════════════════════════════════════════════════
   5. SCROLL REVEAL
   ════════════════════════════════════════════════════════ */
let revealObserver;

function initReveal(scope = document) {
  if (!scope || typeof scope.querySelectorAll !== "function") {
    return;
  }

  const targets = $$(".reveal-text, .reveal-img, .reveal-card", scope).filter(
    (el) => !el.dataset.revealBound
  );

  if (!targets.length) return;

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const parent = entry.target.parentElement || document;
            const siblings = $$(
              ".reveal-text, .reveal-img, .reveal-card",
              parent
            );
            const idx = siblings.indexOf(entry.target);
            entry.target.style.animationDelay = idx * 0.12 + "s";
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
  }

  targets.forEach((el) => {
    el.dataset.revealBound = "1";
    revealObserver.observe(el);
  });
}

initReveal();

/* ════════════════════════════════════════════════════════
   6. MENU + CART + CHECKOUT
   ════════════════════════════════════════════════════════ */
function initMenuAndCart() {
  const grid = $("#menuGrid");
  const tabs = $$(".menu-tab");
  const searchInput = $("#menuSearchInput");
  const clearSearchBtn = $("#menuClearSearch");
  const scopeButtons = $$(".menu-scope-btn");
  const sortSelect = $("#menuSortSelect");
  const tagFiltersWrap = $("#menuTagFilters");
  const resultsMeta = $("#menuResultsMeta");
  const searchState = $("#menuSearchState");
  const loadMoreBtn = $("#menuLoadMoreBtn");
  const scrollHint = $("#menuScrollHint");

  const openCartBtn = $("#openCartBtn");
  const floatingCartBtn = $("#floatingCartBtn");
  const closeCartBtn = $("#closeCartBtn");
  const cartBackdrop = $("#cartBackdrop");
  const checkoutForm = $("#checkoutForm");
  const upiBox = $("#upiBox");
  const orderPreview = $("#orderPreview");

  const payWithGpayBtn = $("#payWithGpayBtn");
  const upiOriginalTotalEl = $("#upiOriginalTotal");
  const upiDiscountAmountEl = $("#upiDiscountAmount");
  const upiDiscountLabelEl = $("#upiDiscountLabel");
  const upiOfferBadgeEl = $("#upiOfferBadge");
  const upiFinalAmountEl = $("#upiFinalAmount");
  const upiFallbackBox = $("#upiFallbackBox");
  const upiFallbackLink = $("#upiFallbackLink");
  const upiManualAmount = $("#upiManualAmount");
  const orderUpiId = $("#orderUpiId");

  if (!grid || !getMenuCategories().length) return;

  const CATEGORY_LABELS = {
    starters: "Starter",
    mains: "Main Course",
    desserts: "Dessert",
    drinks: "Beverage",
  };
  const availableCategories = getMenuCategories();
  const tabCategoryOrder = tabs
    .map((tab) => tab.dataset.cat)
    .filter(Boolean);

  function getCategoryLabel(category) {
    const configuredLabel = getConfiguredMenuCategoryLabel(category);

    if (configuredLabel) {
      return configuredLabel;
    }

    if (CATEGORY_LABELS[category]) {
      return CATEGORY_LABELS[category];
    }

    const normalized = String(category || "")
      .trim()
      .replace(/[-_]+/g, " ");

    if (!normalized) {
      return "Menu";
    }

    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getInitialMenuCategory() {
    const currentTabCategory = $(".menu-tab.active")?.dataset.cat;

    if (currentTabCategory && availableCategories.includes(currentTabCategory)) {
      return currentTabCategory;
    }

    const firstTabbedCategory = tabCategoryOrder.find((category) =>
      availableCategories.includes(category)
    );

    if (firstTabbedCategory) {
      return firstTabbedCategory;
    }

    return availableCategories[0] || "starters";
  }

  function syncCategoryTabsAvailability() {
    const hasTabbedCategories = tabCategoryOrder.some((category) =>
      availableCategories.includes(category)
    );

    tabs.forEach((tab) => {
      const category = tab.dataset.cat || "";
      const hasItems = availableCategories.includes(category);
      const shouldHide = hasTabbedCategories ? !hasItems : false;

      tab.hidden = shouldHide;
      tab.disabled = hasTabbedCategories ? !hasItems : false;
      tab.setAttribute("aria-hidden", shouldHide ? "true" : "false");

      if (tab.disabled) {
        tab.setAttribute("aria-selected", "false");
      }
    });
  }

  const menuMode = grid.dataset.menuMode || "full";
  const previewLimit = Number(grid.dataset.previewLimit || 4);

  const ALL_ITEMS = flattenMenuData().map((item) => {
    const categoryLabel = getCategoryLabel(item.category);
    const normalizedTags = [
      item.tag,
      item.badge,
      item.name,
      item.desc,
      categoryLabel,
    ]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();

    return {
      ...item,
      normalizedTags: Array.from(
        new Set(
          [item.tag, item.badge, categoryLabel].filter(
            Boolean,
          ),
        ),
      ),
      searchBlob:
        `${item.name} ${item.desc} ${item.tag || ""} ${item.badge || ""} ${categoryLabel}`.toLowerCase(),
    };
  });

  const MENU_STATE = {
    activeCategory: getInitialMenuCategory(),
    searchScope: "category",
    query: "",
    selectedTag: "all",
    sortBy: "featured",
    batchSize: 8,
    visibleCount: menuMode === "preview" ? previewLimit : 8,
  };
  let pendingMenuGridFocusSelectors = [];
  let paymentGatewayScriptPromise = null;

  function shouldUsePreviewMode() {
    return menuMode === "preview";
  }

  function getVisibleLimit() {
    return shouldUsePreviewMode() ? previewLimit : MENU_STATE.visibleCount;
  }

  function getBaseItems() {
    if (MENU_STATE.searchScope === "all") return ALL_ITEMS;
    return ALL_ITEMS.filter(
      (item) => item.category === MENU_STATE.activeCategory,
    );
  }

  function getAvailableTags() {
    const items = getBaseItems();
    const tagSet = new Set();

    items.forEach((item) => {
      item.normalizedTags.forEach((tag) => {
        if (tag && tag.trim()) {
          tagSet.add(tag);
        }
      });
    });

    return ["all", ...Array.from(tagSet)];
  }

  function getMenuGridActionSelector(action, itemId) {
    if (!action || !itemId) return "";
    return `[data-${action}="${escapeAttr(itemId)}"]`;
  }

  function queueMenuGridFocusRestore(itemId, actions = []) {
    pendingMenuGridFocusSelectors = actions
      .map((action) => getMenuGridActionSelector(action, itemId))
      .filter(Boolean);
  }

  function restorePendingMenuGridFocus() {
    if (!pendingMenuGridFocusSelectors.length) return;

    const selectors = [...pendingMenuGridFocusSelectors];
    pendingMenuGridFocusSelectors = [];

    const nextTarget = selectors
      .map((selector) => grid.querySelector(selector))
      .find((node) => node instanceof HTMLElement);

    if (nextTarget instanceof HTMLElement) {
      nextTarget.focus({ preventScroll: true });
    }
  }


  function getSelectedPaymentMethod() {
    return $('input[name="paymentMethod"]:checked')?.value || "COD";
  }

  function isPaymentGatewayBridgeEnabled(paymentMethod = getSelectedPaymentMethod()) {
    const provider = String(CONFIG.PAYMENT_GATEWAY_PROVIDER || "").trim().toLowerCase();
    return (
      CONFIG.PAYMENT_GATEWAY_ENABLED === true &&
      provider === "razorpay" &&
      paymentMethod === "ONLINE_GATEWAY"
    );
  }

  function getPaymentGatewayReadinessState() {
    return PAYMENT_GATEWAY_READINESS &&
      typeof PAYMENT_GATEWAY_READINESS === "object"
      ? PAYMENT_GATEWAY_READINESS
      : {};
  }

  function isPaymentGatewayBackendReady() {
    return getPaymentGatewayReadinessState().checkoutAvailable === true;
  }

  async function refreshPaymentGatewayReadiness() {
    if (!CONFIG.PAYMENT_GATEWAY_ENABLED) {
      PAYMENT_GATEWAY_READINESS = {
        checkoutAvailable: false,
        reason: "frontend_disabled"
      };
      return PAYMENT_GATEWAY_READINESS;
    }

    if (paymentGatewayReadinessPromise) {
      return paymentGatewayReadinessPromise;
    }

    paymentGatewayReadinessPromise = fetch(`${CONFIG.API_BASE_URL}/api/payments/readiness`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success === false) {
          throw new Error(data?.message || "Payment readiness check failed.");
        }

        PAYMENT_GATEWAY_READINESS = data.paymentGateway || {
          checkoutAvailable: false,
          reason: "invalid_readiness_response"
        };

        return PAYMENT_GATEWAY_READINESS;
      })
      .catch((error) => {
        console.warn("Payment gateway readiness unavailable:", error);
        PAYMENT_GATEWAY_READINESS = {
          checkoutAvailable: false,
          reason: "readiness_check_failed"
        };
        return PAYMENT_GATEWAY_READINESS;
      })
      .finally(() => {
        paymentGatewayReadinessPromise = null;
      });

    return paymentGatewayReadinessPromise;
  }

  function isPaymentGatewaySubmitImplemented() {
    return true;
  }

  function isPaymentGatewayCheckoutReady(paymentMethod = getSelectedPaymentMethod()) {
    return (
      isPaymentGatewayBridgeEnabled(paymentMethod) &&
      CONFIG.PAYMENT_GATEWAY_CHECKOUT_ENABLED === true &&
      isPaymentGatewaySubmitImplemented() &&
      isPaymentGatewayBackendReady()
    );
  }

  function getGatewayPaymentMethodLabel(paymentMethod = getSelectedPaymentMethod()) {
    if (paymentMethod === "UPI") return "Google Pay / UPI";
    if (paymentMethod === "ONLINE_GATEWAY") return "Online Payment";
    return paymentMethod || "Online Payment";
  }

  function ensurePaymentGatewayOption() {
    if (!checkoutForm || !CONFIG.PAYMENT_GATEWAY_ENABLED) return null;

    const paymentBox = $(".payment-box", checkoutForm);
    const upiInput = $('input[name="paymentMethod"][value="UPI"]', paymentBox || checkoutForm);
    const upiLabel = upiInput?.closest("label");

    if (!paymentBox || !upiLabel) return null;

    let gatewayOption = $("#paymentGatewayOption", paymentBox);
    if (!gatewayOption) {
      gatewayOption = document.createElement("label");
      gatewayOption.id = "paymentGatewayOption";
      gatewayOption.className = "payment-option payment-gateway-option";
      gatewayOption.innerHTML = `
        <input type="radio" name="paymentMethod" value="ONLINE_GATEWAY" />
        <span class="payment-gateway-copy">
          <strong>Secure Online Payment</strong>
          <small>Test gateway bridge. Manual UPI stays available as fallback.</small>
        </span>
      `;
      upiLabel.insertAdjacentElement("afterend", gatewayOption);
    }

    let gatewayBox = $("#paymentGatewayBox", paymentBox);
    if (!gatewayBox) {
      gatewayBox = document.createElement("div");
      gatewayBox.id = "paymentGatewayBox";
      gatewayBox.className = "payment-gateway-box";
      gatewayBox.hidden = true;
      gatewayBox.innerHTML = `
        <p class="payment-gateway-status">Secure online payment is staged in test mode.</p>
        <p class="payment-gateway-note">
          We will open the verified gateway checkout in the next step. Until then, COD and manual Google Pay / UPI remain the live options.
        </p>
      `;
      gatewayOption.insertAdjacentElement("afterend", gatewayBox);
    }

    return gatewayOption;
  }

  function syncPaymentGatewayOptionUI(paymentMethod = getSelectedPaymentMethod()) {
    const gatewayOption = $("#paymentGatewayOption", checkoutForm || document);
    const gatewayBox = $("#paymentGatewayBox", checkoutForm || document);
    const gatewayInput = gatewayOption?.querySelector('input[name="paymentMethod"]');
    const shouldShowGatewayOption = CONFIG.PAYMENT_GATEWAY_ENABLED === true;
    const isCheckoutReady = isPaymentGatewayCheckoutReady("ONLINE_GATEWAY");
    const isGatewaySelected = paymentMethod === "ONLINE_GATEWAY";

    if (gatewayOption) {
      gatewayOption.hidden = !shouldShowGatewayOption;
      gatewayOption.classList.toggle("is-disabled", shouldShowGatewayOption && !isCheckoutReady);
    }

    if (gatewayInput) {
      gatewayInput.disabled = !shouldShowGatewayOption || !isCheckoutReady;
    }

    if (gatewayBox) {
      gatewayBox.hidden = !shouldShowGatewayOption || !isGatewaySelected;
    }
  }

  function getGatewayOrderContextPayload(orderContext = getActiveOrderContext()) {
    return {
      orderType: orderContext.orderType || "standard",
      tableNumber: orderContext.tableNumber || "",
      orderSource: orderContext.orderSource || "website",
      qrContextToken: orderContext.qrContextToken || ""
    };
  }

  function buildPaymentGatewayInitPayload({
    normalizedCart,
    paymentMethod,
    customerName,
    customerPhone,
    customerAddress,
    note,
    summaryText,
    orderContext
  }) {
    return {
      hotelSlug: getActiveHotelSlug(),
      paymentMethod: getGatewayPaymentMethodLabel(paymentMethod),
      items: normalizedCart.map((item) => ({
        id: item.id,
        qty: item.qty
      })),
      orderContext: getGatewayOrderContextPayload(orderContext),
      orderDraft: {
        hotelName: getActiveHotelName(),
        customerName,
        customerPhone,
        customerAddress,
        note,
        whatsappMessage: summaryText
      }
    };
  }

  async function initPaymentGatewayDraft(initPayload) {
    return postJSON("/api/payments/init", initPayload);
  }

  function getGatewayLinkedOrderId(order) {
    return order?.id === undefined || order?.id === null
      ? ""
      : String(order.id).trim();
  }

  async function recordPaymentGatewayFailure({
    order,
    gatewayOrderId,
    gatewayPaymentId = "",
    reason = "",
    errorCode = "",
    errorSource = "",
    errorStep = ""
  }) {
    const orderId = getGatewayLinkedOrderId(order);
    const linkedGatewayOrderId = gatewayOrderId || "";

    if (!orderId || !linkedGatewayOrderId) {
      return null;
    }

    try {
      return await postJSON("/api/payments/fail", {
        hotelSlug: getActiveHotelSlug(),
        orderId,
        gatewayOrderId: linkedGatewayOrderId,
        gatewayPaymentId,
        reason,
        errorCode,
        errorSource,
        errorStep
      });
    } catch (error) {
      console.warn("Payment failure could not be recorded:", error);
      return null;
    }
  }

  async function reconcilePaymentGatewayOrder({
    order,
    gatewayOrderId
  }) {
    const orderId = getGatewayLinkedOrderId(order);
    const linkedGatewayOrderId = gatewayOrderId || "";

    if (!orderId || !linkedGatewayOrderId) {
      return null;
    }

    try {
      return await postJSON("/api/payments/reconcile", {
        hotelSlug: getActiveHotelSlug(),
        orderId,
        gatewayOrderId: linkedGatewayOrderId
      });
    } catch (error) {
      console.warn("Payment reconciliation failed:", error);
      return null;
    }
  }

  function loadPaymentGatewayScript() {
    if (window.Razorpay) {
      return Promise.resolve(window.Razorpay);
    }

    if (paymentGatewayScriptPromise) {
      return paymentGatewayScriptPromise;
    }

    paymentGatewayScriptPromise = new Promise((resolve, reject) => {
      const scriptUrl =
        CONFIG.PAYMENT_GATEWAY_SCRIPT_URL ||
        "https://checkout.razorpay.com/v1/checkout.js";
      let script = document.querySelector('script[data-payment-gateway="razorpay"]');

      const handleLoad = () => {
        if (window.Razorpay) {
          resolve(window.Razorpay);
          return;
        }

        reject(new Error("Payment gateway checkout did not load correctly."));
      };
      const handleError = () => {
        paymentGatewayScriptPromise = null;
        reject(new Error("Unable to load payment gateway checkout."));
      };

      if (!script) {
        script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        script.dataset.paymentGateway = "razorpay";
        script.addEventListener("load", handleLoad, { once: true });
        script.addEventListener("error", handleError, { once: true });
        document.head.appendChild(script);
        return;
      }

      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
    });

    return paymentGatewayScriptPromise;
  }

  function openPaymentGatewayCheckout({
    RazorpayCheckout,
    payment,
    order,
    customerName,
    customerPhone,
    customerAddress,
    note,
    summaryText,
    orderContext
  }) {
    return new Promise((resolve, reject) => {
      const gatewayOrderId = payment?.gatewayOrderId || "";
      let checkoutSettled = false;

      const resolveOnce = (value) => {
        if (checkoutSettled) return;
        checkoutSettled = true;
        resolve(value);
      };

      const rejectOnce = async (error, failurePayload = null) => {
        if (checkoutSettled) return;
        checkoutSettled = true;

        if (failurePayload) {
          await recordPaymentGatewayFailure(failurePayload);
        }

        reject(error);
      };
      const resolveWithPaidGatewayResult = (verifyResult, response = {}) => {
        resolveOnce({
          verifyResult,
          response,
          summaryText,
          customerAddress,
          note
        });
      };

      if (!RazorpayCheckout || !gatewayOrderId || !payment?.keyId) {
        reject(new Error("Payment gateway order is incomplete."));
        return;
      }

      const checkout = new RazorpayCheckout({
        key: payment.keyId,
        amount: payment.amountMinor,
        currency: payment.currency || "INR",
        name: getActiveHotelName() || "Hotel",
        description: "Food order payment",
        order_id: gatewayOrderId,
        prefill: {
          name: customerName,
          contact: customerPhone
        },
        notes: {
          hotelSlug: getActiveHotelSlug(),
          orderId: getGatewayLinkedOrderId(order),
          tableNumber: orderContext?.tableNumber || "",
          orderSource: orderContext?.orderSource || "website"
        },
        theme: {
          color: "#c9a84c"
        },
        modal: {
          ondismiss: async () => {
            const reconcileResult = await reconcilePaymentGatewayOrder({
              order,
              gatewayOrderId
            });

            if (reconcileResult?.orderUpdated) {
              resolveWithPaidGatewayResult(reconcileResult, {
                razorpay_order_id: gatewayOrderId,
                razorpay_payment_id: reconcileResult.payment?.gatewayPaymentId || ""
              });
              return;
            }

            rejectOnce(new Error("Payment was cancelled."), {
              order,
              gatewayOrderId,
              reason: "checkout_dismissed",
              errorStep: "checkout_modal"
            });
          }
        },
        handler: async (response) => {
          try {
            const verifyResult = await postJSON("/api/payments/verify", {
              hotelSlug: getActiveHotelSlug(),
              orderId: getGatewayLinkedOrderId(order),
              gatewayOrderId: response.razorpay_order_id || gatewayOrderId,
              gatewayPaymentId: response.razorpay_payment_id || "",
              gatewaySignature: response.razorpay_signature || ""
            });

            resolveWithPaidGatewayResult(verifyResult, response);
          } catch (error) {
            const reconcileResult = await reconcilePaymentGatewayOrder({
              order,
              gatewayOrderId
            });

            if (reconcileResult?.orderUpdated) {
              resolveWithPaidGatewayResult(reconcileResult, {
                razorpay_order_id: gatewayOrderId,
                razorpay_payment_id: reconcileResult.payment?.gatewayPaymentId || ""
              });
              return;
            }

            rejectOnce(error);
          }
        }
      });

      checkout.on("payment.failed", (response) => {
        const gatewayError = response?.error || {};
        const gatewayMetadata = gatewayError.metadata || {};
        const message =
          gatewayError.description ||
          gatewayError.reason ||
          "Payment failed. Please try again or use COD / manual UPI.";
        rejectOnce(new Error(message), {
          order,
          gatewayOrderId: gatewayMetadata.order_id || gatewayOrderId,
          gatewayPaymentId: gatewayMetadata.payment_id || "",
          reason: message,
          errorCode: gatewayError.code || "",
          errorSource: gatewayError.source || "",
          errorStep: gatewayError.step || ""
        });
      });

      checkout.open();
    });
  }

  async function handlePaymentGatewayCheckout({
    normalizedCart,
    paymentMethod,
    customerName,
    customerPhone,
    customerAddress,
    note,
    summaryText,
    orderContext
  }) {
    showToast("Preparing secure payment...");

    const initPayload = buildPaymentGatewayInitPayload({
      normalizedCart,
      paymentMethod,
      customerName,
      customerPhone,
      customerAddress,
      note,
      summaryText,
      orderContext
    });
    const initResult = await initPaymentGatewayDraft(initPayload);
    const linkedOrder = initResult?.order || null;

    if (!initResult?.orderLinked || !linkedOrder?.id) {
      throw new Error(
        "Secure payment could not prepare the order. Please use COD or Google Pay / UPI."
      );
    }

    const RazorpayCheckout = await loadPaymentGatewayScript();
    const checkoutResult = await openPaymentGatewayCheckout({
      RazorpayCheckout,
      payment: initResult.payment,
      order: linkedOrder,
      customerName,
      customerPhone,
      customerAddress,
      note,
      summaryText,
      orderContext
    });

    if (!checkoutResult?.verifyResult?.orderUpdated) {
      throw new Error(
        "Payment was verified, but the order could not be marked paid. Please contact the hotel."
      );
    }

    CART = [];
    saveCart();
    updateCartUI();
    renderMenu(MENU_STATE.activeCategory);

    if (checkoutForm) {
      checkoutForm.reset();
      clearCheckoutAddressState(checkoutForm);
    }

    const codInput = document.querySelector('input[name="paymentMethod"][value="COD"]');
    if (codInput) codInput.checked = true;

    closeCartDrawer();
    updatePaymentUI();
    showOrderTrackingPrompt(
      initResult?.tracking,
      "Payment verified. Your live order tracking link is ready."
    );
    showToast(
      initResult?.trackingReady
        ? "Payment verified. Tracking link is ready."
        : "Payment verified. Your order was saved successfully."
    );
  }

  function updateOrderPreview() {
    if (!orderPreview) return;

    if (!CART.length) {
      orderPreview.textContent = "No order yet.";
      return;
    }

    const customerName = $("#orderName")?.value.trim() || "Preview User";
    const customerPhone = $("#orderPhone")?.value.trim() || "Not provided";
    const orderContext = getActiveOrderContext();
    const rawCustomerAddress = $("#orderAddress")?.value.trim() || "";
    const customerAddress =
      getEffectiveCustomerAddress(rawCustomerAddress, orderContext) ||
      "Not provided";
    const note = $("#orderNote")?.value.trim() || "";
    const paymentMethod = getSelectedPaymentMethod();
    const paymentConfirmed = $("#orderPaymentConfirmed")?.checked || false;

    orderPreview.textContent = buildOrderSummaryText({
      customerName,
      customerPhone,
      customerAddress,
      customerTableNote: rawCustomerAddress,
      locationLink: USER_LOCATION || "Not shared",
      paymentMethod,
      note,
      paymentConfirmed,
      orderContext,
    });
  }

  function updatePaymentUI() {
    const paymentMethod = getSelectedPaymentMethod();
    const isUpi = paymentMethod === "UPI";
    const isGatewayBridgeReady = isPaymentGatewayBridgeEnabled(paymentMethod);
    const { normalTotal, upiDiscountPercent, gpayDiscount, gpayFinalTotal } =
      calculatePayableAmounts();

    syncPaymentGatewayOptionUI(paymentMethod);

    if (checkoutForm) {
      checkoutForm.dataset.paymentGatewayReady = isGatewayBridgeReady ? "true" : "false";
      checkoutForm.dataset.paymentGatewayProvider = CONFIG.PAYMENT_GATEWAY_PROVIDER || "";
    }

    if (upiBox) {
      upiBox.hidden = !isUpi;
    }

    if (orderUpiId) {
      orderUpiId.textContent = CONFIG.OWNER_UPI_ID || "";
    }

    if (upiOriginalTotalEl) {
      upiOriginalTotalEl.textContent = formatCurrency(normalTotal);
    }

    if (upiDiscountAmountEl) {
      upiDiscountAmountEl.textContent = `-${formatCurrency(gpayDiscount)}`;
    }

    if (upiDiscountLabelEl) {
      upiDiscountLabelEl.textContent =
        `Google Pay Discount (${formatDiscountPercent(upiDiscountPercent)})`;
    }

    if (upiOfferBadgeEl) {
      upiOfferBadgeEl.textContent = upiDiscountPercent > 0
        ? `Pay with Google Pay and get ${formatDiscountPercent(upiDiscountPercent)} off`
        : "Pay with Google Pay / UPI";
    }

    if (upiFinalAmountEl) {
      upiFinalAmountEl.textContent = formatCurrency(gpayFinalTotal);
    }

    if (upiManualAmount) {
      upiManualAmount.textContent = formatCurrency(gpayFinalTotal);
    }

    if (upiFallbackLink) {
      upiFallbackLink.href = buildUpiLink(gpayFinalTotal);
    }

    if (!isUpi && upiFallbackBox) {
      upiFallbackBox.hidden = true;
    }

    updateCartUI();
    updateOrderPreview();
  }

  async function openGooglePay() {
    const { gpayFinalTotal } = calculatePayableAmounts();
    const upiLink = buildUpiLink(gpayFinalTotal);

    if (upiFallbackLink) {
      upiFallbackLink.href = upiLink;
    }

    if (upiFallbackBox) {
      upiFallbackBox.hidden = false;
    }

    if (!CONFIG.OWNER_UPI_ID) {
      showToast("UPI ID is not configured for this hotel.");
      return;
    }

    if (!isLikelyMobileUpiDevice()) {
      await showManualUpiFallback(
        "Google Pay / UPI app links open on supported mobile devices. Use the details below."
      );
      return;
    }

    try {
      window.location.href = upiLink;
    } catch (error) {
      await showManualUpiFallback(
        "Could not open Google Pay automatically. Use the manual UPI link below.",
      );
      return;
    }

    setTimeout(() => {
      if (upiFallbackBox) {
        upiFallbackBox.hidden = false;
      }
    }, 1200);
  }

  function sortItems(items) {
    const list = [...items];

    switch (MENU_STATE.sortBy) {
      case "price-asc":
        list.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        list.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "popularity":
        list.sort((a, b) => {
          const score = (item) => {
            let s = 0;
            if ((item.badge || "").toLowerCase().includes("popular")) s += 5;
            if ((item.badge || "").toLowerCase().includes("signature")) s += 4;
            if ((item.badge || "").toLowerCase().includes("chef")) s += 3;
            return s;
          };
          return score(b) - score(a);
        });
        break;
      case "featured":
      default:
        break;
    }

    return list;
  }

  function getFilteredItems() {
    let items = getBaseItems();

    if (MENU_STATE.selectedTag !== "all") {
      const selected = MENU_STATE.selectedTag.toLowerCase();
      items = items.filter((item) =>
        item.normalizedTags.some(
          (tag) => String(tag).toLowerCase() === selected,
        ),
      );
    }

    if (MENU_STATE.query.trim()) {
      const q = MENU_STATE.query.trim().toLowerCase();
      items = items.filter((item) => item.searchBlob.includes(q));
    }

    return sortItems(items);
  }

  function syncActiveTabUI() {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.cat === MENU_STATE.activeCategory;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  }

  function syncScopeButtonsUI() {
    scopeButtons.forEach((btn) => {
      const isActive = btn.dataset.scope === MENU_STATE.searchScope;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateClearButtonUI() {
    if (!clearSearchBtn || !searchInput) return;
    const hasValue = !!searchInput.value.trim();
    clearSearchBtn.style.visibility = hasValue ? "visible" : "hidden";
    clearSearchBtn.style.pointerEvents = hasValue ? "auto" : "none";
  }

  function buildTagFilters() {
    if (!tagFiltersWrap) return;

    const tags = getAvailableTags();

    tagFiltersWrap.innerHTML = tags
      .map((tag) => {
        const isActive = MENU_STATE.selectedTag === tag;
        const label = tag === "all" ? "All" : tag;
        return `
        <button
          type="button"
          class="menu-filter-chip${isActive ? " active" : ""}"
          data-tag="${escapeAttr(tag)}"
          aria-pressed="${isActive}"
        >
          ${escapeHTML(label)}
        </button>
      `;
      })
      .join("");
  }

  function updateResultsSummary(filteredItems, visibleItems) {
    if (resultsMeta) {
      const total = filteredItems.length;
      const shown = visibleItems.length;
      const remaining = Math.max(0, total - shown);
      const context =
        MENU_STATE.searchScope === "all"
          ? "across full menu"
          : `in ${getCategoryLabel(MENU_STATE.activeCategory).toLowerCase()}`;
      const remainingText =
        !shouldUsePreviewMode() && remaining > 0
          ? ` ${remaining} more available.`
          : "";

      resultsMeta.textContent =
        `${shown} of ${total} dishes shown ${context}.` + remainingText;
    }

    if (searchState) {
      const bits = [
        MENU_STATE.searchScope === "all"
          ? "Scope: Full Menu"
          : `Scope: ${getCategoryLabel(MENU_STATE.activeCategory)}`
      ];
      if (MENU_STATE.query.trim())
        bits.push(`Search: "${MENU_STATE.query.trim()}"`);
      if (MENU_STATE.selectedTag !== "all")
        bits.push(`Tag: ${MENU_STATE.selectedTag}`);
      searchState.textContent = bits.join(" • ");
    }
  }

  function renderEmptyState() {
    const activeQuery = MENU_STATE.query.trim();
    const activeTag = MENU_STATE.selectedTag !== "all" ? MENU_STATE.selectedTag : "";
    const scopeLabel =
      MENU_STATE.searchScope === "all"
        ? "the full menu"
        : getCategoryLabel(MENU_STATE.activeCategory);
    const detailParts = [];

    if (activeQuery) {
      detailParts.push(`for "${escapeHTML(activeQuery)}"`);
    }

    if (activeTag) {
      detailParts.push(`with tag "${escapeHTML(activeTag)}"`);
    }

    const detailText = detailParts.length ? ` ${detailParts.join(" ")}` : "";
    const scopeText =
      MENU_STATE.searchScope === "all"
        ? `across ${scopeLabel}`
        : `in ${escapeHTML(scopeLabel)}`;

    grid.innerHTML = `
      <div class="menu-empty-state glass-card">
        <i class="fas fa-search" aria-hidden="true"></i>
        <h3>No matching dishes found</h3>
        <p>No dishes matched${detailText} ${scopeText}.</p>
        <p>Try changing search, switching scope, or clearing tag filters.</p>
      </div>
    `;
  }



  function addToCartWithLocation(itemId) {
    if (!hasDineInOrderContext()) {
      getUserLiveLocation();
    }
    addToCart(itemId);
    showToast("Added to cart");
  }

  function attachDynamicHoverAndTilt() {
    if (window.innerWidth < 768) return;

    const cards = $$(".menu-card", grid);
    cards.forEach((card) => {
      card.addEventListener("mouseenter", () => {
        const ring = $("#cursorRing");
        if (ring) ring.classList.add("hovered");
      });

      card.addEventListener("mouseleave", () => {
        const ring = $("#cursorRing");
        if (ring) ring.classList.remove("hovered");
        card.style.transform = "";
      });

      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        card.style.transform = `
          perspective(600px)
          rotateY(${x * 5}deg)
          rotateX(${-y * 5}deg)
          translateY(-8px)
          scale(1.015)
        `;
      });
    });
  }

  function createMenuCard(item, index, showCategoryPill) {
    const qty = getItemQty(item.id);
    const inlineTags = item.normalizedTags.slice(0, 3);

    return `
      <article class="menu-card" role="article" style="animation-delay:${index * 0.05}s">
        ${createImageMarkup({
          src: item.image,
          alt: item.alt || item.name,
          badge: item.badge,
          name: item.name,
        })}

        <div class="menu-card-body">
          <div class="menu-card-head">
            <h3 class="menu-card-name">${escapeHTML(item.name)}</h3>
            ${showCategoryPill ? `<span class="menu-card-category">${escapeHTML(getCategoryLabel(item.category))}</span>` : ""}
          </div>

          <p class="menu-card-desc">${escapeHTML(item.desc || "")}</p>

          ${
            inlineTags.length
              ? `
            <div class="menu-card-tags">
              ${inlineTags.map((tag) => `<span class="menu-inline-tag">${escapeHTML(tag)}</span>`).join("")}
            </div>
          `
              : ""
          }

          <div class="menu-card-footer">
            <span class="menu-card-price">${formatCurrency(item.price)}</span>
            ${item.tag ? `<span class="menu-card-tag">${escapeHTML(item.tag)}</span>` : ""}
          </div>

          <div class="menu-card-actions">
            ${
              qty > 0
                ? `
                  <div class="qty-control">
                    <button type="button" class="qty-btn" data-minus="${escapeAttr(item.id)}" aria-label="Decrease quantity">−</button>
                    <span class="qty-value">${qty}</span>
                    <button type="button" class="qty-btn" data-plus="${escapeAttr(item.id)}" aria-label="Increase quantity">+</button>
                  </div>
                  <button type="button" class="remove-mini-btn" data-remove="${escapeAttr(item.id)}">Remove</button>
                `
                : `
                  <button type="button" class="btn btn-primary menu-add-btn" data-add="${escapeAttr(item.id)}">
                    Add
                  </button>
                `
            }
          </div>
        </div>
      </article>
    `;
  }

  window.renderMenu = function renderMenu(
    category = MENU_STATE.activeCategory,
    options = {},
  ) {
    const { resetVisible = false } = options;
    const nextCategory = availableCategories.includes(category)
      ? category
      : availableCategories.includes(MENU_STATE.activeCategory)
        ? MENU_STATE.activeCategory
        : getInitialMenuCategory();

    MENU_STATE.activeCategory = nextCategory || MENU_STATE.activeCategory;
    grid.dataset.activeCategory = MENU_STATE.activeCategory;

    if (resetVisible && !shouldUsePreviewMode()) {
      MENU_STATE.visibleCount = MENU_STATE.batchSize;
    }

    syncCategoryTabsAvailability();
    syncActiveTabUI();
    syncScopeButtonsUI();
    updateClearButtonUI();
    buildTagFilters();

    const filteredItems = getFilteredItems();
    const visibleItems = filteredItems.slice(0, getVisibleLimit());
    const showCategoryPill = MENU_STATE.searchScope === "all";

    if (!filteredItems.length) {
      updateResultsSummary(filteredItems, visibleItems);
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      if (scrollHint) scrollHint.hidden = true;
      renderEmptyState();
      restorePendingMenuGridFocus();
      return;
    }

    grid.innerHTML = visibleItems
      .map((item, i) => createMenuCard(item, i, showCategoryPill))
      .join("");

    initManagedImages(grid);

    const remaining = filteredItems.length - visibleItems.length;

    if (loadMoreBtn) {
      loadMoreBtn.hidden = shouldUsePreviewMode() || remaining <= 0;
      const loadMoreLabel = getConfiguredCtaLabel("loadMore") || "Load More";
      const loadMoreHint = formatConfiguredCountLabel(
        getConfiguredCtaLabel("loadMoreHint"),
        remaining,
        `${remaining} more dishes`
      );
      loadMoreBtn.innerHTML =
        remaining > 0
          ? `<span>${escapeHTML(loadMoreLabel)}</span><small>${escapeHTML(loadMoreHint)}</small>`
          : `<span>${escapeHTML(loadMoreLabel)}</span>`;
    }

    if (scrollHint) {
      const scrollHintLabel = $("span", scrollHint);
      scrollHint.hidden = shouldUsePreviewMode() || remaining <= 0;

      if (scrollHintLabel) {
        const fallbackHint =
          remaining > 0
            ? `Explore ${remaining} more dish${remaining === 1 ? "" : "es"} below`
            : "Explore more dishes below";

        scrollHintLabel.textContent = formatConfiguredCountLabel(
          getConfiguredCtaLabel("menuScrollHint"),
          remaining,
          fallbackHint
        );
      }
    }

    updateResultsSummary(filteredItems, visibleItems);
    attachDynamicHoverAndTilt();
    restorePendingMenuGridFocus();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      MENU_STATE.activeCategory = tab.dataset.cat;
      MENU_STATE.selectedTag = "all";
      MENU_STATE.visibleCount = MENU_STATE.batchSize;
      renderMenu(tab.dataset.cat, { resetVisible: true });
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      MENU_STATE.query = searchInput.value.trim();
      MENU_STATE.visibleCount = MENU_STATE.batchSize;
      renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        MENU_STATE.query = "";
        searchInput.value = "";
        MENU_STATE.visibleCount = MENU_STATE.batchSize;
        updateClearButtonUI();
        renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
        searchInput.blur();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!MENU_STATE.query.trim()) return;

    MENU_STATE.query = "";
    MENU_STATE.visibleCount = MENU_STATE.batchSize;

    if (searchInput) searchInput.value = "";
    updateClearButtonUI();
    renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
  });

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      MENU_STATE.query = "";
      MENU_STATE.visibleCount = MENU_STATE.batchSize;

      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }

      updateClearButtonUI();
      renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
    });
  }

  scopeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      MENU_STATE.searchScope = btn.dataset.scope;
      MENU_STATE.selectedTag = "all";
      MENU_STATE.visibleCount = MENU_STATE.batchSize;
      renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      MENU_STATE.sortBy = sortSelect.value;
      MENU_STATE.visibleCount = MENU_STATE.batchSize;
      renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
    });
  }

  if (tagFiltersWrap) {
    tagFiltersWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tag]");
      if (!btn) return;

      const selected = btn.dataset.tag || "all";

      MENU_STATE.selectedTag =
        MENU_STATE.selectedTag === selected && selected !== "all"
          ? "all"
          : selected;

      MENU_STATE.visibleCount = MENU_STATE.batchSize;
      renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      if (shouldUsePreviewMode()) return;
      MENU_STATE.visibleCount += MENU_STATE.batchSize;
      renderMenu(MENU_STATE.activeCategory);
    });
  }

  if (openCartBtn) openCartBtn.addEventListener("click", openCartDrawer);
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCartDrawer);
  if (cartBackdrop) cartBackdrop.addEventListener("click", closeCartDrawer);
  if (floatingCartBtn)
    floatingCartBtn.addEventListener("click", openCartDrawer);

  ensurePaymentGatewayOption();

  $$('input[name="paymentMethod"]').forEach((input) => {
    input.addEventListener("change", updatePaymentUI);
  });

  refreshPaymentGatewayReadiness().then(() => {
    updatePaymentUI();
  });

  if (payWithGpayBtn) {
    payWithGpayBtn.addEventListener("click", openGooglePay);
  }

  if (upiFallbackLink) {
    upiFallbackLink.addEventListener("click", (event) => {
      if (isLikelyMobileUpiDevice()) return;

      event.preventDefault();
      showManualUpiFallback(
        "Manual UPI links need a supported mobile UPI app. Use the details below."
      );
    });
  }

  [
    "#orderName",
    "#orderPhone",
    "#orderAddress",
    "#orderNote",
    "#orderPaymentConfirmed",
  ].forEach((selector) => {
    const el = $(selector);
    if (!el) return;

    const eventName =
      el.tagName === "INPUT" && el.type === "checkbox" ? "change" : "input";
    el.addEventListener(eventName, updateOrderPreview);
  });

  grid.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;

    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.add) {
      queueMenuGridFocusRestore(btn.dataset.add, ["plus", "remove", "add"]);
      addToCartWithLocation(btn.dataset.add);
      return;
    }

    if (btn.dataset.plus) {
      queueMenuGridFocusRestore(btn.dataset.plus, ["plus", "minus", "remove", "add"]);
      updateCartQty(btn.dataset.plus, 1);
      return;
    }

    if (btn.dataset.minus) {
      queueMenuGridFocusRestore(btn.dataset.minus, ["minus", "plus", "add"]);
      updateCartQty(btn.dataset.minus, -1);
      return;
    }

    if (btn.dataset.remove) {
      queueMenuGridFocusRestore(btn.dataset.remove, ["add"]);
      removeFromCart(btn.dataset.remove);
    }
  });

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const normalizedCart = normalizeCartItems(CART);
  const hotelName = getActiveHotelName();
  const payableAmounts = calculatePayableAmounts(normalizedCart);

  if (!normalizedCart.length) {
    showToast("Your cart is empty.");
    return;
  }

  const orderContext = getActiveOrderContext();
  const customerName = document.getElementById("orderName")?.value.trim();
  const customerPhone = document.getElementById("orderPhone")?.value.trim();
  const rawCustomerAddress = document.getElementById("orderAddress")?.value.trim() || "";
  const customerAddress = getEffectiveCustomerAddress(
    rawCustomerAddress,
    orderContext,
  );
  const note = document.getElementById("orderNote")?.value.trim() || "";

  const paymentMethod = 
    document.querySelector('input[name="paymentMethod"]:checked')?.value || "COD";

  const paymentConfirmed = !!document.getElementById("orderPaymentConfirmed")?.checked;

  if (paymentMethod === "ONLINE_GATEWAY" && !isPaymentGatewayCheckoutReady(paymentMethod)) {
    showToast("Secure online payment is not live yet. Please use COD or Google Pay / UPI.");
    return;
  }

  if (!customerName || !customerPhone || !customerAddress) {
    showToast(
      hasDineInOrderContext(orderContext)
        ? "Please enter your name and phone number."
        : "Please fill all required order details."
    );
    return;
  }

  if (customerName.length < 2) {
    showToast("Please enter a valid name.");
    return;
  }

  if (customerPhone.length < 8) {
    showToast("Please enter a valid phone number.");
    return;
  }

  if (!hasDineInOrderContext(orderContext) && customerAddress.length < 3) {
    showToast("Please enter a Proper delivery address.");
    return;
  }

  if (paymentMethod === "UPI" && !paymentConfirmed) {
    showToast("Please confirm your Google Pay / UPI payment.");
    return;
  }

  const locationLink = USER_LOCATION || "Permission denied";

  // Build the clean summary text
  const summaryText = buildOrderSummaryText({
    customerName,
    customerPhone,
    customerAddress,
    customerTableNote: rawCustomerAddress,
    locationLink,
    paymentMethod,
    note,
    paymentConfirmed,
    items: normalizedCart,
    orderContext,
  });

  // Show in preview
  if (orderPreview) orderPreview.textContent = summaryText;

  const isAddonOrder = hasActiveOrderAddonContext(orderContext);

  if (isAddonOrder && paymentMethod === "ONLINE_GATEWAY") {
    showToast("Secure online payment is not available for add-on items yet. Please use COD or Google Pay / UPI.");
    return;
  }

  if (paymentMethod === "ONLINE_GATEWAY") {
    try {
      await handlePaymentGatewayCheckout({
        normalizedCart,
        paymentMethod,
        customerName,
        customerPhone,
        customerAddress,
        note,
        summaryText,
        orderContext
      });
    } catch (error) {
      console.error("Secure payment checkout failed:", error);
      showToast(error.message || "Secure payment failed. Please use COD or Google Pay / UPI.");
    }
    return;
  }

  const orderItemsPayload = normalizedCart.map(item => ({
    id: item.id,
    name: item.name,
    qty: item.qty,
    price: item.price
  }));
  const paymentMethodLabel = paymentMethod === "UPI" ? "Google Pay / UPI" : "COD";
  const orderContextPayload = hasDineInOrderContext(orderContext)
    ? {
        orderType: orderContext.orderType,
        tableNumber: orderContext.tableNumber,
        orderSource: orderContext.orderSource,
        qrContextToken: orderContext.qrContextToken || ""
      }
    : undefined;
  const endpoint = isAddonOrder
    ? `/api/order-tracking/${encodeURIComponent(getActiveHotelSlug())}/${encodeURIComponent(orderContext.addToOrderId)}/add-items`
    : "/api/orders";
  const payload = isAddonOrder
    ? {
        token: orderContext.addToken,
        note,
        paymentMethod: paymentMethodLabel,
        paymentConfirmed,
        items: orderItemsPayload.map((item) => ({
          id: item.id,
          qty: item.qty
        }))
      }
    : {
        hotelName,
        hotelSlug: getActiveHotelSlug(),
        customerName,
        customerPhone,
        customerAddress,
        locationLink,
        note,
        paymentMethod: paymentMethodLabel,
        paymentConfirmed,
        totals: payableAmounts,
        whatsappMessage: summaryText,
        orderContext: orderContextPayload,
        items: orderItemsPayload
      };

  let waLink;
  let tracking = null;

  try {
    const result = await postJSON(endpoint, payload);
    const approvedSummaryText =
      result?.preview || result?.order?.whatsapp_message || summaryText;
    const activeHotelWhatsappLink = cleanPhone(CONFIG.OWNER_WHATSAPP_NUMBER)
      ? ownerWhatsAppLink(approvedSummaryText)
      : "";
    waLink = result.ownerWhatsappLink || activeHotelWhatsappLink || ownerWhatsAppLink(approvedSummaryText);
    tracking = result?.trackingReady ? result.tracking : null;
  } catch (error) {
    console.warn("Backend save failed, using direct WhatsApp fallback", error);
    if (error?.status >= 400 && error.status < 500) {
      showToast(error.message || "Order details are invalid. Please refresh and try again.");
      return;
    }
    waLink = ownerWhatsAppLink(summaryText);
  }

  // Clear cart
  CART = [];
  saveCart();
  updateCartUI();
  renderMenu(MENU_STATE.activeCategory);

  // Reset form
  e.target.reset();
  clearCheckoutAddressState(e.target);
  const codInput = document.querySelector('input[name="paymentMethod"][value="COD"]');
  if (codInput) codInput.checked = true;

  closeCartDrawer();
  updatePaymentUI();

  // Finally open WhatsApp with the summary
  openWhatsAppSafely(waLink);

  showOrderTrackingPrompt(tracking);
  showToast(
    tracking
      ? "Order saved. Tracking link is ready."
      : "Order sent to WhatsApp successfully!"
  );
}

function bindCheckoutForm() {
  const checkoutForm = document.getElementById("checkoutForm");
  if (!checkoutForm || checkoutForm.dataset.boundSubmit === "true") return;

  checkoutForm.addEventListener("submit", handleCheckoutSubmit);
  checkoutForm.dataset.boundSubmit = "true";
}

  loadCart();
  updateCartUI();
  bindCartDelegation();
  WhatsAppFallback.bind();
  syncOrderContextUI();
  renderMenu(MENU_STATE.activeCategory, { resetVisible: true });
  updatePaymentUI();
  updateOrderPreview();
  bindCheckoutForm();
  renderRecentOrderTrackingShortcut();
}


/* ════════════════════════════════════════════════════════
   7. TESTIMONIALS SLIDER
   ════════════════════════════════════════════════════════ */
(function initTestimonials() {
  const track = $("#testimonialsTrack");
  const dotsWrap = $("#testiDots");
  const prevBtn = $("#testPrev");
  const nextBtn = $("#testNext");
  if (!track || typeof TESTIMONIALS_DATA === "undefined") return;

  let current = 0;
  let autoTimer = null;

  TESTIMONIALS_DATA.forEach((t, i) => {
    const stars = "★".repeat(t.stars) + "☆".repeat(5 - t.stars);
    const card = document.createElement("div");
    card.className = "testi-card";
    card.setAttribute("role", "tabpanel");
    card.setAttribute("aria-label", `Testimonial ${i + 1}`);
    card.innerHTML = `
      <div class="testi-quote" aria-hidden="true">"</div>
      <p class="testi-text">${t.text}</p>
      <div class="testi-author">
        <div class="testi-avatar">
          <img src="${t.avatar}" alt="${t.name}" loading="lazy" />
        </div>
        <div class="testi-stars" aria-label="${t.stars} out of 5 stars">${stars}</div>
        <strong class="testi-name">${t.name}</strong>
        <span class="testi-role">${t.role}</span>
      </div>
    `;
    track.appendChild(card);
  });

  TESTIMONIALS_DATA.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.className = "testi-dot" + (i === 0 ? " active" : "");
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-label", `Go to testimonial ${i + 1}`);
    btn.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(btn);
  });

  function goTo(idx) {
    current = (idx + TESTIMONIALS_DATA.length) % TESTIMONIALS_DATA.length;
    track.style.transform = `translateX(-${current * 100}%)`;

    $$(".testi-dot", dotsWrap).forEach((d, i) =>
      d.classList.toggle("active", i === current),
    );
  }

  if (prevBtn)
    prevBtn.addEventListener("click", () => {
      goTo(current - 1);
      resetAuto();
    });
  if (nextBtn)
    nextBtn.addEventListener("click", () => {
      goTo(current + 1);
      resetAuto();
    });

  function startAuto() {
    autoTimer = setInterval(() => goTo(current + 1), 5000);
  }

  function resetAuto() {
    clearInterval(autoTimer);
    startAuto();
  }

  let touchStartX = 0;
  track.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true },
  );
  track.addEventListener("touchend", (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      goTo(diff > 0 ? current + 1 : current - 1);
      resetAuto();
    }
  });

  startAuto();
})();

/* ════════════════════════════════════════════════════════
   8. GALLERY LIGHTBOX
   ════════════════════════════════════════════════════════ */
const GalleryLightbox = (() => {
  let current = 0;
  let isBound = false;

  function getItems() {
    const gallerySection = $("#gallery");
    return gallerySection ? $$(".gallery-item", gallerySection) : [];
  }

  function getImages() {
    return getItems().map((item) => {
      const img = item.querySelector("img");
      return {
        src: img ? img.src.replace(/w=\d+/, "w=1200") : "",
        alt: img ? img.alt : "",
      };
    });
  }

  function openLightbox(idx) {
    const lightbox = $("#lightbox");
    const lbImg = $("#lightboxImg");
    const closeBtn = $("#lightboxClose");
    const images = getImages();

    if (!lightbox || !lbImg || !images.length || !images[idx]) return;

    current = idx;
    lbImg.src = images[current].src;
    lbImg.alt = images[current].alt;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";

    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function closeLightbox() {
    const lightbox = $("#lightbox");
    const items = getItems();

    if (!lightbox) return;

    lightbox.hidden = true;
    document.body.style.overflow = "";

    if (items[current]) {
      items[current].focus();
    }
  }

  function navigate(dir) {
    const lbImg = $("#lightboxImg");
    const images = getImages();

    if (!lbImg || !images.length) return;

    current = (current + dir + images.length) % images.length;
    lbImg.style.opacity = "0";
    setTimeout(() => {
      lbImg.src = images[current].src;
      lbImg.alt = images[current].alt;
      lbImg.style.opacity = "1";
    }, 200);
  }

  function bindItems() {
    getItems().forEach((item, i) => {
      item.setAttribute("tabindex", "0");
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", `View image ${i + 1}`);

      item.onclick = () => openLightbox(i);
      item.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(i);
        }
      };
    });
  }

  function bindControls() {
    const lightbox = $("#lightbox");
    const lbImg = $("#lightboxImg");
    const closeBtn = $("#lightboxClose");
    const prevBtn = $("#lightboxPrev");
    const nextBtn = $("#lightboxNext");

    if (!lightbox || isBound) return;

    if (lbImg) {
      lbImg.style.transition = "opacity 0.2s ease";
    }

    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    if (prevBtn) prevBtn.addEventListener("click", () => navigate(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => navigate(1));

    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    });

    isBound = true;
  }

  return {
    init() {
      if (!$("#lightbox")) return;
      bindItems();
      bindControls();
    },
  };
})();

/* ════════════════════════════════════════════════════════
   9. GOOGLE SHEET HELPER
   ════════════════════════════════════════════════════════ */
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby-lmCsB31TzVVKzxmBJdQk9cgVBDHcGlnr2730VZq6R_b7d9Odmd3BG6IFAJz9Li9RMA/exec";

async function sendToSheet(data) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

/* ════════════════════════════════════════════════════════
   10. CONTACT FORM
   ════════════════════════════════════════════════════════ */
(function initContactForm() {
  const form = $("#contactForm");
  const success = $("#ctSuccess");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = {
      formType: "Contact",
      name: $("#ctName", form)?.value.trim(),
      email: $("#ctEmail", form)?.value.trim(),
      subject: $("#ctSubject", form)?.value.trim(),
      message: $("#ctMessage", form)?.value.trim(),
    };

    const sheetResult = await sendToSheet(data);
    const hotelName = getActiveHotelName();
    const hotelSlug = getActiveHotelSlug();

    if (hotelName && hotelSlug) {
      try {
        await saveContactSubmission({
          hotelName,
          hotelSlug,
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
          googleSheetStatus: sheetResult ? "saved" : "failed",
          googleSheetResponse:
            sheetResult && typeof sheetResult === "object" && !Array.isArray(sheetResult)
              ? sheetResult
              : {}
        });
      } catch (error) {
        console.warn("Contact DB save failed; Google Sheet flow preserved:", error);
      }
    } else {
      console.warn("Contact DB save skipped: hotel context unavailable.");
    }

    form.style.display = "none";
    success.hidden = false;

    setTimeout(() => {
      success.hidden = true;
      form.style.display = "block";
      form.reset();
    }, 5000);
  });
})();

/* ════════════════════════════════════════════════════════
   13. SMOOTH SCROLL FOR ANCHOR LINKS
   ════════════════════════════════════════════════════════ */
(function initSmoothScroll() {
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();

      const navH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--nav-h",
          ),
        ) || 80;
      const top = target.getBoundingClientRect().top + window.scrollY - navH;

      window.scrollTo({ top, behavior: "smooth" });

      const waPopup = $("#waPopup");
      if (waPopup) waPopup.style.display = "none";
    });
  });
})();

/* ════════════════════════════════════════════════════════
   14. ACTIVE NAV LINK ON SCROLL
   ════════════════════════════════════════════════════════ */
(function initActiveNav() {
  const sections = $$("section[id]");
  const links = $$('.nav-link[href^="#"]');
  if (!sections.length || !links.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach((link) => {
            link.classList.toggle(
              "active-link",
              link.getAttribute("href") === "#" + id,
            );
          });
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
  );

  sections.forEach((s) => observer.observe(s));
})();

/* ════════════════════════════════════════════════════════
   15. FOOTER YEAR
   ════════════════════════════════════════════════════════ */
(function initFooterYear() {
  const el = $("#footerYear");
  if (el) el.textContent = new Date().getFullYear();
})();

/* ════════════════════════════════════════════════════════
   16. PARALLAX ON ABOUT IMAGES
   ════════════════════════════════════════════════════════ */
(function initParallax() {
  const main = $(".about-img-main");
  const sub = $(".about-img-sub");
  if (!main || !sub) return;
  if (window.innerWidth < 768) return;

  window.addEventListener(
    "scroll",
    () => {
      const aboutSection = $("#about");
      if (!aboutSection) return;

      const rect = aboutSection.getBoundingClientRect();
      const windowH = window.innerHeight;

      if (rect.top < windowH && rect.bottom > 0) {
        const progress = (windowH - rect.top) / (windowH + rect.height);
        const shift = (progress - 0.5) * 40;
        main.style.transform = `translateY(${shift * 0.5}px)`;
        sub.style.transform = `translateY(${-shift * 0.7}px)`;
      }
    },
    { passive: true },
  );
})();

/* ════════════════════════════════════════════════════════
   17. CARD TILT EFFECT ON EVENT CARDS
   ════════════════════════════════════════════════════════ */
(function initTilt() {
  if (window.innerWidth < 768) return;

  const cards = $$(".event-card");
  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `
        perspective(600px)
        rotateY(${x * 6}deg)
        rotateX(${-y * 6}deg)
        translateY(-8px)
        scale(1.02)
      `;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
})();

/* ════════════════════════════════════════════════════════
   18. HERO GRADIENT SHIFTS
   ════════════════════════════════════════════════════════ */
(function initHeroGradient() {
  const hero = $(".hero");
  const overlay = $(".hero-overlay");
  if (!hero || !overlay) return;

  let hue = 30;
  setInterval(() => {
    hue += 0.05;
    const r = 15 + Math.sin(hue * 0.1) * 3;
    overlay.style.background = `linear-gradient(${135 + Math.sin(hue * 0.05) * 10}deg,
      rgba(${r},12,8,0.85) 0%,
      rgba(${r},12,8,0.55) 60%,
      rgba(${r},12,8,0.75) 100%)`;
  }, 50);
})();

/* ════════════════════════════════════════════════════════
   19. COUNTER ANIMATION FOR STATS
   ════════════════════════════════════════════════════════ */
(function initCounters() {
  const stats = $$(".stat-num");
  if (!stats.length) return;

  const targets = [1999, 4, 50];
  const suffixes = ["", ".5", "k+"];
  let animated = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting || animated) return;
      animated = true;

      stats.forEach((el, i) => {
        const target = targets[i];
        let current = 0;
        const step = target / 40;

        const timer = setInterval(() => {
          current = Math.min(current + step, target);

          if (i === 1) {
            el.textContent =
              current >= 4 ? "4.5" : Math.floor(current).toString();
          } else {
            el.textContent = Math.floor(current) + (suffixes[i] || "");
          }

          if (current >= target) clearInterval(timer);
        }, 35);
      });
    },
    { threshold: 0.6 },
  );

  const heroStats = $(".hero-stats");
  if (heroStats) observer.observe(heroStats);
})();

/* ════════════════════════════════════════════════════════
   20. ACTIVE LINK STYLE
   ════════════════════════════════════════════════════════ */
(function initDynamicStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .nav-link.active-link { color: var(--gold) !important; }
    .nav-link.active-link::after { width: 100% !important; }
    .navbar.scrolled .nav-link.active-link { color: var(--gold) !important; }

    .global-toast {
      position: fixed;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%) translateY(20px);
      background: rgba(12, 12, 12, 0.92);
      color: #fff;
      padding: 12px 18px;
      border-radius: 999px;
      z-index: 9999;
      font-size: 14px;
      opacity: 0;
      pointer-events: none;
      transition: 0.3s ease;
    }

    .global-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(style);
})();

/* ════════════════════════════════════════════════════════
   21. WHATSAPP QUICK POPUP
   ════════════════════════════════════════════════════════ */
(function initWhatsAppPopup() {
  const waBtn = $("#whatsappBtn");
  const waPopup = $("#waPopup");

  if (!waBtn || !waPopup) return;

  waBtn.addEventListener("click", () => {
    waPopup.style.display =
      waPopup.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!waPopup.contains(e.target) && !waBtn.contains(e.target)) {
      waPopup.style.display = "none";
    }
  });

  $$(".wa-action-link", waPopup).forEach((link) => {
    link.addEventListener("click", () => {
      waPopup.style.display = "none";
    });
  });
})();


function setHTML(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = value || "";
}

function setLink(id, href, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.href = href || "#";
  el.textContent = text || "";
}

function renderEventsSection() {
  const hotel = window.APP_STATE?.hotel;
  const events = hotel?.events;
  if (!events) return;

  setText("eventsEyebrow", events.eyebrow);
  setText("eventsTitle", events.title);
  setText("eventsSubtitle", events.subtitle);

  const wrap = document.getElementById("eventsCards");
  if (!wrap) return;

  wrap.innerHTML = (events.cards || [])
    .map(
      (card) => `
        <article class="event-card reveal-card">
          <i class="${escapeAttr(card.icon || "fas fa-star")}" aria-hidden="true"></i>
          <h3>${escapeHTML(card.title || "")}</h3>
          <p>${escapeHTML(card.text || "")}</p>
        </article>
      `
    )
    .join("");
}

function renderReservationSection() {
  const reservation = window.APP_STATE?.hotel?.reservation;
  if (!reservation) return;

  setText("reservationEyebrow", reservation.eyebrow);
  setText("reservationTitle", reservation.title);
  setText("reservationSubtitle", reservation.subtitle);
}

function renderContactSection() {
  const hotel = window.APP_STATE?.hotel;
  const contact = hotel?.contact;
  const section = hotel?.contactSection;
  const location = hotel?.location;

  if (section) {
    setText("contactEyebrow", section.eyebrow);
    setText("contactTitle", section.title);
    setText("contactSubtitle", section.subtitle);
  }

  if (contact?.phone) {
    setLink("contactPhone", `tel:${contact.phone.replace(/\s+/g, "")}`, contact.phone);
    setLink("footerPhone", `tel:${contact.phone.replace(/\s+/g, "")}`, contact.phone);
  }

  if (contact?.email) {
    setLink("contactEmail", `mailto:${contact.email}`, contact.email);
    setLink("footerEmail", `mailto:${contact.email}`, contact.email);
  }

  setText("contactAddress", contact?.address || "");
  setText("footerAddress", contact?.address || "");

  const mapFrame = document.getElementById("contactMapEmbed");
  if (mapFrame && location?.mapEmbedUrl) {
    mapFrame.src = location.mapEmbedUrl;
  }

  const mapLink = document.getElementById("contactMapLink");
  if (mapLink && location?.mapLink) {
    mapLink.href = location.mapLink;
  }
}

function renderFooterSection() {
  const hotel = window.APP_STATE?.hotel;
  if (!hotel) return;

  setText("footerBrandName", hotel.hotelName || "");
  setText("footerCopyrightName", hotel.hotelName || "Hotel");
  setText("footerDescription", hotel.footer?.description || "");
  renderFooterOpeningHours(hotel.footer?.openingHours);
}

function normalizeFooterOpeningHourRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const label = String(row.label || row.day || row.name || "").trim();
  const value = String(row.value || row.hours || row.time || "").trim();

  if (!label || !value) {
    return null;
  }

  return { label, value };
}

function renderFooterOpeningHours(openingHours) {
  const list = document.getElementById("footerHoursList");
  if (!list) return;

  if (!list.dataset.fallbackHtml) {
    list.dataset.fallbackHtml = list.innerHTML;
  }

  const rows = Array.isArray(openingHours)
    ? openingHours.map((row) => normalizeFooterOpeningHourRow(row)).filter(Boolean)
    : [];

  if (!rows.length) {
    list.innerHTML = list.dataset.fallbackHtml;
    return;
  }

  list.innerHTML = rows
    .map(
      (row) => `
        <li>
          <span>${escapeHTML(row.label)}</span>
          <span>${escapeHTML(row.value)}</span>
        </li>
      `
    )
    .join("");
}

function getEventInquiryPayload(values = {}) {
  return {
    hotelName: CONFIG.HOTEL_NAME,
    hotelSlug: getActiveHotelSlug(),           // ← Added
    name: values.name,
    phone: values.phone,
    eventType: values.eventType,
    date: values.date,
    guests: values.guests,
    specialRequirements: values.specialRequirements || ""
  };
}

function getReservationPayload(values = {}) {
  return {
    hotelName: CONFIG.HOTEL_NAME,
    hotelSlug: getActiveHotelSlug(),           // ← Added
    name: values.name,
    phone: values.phone,
    date: values.date,
    time: values.time,
    guests: values.guests,
    note: values.note || ""
  };
}


async function saveInquiry(payload) {
  return postJSON("/api/inquiries", payload);
}

async function saveReservation(payload) {
  return postJSON("/api/reservations", payload);
}

async function saveContactSubmission(payload) {
  return postJSON("/api/contact-submissions", payload);
}

async function saveTestimonialReview(payload) {
  return postJSON("/api/testimonials", payload);
}

function getUserLiveLocation() {
  if (!navigator.geolocation) {
    USER_LOCATION = "Not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      USER_LOCATION = `https://maps.google.com/?q=${latitude},${longitude}`;
    },
    () => {
      USER_LOCATION = "Permission denied";
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

function getActiveHotelSlug() {
  return (
    window.APP_STATE?.activeHotelSlug ||
    window.APP_RUNTIME_CONFIG?.DEFAULT_HOTEL_SLUG ||
    ""
  );
}

function withHotelSlug(path) {
  const slug = getActiveHotelSlug();
  return buildHotelAwareHref(path, slug);
}

function buildHotelAwareHref(rawHref, hotelSlug) {
  const normalizedHref = typeof rawHref === "string" ? rawHref.trim() : "";
  const normalizedSlug = typeof hotelSlug === "string" ? hotelSlug.trim() : "";

  if (!normalizedHref || !normalizedSlug) {
    return normalizedHref;
  }

  try {
    const url = new URL(normalizedHref, window.location.href);
    const pathname = url.pathname.toLowerCase();
    let basePath = "";

    if (pathname.endsWith("/menu.html") || pathname.endsWith("menu.html")) {
      basePath = "menu.html";
    } else if (pathname.endsWith("/index.html") || pathname.endsWith("index.html")) {
      basePath = "index.html";
    } else {
      return normalizedHref;
    }

    url.searchParams.set("hotel", normalizedSlug);

    const orderContextParams = getCurrentOrderContextLinkParams();
    if (
      orderContextParams.tableNumber &&
      !url.searchParams.has("table") &&
      !url.searchParams.has("tableNumber")
    ) {
      url.searchParams.set("table", orderContextParams.tableNumber);
    }

    if (orderContextParams.tableNumber && orderContextParams.orderSource && !url.searchParams.has("source")) {
      url.searchParams.set("source", orderContextParams.orderSource);
    }

    if (orderContextParams.qrContextToken && !url.searchParams.has("qctx")) {
      url.searchParams.set("qctx", orderContextParams.qrContextToken);
    }

    const search = url.searchParams.toString();

    return `${basePath}${search ? `?${search}` : ""}${url.hash || ""}`;
  } catch (error) {
    return normalizedHref;
  }
}

function getCurrentOrderContextLinkParams() {
  const params = new URLSearchParams(window.location.search);
  const activeOrderContext = getActiveOrderContext();
  const tableNumber =
    params.get("table") ||
    params.get("tableNumber") ||
    activeOrderContext.tableNumber ||
    "";
  const orderSource =
    params.get("source") ||
    activeOrderContext.orderSource ||
    (tableNumber ? "qr" : "");
  const qrContextToken =
    params.get("qctx") ||
    params.get("qrContextToken") ||
    activeOrderContext.qrContextToken ||
    "";

  return {
    tableNumber: normalizeOrderContextText(tableNumber, 80),
    orderSource: normalizeOrderContextText(orderSource, 40),
    qrContextToken: normalizeOrderContextText(qrContextToken, 2000)
  };
}

function updateHotelAwareLinks(hotelSlug = getActiveHotelSlug()) {
  const normalizedSlug = typeof hotelSlug === "string" ? hotelSlug.trim() : "";
  if (!normalizedSlug) return;

  document
    .querySelectorAll('a[href^="menu.html"], a[href^="index.html"]')
    .forEach((link) => {
      const rawHref = link.getAttribute("href");
      if (!rawHref) return;

      const nextHref = buildHotelAwareHref(rawHref, normalizedSlug);
      if (nextHref) {
        link.setAttribute("href", nextHref);
      }
    });
}

function markAppReady() {
  document.body.classList.remove("app-booting");
  document.body.classList.add("app-ready");
  document.dispatchEvent(new Event("app:ready"));
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const isMenuPage = document.body.classList.contains("menu-page");
    const queryHotelSlug =
      typeof getHotelSlugFromQuery === "function" ? getHotelSlugFromQuery() : "";

    if (queryHotelSlug) {
      updateHotelAwareLinks(queryHotelSlug);
    }

    await loadAppData({
      includeGallery: !isMenuPage,
      includeTestimonials: !isMenuPage
    });
    applyLoadingScreenFromState();
    applyThemeFromState();
    applyHotelConfigFromState();
    renderHotelContent();
    renderTestimonialsSection(window.APP_STATE?.testimonials || []);
    updateHotelAwareLinks();
    applySectionVisibilityFromState();
    bindReservationForm();
    bindEventInquiryForm();
    bindTestimonialReviewForm();
    initMenuAndCart();

    markAppReady();
    console.log("App data loaded successfully", window.APP_STATE);
  } catch (error) {
    console.error("App bootstrap failed:", error);
    markAppReady();
  }
});
