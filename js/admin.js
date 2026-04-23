"use strict";

// const API_BASE = "http://localhost:5000/api/admin";

function getDefaultAdminApiBaseUrl() {
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

const BASE_API =
  window.APP_RUNTIME_CONFIG?.API_BASE_URL || getDefaultAdminApiBaseUrl();

const API_BASE = `${BASE_API}/admin`;
const AUTH_API_BASE = `${BASE_API}/auth`;
const UPLOAD_API_BASE = `${BASE_API}/admin/upload`;

const TAB_LABELS = {
  orders: "orders",
  reservations: "reservations",
  inquiries: "inquiries",
  "contact-submissions": "contact messages",
  "notification-events": "notification events",
  hotels: "hotels",
  "gallery-items": "gallery items",
  "menu-items": "menu items",
  testimonials: "testimonials"
};

// ====================== UPLOAD BUTTON ======================
const uploadBtn = document.getElementById("openUploadSectionBtn");

if (uploadBtn) {
  uploadBtn.addEventListener("click", () => {
    const isVisible = setSectionVisibility("uploadSection");
    if (isVisible) {
      scrollSectionIntoView("uploadSection");
    }
  });
}

const ADMIN_TOKEN_KEY = "hotel_platform_admin_token";

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

const state = {
  activeTab: "orders",
  hotels: [],
  orders: [],
  reservations: [],
  inquiries: [],
  contactSubmissions: [],
  notificationEvents: [],
  notificationEventMaxRetries: 3,
  galleryItems: [],
  menuItems: [],
  testimonials: [],
  menuItemSearchQuery: "",
  profileHeroBase: {},
  profileHeroHotelSlug: "",
  profileThemeBase: {},
  profileThemeHotelSlug: "",
  profileThemeSectionOrderDirty: false
};

const PROFILE_THEME_DEFAULTS = {
  colors: {
    primary: "#c9a84c",
    primaryLight: "#e8d08a",
    primaryDark: "#a07830",
    background: "#fbf8f3",
    backgroundAlt: "#f3ede3",
    text: "#333333",
    textMuted: "#6b6b6b"
  },
  radius: {
    base: "16px",
    small: "8px"
  }
};

const PROFILE_THEME_FONT_PRESETS = {
  default: {
    display: "\"Cormorant Garamond\", Georgia, serif",
    body: "\"Jost\", sans-serif"
  },
  system: {
    display: "Georgia, serif",
    body: "system-ui, sans-serif"
  }
};

const PROFILE_THEME_CONTAINER_PRESETS = {
  compact: "1120px",
  default: "1280px",
  wide: "1440px"
};

const PROFILE_THEME_BUTTON_PRESETS = {
  default: "default",
  solid: "solid",
  crisp: "crisp"
};

const PROFILE_THEME_HERO_LAYOUT_PRESETS = {
  default: "default",
  split: "split",
  stacked: "stacked"
};

const PROFILE_THEME_HERO_LAYOUT_LABELS = {
  default: "Default",
  split: "Split",
  stacked: "Stacked"
};

const PROFILE_HERO_SCENE_PRESETS = {
  default: "default",
  luxury: "luxury",
  warm: "warm",
  minimal: "minimal",
  family: "family"
};

const PROFILE_THEME_SECTION_ORDER = [
  "about",
  "menu",
  "reservation",
  "events",
  "gallery",
  "testimonials",
  "contact"
];

const PROFILE_THEME_SECTION_LABELS = {
  about: "About",
  menu: "Menu",
  reservation: "Reservation",
  events: "Events",
  gallery: "Gallery",
  testimonials: "Testimonials",
  contact: "Contact"
};

const THEME_FOUNDATION_VERSION = "24.6-foundation";



function $(selector, scope = document) {
  return scope.querySelector(selector);
}

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeValue(value = "") {
  return String(value).trim().toLowerCase();
}

function getHotelFilterValue() {
  return $("#hotelFilter")?.value.trim() || "";
}

function setHotelFilterValue(value = "") {
  const select = $("#hotelFilter");
  if (!select) return;
  select.value = value;
}

function getSelectedHotel() {
  const filterValue = getHotelFilterValue();
  if (!filterValue) return null;

  const normalizedFilter = normalizeValue(filterValue);

  return (
    state.hotels.find((hotel) => {
      const slug = normalizeValue(hotel.slug);
      const name = normalizeValue(hotel.name);
      return slug === normalizedFilter || name === normalizedFilter;
    }) || null
  );
}

function getSelectedHotelName() {
  return getSelectedHotel()?.name || "";
}

function getSelectedHotelSlug() {
  const selectedHotel = getSelectedHotel();
  if (selectedHotel?.slug) return selectedHotel.slug;
  return getHotelFilterValue();
}

function getLoadingLabel(activeTab = state.activeTab) {
  return TAB_LABELS[activeTab] || "dashboard";
}

function toTitleLabel(value = "") {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderAdminScopeSummary() {
  const tabValue = document.getElementById("adminScopeTabValue");
  const hotelValue = document.getElementById("adminScopeHotelValue");
  const helpText = document.getElementById("adminScopeHelp");

  if (!tabValue || !hotelValue || !helpText) return;

  const selectedHotel = getSelectedHotel();
  const selectedHotelSlug = getSelectedHotelSlug();
  const activeTabLabel = toTitleLabel(getLoadingLabel());
  const hotelScopeLabel = selectedHotel?.name
    ? `${selectedHotel.name}${selectedHotel.slug ? ` (${selectedHotel.slug})` : ""}`
    : selectedHotelSlug
      ? selectedHotelSlug
      : "All Hotels";

  tabValue.textContent = activeTabLabel;
  hotelValue.textContent = hotelScopeLabel;
  helpText.textContent = selectedHotel || selectedHotelSlug
    ? `${activeTabLabel} is currently filtered to one hotel. Supported editor forms will reuse this scope automatically.`
    : `${activeTabLabel} is currently showing all hotels. Choose a hotel filter when you want narrower records and editor defaults.`;
}

function normalizeQrLinkValue(value = "", maxLength = 100) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function syncQrTableLinkHotelSlug({ force = false } = {}) {
  const input = document.getElementById("qrLinkHotelSlugInput");
  if (!input) return;

  const selectedHotelSlug = getSelectedHotelSlug();
  if (selectedHotelSlug && (force || !input.value.trim())) {
    input.value = selectedHotelSlug;
  }
}

function buildQrTableOrderUrl({ hotelSlug, tableNumber, targetPage, qrContextToken = "" }) {
  const safePage = targetPage === "index.html" ? "index.html" : "menu.html";
  const url = new URL(safePage, window.location.href);

  url.search = "";
  url.hash = safePage === "index.html" ? "menu" : "";
  url.searchParams.set("hotel", hotelSlug);
  url.searchParams.set("table", tableNumber);
  url.searchParams.set("source", "qr");
  if (qrContextToken) {
    url.searchParams.set("qctx", qrContextToken);
  }

  return url.href;
}

function updateQrTableLinkOutput(link = "", message = "", summary = "") {
  const output = document.getElementById("qrTableLinkOutput");
  const preview = document.getElementById("qrTableLinkPreview");
  const help = document.getElementById("qrTableLinkHelp");
  const summaryEl = document.getElementById("qrTableLinkSummary");

  if (output) output.value = link;
  if (preview) {
    preview.href = link || "#";
    preview.setAttribute("aria-disabled", link ? "false" : "true");
  }
  if (help) {
    help.textContent = message || (link ? "Use this URL in your QR code tool." : "No QR link generated yet.");
  }
  if (summaryEl) {
    summaryEl.textContent = summary || "No QR table selected yet.";
  }
}

async function fetchSignedQrContextToken({ hotelSlug, tableNumber, orderSource = "qr" }) {
  const result = await fetchJson(`${API_BASE}/qr-links/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      hotelSlug,
      tableNumber,
      orderSource
    })
  });

  return String(result?.qrContextToken || "").trim();
}

async function generateQrTableLink() {
  const hotelSlug = normalizeQrLinkValue(
    document.getElementById("qrLinkHotelSlugInput")?.value,
    120
  );
  const tableNumber = normalizeQrLinkValue(
    document.getElementById("qrLinkTableNumberInput")?.value,
    80
  );
  const targetPage =
    document.getElementById("qrLinkTargetPageInput")?.value || "menu.html";

  if (!hotelSlug || !tableNumber) {
    updateQrTableLinkOutput("", "Enter hotel slug and table number first.");
    return "";
  }

  let qrContextToken = "";
  let helperMessage = "";

  try {
    qrContextToken = await fetchSignedQrContextToken({
      hotelSlug,
      tableNumber,
      orderSource: "qr"
    });
  } catch (error) {
    console.warn("QR link signing failed, using legacy link:", error.message);
    helperMessage = "Signed QR token is unavailable right now. Generated a legacy link so your current QR flow still works.";
  }

  const link = buildQrTableOrderUrl({
    hotelSlug,
    tableNumber,
    targetPage,
    qrContextToken
  });
  updateQrTableLinkOutput(
    link,
    helperMessage,
    `QR target: ${hotelSlug} / ${tableNumber} / ${targetPage === "index.html" ? "Homepage menu section" : "Full menu page"}`
  );
  return link;
}

async function copyQrTableLink() {
  const output = document.getElementById("qrTableLinkOutput");
  const link = output?.value.trim() || await generateQrTableLink();

  if (!link) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
    } else if (output) {
      output.select();
      document.execCommand("copy");
    }
    updateQrTableLinkOutput(link, "Copied. Use this URL in your QR code tool.");
  } catch (error) {
    console.error("QR table link copy failed:", error);
    updateQrTableLinkOutput(link, "Copy failed. Select the generated link manually.");
  }
}

function buildAdminStateBadge(label = "", tone = "neutral") {
  return `<span class="admin-state-badge is-${tone}">${escapeHTML(label)}</span>`;
}

function buildBooleanStateBadge(
  value,
  {
    onLabel = "Enabled",
    offLabel = "Disabled",
    onTone = "success",
    offTone = "warning"
  } = {}
) {
  return buildAdminStateBadge(
    value ? onLabel : offLabel,
    value ? onTone : offTone
  );
}

function getAdminListScopeLabel() {
  const selectedHotel = getSelectedHotel();
  const selectedHotelSlug = getSelectedHotelSlug();

  if (selectedHotel?.name) {
    return `${selectedHotel.name}${selectedHotel.slug ? ` (${selectedHotel.slug})` : ""}`;
  }

  if (selectedHotelSlug) {
    return selectedHotelSlug;
  }

  return "All Hotels";
}

function buildAdminListSummaryCard({
  title = "List Overview",
  count = 0,
  description = ""
} = {}) {
  return `
    <div class="admin-card admin-list-summary">
      <h3>${escapeHTML(title)}</h3>
      ${
        description
          ? `<p class="admin-toolbar-help">${escapeHTML(description)}</p>`
          : ""
      }
      <div class="status-row">
        <span class="status-badge">Records: ${escapeHTML(count)}</span>
        <span class="status-badge">Scope: ${escapeHTML(getAdminListScopeLabel())}</span>
      </div>
    </div>
    `;
}

function normalizeSearchText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function filterMenuItemsBySearchQuery(menuItems = [], searchQuery = "") {
  const normalizedQuery = normalizeSearchText(searchQuery);

  if (!normalizedQuery) {
    return menuItems;
  }

  return menuItems.filter((item) => {
    const searchableFields = [
      item?.name,
      item?.category,
      item?.item_id,
      item?.description,
      item?.badge,
      item?.tag,
      item?.alt,
      item?.hotel_slug
    ];

    return searchableFields.some((fieldValue) =>
      normalizeSearchText(fieldValue).includes(normalizedQuery)
    );
  });
}

async function fetchJson(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  const token = getAdminToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function buildUrl(endpoint) {
  const hotelName = getSelectedHotelName();
  if (!hotelName) return `${API_BASE}/${endpoint}`;

  const params = new URLSearchParams({ hotelName });
  return `${API_BASE}/${endpoint}?${params.toString()}`;
}

function getFilteredHotels() {
  const selectedHotel = getSelectedHotel();
  if (!selectedHotel) return state.hotels;

  return state.hotels.filter((hotel) => String(hotel.id) === String(selectedHotel.id));
}

function syncMenuFormHotelSlug({ force = false } = {}) {
  const input = document.getElementById("menuHotelSlugInput");
  const idField = document.getElementById("menuItemDbId");
  if (!input) return;

  const isEditingExistingItem = !!idField?.value.trim();
  if (isEditingExistingItem) return;

  const hotelSlug = getSelectedHotelSlug();

  if (force || !input.value.trim()) {
    input.value = hotelSlug || "";
  }
}

function syncGalleryFormHotelSlug({ force = false } = {}) {
  const input = document.getElementById("galleryHotelSlugInput");
  const idField = document.getElementById("galleryItemDbId");
  if (!input) return;

  const isEditingExistingItem = !!idField?.value.trim();
  if (isEditingExistingItem) return;

  const hotelSlug = getSelectedHotelSlug();

  if (force || !input.value.trim()) {
    input.value = hotelSlug || "";
  }
}

function syncTestimonialFormHotelSlug({ force = false } = {}) {
  const input = document.getElementById("testimonialHotelSlugInput");
  const idField = document.getElementById("testimonialDbId");
  if (!input) return;

  const isEditingExistingItem = !!idField?.value.trim();
  if (isEditingExistingItem) return;

  const hotelSlug = getSelectedHotelSlug();

  if (force || !input.value.trim()) {
    input.value = hotelSlug || "";
  }
}

function syncNotificationSettingsHotelSlug({ force = false } = {}) {
  const input = document.getElementById("notificationSettingsHotelSlugInput");
  if (!input) return;

  const hotelSlug = getSelectedHotelSlug();

  if (force || !input.value.trim()) {
    input.value = hotelSlug || "";
  }
}

function syncPaymentRouteSettingsHotelSlug({ force = false } = {}) {
  const input = document.getElementById("paymentRouteHotelSlugInput");
  if (!input) return;

  const hotelSlug = getSelectedHotelSlug();

  if (force || !input.value.trim()) {
    input.value = hotelSlug || "";
  }
}

function resetHotelForm() {
  const form = document.getElementById("hotelForm");
  if (!form) return;

  form.reset();
  const idField = document.getElementById("hotelId");
  const activeField = document.getElementById("hotelIsActiveInput");

  if (idField) idField.value = "";
  if (activeField) activeField.checked = true;
}

function resetMenuItemForm() {
  const form = document.getElementById("menuItemForm");
  if (!form) return;

  form.reset();
  const idField = document.getElementById("menuItemDbId");
  const availableField = document.getElementById("menuIsAvailableInput");

  if (idField) idField.value = "";
  if (availableField) availableField.checked = true;

  syncMenuFormHotelSlug({ force: true });
}

function resetGalleryItemForm() {
  const form = document.getElementById("galleryItemForm");
  if (!form) return;

  form.reset();
  const idField = document.getElementById("galleryItemDbId");
  const layoutField = document.getElementById("galleryLayoutVariantInput");
  const activeField = document.getElementById("galleryIsActiveInput");

  if (idField) idField.value = "";
  if (layoutField) layoutField.value = "standard";
  if (activeField) activeField.checked = true;

  syncGalleryFormHotelSlug({ force: true });
}

function resetTestimonialForm() {
  const form = document.getElementById("testimonialForm");
  if (!form) return;

  form.reset();
  const idField = document.getElementById("testimonialDbId");
  const starsField = document.getElementById("testimonialStarsInput");
  const activeField = document.getElementById("testimonialIsActiveInput");
  const approvedField = document.getElementById("testimonialIsApprovedInput");

  if (idField) idField.value = "";
  if (starsField) starsField.value = "5";
  if (activeField) activeField.checked = true;
  if (approvedField) approvedField.checked = true;

  syncTestimonialFormHotelSlug({ force: true });
}

function fillNotificationSettingsForm(settings = {}) {
  document.getElementById("notificationSettingsHotelSlugInput").value =
    settings.hotelSlug || "";
  document.getElementById("notificationOwnerEmailInput").value =
    settings.ownerEmail || "";
  document.getElementById("notificationEmailEnabledInput").checked =
    !!settings.emailEnabled;
  document.getElementById("notificationNotifyOrderInput").checked =
    settings.notifyOnNewOrder !== false;
  document.getElementById("notificationNotifyReservationInput").checked =
    settings.notifyOnNewReservation !== false;
  document.getElementById("notificationNotifyInquiryInput").checked =
    settings.notifyOnNewInquiry !== false;
}

function resetNotificationSettingsForm() {
  fillNotificationSettingsForm({
    hotelSlug: "",
    ownerEmail: "",
    emailEnabled: false,
    notifyOnNewOrder: true,
    notifyOnNewReservation: true,
    notifyOnNewInquiry: true
  });
}

function fillPaymentRouteSettingsForm(settings = {}) {
  const help = document.getElementById("paymentRouteSettingsHelp");

  document.getElementById("paymentRouteHotelSlugInput").value =
    settings.hotelSlug || "";
  document.getElementById("paymentRouteProviderInput").value =
    settings.provider || "razorpay";
  document.getElementById("paymentRouteLinkedAccountInput").value =
    settings.razorpayLinkedAccountId || "";
  document.getElementById("paymentRouteEnabledInput").checked =
    !!settings.routeEnabled;

  if (help) {
    help.textContent = "Route settings loaded. Current checkout is unchanged until Route checkout is enabled later.";
  }
}

function resetPaymentRouteSettingsForm() {
  fillPaymentRouteSettingsForm({
    hotelSlug: "",
    provider: "razorpay",
    routeEnabled: false,
    razorpayLinkedAccountId: ""
  });
}

function setSectionVisibility(id, shouldShow) {
  const el = document.getElementById(id);
  if (!el) return false;

  const isHidden = getComputedStyle(el).display === "none";
  const nextVisibleState = typeof shouldShow === "boolean" ? shouldShow : isHidden;

  el.style.display = nextVisibleState ? "block" : "none";
  return nextVisibleState;
}

function scrollSectionIntoView(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadHotels() {
  const result = await fetchJson(`${API_BASE}/hotels`);
  state.hotels = result.hotels || [];
  renderHotelFilter();
  renderAdminScopeSummary();
}

async function loadTabData() {
  const content = $("#adminContent");
  renderAdminScopeSummary();
  if (content) {
    content.innerHTML = `<p class="loading-state">Loading ${escapeHTML(getLoadingLabel())}...</p>`;
  }

  if (state.activeTab === "orders") {
    const result = await fetchJson(buildUrl("orders"));
    state.orders = result.orders || [];
    renderOrders();
    return;
  }

  if (state.activeTab === "reservations") {
    const result = await fetchJson(buildUrl("reservations"));
    state.reservations = result.reservations || [];
    renderReservations();
    return;
  }

  if (state.activeTab === "inquiries") {
    const result = await fetchJson(buildUrl("inquiries"));
    state.inquiries = result.inquiries || [];
    renderInquiries();
    return;
  }

  if (state.activeTab === "contact-submissions") {
    const hotelSlug = getSelectedHotelSlug();
    const result = await fetchJson(
      hotelSlug
        ? `${API_BASE}/contact-submissions?hotelSlug=${encodeURIComponent(hotelSlug)}`
        : `${API_BASE}/contact-submissions`
    );
    state.contactSubmissions = result.contactSubmissions || [];
    renderContactSubmissions();
    return;
  }

  if (state.activeTab === "notification-events") {
    const hotelSlug = getSelectedHotelSlug();
    const result = await fetchJson(
      hotelSlug
        ? `${API_BASE}/notification-events?hotelSlug=${encodeURIComponent(hotelSlug)}`
        : `${API_BASE}/notification-events`
    );

    state.notificationEvents = result.notificationEvents || [];
    const maxRetries = Number.parseInt(
      String(result.notificationEventMaxRetries ?? ""),
      10
    );
    state.notificationEventMaxRetries =
      Number.isFinite(maxRetries) && maxRetries > 0 ? maxRetries : 3;
    renderNotificationEvents();
    return;
  }

  if (state.activeTab === "hotels") {
    renderHotels();
    return;
  }

  if (state.activeTab === "menu-items") {
    const hotelSlug = getSelectedHotelSlug();
    const result = await fetchJson(
      hotelSlug
        ? `${API_BASE}/menu-items?hotelSlug=${encodeURIComponent(hotelSlug)}`
        : `${API_BASE}/menu-items`
    );

    state.menuItems = result.menuItems || [];
    renderMenuItems();
    return;
  }

  if (state.activeTab === "gallery-items") {
    const hotelSlug = getSelectedHotelSlug();
    const result = await fetchJson(
      hotelSlug
        ? `${API_BASE}/gallery-items?hotelSlug=${encodeURIComponent(hotelSlug)}`
        : `${API_BASE}/gallery-items`
    );

    state.galleryItems = result.galleryItems || [];
    renderGalleryItems();
    return;
  }

  if (state.activeTab === "testimonials") {
    const hotelSlug = getSelectedHotelSlug();
    const result = await fetchJson(
      hotelSlug
        ? `${API_BASE}/testimonials?hotelSlug=${encodeURIComponent(hotelSlug)}`
        : `${API_BASE}/testimonials`
    );

    state.testimonials = result.testimonials || [];
    renderTestimonialsAdminList();
    return;
  }

  if (content) {
    content.innerHTML = `<p class="empty-state">Select a valid dashboard section.</p>`;
  }
}

function renderMenuItems() {
  const content = $("#adminContent");
  if (!content) return;
  const searchQuery = String(state.menuItemSearchQuery || "");
  const filteredMenuItems = filterMenuItemsBySearchQuery(
    state.menuItems,
    searchQuery
  );
  const menuCountLabel = searchQuery.trim()
    ? `${filteredMenuItems.length} of ${state.menuItems.length}`
    : state.menuItems.length;

  if (!state.menuItems.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Menu Items",
        count: 0,
        description: "Browse menu records for the current hotel scope."
      })}
      <p class="empty-state">No menu items found.</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Menu Items",
      count: menuCountLabel,
      description: "Browse menu records for the current hotel scope."
    })}
    <div class="admin-card admin-list-summary">
      <div class="admin-list-toolbar">
        <input
          class="admin-list-search"
          type="search"
          data-menu-item-search
          value="${escapeHTML(searchQuery)}"
          placeholder="Search by name, category, item ID, description, badge, tag, or hotel slug" />
        <p class="admin-list-helper-text">
          ${
            searchQuery.trim()
              ? escapeHTML(
                  `Showing ${filteredMenuItems.length} matching menu items in the current scope.`
                )
              : "Search filters only the menu items already loaded for the current hotel scope."
          }
        </p>
      </div>
    </div>
    ${
      filteredMenuItems.length
        ? `
    <div class="admin-grid">
      ${filteredMenuItems
        .map(
          (item) => `
            <article class="admin-card">
              <h3>${escapeHTML(item.name || "")}</h3>
              <div class="admin-meta">${escapeHTML(item.hotel_slug || "")} • ${escapeHTML(item.category || "")}</div>

              <div class="admin-row"><strong>DB ID:</strong> ${escapeHTML(item.id)}</div>
              <div class="admin-row"><strong>Item ID:</strong> ${escapeHTML(item.item_id || "")}</div>
              <div class="admin-row"><strong>Price:</strong> ₹${escapeHTML(item.price ?? "")}</div>
              <div class="admin-row"><strong>Badge:</strong> ${escapeHTML(item.badge || "")}</div>
              <div class="admin-row"><strong>Tag:</strong> ${escapeHTML(item.tag || "")}</div>
              <div class="admin-row admin-state-line">
                <strong>State:</strong>
                <div class="admin-state-list">
                  ${buildBooleanStateBadge(item.is_available, {
                    onLabel: "Available",
                    offLabel: "Unavailable",
                    onTone: "success",
                    offTone: "warning"
                  })}
                  ${buildBooleanStateBadge(item.is_archived, {
                    onLabel: "Archived",
                    offLabel: "Live",
                    onTone: "danger",
                    offTone: "neutral"
                  })}
                </div>
              </div>
              <div class="admin-row"><strong>Sort Order:</strong> ${escapeHTML(item.sort_order ?? "")}</div>

              <div class="status-row admin-card-actions">
                <button class="status-btn" data-edit-menu-item data-id="${escapeHTML(item.id)}">
                  Edit Menu Item
                </button>

                <button 
                  class="status-btn" 
                  data-toggle-menu-archive 
                  data-id="${escapeHTML(item.id)}" 
                  data-archived="${escapeHTML(String(item.is_archived))}">
                  ${item.is_archived ? "Restore Menu Item" : "Archive Menu Item"}
                </button>

                <button 
                  class="status-btn" 
                  data-delete-menu-item 
                  data-id="${escapeHTML(item.id)}">
                  Delete Menu Item
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
    `
        : `<p class="empty-state">No menu items match the current search.</p>`
    }
  `;
}

function renderGalleryItems() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.galleryItems.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Gallery Items",
        count: 0,
        description: "Browse gallery records for the current hotel scope."
      })}
      <p class="empty-state">No gallery items found.</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Gallery Items",
      count: state.galleryItems.length,
      description: "Browse gallery records for the current hotel scope."
    })}
    <div class="admin-grid">
      ${state.galleryItems
        .map(
          (item) => `
            <article class="admin-card">
              <h3>${escapeHTML(item.alt || `Gallery Item #${item.id || ""}`)}</h3>
              <div class="admin-meta">${escapeHTML(item.hotel_slug || "")} • ${escapeHTML(item.layout_variant || "standard")}</div>

              <div class="admin-row"><strong>DB ID:</strong> ${escapeHTML(item.id ?? "")}</div>
              <div class="admin-row"><strong>Image URL:</strong> ${escapeHTML(item.image_url || "")}</div>
              <div class="admin-row"><strong>Storage Path:</strong> ${escapeHTML(item.storage_path || "")}</div>
              <div class="admin-row admin-state-line">
                <strong>State:</strong>
                <div class="admin-state-list">
                  ${buildBooleanStateBadge(item.is_active, {
                    onLabel: "Active",
                    offLabel: "Inactive",
                    onTone: "success",
                    offTone: "warning"
                  })}
                  ${buildBooleanStateBadge(item.is_archived, {
                    onLabel: "Archived",
                    offLabel: "Live",
                    onTone: "danger",
                    offTone: "neutral"
                  })}
                </div>
              </div>
              <div class="admin-row"><strong>Sort Order:</strong> ${escapeHTML(item.sort_order ?? "")}</div>

              <div class="status-row admin-card-actions">
                <button class="status-btn" data-edit-gallery-item data-id="${escapeHTML(item.id)}">
                  Edit Gallery Item
                </button>

                ${
                  item.is_archived
                    ? `
                <button
                  class="status-btn"
                  data-toggle-gallery-archive
                  data-id="${escapeHTML(item.id)}"
                  data-archived="${escapeHTML(String(item.is_archived))}">
                  Restore Gallery Item
                </button>

                <button
                  class="status-btn"
                  data-delete-gallery-item
                  data-id="${escapeHTML(item.id)}">
                  Delete Gallery Item
                </button>
                `
                    : `
                <button
                  class="status-btn"
                  data-toggle-gallery-active
                  data-id="${escapeHTML(item.id)}"
                  data-active="${escapeHTML(String(item.is_active))}">
                  ${item.is_active ? "Deactivate Gallery Item" : "Activate Gallery Item"}
                </button>

                <button
                  class="status-btn"
                  data-toggle-gallery-archive
                  data-id="${escapeHTML(item.id)}"
                  data-archived="${escapeHTML(String(item.is_archived))}">
                  Archive Gallery Item
                </button>
                `
                }
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTestimonialsAdminList() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.testimonials.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Testimonials",
        count: 0,
        description: "Browse hotel-specific testimonial records for the current scope."
      })}
      <p class="empty-state">No testimonials found.</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Testimonials",
      count: state.testimonials.length,
      description: "Browse hotel-specific testimonial records for the current scope."
    })}
    <div class="admin-grid">
      ${state.testimonials
        .map(
          (item) => `
            <article class="admin-card">
              <h3>${escapeHTML(item.guest_name || item.name || `Testimonial #${item.id || ""}`)}</h3>
              <div class="admin-meta">${escapeHTML(item.hotel_slug || item.hotelSlug || "")} • ${escapeHTML(item.guest_role || item.role || "Guest")}</div>

              <div class="admin-row"><strong>DB ID:</strong> ${escapeHTML(item.id ?? "")}</div>
              <div class="admin-row"><strong>Review:</strong> ${escapeHTML(item.review_text || item.text || "")}</div>
              <div class="admin-row"><strong>Stars:</strong> ${escapeHTML(item.star_rating ?? item.stars ?? "")}</div>
              <div class="admin-row"><strong>Avatar URL:</strong> ${escapeHTML(item.avatar_url || item.avatar || "")}</div>
              <div class="admin-row admin-state-line">
                <strong>State:</strong>
                <div class="admin-state-list">
                  ${buildBooleanStateBadge(item.is_active, {
                    onLabel: "Active",
                    offLabel: "Inactive",
                    onTone: "success",
                    offTone: "warning"
                  })}
                  ${buildBooleanStateBadge(item.is_approved, {
                    onLabel: "Approved",
                    offLabel: "Pending",
                    onTone: "success",
                    offTone: "warning"
                  })}
                  ${buildBooleanStateBadge(item.is_archived, {
                    onLabel: "Archived",
                    offLabel: "Live",
                    onTone: "danger",
                    offTone: "neutral"
                  })}
                </div>
              </div>
              <div class="admin-row"><strong>Sort Order:</strong> ${escapeHTML(item.sort_order ?? item.sortOrder ?? "")}</div>
              <div class="admin-row"><strong>Created At:</strong> ${escapeHTML(item.created_at || "")}</div>

              <div class="status-row admin-card-actions">
                <button class="status-btn" data-edit-testimonial data-id="${escapeHTML(item.id)}">
                  Edit Testimonial
                </button>
                <button
                  class="status-btn"
                  data-toggle-testimonial-approval
                  data-id="${escapeHTML(item.id)}"
                  data-approved="${escapeHTML(String(item.is_approved !== false))}">
                  ${item.is_approved !== false ? "Mark Pending" : "Approve Testimonial"}
                </button>
                <button
                  class="status-btn"
                  data-toggle-testimonial-archive
                  data-id="${escapeHTML(item.id)}"
                  data-archived="${escapeHTML(String(item.is_archived === true))}">
                  ${item.is_archived === true ? "Restore Testimonial" : "Archive Testimonial"}
                </button>
                <button
                  class="status-btn"
                  data-delete-testimonial
                  data-id="${escapeHTML(item.id)}">
                  Delete Testimonial
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function normalizeNotificationEventStatus(value = "") {
  const status = String(value || "").trim().toLowerCase();
  const supportedStatuses = ["pending", "sent", "failed", "skipped"];

  return supportedStatuses.includes(status) ? status : "unknown";
}

function buildNotificationStatusCounts(notificationEvents = []) {
  const counts = {
    total: notificationEvents.length,
    pending: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    unknown: 0
  };

  for (const event of notificationEvents) {
    const status = normalizeNotificationEventStatus(event?.status);
    counts[status] += 1;
  }

  return counts;
}

function getNotificationEventRetryCount(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function renderNotificationEvents() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.notificationEvents.length) {
    content.innerHTML = `<p class="empty-state">No notification events found.</p>`;
    return;
  }

  const statusCounts = buildNotificationStatusCounts(state.notificationEvents);

  content.innerHTML = `
    <div class="admin-card">
      <h3>Delivery Status Overview</h3>
      <div class="status-row">
        <span class="status-badge">Total: ${escapeHTML(statusCounts.total)}</span>
        <span class="status-badge">Pending: ${escapeHTML(statusCounts.pending)}</span>
        <span class="status-badge">Sent: ${escapeHTML(statusCounts.sent)}</span>
        <span class="status-badge">Failed: ${escapeHTML(statusCounts.failed)}</span>
        <span class="status-badge">Skipped: ${escapeHTML(statusCounts.skipped)}</span>
        <span class="status-badge">Unknown: ${escapeHTML(statusCounts.unknown)}</span>
      </div>
    </div>

    <div class="admin-grid">
      ${state.notificationEvents
        .map(
          (event) => `
            <article class="admin-card">
              <h3>${escapeHTML(event.event_type || "notification_event")}</h3>
              <div class="admin-meta">${escapeHTML(event.hotel_slug || "shared")} • ${escapeHTML(event.source_type || "unknown")}</div>

              <div class="admin-row"><strong>DB ID:</strong> ${escapeHTML(event.id ?? "")}</div>
              <div class="admin-row"><strong>Source ID:</strong> ${escapeHTML(event.source_id || "")}</div>
              <div class="admin-row"><strong>Channel:</strong> ${escapeHTML(event.delivery_channel || "")}</div>
              <div class="admin-row"><strong>Status:</strong> ${escapeHTML(event.status || "")}</div>
              <div class="admin-row"><strong>Retry Count:</strong> ${escapeHTML(getNotificationEventRetryCount(event.retry_count))}</div>
              <div class="admin-row"><strong>Last Retry At:</strong> ${escapeHTML(event.last_retry_at || "")}</div>
              <div class="admin-row"><strong>Created At:</strong> ${escapeHTML(event.created_at || "")}</div>
              <div class="admin-row"><strong>Processed At:</strong> ${escapeHTML(event.processed_at || "")}</div>
              <div class="admin-row"><strong>Error:</strong> ${escapeHTML(event.error_message || "")}</div>

              ${
                ["failed", "skipped"].includes(
                  String(event.status || "").trim().toLowerCase()
                ) &&
                getNotificationEventRetryCount(event.retry_count) <
                  state.notificationEventMaxRetries
                  ? `
              <button
                class="status-btn"
                data-resend-notification-event
                data-id="${escapeHTML(event.id ?? "")}">
                Resend Notification
              </button>
              `
                  : ""
              }
              ${
                ["failed", "skipped"].includes(
                  String(event.status || "").trim().toLowerCase()
                ) &&
                getNotificationEventRetryCount(event.retry_count) >=
                  state.notificationEventMaxRetries
                  ? `
              <div class="admin-row"><strong>Retry:</strong> Maximum resend attempts reached (${escapeHTML(
                state.notificationEventMaxRetries
              )})</div>
              `
                  : ""
              }

              <pre class="json-box">${escapeHTML(
                JSON.stringify(
                  event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
                    ? event.payload
                    : {},
                  null,
                  2
                )
              )}</pre>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function bindEditActions() {
  document.addEventListener("click", async (e) => {
    const resendNotificationBtn = e.target.closest(
      "[data-resend-notification-event]"
    );
    if (resendNotificationBtn) {
      const notificationEventId = resendNotificationBtn.dataset.id;
      if (!notificationEventId) return;

      if (!window.confirm("Resend this notification event now?")) {
        return;
      }

      try {
        await resendNotificationEvent(notificationEventId);
        await loadTabData();
      } catch (error) {
        console.error("Notification resend failed:", error);
        alert(error.message || "Failed to resend notification event");
      }
      return;
    }

    const menuBtn = e.target.closest("[data-edit-menu-item]");
    if (menuBtn) {
      const id = menuBtn.dataset.id;
      const item = state.menuItems.find((entry) => String(entry.id) === String(id));
      if (!item) return;

      setSectionVisibility("menuFormSection", true);
      document.getElementById("menuItemDbId").value = item.id || "";
      document.getElementById("menuHotelSlugInput").value = item.hotel_slug || "";
      document.getElementById("menuCategoryInput").value = item.category || "";
      document.getElementById("menuItemIdInput").value = item.item_id || "";
      document.getElementById("menuNameInput").value = item.name || "";
      document.getElementById("menuDescriptionInput").value = item.description || "";
      document.getElementById("menuPriceInput").value = item.price || 0;
      document.getElementById("menuImageInput").value = item.image || "";
      document.getElementById("menuAltInput").value = item.alt || "";
      document.getElementById("menuBadgeInput").value = item.badge || "";
      document.getElementById("menuTagInput").value = item.tag || "";
      document.getElementById("menuSortOrderInput").value = item.sort_order || 0;
      document.getElementById("menuIsAvailableInput").checked = !!item.is_available;
      scrollSectionIntoView("menuFormSection");
      return;
    }

    const galleryBtn = e.target.closest("[data-edit-gallery-item]");
    if (galleryBtn) {
      const id = galleryBtn.dataset.id;
      const item = state.galleryItems.find((entry) => String(entry.id) === String(id));
      if (!item) return;

      setSectionVisibility("galleryFormSection", true);
      document.getElementById("galleryItemDbId").value = item.id || "";
      document.getElementById("galleryHotelSlugInput").value = item.hotel_slug || "";
      document.getElementById("galleryImageUrlInput").value = item.image_url || "";
      document.getElementById("galleryStoragePathInput").value = item.storage_path || "";
      document.getElementById("galleryAltInput").value = item.alt || "";
      document.getElementById("galleryLayoutVariantInput").value = item.layout_variant || "standard";
      document.getElementById("gallerySortOrderInput").value = item.sort_order || 0;
      document.getElementById("galleryIsActiveInput").checked = !!item.is_active;
      scrollSectionIntoView("galleryFormSection");
      return;
    }

    const testimonialBtn = e.target.closest("[data-edit-testimonial]");
    if (testimonialBtn) {
      const id = testimonialBtn.dataset.id;
      const item = state.testimonials.find((entry) => String(entry.id) === String(id));
      if (!item) return;

      setSectionVisibility("testimonialFormSection", true);
      document.getElementById("testimonialDbId").value = item.id || "";
      document.getElementById("testimonialHotelSlugInput").value =
        item.hotel_slug || item.hotelSlug || "";
      document.getElementById("testimonialNameInput").value =
        item.guest_name || item.name || "";
      document.getElementById("testimonialRoleInput").value =
        item.guest_role || item.role || "";
      document.getElementById("testimonialTextInput").value =
        item.review_text || item.text || "";
      document.getElementById("testimonialStarsInput").value =
        item.star_rating ?? item.stars ?? 5;
      document.getElementById("testimonialAvatarInput").value =
        item.avatar_url || item.avatar || "";
      document.getElementById("testimonialSortOrderInput").value =
        item.sort_order ?? item.sortOrder ?? 0;
      document.getElementById("testimonialIsActiveInput").checked = !!item.is_active;
      document.getElementById("testimonialIsApprovedInput").checked =
        item.is_approved !== false;
      scrollSectionIntoView("testimonialFormSection");
      return;
    }

    const hotelBtn = e.target.closest("[data-edit-hotel]");
    if (hotelBtn) {
      const id = hotelBtn.dataset.id;
      const hotel = state.hotels.find((entry) => String(entry.id) === String(id));
      if (!hotel) return;

      setSectionVisibility("hotelFormSection", true);
      document.getElementById("hotelId").value = hotel.id || "";
      document.getElementById("hotelSlugInput").value = hotel.slug || "";
      document.getElementById("hotelNameInput").value = hotel.name || "";
      document.getElementById("hotelWhatsappInput").value = hotel.whatsapp_number || "";
      document.getElementById("hotelUpiInput").value = hotel.upi_id || "";
      document.getElementById("hotelGstInput").value = hotel.gst_percent || 5;
      document.getElementById("hotelPrimaryDomainInput").value = hotel.primary_domain || "";
      document.getElementById("hotelSubdomainInput").value = hotel.subdomain || "";
      document.getElementById("hotelIsActiveInput").checked = !!hotel.is_active;
      scrollSectionIntoView("hotelFormSection");
    }

    const profileBtn = e.target.closest("[data-edit-profile]");
if (profileBtn) {
  const slug = profileBtn.dataset.slug;
  if (!slug) return;

  try {
    const result = await fetchHotelProfile(slug);
    fillProfileForm(result.profile);
  } catch (error) {
    console.error("Failed to load profile:", error);
    alert("Failed to load hotel profile");
  }
  return;
}

const archiveBtn = e.target.closest("[data-toggle-menu-archive]");
if (archiveBtn) {
  const id = archiveBtn.dataset.id;
  const currentArchived = archiveBtn.dataset.archived === "true";

  const confirmMessage = currentArchived
    ? "Restore this menu item?"
    : "Archive this menu item?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleMenuArchive(id, !currentArchived);
    await loadTabData();
  } catch (error) {
    console.error("Toggle menu archive failed:", error);
    alert("Failed to update menu item archive state");
  }
  return;
}

const galleryArchiveBtn = e.target.closest("[data-toggle-gallery-archive]");
if (galleryArchiveBtn) {
  const id = galleryArchiveBtn.dataset.id;
  const currentArchived = galleryArchiveBtn.dataset.archived === "true";

  const confirmMessage = currentArchived
    ? "Restore this gallery item?"
    : "Archive this gallery item?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleGalleryArchive(id, !currentArchived);
    await loadTabData();
  } catch (error) {
    console.error("Toggle gallery archive failed:", error);
    alert("Failed to update gallery item archive state");
  }
  return;
}

const galleryActiveBtn = e.target.closest("[data-toggle-gallery-active]");
if (galleryActiveBtn) {
  const id = galleryActiveBtn.dataset.id;
  const currentActive = galleryActiveBtn.dataset.active === "true";

  const confirmMessage = currentActive
    ? "Deactivate this gallery item?"
    : "Activate this gallery item?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleGalleryActive(id, !currentActive);
    await loadTabData();
  } catch (error) {
    console.error("Toggle gallery active failed:", error);
    alert("Failed to update gallery item active state");
  }
  return;
}

const deleteGalleryBtn = e.target.closest("[data-delete-gallery-item]");
if (deleteGalleryBtn) {
  const id = deleteGalleryBtn.dataset.id;
  const item = state.galleryItems.find((entry) => String(entry.id) === String(id));

  if (!item || !item.is_archived) {
    alert("Archive the gallery item before deleting it permanently.");
    return;
  }

  if (
    !window.confirm(
      "Delete this gallery item permanently? The gallery record will be removed, but the uploaded image file will stay in storage."
    )
  ) {
    return;
  }

  try {
    await deleteGalleryItem(id);

    if (String(document.getElementById("galleryItemDbId")?.value || "") === String(id)) {
      resetGalleryItemForm();
    }

    await loadTabData();
  } catch (error) {
    console.error("Delete gallery item failed:", error);
    alert("Failed to delete gallery item");
  }
  return;
}

const deleteMenuBtn = e.target.closest("[data-delete-menu-item]");
if (deleteMenuBtn) {
  const id = deleteMenuBtn.dataset.id;

  if (!window.confirm("Delete this menu item permanently? This cannot be undone.")) {
    return;
  }

  try {
    await deleteMenuItem(id);
    await loadTabData();
  } catch (error) {
    console.error("Delete menu item failed:", error);
    alert("Failed to delete menu item");
  }
  return;
}

const testimonialApprovalBtn = e.target.closest("[data-toggle-testimonial-approval]");
if (testimonialApprovalBtn) {
  const id = testimonialApprovalBtn.dataset.id;
  const currentApproved = testimonialApprovalBtn.dataset.approved === "true";

  const confirmMessage = currentApproved
    ? "Mark this testimonial as pending so it no longer appears publicly?"
    : "Approve this testimonial for public display?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleTestimonialApproval(id, !currentApproved);
    await loadTabData();
  } catch (error) {
    console.error("Toggle testimonial approval failed:", error);
    alert("Failed to update testimonial approval");
  }
  return;
}

const testimonialArchiveBtn = e.target.closest("[data-toggle-testimonial-archive]");
if (testimonialArchiveBtn) {
  const id = testimonialArchiveBtn.dataset.id;
  const currentArchived = testimonialArchiveBtn.dataset.archived === "true";

  const confirmMessage = currentArchived
    ? "Restore this testimonial?"
    : "Archive this testimonial?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleTestimonialArchive(id, !currentArchived);
    await loadTabData();
  } catch (error) {
    console.error("Toggle testimonial archive failed:", error);
    alert("Failed to update testimonial archive state");
  }
  return;
}

const deleteTestimonialBtn = e.target.closest("[data-delete-testimonial]");
if (deleteTestimonialBtn) {
  const id = deleteTestimonialBtn.dataset.id;
  const item = state.testimonials.find((entry) => String(entry.id) === String(id));

  if (!item || item.is_archived !== true) {
    alert("Archive the testimonial before deleting it permanently.");
    return;
  }

  if (!window.confirm("Delete this testimonial permanently? This cannot be undone.")) {
    return;
  }

  try {
    await deleteTestimonial(id);

    if (String(document.getElementById("testimonialDbId")?.value || "") === String(id)) {
      resetTestimonialForm();
    }

    await loadTabData();
  } catch (error) {
    console.error("Delete testimonial failed:", error);
    alert("Failed to delete testimonial");
  }
  return;
}

const hotelActiveBtn = e.target.closest("[data-toggle-hotel-active]");
if (hotelActiveBtn) {
  const id = hotelActiveBtn.dataset.id;
  const currentActive = hotelActiveBtn.dataset.active === "true";

  const confirmMessage = currentActive
    ? "Deactivate this hotel? It will stop resolving for live use."
    : "Activate this hotel?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleHotelActive(id, !currentActive);
    await loadHotels();
    if (state.activeTab === "hotels") {
      await loadTabData();
    }
  } catch (error) {
    console.error("Toggle hotel active failed:", error);
    alert("Failed to update hotel active state");
  }
  return;
}

  });
}

function renderHotelFilter() {
  const select = $("#hotelFilter");
  if (!select) return;

  const currentValue = getHotelFilterValue();
  const optionMap = new Map();

  state.hotels.forEach((hotel) => {
    const optionValue = (hotel.slug || hotel.name || "").trim();
    if (!optionValue) return;

    const key = normalizeValue(optionValue);
    if (!optionMap.has(key)) {
      optionMap.set(key, {
        value: optionValue,
        label: hotel.name || hotel.slug || optionValue
      });
    }
  });

  select.innerHTML = `
    <option value="">All Hotels</option>
    ${[...optionMap.values()]
      .map(
        (hotel) => `
          <option value="${escapeHTML(hotel.value)}">
            ${escapeHTML(hotel.label)}
          </option>
        `
      )
      .join("")}
  `;

  const matchingOption = [...optionMap.values()].find(
    (hotel) => normalizeValue(hotel.value) === normalizeValue(currentValue)
  );

  select.value = matchingOption?.value || "";
  syncMenuFormHotelSlug({ force: true });
}

function getOrderContextValues(order = {}) {
  const orderContext =
    order.orderContext && typeof order.orderContext === "object" && !Array.isArray(order.orderContext)
      ? order.orderContext
      : {};

  return {
    orderType: order.order_type || orderContext.orderType || "",
    tableNumber: order.table_number || orderContext.tableNumber || "",
    orderSource: order.order_source || orderContext.orderSource || ""
  };
}

function buildOrderContextRows(order = {}) {
  const { orderType, tableNumber, orderSource } = getOrderContextValues(order);
  const rows = [];

  if (orderType) {
    rows.push(
      `<div class="admin-row"><strong>Order Type:</strong> ${escapeHTML(orderType)}</div>`
    );
  }

  if (tableNumber) {
    rows.push(
      `<div class="admin-row"><strong>Table:</strong> ${escapeHTML(tableNumber)}</div>`
    );
  }

  if (orderSource) {
    rows.push(
      `<div class="admin-row"><strong>Source:</strong> ${escapeHTML(orderSource)}</div>`
    );
  }

  return rows.join("");
}

function buildOrderBillingRows(order = {}) {
  const rows = [];
  const showBillingDefaults = isDineInOrderCard(order);
  const paymentStatus = getOrderPaymentStatus(order, showBillingDefaults);
  const billingStatus = getOrderBillingStatus(order, showBillingDefaults);

  if (paymentStatus) {
    rows.push(
      `<div class="admin-row"><strong>Payment Status:</strong> ${escapeHTML(getPaymentStatusLabel(paymentStatus))}</div>`
    );
  }

  if (billingStatus) {
    rows.push(
      `<div class="admin-row"><strong>Billing Status:</strong> ${escapeHTML(billingStatus)}</div>`
    );
  }

  if (order.bill_number) {
    rows.push(
      `<div class="admin-row"><strong>${escapeHTML(getOrderBillNumberLabel(order))}:</strong> ${escapeHTML(order.bill_number)}</div>`
    );
  }

  if (order.billed_at) {
    rows.push(
      `<div class="admin-row"><strong>Billed At:</strong> ${escapeHTML(order.billed_at)}</div>`
    );
  }

  if (order.paid_at) {
    rows.push(
      `<div class="admin-row"><strong>Paid At:</strong> ${escapeHTML(order.paid_at)}</div>`
    );
  }

  return rows.join("");
}

function getOrderRouteMetadata(order = {}) {
  const paymentMetadata =
    order.payment_metadata &&
    typeof order.payment_metadata === "object" &&
    !Array.isArray(order.payment_metadata)
      ? order.payment_metadata
      : {};
  const route =
    paymentMetadata.route &&
    typeof paymentMetadata.route === "object" &&
    !Array.isArray(paymentMetadata.route)
      ? paymentMetadata.route
      : {};

  return {
    routeStatus: route.routeStatus || "",
    routeReady: !!route.routeReady,
    transferRequested: !!route.transferRequested,
    transferId: order.gateway_transfer_id || route.transferId || "",
    transferStatus:
      order.gateway_transfer_status ||
      route.transferStatus ||
      route.transfer_status ||
      "",
    settlementStatus:
      order.gateway_settlement_status ||
      route.settlementStatus ||
      route.settlement_status ||
      "",
    transferError:
      order.gateway_transfer_error ||
      route.transferError ||
      route.transfer_error ||
      "",
    linkedAccountId: route.linkedAccountId || ""
  };
}

function buildOrderRouteTransferRows(order = {}) {
  const route = getOrderRouteMetadata(order);
  const rows = [];
  const hasRouteData =
    route.routeStatus ||
    route.transferRequested ||
    route.transferId ||
    route.transferStatus ||
    route.settlementStatus ||
    route.linkedAccountId;

  if (!hasRouteData) {
    return "";
  }

  if (route.routeStatus) {
    rows.push(
      `<div class="admin-row"><strong>Route Status:</strong> ${escapeHTML(route.routeStatus)}</div>`
    );
  }

  if (route.linkedAccountId) {
    rows.push(
      `<div class="admin-row"><strong>Route Linked Account:</strong> ${escapeHTML(route.linkedAccountId)}</div>`
    );
  }

  rows.push(
    `<div class="admin-row"><strong>Route Transfer Requested:</strong> ${escapeHTML(route.transferRequested ? "yes" : "no")}</div>`
  );

  if (route.transferId) {
    rows.push(
      `<div class="admin-row"><strong>Transfer ID:</strong> ${escapeHTML(route.transferId)}</div>`
    );
  }

  if (route.transferStatus) {
    rows.push(
      `<div class="admin-row"><strong>Transfer Status:</strong> <span class="status-badge">${escapeHTML(route.transferStatus)}</span></div>`
    );
  }

  if (route.settlementStatus) {
    rows.push(
      `<div class="admin-row"><strong>Settlement Status:</strong> ${escapeHTML(route.settlementStatus)}</div>`
    );
  }

  if (route.transferError) {
    rows.push(
      `<div class="admin-row admin-attention-row"><strong>Transfer Error:</strong> ${escapeHTML(route.transferError)}</div>`
    );
  }

  return rows.join("");
}

function isDineInOrderCard(order = {}) {
  const { orderType, tableNumber } = getOrderContextValues(order);
  const normalizedOrderType = String(orderType || "")
    .trim()
    .toLowerCase();
  const normalizedTableNumber = String(tableNumber || "").trim();

  return (
    normalizedOrderType === "dine-in" ||
    !!normalizedTableNumber ||
    !!order.payment_status ||
    !!order.billing_status
  );
}

function getOrderPaymentStatus(order = {}, useDefault = isDineInOrderCard(order)) {
  return order.payment_status || (useDefault ? "unpaid" : "");
}

function getPaymentStatusLabel(paymentStatus = "") {
  const normalizedStatus = String(paymentStatus || "").trim().toLowerCase();
  const labels = {
    unpaid: "unpaid",
    customer_confirmed: "customer confirmed, verify before paid",
    paid: "paid",
    refunded: "refunded"
  };

  return labels[normalizedStatus] || normalizedStatus.replace(/_/g, " ");
}

function getOrderBillingStatus(order = {}, useDefault = isDineInOrderCard(order)) {
  return order.billing_status || (useDefault ? "not_billed" : "");
}

function getOrderBillingAttentionMessage(order = {}) {
  if (!isDineInOrderCard(order)) {
    return "";
  }

  const paymentStatus = getOrderPaymentStatus(order, true);
  const billingStatus = getOrderBillingStatus(order, true);

  if (paymentStatus === "customer_confirmed") {
    return "Verify UPI receipt before marking paid.";
  }

  if (billingStatus === "billed" && paymentStatus !== "paid") {
    return "Bill is ready, payment is not marked paid.";
  }

  if (paymentStatus === "paid" && billingStatus !== "billed") {
    return "Payment is marked paid, but billing is not marked billed.";
  }

  return "";
}

function buildOrderBillingAttentionRow(order = {}) {
  const message = getOrderBillingAttentionMessage(order);

  if (!message) {
    return "";
  }

  return `<div class="admin-row admin-attention-row"><strong>Payment Attention:</strong> ${escapeHTML(message)}</div>`;
}

function getOrderBillNumberLabel(order = {}) {
  return getOrderBillingStatus(order, true) === "billed"
    ? "Bill Number"
    : "Saved Bill Ref";
}

function getOrderBillPrintTitle(order = {}) {
  if (order.bill_number && getOrderBillingStatus(order, true) === "billed") {
    return order.bill_number;
  }

  return `Draft Bill - Order ${order.id || ""}`;
}

function getNumberValue(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatDiscountPercent(value) {
  const percent = getNumberValue(value);

  if (percent === null) return "";

  return Number.isInteger(percent)
    ? `${percent}%`
    : `${percent.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatBillMoney(value) {
  const numberValue = getNumberValue(value);
  return numberValue === null ? "Rs. 0.00" : `Rs. ${numberValue.toFixed(2)}`;
}

function getOrderBillItems(order = {}) {
  return Array.isArray(order.items) ? order.items : [];
}

function getOrderBillItemLineTotal(item = {}) {
  const qty = getNumberValue(item.qty) || 0;
  const price = getNumberValue(item.price) || 0;
  return qty * price;
}

function getOrderBillItemSubtotal(order = {}) {
  return getOrderBillItems(order).reduce(
    (sum, item) => sum + getOrderBillItemLineTotal(item),
    0
  );
}

function getOrderBillTotals(order = {}) {
  return order.totals && typeof order.totals === "object" && !Array.isArray(order.totals)
    ? order.totals
    : {};
}

function isUpiOrder(order = {}) {
  const paymentMethod = String(order.payment_method || "").trim().toLowerCase();
  return paymentMethod.includes("upi") || paymentMethod.includes("google pay");
}

function getOrderBillFinalTotal(order = {}) {
  const totals = getOrderBillTotals(order);
  const itemSubtotal = getOrderBillItemSubtotal(order);

  if (isUpiOrder(order)) {
    return (
      getNumberValue(totals.gpayFinalTotal) ??
      getNumberValue(totals.total) ??
      getNumberValue(totals.normalTotal) ??
      itemSubtotal
    );
  }

  return (
    getNumberValue(totals.total) ??
    getNumberValue(totals.normalTotal) ??
    getNumberValue(totals.gpayFinalTotal) ??
    itemSubtotal
  );
}

function buildOrderBillTotalsRows(order = {}) {
  const totals = getOrderBillTotals(order);
  const rows = [];
  const subtotal = getNumberValue(totals.subtotal);
  const gst = getNumberValue(totals.gst);
  const deliveryCharge = getNumberValue(totals.deliveryCharge);
  const normalTotal = getNumberValue(totals.normalTotal);
  const upiDiscountPercent = getNumberValue(totals.upiDiscountPercent);
  const gpayDiscount = getNumberValue(totals.gpayDiscount);
  const gpayFinalTotal = getNumberValue(totals.gpayFinalTotal);

  if (subtotal !== null) {
    rows.push(`<tr><th>Subtotal</th><td>${escapeHTML(formatBillMoney(subtotal))}</td></tr>`);
  }

  if (gst !== null) {
    rows.push(`<tr><th>GST</th><td>${escapeHTML(formatBillMoney(gst))}</td></tr>`);
  }

  if (deliveryCharge !== null && deliveryCharge > 0) {
    rows.push(
      `<tr><th>Delivery Charge</th><td>${escapeHTML(formatBillMoney(deliveryCharge))}</td></tr>`
    );
  }

  if (isUpiOrder(order) && normalTotal !== null) {
    rows.push(`<tr><th>Original Total</th><td>${escapeHTML(formatBillMoney(normalTotal))}</td></tr>`);
  }

  if (isUpiOrder(order) && gpayDiscount !== null) {
    const discountLabel = upiDiscountPercent !== null
      ? `Google Pay Discount (${formatDiscountPercent(upiDiscountPercent)})`
      : "Google Pay Discount";
    rows.push(`<tr><th>${escapeHTML(discountLabel)}</th><td>-${escapeHTML(formatBillMoney(gpayDiscount))}</td></tr>`);
  }

  if (isUpiOrder(order) && gpayFinalTotal !== null) {
    rows.push(`<tr><th>Final Paid Amount</th><td>${escapeHTML(formatBillMoney(gpayFinalTotal))}</td></tr>`);
  } else {
    rows.push(`<tr><th>Total</th><td>${escapeHTML(formatBillMoney(getOrderBillFinalTotal(order)))}</td></tr>`);
  }

  return rows.join("");
}

function buildOrderBillPrintDocument(order = {}) {
  const { orderType, tableNumber, orderSource } = getOrderContextValues(order);
  const billTitle = getOrderBillPrintTitle(order);
  const savedBillRefRow = order.bill_number
    ? `<p>${escapeHTML(getOrderBillNumberLabel(order))}: ${escapeHTML(order.bill_number)}</p>`
    : "";
  const items = getOrderBillItems(order);

  const itemRows = items.length
    ? items
        .map((item, index) => {
          const qty = getNumberValue(item.qty) || 0;
          const price = getNumberValue(item.price) || 0;
          const lineTotal = getOrderBillItemLineTotal(item);

          return `
            <tr>
              <td>${escapeHTML(index + 1)}</td>
              <td>${escapeHTML(item.name || item.id || "Item")}</td>
              <td>${escapeHTML(qty)}</td>
              <td>${escapeHTML(formatBillMoney(price))}</td>
              <td>${escapeHTML(formatBillMoney(lineTotal))}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="5">No items found for this order.</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(billTitle)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    .bill { max-width: 760px; margin: 0 auto; }
    .bill-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 18px; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 24px; }
    h2 { font-size: 16px; margin-top: 4px; font-weight: 600; }
    .muted { color: #555; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 18px 0; }
    .row { font-size: 14px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 14px; }
    th { background: #f2f2f2; }
    .totals { max-width: 340px; margin-left: auto; }
    .note { margin-top: 18px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 14px; }
    .actions { display: flex; justify-content: flex-end; margin-bottom: 18px; }
    button { border: 0; border-radius: 8px; background: #111; color: #fff; padding: 10px 14px; cursor: pointer; }
    @media print {
      body { margin: 0; }
      .actions { display: none; }
      .bill { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="bill">
    <div class="actions">
      <button type="button" onclick="window.print()">Print Bill</button>
    </div>
    <header class="bill-header">
      <div>
        <h1>${escapeHTML(order.hotel_name || "Hotel")}</h1>
        <h2>${escapeHTML(billTitle)}</h2>
      </div>
      <div class="muted">
        <p>Order: ${escapeHTML(order.id || "")}</p>
        ${savedBillRefRow}
        <p>Created: ${escapeHTML(order.created_at || "")}</p>
        <p>Billed: ${escapeHTML(order.billed_at || "Not billed yet")}</p>
      </div>
    </header>

    <section class="grid">
      <div class="row"><strong>Customer:</strong> ${escapeHTML(order.customer_name || "")}</div>
      <div class="row"><strong>Phone:</strong> ${escapeHTML(order.customer_phone || "")}</div>
      <div class="row"><strong>Order Type:</strong> ${escapeHTML(orderType || "dine-in")}</div>
      <div class="row"><strong>Table:</strong> ${escapeHTML(tableNumber || "Not provided")}</div>
      <div class="row"><strong>Source:</strong> ${escapeHTML(orderSource || "")}</div>
      <div class="row"><strong>Payment:</strong> ${escapeHTML(order.payment_method || "")}</div>
      <div class="row"><strong>Payment Status:</strong> ${escapeHTML(getPaymentStatusLabel(getOrderPaymentStatus(order, true)))}</div>
      <div class="row"><strong>Billing Status:</strong> ${escapeHTML(getOrderBillingStatus(order, true))}</div>
    </section>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <table class="totals">
      <tbody>${buildOrderBillTotalsRows(order)}</tbody>
    </table>

    <div class="note">
      <strong>Note:</strong> ${escapeHTML(order.note || "No note")}
    </div>
  </div>
</body>
</html>`;
}

function openOrderBillPrintView(order = {}) {
  const printWindow = window.open("", "_blank", "width=780,height=900");

  if (!printWindow) {
    alert("Please allow popups to open the bill view.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildOrderBillPrintDocument(order));
  printWindow.document.close();
  printWindow.focus();
}

function buildSelectOption(value, label, currentValue) {
  return `<option value="${escapeHTML(value)}" ${currentValue === value ? "selected" : ""}>${escapeHTML(label)}</option>`;
}

function buildOrderBillingControls(order = {}) {
  if (!isDineInOrderCard(order)) {
    return "";
  }

  const orderId = escapeHTML(order.id);
  const billingStatus = String(order.billing_status || "not_billed").trim().toLowerCase();
  const paymentStatus = String(order.payment_status || "unpaid").trim().toLowerCase();

  return `
    <div class="status-row admin-card-actions">
      <select class="status-select order-billing-select" data-order-billing-field="billingStatus" data-id="${orderId}" aria-label="Billing status">
        ${buildSelectOption("not_billed", "not billed", billingStatus)}
        ${buildSelectOption("billed", "billed", billingStatus)}
        ${buildSelectOption("cancelled", "billing cancelled", billingStatus)}
      </select>
      <select class="status-select order-billing-select" data-order-billing-field="paymentStatus" data-id="${orderId}" aria-label="Payment status">
        ${buildSelectOption("unpaid", "unpaid", paymentStatus)}
        ${buildSelectOption("customer_confirmed", getPaymentStatusLabel("customer_confirmed"), paymentStatus)}
        ${buildSelectOption("paid", "paid", paymentStatus)}
        ${buildSelectOption("refunded", "refunded", paymentStatus)}
      </select>
      <button class="status-btn" data-update-order-billing data-id="${orderId}">Update Billing</button>
      <button class="status-btn" data-print-order-bill data-id="${orderId}">View Bill</button>
    </div>
  `;
}

function getOrderBillingSummaryCounts(orders = []) {
  const dineInOrders = orders.filter(isDineInOrderCard);
  const notBilled = dineInOrders.filter(
    (order) => getOrderBillingStatus(order, true) === "not_billed"
  );
  const billedAndPaid = dineInOrders.filter(
    (order) =>
      getOrderBillingStatus(order, true) === "billed" &&
      getOrderPaymentStatus(order, true) === "paid"
  );
  const billedNotPaid = dineInOrders.filter(
    (order) =>
      getOrderBillingStatus(order, true) === "billed" &&
      getOrderPaymentStatus(order, true) !== "paid"
  );
  const needsPaymentVerification = dineInOrders.filter(
    (order) => getOrderPaymentStatus(order, true) === "customer_confirmed"
  );
  const paidNotBilled = dineInOrders.filter(
    (order) =>
      getOrderPaymentStatus(order, true) === "paid" &&
      getOrderBillingStatus(order, true) !== "billed"
  );

  return {
    dineIn: dineInOrders.length,
    notBilled: notBilled.length,
    billedAndPaid: billedAndPaid.length,
    billedNotPaid: billedNotPaid.length,
    needsPaymentVerification: needsPaymentVerification.length,
    paidNotBilled: paidNotBilled.length
  };
}

function buildOrderBillingSummaryCard(orders = []) {
  const counts = getOrderBillingSummaryCounts(orders);

  if (!counts.dineIn) {
    return "";
  }

  return `
    <div class="admin-card admin-list-summary">
      <h3>Dine-in Billing</h3>
      <p class="admin-toolbar-help">Customer confirmed means verify before paid. Only mark paid after the operator confirms receipt.</p>
      <div class="status-row">
        <span class="status-badge">Dine-in: ${escapeHTML(counts.dineIn)}</span>
        <span class="status-badge">Not billed: ${escapeHTML(counts.notBilled)}</span>
        <span class="status-badge">Billed not paid: ${escapeHTML(counts.billedNotPaid)}</span>
        <span class="status-badge">Verify UPI: ${escapeHTML(counts.needsPaymentVerification)}</span>
        <span class="status-badge">Paid: ${escapeHTML(counts.billedAndPaid)}</span>
        ${
          counts.paidNotBilled
            ? `<span class="status-badge">Paid not billed: ${escapeHTML(counts.paidNotBilled)}</span>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderOrders() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.orders.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Orders",
        count: 0,
        description: "Review incoming food orders and update their current status."
      })}
      <p class="empty-state">No orders found.</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Orders",
      count: state.orders.length,
      description: "Review incoming food orders and update their current status."
    })}
    ${buildOrderBillingSummaryCard(state.orders)}
    <div class="admin-grid">
      ${state.orders
        .map(
          (order) => `
            <article class="admin-card">
              <h3>Order #${escapeHTML(order.id)}</h3>
              <div class="admin-meta">${escapeHTML(order.created_at || "")}</div>

              <div class="admin-row"><strong>Hotel:</strong> ${escapeHTML(order.hotel_name || "")}</div>
              <div class="admin-row"><strong>Customer:</strong> ${escapeHTML(order.customer_name || "")}</div>
              <div class="admin-row"><strong>Phone:</strong> ${escapeHTML(order.customer_phone || "")}</div>
              <div class="admin-row"><strong>Address:</strong> ${escapeHTML(order.customer_address || "")}</div>
              ${buildOrderContextRows(order)}
              <div class="admin-row"><strong>Payment:</strong> ${escapeHTML(order.payment_method || "")}</div>
              ${buildOrderBillingRows(order)}
              ${buildOrderRouteTransferRows(order)}
              ${buildOrderBillingAttentionRow(order)}
              <div class="admin-row"><strong>Note:</strong> ${escapeHTML(order.note || "")}</div>
              <div class="admin-row"><strong>Total:</strong> ₹${escapeHTML(order.totals?.total ?? "")}</div>
              <div class="admin-row"><strong>Status:</strong> <span class="status-badge">${escapeHTML(order.status || "new")}</span></div>

              <details>
                <summary>View Items</summary>
                <pre class="json-box">${escapeHTML(JSON.stringify(order.items || [], null, 2))}</pre>
              </details>

              <div class="status-row">
                <select class="status-select" data-type="orders" data-id="${escapeHTML(order.id)}">
                  <option value="new" ${order.status === "new" ? "selected" : ""}>new</option>
                  <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>confirmed</option>
                  <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>preparing</option>
                  <option value="completed" ${order.status === "completed" ? "selected" : ""}>completed</option>
                  <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>cancelled</option>
                </select>
                <button class="status-btn" data-update-status data-type="orders" data-id="${escapeHTML(order.id)}">Update Status</button>
              </div>
              ${buildOrderBillingControls(order)}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReservations() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.reservations.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Reservations",
        count: 0,
        description: "Review reservation requests and move them through the current seating flow."
      })}
      <p class="empty-state">No reservations found.</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Reservations",
      count: state.reservations.length,
      description: "Review reservation requests and move them through the current seating flow."
    })}
    <div class="admin-grid">
      ${state.reservations
        .map(
          (item) => `
            <article class="admin-card">
              <h3>Reservation #${escapeHTML(item.id)}</h3>
              <div class="admin-meta">${escapeHTML(item.created_at || "")}</div>

              <div class="admin-row"><strong>Hotel:</strong> ${escapeHTML(item.hotel_name || "")}</div>
              <div class="admin-row"><strong>Name:</strong> ${escapeHTML(item.name || "")}</div>
              <div class="admin-row"><strong>Phone:</strong> ${escapeHTML(item.phone || "")}</div>
              <div class="admin-row"><strong>Date:</strong> ${escapeHTML(item.date || "")}</div>
              <div class="admin-row"><strong>Time:</strong> ${escapeHTML(item.time || "")}</div>
              <div class="admin-row"><strong>Guests:</strong> ${escapeHTML(item.guests || "")}</div>
              <div class="admin-row"><strong>Note:</strong> ${escapeHTML(item.note || "")}</div>
              <div class="admin-row"><strong>Status:</strong> <span class="status-badge">${escapeHTML(item.status || "new")}</span></div>

              <div class="status-row">
                <select class="status-select" data-type="reservations" data-id="${escapeHTML(item.id)}">
                  <option value="new" ${item.status === "new" ? "selected" : ""}>new</option>
                  <option value="confirmed" ${item.status === "confirmed" ? "selected" : ""}>confirmed</option>
                  <option value="seated" ${item.status === "seated" ? "selected" : ""}>seated</option>
                  <option value="completed" ${item.status === "completed" ? "selected" : ""}>completed</option>
                  <option value="cancelled" ${item.status === "cancelled" ? "selected" : ""}>cancelled</option>
                </select>
                <button class="status-btn" data-update-status data-type="reservations" data-id="${escapeHTML(item.id)}">Update Status</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderInquiries() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.inquiries.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Inquiries",
        count: 0,
        description: "Review event and inquiry submissions for the current hotel scope."
      })}
      <p class="empty-state">No inquiries found.</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Inquiries",
      count: state.inquiries.length,
      description: "Review event and inquiry submissions for the current hotel scope."
    })}
    <div class="admin-grid">
      ${state.inquiries
        .map(
          (item) => `
            <article class="admin-card">
              <h3>Inquiry #${escapeHTML(item.id)}</h3>
              <div class="admin-meta">${escapeHTML(item.created_at || "")}</div>

              <div class="admin-row"><strong>Hotel:</strong> ${escapeHTML(item.hotel_name || "")}</div>
              <div class="admin-row"><strong>Name:</strong> ${escapeHTML(item.name || "")}</div>
              <div class="admin-row"><strong>Phone:</strong> ${escapeHTML(item.phone || "")}</div>
              <div class="admin-row"><strong>Event Type:</strong> ${escapeHTML(item.event_type || "")}</div>
              <div class="admin-row"><strong>Date:</strong> ${escapeHTML(item.date || "")}</div>
              <div class="admin-row"><strong>Guests:</strong> ${escapeHTML(item.guests || "")}</div>
              <div class="admin-row"><strong>Requirements:</strong> ${escapeHTML(item.special_requirements || "")}</div>
              <div class="admin-row"><strong>Status:</strong> <span class="status-badge">${escapeHTML(item.status || "new")}</span></div>

              <div class="status-row">
                <select class="status-select" data-type="inquiries" data-id="${escapeHTML(item.id)}">
                  <option value="new" ${item.status === "new" ? "selected" : ""}>new</option>
                  <option value="contacted" ${item.status === "contacted" ? "selected" : ""}>contacted</option>
                  <option value="converted" ${item.status === "converted" ? "selected" : ""}>converted</option>
                  <option value="closed" ${item.status === "closed" ? "selected" : ""}>closed</option>
                </select>
                <button class="status-btn" data-update-status data-type="inquiries" data-id="${escapeHTML(item.id)}">Update Status</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderHotels() {
  const content = $("#adminContent");
  if (!content) return;

  const hotelsToRender = getFilteredHotels();

  if (!hotelsToRender.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Hotels",
        count: 0,
        description: "Browse hotel records and jump into hotel or profile editing."
      })}
      <p class="empty-state">${getHotelFilterValue() ? "No hotels found for the selected filter." : "No hotels found."}</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Hotels",
      count: hotelsToRender.length,
      description: "Browse hotel records and jump into hotel or profile editing."
    })}
    <div class="admin-grid">
      ${hotelsToRender
        .map(
          (hotel) => `
            <article class="admin-card">
              <h3>${escapeHTML(hotel.name || "")}</h3>
              <div class="admin-meta">${escapeHTML(hotel.created_at || "")}</div>
              <div class="admin-row"><strong>Slug:</strong> ${escapeHTML(hotel.slug || "")}</div>
              <div class="admin-row"><strong>WhatsApp:</strong> ${escapeHTML(hotel.whatsapp_number || "")}</div>
              <div class="admin-row"><strong>UPI ID:</strong> ${escapeHTML(hotel.upi_id || "")}</div>
              <div class="admin-row"><strong>GST %:</strong> ${escapeHTML(hotel.gst_percent ?? "")}</div>
              <div class="admin-row"><strong>Primary Domain:</strong> ${escapeHTML(hotel.primary_domain || "")}</div>
              <div class="admin-row"><strong>Subdomain:</strong> ${escapeHTML(hotel.subdomain || "")}</div>
              <div class="admin-row admin-state-line">
                <strong>Status:</strong>
                <div class="admin-state-list">
                  ${buildBooleanStateBadge(hotel.is_active, {
                    onLabel: "Active",
                    offLabel: "Inactive",
                    onTone: "success",
                    offTone: "danger"
                  })}
                </div>
              </div>
              <div class="status-row admin-card-actions">
                <button class="status-btn" data-edit-hotel data-id="${escapeHTML(hotel.id)}">Edit Hotel</button>
                <button class="status-btn" data-edit-profile data-slug="${escapeHTML(hotel.slug)}">Edit Profile</button>
                <button class="status-btn" data-toggle-hotel-active data-id="${escapeHTML(hotel.id)}" data-active="${escapeHTML(String(hotel.is_active))}">
                  ${hotel.is_active ? "Deactivate Hotel" : "Activate Hotel"}
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

async function updateStatus(type, id, status) {
  await fetchJson(`${API_BASE}/${type}/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });
}

function renderContactSubmissions() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.contactSubmissions.length) {
    content.innerHTML = `
      ${buildAdminListSummaryCard({
        title: "Contact Messages",
        count: 0,
        description: "Review public contact form messages saved from the website."
      })}
      <p class="empty-state">No contact messages found.</p>
    `;
    return;
  }

  content.innerHTML = `
    ${buildAdminListSummaryCard({
      title: "Contact Messages",
      count: state.contactSubmissions.length,
      description: "Review public contact form messages saved from the website."
    })}
    <div class="admin-grid">
      ${state.contactSubmissions
        .map(
          (item) => `
            <article class="admin-card">
              <h3>Contact #${escapeHTML(item.id)}</h3>
              <div class="admin-meta">${escapeHTML(item.created_at || "")}</div>

              <div class="admin-row"><strong>Hotel:</strong> ${escapeHTML(item.hotel_name || "")}</div>
              <div class="admin-row"><strong>Hotel Slug:</strong> ${escapeHTML(item.hotel_slug || "")}</div>
              <div class="admin-row"><strong>Name:</strong> ${escapeHTML(item.name || "")}</div>
              <div class="admin-row"><strong>Email:</strong> ${escapeHTML(item.email || "")}</div>
              <div class="admin-row"><strong>Subject:</strong> ${escapeHTML(item.subject || "")}</div>
              <div class="admin-row"><strong>Message:</strong> ${escapeHTML(item.message || "")}</div>
              <div class="admin-row"><strong>Sheet Status:</strong> ${escapeHTML(item.google_sheet_status || "")}</div>
              <div class="admin-row"><strong>Status:</strong> <span class="status-badge">${escapeHTML(item.status || "new")}</span></div>

              <div class="status-row">
                <select class="status-select" data-type="contact-submissions" data-id="${escapeHTML(item.id)}">
                  <option value="new" ${item.status === "new" ? "selected" : ""}>new</option>
                  <option value="contacted" ${item.status === "contacted" ? "selected" : ""}>contacted</option>
                  <option value="resolved" ${item.status === "resolved" ? "selected" : ""}>resolved</option>
                  <option value="closed" ${item.status === "closed" ? "selected" : ""}>closed</option>
                  <option value="archived" ${item.status === "archived" ? "selected" : ""}>archived</option>
                </select>
                <button class="status-btn" data-update-status data-type="contact-submissions" data-id="${escapeHTML(item.id)}">Update Status</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

async function updateOrderBilling(id, payload) {
  await fetchJson(`${API_BASE}/orders/${id}/billing`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function getBillingUpdateConfirmMessage(id, payload = {}) {
  const billingStatus = String(payload.billingStatus || "").replace(/_/g, " ");
  const paymentStatus = getPaymentStatusLabel(payload.paymentStatus);

  return [
    `Update billing for order ${id}?`,
    `Billing Status: ${billingStatus || "not set"}`,
    `Payment Status: ${paymentStatus || "not set"}`,
    "",
    "Only continue if the operator has confirmed this change."
  ].join("\n");
}

function bindTabs() {
  const tabs = [...document.querySelectorAll(".admin-tab[data-tab]")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      tabs.forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");
      state.activeTab = tab.dataset.tab;
      await loadTabData();
    });
  });
}

function bindHotelFilter() {
  const select = $("#hotelFilter");
  if (!select) return;

  select.addEventListener("change", async () => {
    syncMenuFormHotelSlug({ force: true });
    syncGalleryFormHotelSlug({ force: true });
    syncNotificationSettingsHotelSlug();
    syncQrTableLinkHotelSlug({ force: true });
    await loadTabData();
  });
}

function bindListFilters() {
  document.addEventListener("input", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches("[data-menu-item-search]")) {
      const nextValue = target.value || "";
      const selectionStart = target.selectionStart ?? nextValue.length;
      const selectionEnd = target.selectionEnd ?? nextValue.length;

      state.menuItemSearchQuery = nextValue;

      if (state.activeTab === "menu-items") {
        renderMenuItems();

        const nextInput = document.querySelector("[data-menu-item-search]");
        if (nextInput instanceof HTMLInputElement) {
          nextInput.focus();

          try {
            nextInput.setSelectionRange(selectionStart, selectionEnd);
          } catch (error) {
            console.warn("Menu item search cursor restore failed:", error);
          }
        }
      }
    }
  });
}

function openUploadSectionWithConfig({
  hotelSlug = "",
  folder = "misc",
  targetFieldId = "",
  storageTargetFieldId = ""
} = {}) {
  const uploadHotelSlugInput = document.getElementById("uploadHotelSlugInput");
  const uploadFolderInput = document.getElementById("uploadFolderInput");
  const uploadTargetFieldInput = document.getElementById("uploadTargetFieldInput");
  const uploadStorageTargetFieldInput = document.getElementById("uploadStorageTargetFieldInput");

  if (uploadHotelSlugInput) uploadHotelSlugInput.value = hotelSlug || "shared";
  if (uploadFolderInput) uploadFolderInput.value = folder || "misc";
  if (uploadTargetFieldInput) uploadTargetFieldInput.value = targetFieldId || "";
  if (uploadStorageTargetFieldInput) {
    uploadStorageTargetFieldInput.value = storageTargetFieldId || "";
  }

  setSectionVisibility("uploadSection", true);
  scrollSectionIntoView("uploadSection");
}

function bindStatusActions() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-update-status]");
    if (!btn) return;

    const { type, id } = btn.dataset;
    const select = document.querySelector(
      `.status-select[data-type="${type}"][data-id="${id}"]`
    );

    if (!select) return;

    try {
      btn.disabled = true;
      btn.textContent = "Updating...";

      await updateStatus(type, id, select.value);
      await loadTabData();
    } catch (error) {
      console.error("Status update failed:", error);
      alert("Failed to update status");
    } finally {
      btn.disabled = false;
      btn.textContent = "Update Status";
    }
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-update-order-billing]");
    if (!btn) return;

    const { id } = btn.dataset;
    const billingSelect = document.querySelector(
      `.order-billing-select[data-order-billing-field="billingStatus"][data-id="${id}"]`
    );
    const paymentSelect = document.querySelector(
      `.order-billing-select[data-order-billing-field="paymentStatus"][data-id="${id}"]`
    );

    if (!billingSelect || !paymentSelect) return;

    const nextBillingStatus = billingSelect.value;
    const nextPaymentStatus = paymentSelect.value;
    const confirmed = window.confirm(
      getBillingUpdateConfirmMessage(id, {
        billingStatus: nextBillingStatus,
        paymentStatus: nextPaymentStatus
      })
    );

    if (!confirmed) return;

    try {
      btn.disabled = true;
      btn.textContent = "Updating...";

      await updateOrderBilling(id, {
        billingStatus: nextBillingStatus,
        paymentStatus: nextPaymentStatus
      });
      await loadTabData();
    } catch (error) {
      console.error("Billing update failed:", error);
      alert("Failed to update billing");
    } finally {
      btn.disabled = false;
      btn.textContent = "Update Billing";
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-print-order-bill]");
    if (!btn) return;

    const { id } = btn.dataset;
    const order = state.orders.find((item) => String(item.id) === String(id));

    if (!order) {
      alert("Order not found in the current dashboard list.");
      return;
    }

    openOrderBillPrintView(order);
  });
}

function bindFormToggles() {
  const hotelBtn = document.getElementById("openHotelFormBtn");
  const menuBtn = document.getElementById("openMenuFormBtn");
  const galleryBtn = document.getElementById("openGalleryFormBtn");
  const testimonialBtn = document.getElementById("openTestimonialFormBtn");
  const notificationSettingsBtn = document.getElementById(
    "openNotificationSettingsBtn"
  );
  const paymentRouteSettingsBtn = document.getElementById(
    "openPaymentRouteSettingsBtn"
  );
  const profileBtn = document.getElementById("openProfileFormBtn");
  const qrTableLinkBtn = document.getElementById("openQrTableLinkBtn");

  if (
    notificationSettingsBtn &&
    notificationSettingsBtn.dataset.boundClick !== "true"
  ) {
    notificationSettingsBtn.addEventListener("click", async () => {
      syncNotificationSettingsHotelSlug({ force: true });
      const isVisible = setSectionVisibility("notificationSettingsSection");

      if (!isVisible) return;

      const hotelSlug =
        document.getElementById("notificationSettingsHotelSlugInput")?.value.trim() || "";

      if (hotelSlug) {
        try {
          const result = await fetchNotificationSettings(hotelSlug);
          fillNotificationSettingsForm(result.settings || {});
        } catch (error) {
          console.error("Failed to load notification settings:", error);
          alert(error.message || "Failed to load notification settings");
        }
      } else {
        resetNotificationSettingsForm();
      }

      scrollSectionIntoView("notificationSettingsSection");
    });
    notificationSettingsBtn.dataset.boundClick = "true";
  }

  if (
    paymentRouteSettingsBtn &&
    paymentRouteSettingsBtn.dataset.boundClick !== "true"
  ) {
    paymentRouteSettingsBtn.addEventListener("click", async () => {
      syncPaymentRouteSettingsHotelSlug({ force: true });
      const isVisible = setSectionVisibility("paymentRouteSettingsSection");

      if (!isVisible) return;

      const hotelSlug =
        document.getElementById("paymentRouteHotelSlugInput")?.value.trim() || "";

      if (hotelSlug) {
        try {
          const result = await fetchPaymentRouteSettings(hotelSlug);
          fillPaymentRouteSettingsForm(result.settings || {});
          const help = document.getElementById("paymentRouteSettingsHelp");

          if (help && result.schemaReady === false) {
            help.textContent =
              "Run the hotel payment Route settings SQL script before saving.";
          }
        } catch (error) {
          console.error("Failed to load payment Route settings:", error);
          alert(error.message || "Failed to load payment Route settings");
        }
      } else {
        resetPaymentRouteSettingsForm();
      }

      scrollSectionIntoView("paymentRouteSettingsSection");
    });
    paymentRouteSettingsBtn.dataset.boundClick = "true";
  }

  if (profileBtn) {
    profileBtn.addEventListener("click", () => {
      const isVisible = setSectionVisibility("profileFormSection");
      if (isVisible) {
        scrollSectionIntoView("profileFormSection");
      }
  });
}

  if (qrTableLinkBtn) {
    qrTableLinkBtn.addEventListener("click", () => {
      syncQrTableLinkHotelSlug({ force: true });
      const isVisible = setSectionVisibility("qrTableLinkSection");
      if (isVisible) {
        scrollSectionIntoView("qrTableLinkSection");
      }
    });
  }

  if (hotelBtn) {
    hotelBtn.addEventListener("click", () => {
      const isVisible = setSectionVisibility("hotelFormSection");
      if (isVisible) {
        scrollSectionIntoView("hotelFormSection");
      }
    });
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      syncMenuFormHotelSlug({ force: true });
      const isVisible = setSectionVisibility("menuFormSection");
      if (isVisible) {
        scrollSectionIntoView("menuFormSection");
      }
    });
  }

  if (galleryBtn) {
    galleryBtn.addEventListener("click", () => {
      syncGalleryFormHotelSlug({ force: true });
      const isVisible = setSectionVisibility("galleryFormSection");
      if (isVisible) {
        scrollSectionIntoView("galleryFormSection");
      }
    });
  }

  if (testimonialBtn) {
    testimonialBtn.addEventListener("click", () => {
      syncTestimonialFormHotelSlug({ force: true });
      const isVisible = setSectionVisibility("testimonialFormSection");
      if (isVisible) {
        scrollSectionIntoView("testimonialFormSection");
      }
    });
  }
}

function bindQrTableLinkHelper() {
  const form = document.getElementById("qrTableLinkForm");
  const copyBtn = document.getElementById("copyQrTableLinkBtn");
  const previewLink = document.getElementById("qrTableLinkPreview");
  const inputs = [
    document.getElementById("qrLinkHotelSlugInput"),
    document.getElementById("qrLinkTableNumberInput"),
    document.getElementById("qrLinkTargetPageInput")
  ].filter(Boolean);

  if (form && form.dataset.boundSubmit !== "true") {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void generateQrTableLink();
    });
    form.dataset.boundSubmit = "true";
  }

  if (copyBtn && copyBtn.dataset.boundClick !== "true") {
    copyBtn.addEventListener("click", () => {
      void copyQrTableLink();
    });
    copyBtn.dataset.boundClick = "true";
  }

  if (previewLink && previewLink.dataset.boundClick !== "true") {
    previewLink.addEventListener("click", (event) => {
      if (!previewLink.getAttribute("href") || previewLink.getAttribute("href") === "#") {
        event.preventDefault();
        void generateQrTableLink();
      }
    });
    previewLink.dataset.boundClick = "true";
  }

  inputs.forEach((input) => {
    if (input.dataset.boundQrLinkChange === "true") return;
    input.addEventListener("input", () => {
      updateQrTableLinkOutput("", "QR link inputs changed. Generate a fresh link before copying.");
    });
    input.addEventListener("change", () => {
      updateQrTableLinkOutput("", "QR link inputs changed. Generate a fresh link before copying.");
    });
    input.dataset.boundQrLinkChange = "true";
  });
}

function bindGalleryUploadHelper() {
  const btn = document.getElementById("galleryUploadHelperBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const hotelSlug =
      document.getElementById("galleryHotelSlugInput")?.value.trim() ||
      getSelectedHotelSlug() ||
      "shared";

    openUploadSectionWithConfig({
      hotelSlug,
      folder: "gallery",
      targetFieldId: "galleryImageUrlInput",
      storageTargetFieldId: "galleryStoragePathInput"
    });
  });
}

function bindProfileAboutImageUploadHelpers() {
  const helperConfigs = [
    {
      buttonId: "profileAboutPrimaryImageUploadBtn",
      targetFieldId: "profileAboutPrimaryImageUrlInput"
    },
    {
      buttonId: "profileAboutSecondaryImageUploadBtn",
      targetFieldId: "profileAboutSecondaryImageUrlInput"
    }
  ];

  helperConfigs.forEach(({ buttonId, targetFieldId }) => {
    const btn = document.getElementById(buttonId);
    if (!btn || btn.dataset.boundClick === "true") return;

    btn.addEventListener("click", () => {
      const hotelSlug =
        document.getElementById("profileHotelSlugInput")?.value.trim() ||
        getSelectedHotelSlug() ||
        "shared";

      openUploadSectionWithConfig({
        hotelSlug,
        folder: "about",
        targetFieldId
      });
    });

    btn.dataset.boundClick = "true";
  });
}

async function createHotel(payload) {
  return fetchJson(`${API_BASE}/hotels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function updateHotel(id, payload) {
  return fetchJson(`${API_BASE}/hotels/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function createMenuItem(payload) {
  return fetchJson(`${API_BASE}/menu-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function updateMenuItem(id, payload) {
  return fetchJson(`${API_BASE}/menu-items/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function createGalleryItem(payload) {
  return fetchJson(`${API_BASE}/gallery-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function updateGalleryItem(id, payload) {
  return fetchJson(`${API_BASE}/gallery-items/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function createTestimonial(payload) {
  return fetchJson(`${API_BASE}/testimonials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function updateTestimonial(id, payload) {
  return fetchJson(`${API_BASE}/testimonials/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function bindHotelForm() {
  const form = document.getElementById("hotelForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.submitter || form.querySelector('button[type="submit"]');
    const id = document.getElementById("hotelId")?.value.trim();
    const currentlySelectedHotelId = getSelectedHotel()?.id;

    const payload = {
      slug: document.getElementById("hotelSlugInput")?.value.trim(),
      name: document.getElementById("hotelNameInput")?.value.trim(),
      whatsappNumber: document.getElementById("hotelWhatsappInput")?.value.trim(),
      upiId: document.getElementById("hotelUpiInput")?.value.trim(),
      gstPercent: Number(document.getElementById("hotelGstInput")?.value || 5),
      primaryDomain: document.getElementById("hotelPrimaryDomainInput")?.value.trim(),
      subdomain: document.getElementById("hotelSubdomainInput")?.value.trim(),
      isActive: !!document.getElementById("hotelIsActiveInput")?.checked
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = id ? "Updating hotel..." : "Creating hotel...";
      }

      if (id) {
        await updateHotel(id, payload);
        alert("Hotel updated successfully");
      } else {
        await createHotel(payload);
        alert("Hotel created successfully");
      }

      await loadHotels();

      if (id && currentlySelectedHotelId && String(currentlySelectedHotelId) === String(id)) {
        const updatedHotel = state.hotels.find((entry) => String(entry.id) === String(id));
        if (updatedHotel) {
          setHotelFilterValue(updatedHotel.slug || updatedHotel.name || "");
        }
      }

      resetHotelForm();
      syncMenuFormHotelSlug({ force: true });
      syncGalleryFormHotelSlug({ force: true });
      await loadTabData();
    } catch (error) {
      console.error("Hotel form submit failed:", error);
      alert("Failed to save hotel");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Hotel";
      }
    }
  });
}

function bindMenuItemForm() {
  const form = document.getElementById("menuItemForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.submitter || form.querySelector('button[type="submit"]');
    const id = document.getElementById("menuItemDbId")?.value.trim();

    const payload = {
      hotelSlug: document.getElementById("menuHotelSlugInput")?.value.trim(),
      category: document.getElementById("menuCategoryInput")?.value.trim(),
      itemId: document.getElementById("menuItemIdInput")?.value.trim(),
      name: document.getElementById("menuNameInput")?.value.trim(),
      description: document.getElementById("menuDescriptionInput")?.value.trim(),
      price: Number(document.getElementById("menuPriceInput")?.value || 0),
      image: document.getElementById("menuImageInput")?.value.trim(),
      alt: document.getElementById("menuAltInput")?.value.trim(),
      badge: document.getElementById("menuBadgeInput")?.value.trim(),
      tag: document.getElementById("menuTagInput")?.value.trim(),
      sortOrder: Number(document.getElementById("menuSortOrderInput")?.value || 0),
      isAvailable: !!document.getElementById("menuIsAvailableInput")?.checked
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = id ? "Updating menu item..." : "Creating menu item...";
      }

      if (id) {
        await updateMenuItem(id, payload);
        alert("Menu item updated successfully");
      } else {
        await createMenuItem(payload);
        alert("Menu item created successfully");
      }

      resetMenuItemForm();

      if (state.activeTab === "menu-items") {
        await loadTabData();
      }
    } catch (error) {
      console.error("Menu form submit failed:", error);
      alert("Failed to save menu item");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Menu Item";
      }
    }
  });
}

function bindGalleryItemForm() {
  const form = document.getElementById("galleryItemForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.submitter || form.querySelector('button[type="submit"]');
    const id = document.getElementById("galleryItemDbId")?.value.trim();

    const payload = {
      hotelSlug: document.getElementById("galleryHotelSlugInput")?.value.trim(),
      imageUrl: document.getElementById("galleryImageUrlInput")?.value.trim(),
      storagePath: document.getElementById("galleryStoragePathInput")?.value.trim(),
      alt: document.getElementById("galleryAltInput")?.value.trim(),
      layoutVariant: document.getElementById("galleryLayoutVariantInput")?.value.trim() || "standard",
      sortOrder: Number(document.getElementById("gallerySortOrderInput")?.value || 0),
      isActive: !!document.getElementById("galleryIsActiveInput")?.checked
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = id ? "Updating gallery item..." : "Creating gallery item...";
      }

      if (id) {
        await updateGalleryItem(id, payload);
        alert("Gallery item updated successfully");
      } else {
        await createGalleryItem(payload);
        alert("Gallery item created successfully");
      }

      resetGalleryItemForm();

      if (state.activeTab === "gallery-items") {
        await loadTabData();
      }
    } catch (error) {
      console.error("Gallery form submit failed:", error);
      alert("Failed to save gallery item");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Gallery Item";
      }
    }
  });
}

function bindTestimonialForm() {
  const form = document.getElementById("testimonialForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.submitter || form.querySelector('button[type="submit"]');
    const id = document.getElementById("testimonialDbId")?.value.trim();

    const payload = {
      hotelSlug: document.getElementById("testimonialHotelSlugInput")?.value.trim(),
      name: document.getElementById("testimonialNameInput")?.value.trim(),
      role: document.getElementById("testimonialRoleInput")?.value.trim(),
      text: document.getElementById("testimonialTextInput")?.value.trim(),
      stars: Number(document.getElementById("testimonialStarsInput")?.value || 5),
      avatar: document.getElementById("testimonialAvatarInput")?.value.trim(),
      sortOrder: Number(document.getElementById("testimonialSortOrderInput")?.value || 0),
      isActive: !!document.getElementById("testimonialIsActiveInput")?.checked,
      isApproved: !!document.getElementById("testimonialIsApprovedInput")?.checked
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = id
          ? "Updating testimonial..."
          : "Creating testimonial...";
      }

      if (id) {
        await updateTestimonial(id, payload);
        alert("Testimonial updated successfully");
      } else {
        await createTestimonial(payload);
        alert("Testimonial created successfully");
      }

      resetTestimonialForm();

      if (state.activeTab === "testimonials") {
        await loadTabData();
      }
    } catch (error) {
      console.error("Testimonial form submit failed:", error);
      alert(error.message || "Failed to save testimonial");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Testimonial";
      }
    }
  });
}

async function fetchHotelProfile(slug) {
  return fetchJson(`${API_BASE}/hotel-profiles/${encodeURIComponent(slug)}`);
}

async function fetchNotificationSettings(slug) {
  return fetchJson(
    `${API_BASE}/notification-settings/${encodeURIComponent(slug)}`
  );
}

async function fetchPaymentRouteSettings(slug) {
  return fetchJson(
    `${API_BASE}/payment-route-settings/${encodeURIComponent(slug)}`
  );
}

async function saveHotelProfile(payload) {
  return fetchJson(`${API_BASE}/hotel-profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function saveNotificationSettings(payload) {
  return fetchJson(`${API_BASE}/notification-settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function savePaymentRouteSettings(payload) {
  return fetchJson(`${API_BASE}/payment-route-settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function parseJsonInput(value, fallback) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return fallback;

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error("Invalid JSON input");
  }
}

function parseJsonArrayInput(value, fallback, label) {
  const parsedValue = parseJsonInput(value, fallback);

  if (!Array.isArray(parsedValue)) {
    throw new Error(`${label} must be a JSON array.`);
  }

  return parsedValue;
}

function formatJson(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function cloneThemeValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value));
}

function getCurrentProfileHeroBase() {
  const currentHotelSlug = document.getElementById("profileHotelSlugInput")?.value.trim() || "";

  if (currentHotelSlug && currentHotelSlug === state.profileHeroHotelSlug) {
    return cloneThemeValue(state.profileHeroBase);
  }

  return {};
}

function getTrimmedInputValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function setInputValue(id, value) {
  const input = document.getElementById(id);
  if (!input) return;

  input.value = value || "";
}

function getValidProfileHeroScenePreset(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return PROFILE_HERO_SCENE_PRESETS[candidate] ? candidate : "";
}

function getOptionalNumberInputValue(id, label) {
  const rawValue = getTrimmedInputValue(id);

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsedValue;
}

function getOptionalPercentageInputValue(id, label) {
  const parsedValue = getOptionalNumberInputValue(id, label);

  if (parsedValue === null) {
    return null;
  }

  if (parsedValue < 0 || parsedValue > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }

  return parsedValue;
}

function getCurrentProfileThemeBase() {
  const currentHotelSlug = document.getElementById("profileHotelSlugInput")?.value.trim() || "";

  if (currentHotelSlug && currentHotelSlug === state.profileThemeHotelSlug) {
    return cloneThemeValue(state.profileThemeBase);
  }

  return {};
}

function validateCssColorValue(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return true;

  if (window.CSS && typeof window.CSS.supports === "function") {
    return window.CSS.supports("color", candidate);
  }

  return true;
}

function validateCssRadiusValue(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return true;

  if (window.CSS && typeof window.CSS.supports === "function") {
    return window.CSS.supports("border-radius", candidate);
  }

  return true;
}

function getValidProfileThemeTypographyPreset(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return PROFILE_THEME_FONT_PRESETS[candidate] ? candidate : "";
}

function getSelectedProfileThemeTypographyPreset() {
  return getValidProfileThemeTypographyPreset(
    document.getElementById("profileThemeTypographyPresetInput")?.value
  );
}

function getValidProfileThemeContainerPreset(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return PROFILE_THEME_CONTAINER_PRESETS[candidate] ? candidate : "";
}

function getSelectedProfileThemeContainerPreset() {
  return getValidProfileThemeContainerPreset(
    document.getElementById("profileThemeContainerPresetInput")?.value
  );
}

function getValidProfileThemeButtonPreset(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return PROFILE_THEME_BUTTON_PRESETS[candidate] ? candidate : "";
}

function getSelectedProfileThemeButtonPreset() {
  return getValidProfileThemeButtonPreset(
    document.getElementById("profileThemeButtonPresetInput")?.value
  );
}

function getValidProfileThemeHeroLayoutPreset(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return PROFILE_THEME_HERO_LAYOUT_PRESETS[candidate] ? candidate : "";
}

function getSelectedProfileThemeHeroLayoutPreset() {
  return getValidProfileThemeHeroLayoutPreset(
    document.getElementById("profileThemeHeroLayoutPresetInput")?.value
  );
}

function normalizeProfileThemeSectionOrder(order) {
  if (!Array.isArray(order)) return [];

  const seen = new Set();

  return order.reduce((nextOrder, value) => {
    const candidate = String(value || "").trim().toLowerCase();

    if (!PROFILE_THEME_SECTION_ORDER.includes(candidate) || seen.has(candidate)) {
      return nextOrder;
    }

    seen.add(candidate);
    nextOrder.push(candidate);
    return nextOrder;
  }, []);
}

function areThemeSectionOrdersEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function getEffectiveProfileThemeSectionOrder(theme) {
  const savedOrder = normalizeProfileThemeSectionOrder(theme?.sections?.order);

  return [
    ...savedOrder,
    ...PROFILE_THEME_SECTION_ORDER.filter((sectionId) => !savedOrder.includes(sectionId))
  ];
}

function getProfileThemeSectionVisibilityMap() {
  return {
    about: Boolean(document.getElementById("profileThemeShowAboutInput")?.checked),
    menu: true,
    reservation: Boolean(document.getElementById("profileThemeShowReservationInput")?.checked),
    events: Boolean(document.getElementById("profileThemeShowEventsInput")?.checked),
    gallery: Boolean(document.getElementById("profileThemeShowGalleryInput")?.checked),
    testimonials: Boolean(document.getElementById("profileThemeShowTestimonialsInput")?.checked),
    contact: true
  };
}

function syncProfileThemeSectionOrderList() {
  const list = document.getElementById("profileThemeSectionOrderList");
  if (!list) return;

  const items = [...list.querySelectorAll("[data-theme-section-id]")];

  items.forEach((item, index) => {
    const indexEl = item.querySelector("[data-theme-order-index]");
    const upBtn = item.querySelector('[data-move-theme-section="up"]');
    const downBtn = item.querySelector('[data-move-theme-section="down"]');

    if (indexEl) {
      indexEl.textContent = String(index + 1);
    }

    if (upBtn) {
      upBtn.disabled = index === 0;
    }

    if (downBtn) {
      downBtn.disabled = index === items.length - 1;
    }
  });
}

function syncProfileThemeSectionOrderStates() {
  const list = document.getElementById("profileThemeSectionOrderList");
  if (!list) return;

  const visibilityMap = getProfileThemeSectionVisibilityMap();

  [...list.querySelectorAll("[data-theme-section-id]")].forEach((item) => {
    const sectionId = item.dataset.themeSectionId || "";
    const stateEl = item.querySelector("[data-theme-order-state]");

    if (!stateEl) return;

    const isVisible = visibilityMap[sectionId] !== false;

    stateEl.textContent = isVisible ? "Visible" : "Hidden";
    stateEl.classList.toggle("is-hidden", !isVisible);
    item.setAttribute("data-theme-section-hidden", isVisible ? "false" : "true");
  });
}

function renderProfileThemeSectionOrder(order) {
  const list = document.getElementById("profileThemeSectionOrderList");
  if (!list) return;

  const effectiveOrder = normalizeProfileThemeSectionOrder(order);
  const orderedSections = effectiveOrder.length
    ? effectiveOrder
    : [...PROFILE_THEME_SECTION_ORDER];

  list.innerHTML = orderedSections
    .map(
      (sectionId, index) => `
        <div class="theme-order-item" data-theme-section-id="${escapeHTML(sectionId)}">
          <div class="theme-order-label">
            <span class="theme-order-index" data-theme-order-index>${index + 1}</span>
            <div class="theme-order-meta">
              <span class="theme-order-name">${escapeHTML(
                PROFILE_THEME_SECTION_LABELS[sectionId] || sectionId
              )}</span>
              <span class="theme-order-state" data-theme-order-state>Visible</span>
            </div>
          </div>
          <div class="theme-order-actions">
            <button
              type="button"
              class="admin-tab"
              data-move-theme-section="up"
              aria-label="Move ${escapeHTML(
                PROFILE_THEME_SECTION_LABELS[sectionId] || sectionId
              )} up"
            >
              Up
            </button>
            <button
              type="button"
              class="admin-tab"
              data-move-theme-section="down"
              aria-label="Move ${escapeHTML(
                PROFILE_THEME_SECTION_LABELS[sectionId] || sectionId
              )} down"
            >
              Down
            </button>
          </div>
        </div>
      `
    )
    .join("");

  syncProfileThemeSectionOrderList();
  syncProfileThemeSectionOrderStates();
}

function getCurrentProfileThemeSectionOrder() {
  const list = document.getElementById("profileThemeSectionOrderList");
  if (!list) {
    return [...PROFILE_THEME_SECTION_ORDER];
  }

  return normalizeProfileThemeSectionOrder(
    [...list.querySelectorAll("[data-theme-section-id]")].map(
      (item) => item.dataset.themeSectionId || ""
    )
  );
}

function syncProfileThemeSectionOrderDirtyState() {
  const loadedOrder = getEffectiveProfileThemeSectionOrder(getCurrentProfileThemeBase());
  const currentOrder = getCurrentProfileThemeSectionOrder();

  state.profileThemeSectionOrderDirty = !areThemeSectionOrdersEqual(currentOrder, loadedOrder);
}

function moveProfileThemeSectionOrder(button) {
  const list = document.getElementById("profileThemeSectionOrderList");
  const item = button?.closest("[data-theme-section-id]");
  const direction = button?.dataset.moveThemeSection;

  if (!list || !item || !direction) return;

  if (direction === "up") {
    const previousItem = item.previousElementSibling;
    if (!previousItem) return;
    list.insertBefore(item, previousItem);
  } else if (direction === "down") {
    const nextItem = item.nextElementSibling;
    if (!nextItem) return;
    list.insertBefore(nextItem, item);
  } else {
    return;
  }

  syncProfileThemeSectionOrderList();
  syncProfileThemeSectionOrderStates();
  syncProfileThemeSectionOrderDirtyState();
}

function validateProfileThemeInputs(form) {
  const fields = [
    {
      id: "profileThemePrimaryInput",
      label: "Primary accent color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemePrimaryLightInput",
      label: "Primary light color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemePrimaryDarkInput",
      label: "Primary dark color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeBackgroundInput",
      label: "Background color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeBackgroundAltInput",
      label: "Alternate background color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeTextInput",
      label: "Text color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeTextMutedInput",
      label: "Muted text color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeLoadingBackgroundColorInput",
      label: "Loader background color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeLoadingAccentColorInput",
      label: "Loader accent color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeLoadingTextColorInput",
      label: "Loader text color",
      isValid: validateCssColorValue
    },
    {
      id: "profileThemeRadiusBaseInput",
      label: "Base radius",
      isValid: validateCssRadiusValue
    },
    {
      id: "profileThemeRadiusSmallInput",
      label: "Small radius",
      isValid: validateCssRadiusValue
    }
  ];

  let firstInvalidInput = null;

  fields.forEach(({ id, label, isValid }) => {
    const input = form.querySelector(`#${id}`);
    if (!input) return;

    input.setCustomValidity("");

    const value = input.value.trim();
    if (!value || isValid(value)) return;

    input.setCustomValidity(
      `${label} must be a valid CSS ${id.includes("Radius") ? "border-radius" : "color"} value.`
    );

    if (!firstInvalidInput) {
      firstInvalidInput = input;
    }
  });

  if (firstInvalidInput) {
    firstInvalidInput.reportValidity();
    firstInvalidInput.focus();
    return false;
  }

  return true;
}

function fillProfileThemeFields(theme) {
  const safeTheme = cloneThemeValue(theme);
  const colors =
    safeTheme.colors && typeof safeTheme.colors === "object" && !Array.isArray(safeTheme.colors)
      ? safeTheme.colors
      : {};
  const radius =
    safeTheme.radius && typeof safeTheme.radius === "object" && !Array.isArray(safeTheme.radius)
      ? safeTheme.radius
      : {};
  const typography =
    safeTheme.typography &&
    typeof safeTheme.typography === "object" &&
    !Array.isArray(safeTheme.typography)
      ? safeTheme.typography
      : {};
  const layout =
    safeTheme.layout &&
    typeof safeTheme.layout === "object" &&
    !Array.isArray(safeTheme.layout)
      ? safeTheme.layout
      : {};
  const buttons =
    safeTheme.buttons &&
    typeof safeTheme.buttons === "object" &&
    !Array.isArray(safeTheme.buttons)
      ? safeTheme.buttons
      : {};
  const hero =
    safeTheme.hero && typeof safeTheme.hero === "object" && !Array.isArray(safeTheme.hero)
      ? safeTheme.hero
      : {};
  const loadingScreen =
    safeTheme.loadingScreen &&
    typeof safeTheme.loadingScreen === "object" &&
    !Array.isArray(safeTheme.loadingScreen)
      ? safeTheme.loadingScreen
      : {};
  const payment =
    safeTheme.payment && typeof safeTheme.payment === "object" && !Array.isArray(safeTheme.payment)
      ? safeTheme.payment
      : {};
  const content =
    safeTheme.content && typeof safeTheme.content === "object" && !Array.isArray(safeTheme.content)
      ? safeTheme.content
      : {};
  const navLabels =
    content.navLabels && typeof content.navLabels === "object" && !Array.isArray(content.navLabels)
      ? content.navLabels
      : {};
  const menuSection =
    content.menuSection &&
    typeof content.menuSection === "object" &&
    !Array.isArray(content.menuSection)
      ? content.menuSection
      : {};
  const menuCategories =
    content.menuCategories &&
    typeof content.menuCategories === "object" &&
    !Array.isArray(content.menuCategories)
      ? content.menuCategories
      : {};
  const ctaLabels =
    content.ctaLabels && typeof content.ctaLabels === "object" && !Array.isArray(content.ctaLabels)
      ? content.ctaLabels
      : {};
  const footerLabels =
    content.footerLabels &&
    typeof content.footerLabels === "object" &&
    !Array.isArray(content.footerLabels)
      ? content.footerLabels
      : {};
  const sections =
    safeTheme.sections &&
    typeof safeTheme.sections === "object" &&
    !Array.isArray(safeTheme.sections)
      ? safeTheme.sections
      : {};

  document.getElementById("profileThemePrimaryInput").value = colors.primary || "";
  document.getElementById("profileThemePrimaryLightInput").value = colors.primaryLight || "";
  document.getElementById("profileThemePrimaryDarkInput").value = colors.primaryDark || "";
  document.getElementById("profileThemeBackgroundInput").value = colors.background || "";
  document.getElementById("profileThemeBackgroundAltInput").value = colors.backgroundAlt || "";
  document.getElementById("profileThemeTextInput").value = colors.text || "";
  document.getElementById("profileThemeTextMutedInput").value = colors.textMuted || "";
  document.getElementById("profileThemeRadiusBaseInput").value = radius.base || "";
  document.getElementById("profileThemeRadiusSmallInput").value = radius.small || "";
  document.getElementById("profileThemeLoadingLogoPrimaryInput").value =
    loadingScreen.logoPrimaryText || "";
  document.getElementById("profileThemeLoadingLogoSecondaryInput").value =
    loadingScreen.logoSecondaryText || "";
  document.getElementById("profileThemeLoadingTaglineInput").value =
    loadingScreen.tagline || "";
  document.getElementById("profileThemeLoadingBackgroundColorInput").value =
    loadingScreen.backgroundColor || "";
  document.getElementById("profileThemeLoadingAccentColorInput").value =
    loadingScreen.accentColor || "";
  document.getElementById("profileThemeLoadingTextColorInput").value =
    loadingScreen.textColor || "";
  document.getElementById("profileUpiDiscountPercentInput").value =
    payment.upiDiscountPercent ?? "";
  document.getElementById("profileDeliveryChargeInput").value =
    payment.deliveryCharge ?? "";
  setInputValue("profileNavLabelAboutInput", navLabels.about);
  setInputValue("profileNavLabelMenuInput", navLabels.menu);
  setInputValue("profileNavLabelGalleryInput", navLabels.gallery);
  setInputValue("profileNavLabelEventsInput", navLabels.events);
  setInputValue("profileNavLabelTestimonialsInput", navLabels.testimonials);
  setInputValue("profileNavLabelContactInput", navLabels.contact);
  setInputValue("profileNavLabelReservationInput", navLabels.reservation);
  setInputValue("profileMenuSectionEyebrowInput", menuSection.eyebrow);
  setInputValue("profileMenuSectionTitleInput", menuSection.title);
  setInputValue("profileMenuSectionSubtitleInput", menuSection.subtitle);
  setInputValue("profileMenuViewFullLabelInput", menuSection.viewFullMenu);
  setInputValue("profileFullMenuSectionEyebrowInput", menuSection.fullEyebrow);
  setInputValue("profileFullMenuSectionTitleInput", menuSection.fullTitle);
  setInputValue("profileFullMenuSectionSubtitleInput", menuSection.fullSubtitle);
  setInputValue("profileMenuCategoryStartersInput", menuCategories.starters);
  setInputValue("profileMenuCategoryMainsInput", menuCategories.mains);
  setInputValue("profileMenuCategoryDessertsInput", menuCategories.desserts);
  setInputValue("profileMenuCategoryDrinksInput", menuCategories.drinks);
  setInputValue("profileCtaHeroPrimaryInput", ctaLabels.heroPrimary);
  setInputValue("profileCtaHeroReservationInput", ctaLabels.heroReservation);
  setInputValue("profileCtaAboutReservationInput", ctaLabels.aboutReservation);
  setInputValue("profileCtaCartButtonInput", ctaLabels.cartButton);
  setInputValue("profileCtaMenuScrollHintInput", ctaLabels.menuScrollHint);
  setInputValue("profileCtaLoadMoreInput", ctaLabels.loadMore);
  setInputValue("profileCtaLoadMoreHintInput", ctaLabels.loadMoreHint);
  setInputValue("profileFooterLabelExploreHeadingInput", footerLabels.exploreHeading);
  setInputValue("profileFooterLabelAboutInput", footerLabels.about);
  setInputValue("profileFooterLabelMenuInput", footerLabels.menu);
  setInputValue("profileFooterLabelGalleryInput", footerLabels.gallery);
  setInputValue("profileFooterLabelEventsInput", footerLabels.events);
  setInputValue("profileFooterLabelReviewsInput", footerLabels.reviews);
  setInputValue("profileFooterLabelReservationsHeadingInput", footerLabels.reservationsHeading);
  setInputValue("profileFooterLabelBookTableInput", footerLabels.bookTable);
  setInputValue("profileFooterLabelPrivateDiningInput", footerLabels.privateDining);
  setInputValue("profileFooterLabelContactInput", footerLabels.contact);
  setInputValue("profileFooterLabelOpeningHoursHeadingInput", footerLabels.openingHoursHeading);
  setInputValue("profileFooterLabelFindUsHeadingInput", footerLabels.findUsHeading);
  setInputValue("profileFooterLabelCopyrightSuffixInput", footerLabels.copyrightSuffix);
  document.getElementById("profileThemeTypographyPresetInput").value =
    getValidProfileThemeTypographyPreset(typography.preset);
  document.getElementById("profileThemeContainerPresetInput").value =
    getValidProfileThemeContainerPreset(layout.containerPreset);
  document.getElementById("profileThemeButtonPresetInput").value =
    getValidProfileThemeButtonPreset(buttons.preset);
  document.getElementById("profileThemeHeroLayoutPresetInput").value =
    getValidProfileThemeHeroLayoutPreset(hero.layoutVariant);
  document.getElementById("profileThemeShowAboutInput").checked = sections.about !== false;
  document.getElementById("profileThemeShowEventsInput").checked = sections.events !== false;
  document.getElementById("profileThemeShowReservationInput").checked =
    sections.reservation !== false;
  document.getElementById("profileThemeShowGalleryInput").checked = sections.gallery !== false;
  document.getElementById("profileThemeShowTestimonialsInput").checked =
    sections.testimonials !== false;
  renderProfileThemeSectionOrder(getEffectiveProfileThemeSectionOrder(safeTheme));
  syncProfileThemeSectionOrderDirtyState();
}

function getThemePreviewColorValue(inputId, baseValue, defaultValue) {
  const currentValue = getTrimmedInputValue(inputId);
  if (currentValue && validateCssColorValue(currentValue)) {
    return currentValue;
  }

  return baseValue || defaultValue;
}

function getThemePreviewRadiusValue(inputId, baseValue, defaultValue) {
  const currentValue = getTrimmedInputValue(inputId);
  if (currentValue && validateCssRadiusValue(currentValue)) {
    return currentValue;
  }

  return baseValue || defaultValue;
}

function getThemePreviewFontPreset(baseTheme) {
  const selectedPreset = getSelectedProfileThemeTypographyPreset();
  if (selectedPreset) {
    return PROFILE_THEME_FONT_PRESETS[selectedPreset];
  }

  const basePreset = getValidProfileThemeTypographyPreset(baseTheme?.typography?.preset);
  return PROFILE_THEME_FONT_PRESETS[basePreset] || PROFILE_THEME_FONT_PRESETS.default;
}

function getThemePreviewButtonPreset(baseTheme) {
  const selectedPreset = getSelectedProfileThemeButtonPreset();
  if (selectedPreset) return selectedPreset;

  const basePreset = getValidProfileThemeButtonPreset(baseTheme?.buttons?.preset);
  return basePreset || "default";
}

function getThemePreviewHeroLayoutPreset(baseTheme) {
  const selectedPreset = getSelectedProfileThemeHeroLayoutPreset();
  if (selectedPreset) return selectedPreset;

  const basePreset = getValidProfileThemeHeroLayoutPreset(baseTheme?.hero?.layoutVariant);
  return basePreset || "default";
}

function getThemePreviewButtonStyles(presetKey, colors) {
  if (presetKey === "solid") {
    return {
      radius: "14px",
      primaryBackground: colors.primary,
      primaryBorder: `1px solid ${colors.primaryDark}`,
      primaryShadow: "0 4px 16px rgba(201, 168, 76, 0.28)",
      outlineBorder: `1px solid ${colors.primary}`,
      outlineBackground: "transparent"
    };
  }

  if (presetKey === "crisp") {
    return {
      radius: "8px",
      primaryBackground: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
      primaryBorder: `1px solid ${colors.primaryDark}`,
      primaryShadow: "0 4px 18px rgba(160, 120, 48, 0.28)",
      outlineBorder: "1.5px solid rgba(255, 255, 255, 0.75)",
      outlineBackground: "transparent"
    };
  }

  return {
    radius: "100px",
    primaryBackground: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
    primaryBorder: "1px solid transparent",
    primaryShadow: "0 4px 20px rgba(201, 168, 76, 0.35)",
    outlineBorder: "1.5px solid rgba(255, 255, 255, 0.6)",
    outlineBackground: "transparent"
  };
}

function updateProfileThemePreview() {
  const previewCard = document.getElementById("profileThemePreviewCard");
  const previewTop = document.getElementById("profileThemePreviewTop");
  const previewSurface = document.getElementById("profileThemePreviewSurface");
  const previewEyebrow = document.getElementById("profileThemePreviewEyebrow");
  const previewTitle = document.getElementById("profileThemePreviewTitle");
  const previewBody = document.getElementById("profileThemePreviewBody");
  const previewMuted = document.getElementById("profileThemePreviewMuted");
  const previewOutlineBtn = document.getElementById("profileThemePreviewOutlineBtn");
  const previewPrimaryBtn = document.getElementById("profileThemePreviewPrimaryBtn");
  const previewChip = document.getElementById("profileThemePreviewChip");

  if (
    !previewCard ||
    !previewTop ||
    !previewSurface ||
    !previewEyebrow ||
    !previewTitle ||
    !previewBody ||
    !previewMuted ||
    !previewOutlineBtn ||
    !previewPrimaryBtn ||
    !previewChip
  ) {
    return;
  }

  const baseTheme = getCurrentProfileThemeBase();
  const baseColors =
    baseTheme.colors && typeof baseTheme.colors === "object" && !Array.isArray(baseTheme.colors)
      ? baseTheme.colors
      : {};
  const baseRadius =
    baseTheme.radius && typeof baseTheme.radius === "object" && !Array.isArray(baseTheme.radius)
      ? baseTheme.radius
      : {};
  const fontPreset = getThemePreviewFontPreset(baseTheme);
  const buttonPresetKey = getThemePreviewButtonPreset(baseTheme);
  const heroLayoutPresetKey = getThemePreviewHeroLayoutPreset(baseTheme);

  const colors = {
    primary: getThemePreviewColorValue(
      "profileThemePrimaryInput",
      baseColors.primary,
      PROFILE_THEME_DEFAULTS.colors.primary
    ),
    primaryLight: getThemePreviewColorValue(
      "profileThemePrimaryLightInput",
      baseColors.primaryLight,
      PROFILE_THEME_DEFAULTS.colors.primaryLight
    ),
    primaryDark: getThemePreviewColorValue(
      "profileThemePrimaryDarkInput",
      baseColors.primaryDark,
      PROFILE_THEME_DEFAULTS.colors.primaryDark
    ),
    background: getThemePreviewColorValue(
      "profileThemeBackgroundInput",
      baseColors.background,
      PROFILE_THEME_DEFAULTS.colors.background
    ),
    backgroundAlt: getThemePreviewColorValue(
      "profileThemeBackgroundAltInput",
      baseColors.backgroundAlt,
      PROFILE_THEME_DEFAULTS.colors.backgroundAlt
    ),
    text: getThemePreviewColorValue(
      "profileThemeTextInput",
      baseColors.text,
      PROFILE_THEME_DEFAULTS.colors.text
    ),
    textMuted: getThemePreviewColorValue(
      "profileThemeTextMutedInput",
      baseColors.textMuted,
      PROFILE_THEME_DEFAULTS.colors.textMuted
    )
  };
  const radius = {
    base: getThemePreviewRadiusValue(
      "profileThemeRadiusBaseInput",
      baseRadius.base,
      PROFILE_THEME_DEFAULTS.radius.base
    ),
    small: getThemePreviewRadiusValue(
      "profileThemeRadiusSmallInput",
      baseRadius.small,
      PROFILE_THEME_DEFAULTS.radius.small
    )
  };
  const buttonStyles = getThemePreviewButtonStyles(buttonPresetKey, colors);

  previewCard.style.background = colors.backgroundAlt;
  previewCard.style.borderColor = colors.primaryDark;
  previewCard.style.borderRadius = radius.base;

  previewTop.style.background = colors.background;
  previewTop.style.borderColor = colors.primaryDark;
  previewTop.style.borderRadius = radius.base;

  previewSurface.style.background = colors.background;
  previewSurface.style.borderColor = colors.primaryDark;
  previewSurface.style.borderRadius = radius.base;

  previewEyebrow.style.color = colors.primary;
  previewEyebrow.style.fontFamily = fontPreset.body;
  previewTitle.style.color = colors.text;
  previewTitle.style.fontFamily = fontPreset.display;
  previewBody.style.color = colors.text;
  previewBody.style.fontFamily = fontPreset.body;
  previewMuted.style.color = colors.textMuted;
  previewMuted.style.fontFamily = fontPreset.body;

  previewOutlineBtn.style.borderColor = colors.primary;
  previewOutlineBtn.style.color = colors.primary;
  previewOutlineBtn.style.border = buttonStyles.outlineBorder;
  previewOutlineBtn.style.background = buttonStyles.outlineBackground;
  previewOutlineBtn.style.borderRadius = buttonStyles.radius;
  previewOutlineBtn.style.fontFamily = fontPreset.body;
  previewOutlineBtn.style.boxShadow = "none";

  previewPrimaryBtn.style.background = buttonStyles.primaryBackground;
  previewPrimaryBtn.style.color = "#ffffff";
  previewPrimaryBtn.style.border = buttonStyles.primaryBorder;
  previewPrimaryBtn.style.borderRadius = buttonStyles.radius;
  previewPrimaryBtn.style.fontFamily = fontPreset.body;
  previewPrimaryBtn.style.boxShadow = buttonStyles.primaryShadow;

  previewChip.style.background = colors.primaryLight;
  previewChip.style.color = colors.text;
  previewChip.style.borderColor = colors.primary;
  previewChip.style.borderRadius = radius.small;
  previewChip.style.fontFamily = fontPreset.body;
  previewChip.textContent = `Hero: ${
    PROFILE_THEME_HERO_LAYOUT_LABELS[heroLayoutPresetKey] || "Default"
  }`;
}

function buildProfileThemePayload(currentHotelSlug) {
  const baseTheme = currentHotelSlug ? getCurrentProfileThemeBase() : {};

  const nextTheme = cloneThemeValue(baseTheme);
  const colorValues = {
    primary: getTrimmedInputValue("profileThemePrimaryInput"),
    primaryLight: getTrimmedInputValue("profileThemePrimaryLightInput"),
    primaryDark: getTrimmedInputValue("profileThemePrimaryDarkInput"),
    background: getTrimmedInputValue("profileThemeBackgroundInput"),
    backgroundAlt: getTrimmedInputValue("profileThemeBackgroundAltInput"),
    text: getTrimmedInputValue("profileThemeTextInput"),
    textMuted: getTrimmedInputValue("profileThemeTextMutedInput")
  };
  const radiusValues = {
    base: getTrimmedInputValue("profileThemeRadiusBaseInput"),
    small: getTrimmedInputValue("profileThemeRadiusSmallInput")
  };
  const loadingScreenValues = {
    logoPrimaryText: getTrimmedInputValue("profileThemeLoadingLogoPrimaryInput"),
    logoSecondaryText: getTrimmedInputValue("profileThemeLoadingLogoSecondaryInput"),
    tagline: getTrimmedInputValue("profileThemeLoadingTaglineInput"),
    backgroundColor: getTrimmedInputValue("profileThemeLoadingBackgroundColorInput"),
    accentColor: getTrimmedInputValue("profileThemeLoadingAccentColorInput"),
    textColor: getTrimmedInputValue("profileThemeLoadingTextColorInput")
  };
  const navLabelValues = {
    about: getTrimmedInputValue("profileNavLabelAboutInput"),
    menu: getTrimmedInputValue("profileNavLabelMenuInput"),
    gallery: getTrimmedInputValue("profileNavLabelGalleryInput"),
    events: getTrimmedInputValue("profileNavLabelEventsInput"),
    testimonials: getTrimmedInputValue("profileNavLabelTestimonialsInput"),
    contact: getTrimmedInputValue("profileNavLabelContactInput"),
    reservation: getTrimmedInputValue("profileNavLabelReservationInput")
  };
  const menuSectionValues = {
    eyebrow: getTrimmedInputValue("profileMenuSectionEyebrowInput"),
    title: getTrimmedInputValue("profileMenuSectionTitleInput"),
    subtitle: getTrimmedInputValue("profileMenuSectionSubtitleInput"),
    viewFullMenu: getTrimmedInputValue("profileMenuViewFullLabelInput"),
    fullEyebrow: getTrimmedInputValue("profileFullMenuSectionEyebrowInput"),
    fullTitle: getTrimmedInputValue("profileFullMenuSectionTitleInput"),
    fullSubtitle: getTrimmedInputValue("profileFullMenuSectionSubtitleInput")
  };
  const menuCategoryValues = {
    starters: getTrimmedInputValue("profileMenuCategoryStartersInput"),
    mains: getTrimmedInputValue("profileMenuCategoryMainsInput"),
    desserts: getTrimmedInputValue("profileMenuCategoryDessertsInput"),
    drinks: getTrimmedInputValue("profileMenuCategoryDrinksInput")
  };
  const ctaLabelValues = {
    heroPrimary: getTrimmedInputValue("profileCtaHeroPrimaryInput"),
    heroReservation: getTrimmedInputValue("profileCtaHeroReservationInput"),
    aboutReservation: getTrimmedInputValue("profileCtaAboutReservationInput"),
    cartButton: getTrimmedInputValue("profileCtaCartButtonInput"),
    menuScrollHint: getTrimmedInputValue("profileCtaMenuScrollHintInput"),
    loadMore: getTrimmedInputValue("profileCtaLoadMoreInput"),
    loadMoreHint: getTrimmedInputValue("profileCtaLoadMoreHintInput")
  };
  const footerLabelValues = {
    exploreHeading: getTrimmedInputValue("profileFooterLabelExploreHeadingInput"),
    about: getTrimmedInputValue("profileFooterLabelAboutInput"),
    menu: getTrimmedInputValue("profileFooterLabelMenuInput"),
    gallery: getTrimmedInputValue("profileFooterLabelGalleryInput"),
    events: getTrimmedInputValue("profileFooterLabelEventsInput"),
    reviews: getTrimmedInputValue("profileFooterLabelReviewsInput"),
    reservationsHeading: getTrimmedInputValue("profileFooterLabelReservationsHeadingInput"),
    bookTable: getTrimmedInputValue("profileFooterLabelBookTableInput"),
    privateDining: getTrimmedInputValue("profileFooterLabelPrivateDiningInput"),
    contact: getTrimmedInputValue("profileFooterLabelContactInput"),
    openingHoursHeading: getTrimmedInputValue("profileFooterLabelOpeningHoursHeadingInput"),
    findUsHeading: getTrimmedInputValue("profileFooterLabelFindUsHeadingInput"),
    copyrightSuffix: getTrimmedInputValue("profileFooterLabelCopyrightSuffixInput")
  };
  const typographyPresetValue = getSelectedProfileThemeTypographyPreset();
  const containerPresetValue = getSelectedProfileThemeContainerPreset();
  const buttonPresetValue = getSelectedProfileThemeButtonPreset();
  const heroLayoutPresetValue = getSelectedProfileThemeHeroLayoutPreset();
  const upiDiscountPercent = getOptionalPercentageInputValue(
    "profileUpiDiscountPercentInput",
    "Google Pay / UPI discount percentage"
  );
  const deliveryCharge = getOptionalNumberInputValue(
    "profileDeliveryChargeInput",
    "Website delivery charge"
  );
  const showAbout = Boolean(document.getElementById("profileThemeShowAboutInput")?.checked);
  const showEvents = Boolean(document.getElementById("profileThemeShowEventsInput")?.checked);
  const showReservation = Boolean(
    document.getElementById("profileThemeShowReservationInput")?.checked
  );
  const showGallery = Boolean(document.getElementById("profileThemeShowGalleryInput")?.checked);
  const showTestimonials = Boolean(
    document.getElementById("profileThemeShowTestimonialsInput")?.checked
  );
  const sectionOrder = getCurrentProfileThemeSectionOrder();

  function applyManagedGroup(groupName, values) {
    const currentGroup =
      nextTheme[groupName] &&
      typeof nextTheme[groupName] === "object" &&
      !Array.isArray(nextTheme[groupName])
        ? { ...nextTheme[groupName] }
        : {};

    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        currentGroup[key] = value;
        return;
      }

      delete currentGroup[key];
    });

    if (Object.keys(currentGroup).length) {
      nextTheme[groupName] = currentGroup;
      return;
    }

    delete nextTheme[groupName];
  }

  function applyManagedContentGroup(groupName, values) {
    const currentContent =
      nextTheme.content &&
      typeof nextTheme.content === "object" &&
      !Array.isArray(nextTheme.content)
        ? { ...nextTheme.content }
        : {};
    const currentGroup =
      currentContent[groupName] &&
      typeof currentContent[groupName] === "object" &&
      !Array.isArray(currentContent[groupName])
        ? { ...currentContent[groupName] }
        : {};

    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        currentGroup[key] = value;
        return;
      }

      delete currentGroup[key];
    });

    if (Object.keys(currentGroup).length) {
      currentContent[groupName] = currentGroup;
    } else {
      delete currentContent[groupName];
    }

    if (Object.keys(currentContent).length) {
      nextTheme.content = currentContent;
      return;
    }

    delete nextTheme.content;
  }

  applyManagedGroup("colors", colorValues);
  applyManagedGroup("radius", radiusValues);
  applyManagedGroup("loadingScreen", loadingScreenValues);
  applyManagedContentGroup("navLabels", navLabelValues);
  applyManagedContentGroup("menuSection", menuSectionValues);
  applyManagedContentGroup("menuCategories", menuCategoryValues);
  applyManagedContentGroup("ctaLabels", ctaLabelValues);
  applyManagedContentGroup("footerLabels", footerLabelValues);

  if (deliveryCharge !== null && deliveryCharge < 0) {
    throw new Error("Website delivery charge must be 0 or more.");
  }

  if (upiDiscountPercent !== null || deliveryCharge !== null) {
    const nextPayment =
      nextTheme.payment && typeof nextTheme.payment === "object" && !Array.isArray(nextTheme.payment)
        ? { ...nextTheme.payment }
        : {};

    if (upiDiscountPercent !== null) {
      nextPayment.upiDiscountPercent = upiDiscountPercent;
    } else {
      delete nextPayment.upiDiscountPercent;
    }

    if (deliveryCharge !== null) {
      nextPayment.deliveryCharge = deliveryCharge;
    } else {
      delete nextPayment.deliveryCharge;
    }

    if (Object.keys(nextPayment).length) {
      nextTheme.payment = nextPayment;
    } else {
      delete nextTheme.payment;
    }
  } else if (nextTheme.payment && typeof nextTheme.payment === "object" && !Array.isArray(nextTheme.payment)) {
    const nextPayment = { ...nextTheme.payment };
    delete nextPayment.upiDiscountPercent;
    delete nextPayment.deliveryCharge;

    if (Object.keys(nextPayment).length) {
      nextTheme.payment = nextPayment;
    } else {
      delete nextTheme.payment;
    }
  }

  const currentTypography =
    nextTheme.typography &&
    typeof nextTheme.typography === "object" &&
    !Array.isArray(nextTheme.typography)
      ? { ...nextTheme.typography }
      : {};

  if (typographyPresetValue) {
    currentTypography.preset = typographyPresetValue;
  }

  if (Object.keys(currentTypography).length) {
    nextTheme.typography = currentTypography;
  } else {
    delete nextTheme.typography;
  }

  const currentLayout =
    nextTheme.layout &&
    typeof nextTheme.layout === "object" &&
    !Array.isArray(nextTheme.layout)
      ? { ...nextTheme.layout }
      : {};

  if (containerPresetValue) {
    currentLayout.containerPreset = containerPresetValue;
  }

  if (Object.keys(currentLayout).length) {
    nextTheme.layout = currentLayout;
  } else {
    delete nextTheme.layout;
  }

  const currentButtons =
    nextTheme.buttons &&
    typeof nextTheme.buttons === "object" &&
    !Array.isArray(nextTheme.buttons)
      ? { ...nextTheme.buttons }
      : {};

  if (buttonPresetValue) {
    currentButtons.preset = buttonPresetValue;
  }

  if (Object.keys(currentButtons).length) {
    nextTheme.buttons = currentButtons;
  } else {
    delete nextTheme.buttons;
  }

  const currentHero =
    nextTheme.hero && typeof nextTheme.hero === "object" && !Array.isArray(nextTheme.hero)
      ? { ...nextTheme.hero }
      : {};

  if (heroLayoutPresetValue === "default") {
    delete currentHero.layoutVariant;
  } else if (heroLayoutPresetValue) {
    currentHero.layoutVariant = heroLayoutPresetValue;
  }

  if (Object.keys(currentHero).length) {
    nextTheme.hero = currentHero;
  } else {
    delete nextTheme.hero;
  }

  const currentSections =
    nextTheme.sections &&
    typeof nextTheme.sections === "object" &&
    !Array.isArray(nextTheme.sections)
      ? { ...nextTheme.sections }
      : {};

  if (typeof baseTheme.sections?.about === "boolean" || showAbout === false) {
    currentSections.about = showAbout;
  } else {
    delete currentSections.about;
  }

  if (typeof baseTheme.sections?.events === "boolean" || showEvents === false) {
    currentSections.events = showEvents;
  } else {
    delete currentSections.events;
  }

  if (
    typeof baseTheme.sections?.reservation === "boolean" ||
    showReservation === false
  ) {
    currentSections.reservation = showReservation;
  } else {
    delete currentSections.reservation;
  }

  if (typeof baseTheme.sections?.gallery === "boolean" || showGallery === false) {
    currentSections.gallery = showGallery;
  } else {
    delete currentSections.gallery;
  }

  if (
    typeof baseTheme.sections?.testimonials === "boolean" ||
    showTestimonials === false
  ) {
    currentSections.testimonials = showTestimonials;
  } else {
    delete currentSections.testimonials;
  }

  if (state.profileThemeSectionOrderDirty) {
    if (areThemeSectionOrdersEqual(sectionOrder, PROFILE_THEME_SECTION_ORDER)) {
      delete currentSections.order;
    } else {
      currentSections.order = sectionOrder;
    }
  }

  if (Object.keys(currentSections).length) {
    nextTheme.sections = currentSections;
  } else {
    delete nextTheme.sections;
  }

  if (!Object.keys(nextTheme).length) {
    return undefined;
  }

  const currentMeta =
    nextTheme.meta &&
    typeof nextTheme.meta === "object" &&
    !Array.isArray(nextTheme.meta)
      ? { ...nextTheme.meta }
      : {};

  currentMeta.version = THEME_FOUNDATION_VERSION;
  nextTheme.meta = currentMeta;

  return nextTheme;
}

function bindProfileForm() {
  const form = document.getElementById("profileForm");
  const resetThemeBtn = document.getElementById("profileThemeResetBtn");
  const sectionOrderList = document.getElementById("profileThemeSectionOrderList");
  if (!form) return;

  function handleThemeFieldInteraction(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.id || !target.id.startsWith("profileTheme")) return;

    if ("setCustomValidity" in target) {
      target.setCustomValidity("");
    }

    updateProfileThemePreview();
    syncProfileThemeSectionOrderStates();
  }

  form.addEventListener("input", handleThemeFieldInteraction);
  form.addEventListener("change", handleThemeFieldInteraction);

  if (resetThemeBtn && resetThemeBtn.dataset.boundClick !== "true") {
    resetThemeBtn.addEventListener("click", () => {
      fillProfileThemeFields(getCurrentProfileThemeBase());
      updateProfileThemePreview();
    });
    resetThemeBtn.dataset.boundClick = "true";
  }

  if (sectionOrderList && sectionOrderList.dataset.boundClick !== "true") {
    sectionOrderList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-move-theme-section]");
      if (!(button instanceof HTMLButtonElement)) return;

      moveProfileThemeSectionOrder(button);
    });
    sectionOrderList.dataset.boundClick = "true";
  }

  updateProfileThemePreview();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      if (!validateProfileThemeInputs(form)) {
        return;
      }

      const hotelSlug = document.getElementById("profileHotelSlugInput")?.value.trim();
      const currentHero = hotelSlug ? getCurrentProfileHeroBase() : {};
      const nextHero =
        currentHero && typeof currentHero === "object" && !Array.isArray(currentHero)
          ? { ...currentHero }
          : {};
      const currentHeroScene =
        currentHero.scene &&
        typeof currentHero.scene === "object" &&
        !Array.isArray(currentHero.scene)
          ? { ...currentHero.scene }
          : {};
      const nextHeroScene = { ...currentHeroScene };
      const heroScenePreset = getValidProfileHeroScenePreset(
        document.getElementById("profileHeroScenePresetInput")?.value
      );

      nextHero.titleLine1 = document.getElementById("profileHeroLine1Input")?.value.trim();
      nextHero.titleLine2 = document.getElementById("profileHeroLine2Input")?.value.trim();
      nextHero.titleLine3 = document.getElementById("profileHeroLine3Input")?.value.trim();
      nextHero.stats = parseJsonInput(document.getElementById("profileHeroStatsInput")?.value, []);
      nextHeroScene.enabled = Boolean(
        document.getElementById("profileHeroSceneEnabledInput")?.checked
      );

      if (heroScenePreset) {
        nextHeroScene.preset = heroScenePreset;
      } else {
        delete nextHeroScene.preset;
      }

      [
        {
          inputId: "profileHeroSceneToneMappingExposureInput",
          field: "toneMappingExposure",
          label: "Hero scene tone mapping exposure"
        },
        {
          inputId: "profileHeroSceneCameraDistanceInput",
          field: "cameraDistance",
          label: "Hero scene camera distance"
        },
        {
          inputId: "profileHeroSceneAmbientLightIntensityInput",
          field: "ambientLightIntensity",
          label: "Hero scene ambient light intensity"
        },
        {
          inputId: "profileHeroSceneGoldLightIntensityInput",
          field: "goldLightIntensity",
          label: "Hero scene gold light intensity"
        },
        {
          inputId: "profileHeroSceneWarmLightIntensityInput",
          field: "warmLightIntensity",
          label: "Hero scene warm light intensity"
        },
        {
          inputId: "profileHeroSceneRimLightIntensityInput",
          field: "rimLightIntensity",
          label: "Hero scene rim light intensity"
        },
        {
          inputId: "profileHeroSceneParticleCountInput",
          field: "particleCount",
          label: "Hero scene particle count"
        }
      ].forEach(({ inputId, field, label }) => {
        const nextValue = getOptionalNumberInputValue(inputId, label);

        if (nextValue === null) {
          delete nextHeroScene[field];
          return;
        }

        nextHeroScene[field] = nextValue;
      });

      if (Object.keys(nextHeroScene).length) {
        nextHero.scene = nextHeroScene;
      } else {
        delete nextHero.scene;
      }

      const payload = {
        hotelSlug,
        hotelName: document.getElementById("profileHotelNameInput")?.value.trim(),
        tagline: document.getElementById("profileTaglineInput")?.value.trim(),
        ownerWhatsAppNumber: document.getElementById("profileWhatsappInput")?.value.trim(),
        ownerUpiId: document.getElementById("profileUpiInput")?.value.trim(),
        gstPercent: Number(document.getElementById("profileGstInput")?.value || 5),

        branding: {
          logoTextPrimary: document.getElementById("profileBrandPrimaryInput")?.value.trim(),
          logoTextSecondary: document.getElementById("profileBrandSecondaryInput")?.value.trim()
        },

        theme: buildProfileThemePayload(hotelSlug),
        hero: nextHero,

        about: {
          eyebrow: document.getElementById("profileAboutEyebrowInput")?.value.trim(),
          title: document.getElementById("profileAboutTitleInput")?.value.trim(),
          paragraphs: parseJsonInput(document.getElementById("profileAboutParagraphsInput")?.value, []),
          primaryImageUrl: document
            .getElementById("profileAboutPrimaryImageUrlInput")
            ?.value.trim(),
          primaryImageAlt: document
            .getElementById("profileAboutPrimaryImageAltInput")
            ?.value.trim(),
          secondaryImageUrl: document
            .getElementById("profileAboutSecondaryImageUrlInput")
            ?.value.trim(),
          secondaryImageAlt: document
            .getElementById("profileAboutSecondaryImageAltInput")
            ?.value.trim()
        },

        features: parseJsonInput(document.getElementById("profileFeaturesInput")?.value, []),

        events: {
          eyebrow: document.getElementById("profileEventsEyebrowInput")?.value.trim(),
          title: document.getElementById("profileEventsTitleInput")?.value.trim(),
          subtitle: document.getElementById("profileEventsSubtitleInput")?.value.trim(),
          cards: parseJsonInput(document.getElementById("profileEventsCardsInput")?.value, [])
        },

        reservation: {
          eyebrow: document.getElementById("profileReservationEyebrowInput")?.value.trim(),
          title: document.getElementById("profileReservationTitleInput")?.value.trim(),
          subtitle: document.getElementById("profileReservationSubtitleInput")?.value.trim()
        },

        contactSection: {
          eyebrow: document.getElementById("profileContactEyebrowInput")?.value.trim(),
          title: document.getElementById("profileContactTitleInput")?.value.trim(),
          subtitle: document.getElementById("profileContactSubtitleInput")?.value.trim()
        },

        contact: {
          phone: document.getElementById("profilePhoneInput")?.value.trim(),
          email: document.getElementById("profileEmailInput")?.value.trim(),
          address: document.getElementById("profileAddressInput")?.value.trim()
        },

        location: {
          mapEmbedUrl: document.getElementById("profileMapEmbedInput")?.value.trim(),
          mapLink: document.getElementById("profileMapLinkInput")?.value.trim()
        },

        footer: {
          description: document.getElementById("profileFooterDescriptionInput")?.value.trim(),
          openingHours: parseJsonArrayInput(
            document.getElementById("profileFooterOpeningHoursInput")?.value,
            [],
            "Footer opening hours"
          )
        },

        social: {
          instagram: document.getElementById("profileInstagramInput")?.value.trim(),
          facebook: document.getElementById("profileFacebookInput")?.value.trim(),
          youtube: document.getElementById("profileYoutubeInput")?.value.trim()
        }
      };

      if (!payload.hotelSlug || !payload.hotelName) {
        alert("Hotel slug and hotel name are required.");
        return;
      }

      await saveHotelProfile(payload);
      state.profileHeroBase = cloneThemeValue(payload.hero || {});
      state.profileHeroHotelSlug = payload.hotelSlug || "";
      state.profileThemeBase = cloneThemeValue(payload.theme || {});
      state.profileThemeHotelSlug = payload.hotelSlug || "";
      fillProfileThemeFields(state.profileThemeBase);
      updateProfileThemePreview();
      alert("Hotel profile saved successfully.");
    } catch (error) {
      console.error("Profile form submit failed:", error);
      alert(error.message || "Failed to save hotel profile");
    }
  });
}

function fillProfileForm(profile) {
  if (!profile) return;

  document.getElementById("profileFormSection").style.display = "block";

  const theme =
    profile.theme && typeof profile.theme === "object" && !Array.isArray(profile.theme)
      ? cloneThemeValue(profile.theme)
      : {};
  const hero =
    profile.hero && typeof profile.hero === "object" && !Array.isArray(profile.hero)
      ? cloneThemeValue(profile.hero)
      : {};

  state.profileHeroBase = hero;
  state.profileHeroHotelSlug = profile.hotel_slug || "";
  state.profileThemeBase = theme;
  state.profileThemeHotelSlug = profile.hotel_slug || "";

  document.getElementById("profileHotelSlugInput").value = profile.hotel_slug || "";
  document.getElementById("profileHotelNameInput").value = profile.hotel_name || "";
  document.getElementById("profileTaglineInput").value = profile.tagline || "";
  document.getElementById("profileWhatsappInput").value = profile.owner_whatsapp_number || "";
  document.getElementById("profileUpiInput").value = profile.owner_upi_id || "";
  document.getElementById("profileGstInput").value = profile.gst_percent ?? 5;

  document.getElementById("profileBrandPrimaryInput").value = profile.branding?.logoTextPrimary || "";
  document.getElementById("profileBrandSecondaryInput").value = profile.branding?.logoTextSecondary || "";
  fillProfileThemeFields(theme);
  updateProfileThemePreview();

  document.getElementById("profileHeroLine1Input").value = hero.titleLine1 || "";
  document.getElementById("profileHeroLine2Input").value = hero.titleLine2 || "";
  document.getElementById("profileHeroLine3Input").value = hero.titleLine3 || "";
  document.getElementById("profileHeroStatsInput").value = formatJson(hero.stats || []);
  document.getElementById("profileHeroSceneEnabledInput").checked =
    hero.scene?.enabled !== false;
  document.getElementById("profileHeroScenePresetInput").value =
    getValidProfileHeroScenePreset(hero.scene?.preset);
  document.getElementById("profileHeroSceneToneMappingExposureInput").value =
    hero.scene?.toneMappingExposure ?? "";
  document.getElementById("profileHeroSceneCameraDistanceInput").value =
    hero.scene?.cameraDistance ?? "";
  document.getElementById("profileHeroSceneAmbientLightIntensityInput").value =
    hero.scene?.ambientLightIntensity ?? "";
  document.getElementById("profileHeroSceneGoldLightIntensityInput").value =
    hero.scene?.goldLightIntensity ?? "";
  document.getElementById("profileHeroSceneWarmLightIntensityInput").value =
    hero.scene?.warmLightIntensity ?? "";
  document.getElementById("profileHeroSceneRimLightIntensityInput").value =
    hero.scene?.rimLightIntensity ?? "";
  document.getElementById("profileHeroSceneParticleCountInput").value =
    hero.scene?.particleCount ?? "";

  document.getElementById("profileAboutEyebrowInput").value = profile.about?.eyebrow || "";
  document.getElementById("profileAboutTitleInput").value = profile.about?.title || "";
  document.getElementById("profileAboutParagraphsInput").value = formatJson(profile.about?.paragraphs || []);
  document.getElementById("profileAboutPrimaryImageUrlInput").value =
    profile.about?.primaryImageUrl || "";
  document.getElementById("profileAboutPrimaryImageAltInput").value =
    profile.about?.primaryImageAlt || "";
  document.getElementById("profileAboutSecondaryImageUrlInput").value =
    profile.about?.secondaryImageUrl || "";
  document.getElementById("profileAboutSecondaryImageAltInput").value =
    profile.about?.secondaryImageAlt || "";

  document.getElementById("profileFeaturesInput").value = formatJson(profile.features || []);

  document.getElementById("profileEventsEyebrowInput").value = profile.events?.eyebrow || "";
  document.getElementById("profileEventsTitleInput").value = profile.events?.title || "";
  document.getElementById("profileEventsSubtitleInput").value = profile.events?.subtitle || "";
  document.getElementById("profileEventsCardsInput").value = formatJson(profile.events?.cards || []);

  document.getElementById("profileReservationEyebrowInput").value = profile.reservation?.eyebrow || "";
  document.getElementById("profileReservationTitleInput").value = profile.reservation?.title || "";
  document.getElementById("profileReservationSubtitleInput").value = profile.reservation?.subtitle || "";

  document.getElementById("profileContactEyebrowInput").value = profile.contact_section?.eyebrow || "";
  document.getElementById("profileContactTitleInput").value = profile.contact_section?.title || "";
  document.getElementById("profileContactSubtitleInput").value = profile.contact_section?.subtitle || "";

  document.getElementById("profilePhoneInput").value = profile.contact?.phone || "";
  document.getElementById("profileEmailInput").value = profile.contact?.email || "";
  document.getElementById("profileAddressInput").value = profile.contact?.address || "";

  document.getElementById("profileMapEmbedInput").value = profile.location?.mapEmbedUrl || "";
  document.getElementById("profileMapLinkInput").value = profile.location?.mapLink || "";

  document.getElementById("profileFooterDescriptionInput").value = profile.footer?.description || "";
  document.getElementById("profileFooterOpeningHoursInput").value = formatJson(
    Array.isArray(profile.footer?.openingHours) ? profile.footer.openingHours : []
  );

  document.getElementById("profileInstagramInput").value = profile.social?.instagram || "";
  document.getElementById("profileFacebookInput").value = profile.social?.facebook || "";
  document.getElementById("profileYoutubeInput").value = profile.social?.youtube || "";
}


async function loginAdmin(email, password) {
 const response = await fetch(`${AUTH_API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
}

function showLoginView() {
  const loginWrap = document.getElementById("adminLoginWrap");
  const dashboardWrap = document.getElementById("adminDashboardWrap");

  if (loginWrap) loginWrap.style.display = "block";
  if (dashboardWrap) dashboardWrap.style.display = "none";
}

function showDashboardView() {
  const loginWrap = document.getElementById("adminLoginWrap");
  const dashboardWrap = document.getElementById("adminDashboardWrap");

  if (loginWrap) loginWrap.style.display = "none";
  if (dashboardWrap) dashboardWrap.style.display = "block";
}

function bindAdminLoginForm() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("adminEmailInput")?.value.trim();
    const password = document.getElementById("adminPasswordInput")?.value || "";

    try {
      const result = await loginAdmin(email, password);
      setAdminToken(result.token);
      showDashboardView();
      await loadHotels();
      await loadTabData();
    } catch (error) {
      console.error("Admin login failed:", error);
      alert(error.message || "Login failed");
    }
  });
}

function bindAdminLogout() {
  const btn = document.getElementById("adminLogoutBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    clearAdminToken();
    showLoginView();
  });
}

async function checkExistingAdminSession() {
  const token = getAdminToken();

  if (!token) {
    showLoginView();
    return false;
  }

  try {
    // await fetchJson("http://localhost:5000/api/auth/me");
    await fetchJson(`${AUTH_API_BASE}/me`);
    showDashboardView();
    return true;
  } catch (error) {
    console.warn("Admin session invalid:", error);
    clearAdminToken();
    showLoginView();
    return false;
  }
}

async function uploadImageFile({ hotelSlug, folder, file }) {
  const token = getAdminToken();
  const formData = new FormData();

  formData.append("hotelSlug", hotelSlug || "shared");
  formData.append("folder", folder || "misc");
  formData.append("file", file);

const response = await fetch(UPLOAD_API_BASE, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : {},
    body: formData
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Upload failed");
  }

  return data;
}

function bindUploadForm() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const hotelSlug =
      document.getElementById("uploadHotelSlugInput")?.value.trim() || "shared";
    const folder =
      document.getElementById("uploadFolderInput")?.value.trim() || "misc";
    const targetFieldId =
      document.getElementById("uploadTargetFieldInput")?.value.trim() || "";
    const storageTargetFieldId =
      document.getElementById("uploadStorageTargetFieldInput")?.value.trim() || "";
    const fileInput = document.getElementById("uploadFileInput");
    const resultWrap = document.getElementById("uploadResult");
    const file = fileInput?.files?.[0];

    if (!file) {
      alert("Please choose a file first.");
      return;
    }

    try {
      if (resultWrap) {
        resultWrap.innerHTML = `<p class="loading-state">Uploading...</p>`;
      }

      const result = await uploadImageFile({
        hotelSlug,
        folder,
        file
      });

      const publicUrl = result.file?.publicUrl || "";
      const storagePath = result.file?.path || "";

      if (targetFieldId) {
        const targetInput = document.getElementById(targetFieldId);
        if (targetInput) {
          targetInput.value = publicUrl;
        }
      }

      if (storageTargetFieldId) {
        const storageTargetInput = document.getElementById(storageTargetFieldId);
        if (storageTargetInput) {
          storageTargetInput.value = storagePath;
        }
      }

      if (resultWrap) {
        resultWrap.innerHTML = `
          <div class="admin-card" style="margin-top: 12px;">
            <p><strong>Uploaded successfully</strong></p>
            <p><strong>URL:</strong> <a href="${escapeHTML(publicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(publicUrl)}</a></p>
            <p><strong>Storage Path:</strong> ${escapeHTML(storagePath)}</p>
            <img src="${escapeHTML(publicUrl)}" alt="Uploaded preview" style="max-width: 240px; border-radius: 8px; margin-top: 10px;" />
          </div>
        `;
      }

      form.reset();
    } catch (error) {
      console.error("Upload failed:", error);
      if (resultWrap) {
        resultWrap.innerHTML = `<p class="empty-state">Upload failed: ${escapeHTML(error.message || "Unknown error")}</p>`;
      }
    }
  });
}

async function toggleMenuArchive(id, isArchived) {
  return fetchJson(`${API_BASE}/menu-items/${id}/archive`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isArchived })
  });
}

async function resendNotificationEvent(id) {
  return fetchJson(`${API_BASE}/notification-events/${id}/resend`, {
    method: "POST"
  });
}

function bindNotificationSettingsForm() {
  const form = document.getElementById("notificationSettingsForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const payload = {
        hotelSlug:
          document.getElementById("notificationSettingsHotelSlugInput")?.value.trim() ||
          "",
        ownerEmail:
          document.getElementById("notificationOwnerEmailInput")?.value.trim() || "",
        emailEnabled:
          !!document.getElementById("notificationEmailEnabledInput")?.checked,
        notifyOnNewOrder:
          !!document.getElementById("notificationNotifyOrderInput")?.checked,
        notifyOnNewReservation:
          !!document.getElementById("notificationNotifyReservationInput")?.checked,
        notifyOnNewInquiry:
          !!document.getElementById("notificationNotifyInquiryInput")?.checked
      };

      if (!payload.hotelSlug) {
        alert("Hotel slug is required.");
        return;
      }

      const result = await saveNotificationSettings(payload);
      fillNotificationSettingsForm(result.settings || payload);
      alert("Notification settings saved successfully.");
    } catch (error) {
      console.error("Notification settings save failed:", error);
      alert(error.message || "Failed to save notification settings");
    }
  });
}

function bindPaymentRouteSettingsForm() {
  const form = document.getElementById("paymentRouteSettingsForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const payload = {
        hotelSlug:
          document.getElementById("paymentRouteHotelSlugInput")?.value.trim() ||
          "",
        provider:
          document.getElementById("paymentRouteProviderInput")?.value || "razorpay",
        routeEnabled:
          !!document.getElementById("paymentRouteEnabledInput")?.checked,
        razorpayLinkedAccountId:
          document.getElementById("paymentRouteLinkedAccountInput")?.value.trim() || ""
      };

      if (!payload.hotelSlug) {
        alert("Hotel slug is required.");
        return;
      }

      if (
        payload.razorpayLinkedAccountId &&
        !/^acc_[A-Za-z0-9]+$/.test(payload.razorpayLinkedAccountId)
      ) {
        alert("Razorpay linked account id should look like acc_xxxxx.");
        return;
      }

      if (payload.routeEnabled && !payload.razorpayLinkedAccountId) {
        alert("Linked account id is required when Route is enabled.");
        return;
      }

      const result = await savePaymentRouteSettings(payload);
      fillPaymentRouteSettingsForm(result.settings || payload);
      alert("Payment Route settings saved successfully.");
    } catch (error) {
      console.error("Payment Route settings save failed:", error);
      alert(error.message || "Failed to save payment Route settings");
    }
  });
}

async function toggleGalleryArchive(id, isArchived) {
  return fetchJson(`${API_BASE}/gallery-items/${id}/archive`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isArchived })
  });
}

async function deleteMenuItem(id) {
  return fetchJson(`${API_BASE}/menu-items/${id}`, {
    method: "DELETE"
  });
}

async function deleteGalleryItem(id) {
  return fetchJson(`${API_BASE}/gallery-items/${id}`, {
    method: "DELETE"
  });
}

async function deleteTestimonial(id) {
  return fetchJson(`${API_BASE}/testimonials/${id}`, {
    method: "DELETE"
  });
}

async function toggleTestimonialApproval(id, isApproved) {
  return fetchJson(`${API_BASE}/testimonials/${id}/approval`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isApproved })
  });
}

async function toggleTestimonialArchive(id, isArchived) {
  return fetchJson(`${API_BASE}/testimonials/${id}/archive`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isArchived })
  });
}

async function toggleHotelActive(id, isActive) {
  return fetchJson(`${API_BASE}/hotels/${id}/active`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isActive })
  });
}

async function toggleGalleryActive(id, isActive) {
  return fetchJson(`${API_BASE}/gallery-items/${id}/active`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isActive })
  });
}

async function deleteUploadedFile(storagePath) {
  return fetchJson(UPLOAD_API_BASE, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ storagePath })
  });
}

function bindUploadedFileDelete() {
  const btn = document.getElementById("deleteUploadedFileBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const storagePath =
      document.getElementById("deleteStoragePathInput")?.value.trim() || "";

    if (!storagePath) {
      alert("Enter a storage path first.");
      return;
    }

    if (!window.confirm("Delete this uploaded file?")) return;

    try {
      await deleteUploadedFile(storagePath);
      alert("Uploaded file deleted successfully");
      document.getElementById("deleteStoragePathInput").value = "";
    } catch (error) {
      console.error("Delete uploaded file failed:", error);
      alert("Failed to delete uploaded file");
    }
  });
}

async function initAdmin() {
  try {
    bindTabs();
    bindHotelFilter();
    bindListFilters();
    bindStatusActions();
    bindFormToggles();
    bindQrTableLinkHelper();
    bindGalleryUploadHelper();
    bindProfileAboutImageUploadHelpers();
    bindHotelForm();
    bindMenuItemForm();
    bindGalleryItemForm();
    bindTestimonialForm();
    bindNotificationSettingsForm();
    bindPaymentRouteSettingsForm();
    bindEditActions();
    bindProfileForm();
    bindUploadForm();
    bindUploadedFileDelete();
    syncMenuFormHotelSlug();
    syncGalleryFormHotelSlug();
    syncTestimonialFormHotelSlug();
    syncNotificationSettingsHotelSlug();
    syncPaymentRouteSettingsHotelSlug();
    syncQrTableLinkHotelSlug();
    bindAdminLoginForm();
    bindAdminLogout();

    const hasSession = await checkExistingAdminSession();
    if (!hasSession) return;

    await loadHotels();
    await loadTabData();
  } catch (error) {
    console.error("Admin init failed:", error);
    const content = $("#adminContent");
    if (content) {
      content.innerHTML = `<p class="empty-state">Failed to load dashboard.</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", initAdmin);
