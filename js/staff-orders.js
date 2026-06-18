"use strict";

function getDefaultStaffApiBaseUrl() {
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

const STAFF_BASE_API =
  window.APP_RUNTIME_CONFIG?.API_BASE_URL || getDefaultStaffApiBaseUrl();
const STAFF_API_BASE = `${STAFF_BASE_API}/staff`;
const STAFF_TOKEN_KEY = "hotel_platform_staff_token";
const STAFF_SOUND_ALERT_ENABLED_KEY = "hotel_platform_staff_sound_alert_enabled";
const STAFF_BROWSER_ALERT_ENABLED_KEY = "hotel_platform_staff_browser_alert_enabled";
const STAFF_AUTO_REFRESH_INTERVAL_MS = 15 * 1000;
const STAFF_STATE = {
  staffUser: null,
  activeView: "dashboard",
  orders: [],
  tableOrderMenu: [],
  tableOrderCart: {},
  tableOrderMenuLoaded: false,
  tableOrderMenuQuery: "",
  tableOrderMenuCategory: "all",
  dashboardReports: null,
  dashboardReportsFreshnessLabel: "",
  itemSalesReports: null,
  supportRequests: [],
  reservations: [],
  inquiries: [],
  contactSubmissions: [],
  testimonials: [],
  supportRequestsLoaded: false,
  reservationsLoaded: false,
  inquiriesLoaded: false,
  contactSubmissionsLoaded: false,
  testimonialsLoaded: false
};
const STAFF_ORDER_STATUS_OPTIONS = ["new", "confirmed", "preparing", "completed", "cancelled"];
const STAFF_RESERVATION_STATUS_OPTIONS = ["new", "confirmed", "seated", "completed", "cancelled"];
const STAFF_INQUIRY_STATUS_OPTIONS = ["new", "contacted", "converted", "closed"];
const STAFF_CONTACT_STATUS_OPTIONS = ["new", "contacted", "resolved", "closed", "archived"];
const STAFF_SUPPORT_STATUS_OPTIONS = ["new", "acknowledged", "resolved", "closed"];
const STAFF_MANAGER_VIEWS = [
  "dashboard",
  "table-order",
  "orders",
  "support",
  "reservations",
  "inquiries",
  "contacts",
  "testimonials"
];
const STAFF_BASIC_VIEWS = ["table-order", "orders", "support"];
const STAFF_ORDER_STATUS_LABELS = {
  new: "Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  completed: "Completed / Served",
  cancelled: "Cancelled"
};
const STAFF_VIEW_META = {
  dashboard: {
    badge: "Dashboard",
    title: "Dashboard overview",
    description:
      "Start from the hotel snapshot, then move into live orders, guest communication, and operational follow-up without leaving this workspace."
  },
  orders: {
    badge: "Orders",
    title: "Orders and billing workspace",
    description:
      "Review live QR and website orders, billing actions, payment state, and the current working queue for this hotel."
  },
  "table-order": {
    badge: "Take Order",
    title: "Take table order",
    description:
      "Create a staff-assisted dine-in order from this hotel's live menu."
  },
  support: {
    badge: "Support",
    title: "Table support workspace",
    description:
      "Handle bill requests and staff-help calls from QR/table tracking without opening the full admin area."
  },
  reservations: {
    badge: "Reservations",
    title: "Reservations workspace",
    description:
      "Check booking requests, guest timing, table planning, and reservation follow-up for this hotel."
  },
  inquiries: {
    badge: "Inquiries",
    title: "Inquiries workspace",
    description:
      "Follow guest event leads, contact details, and status updates from one focused section."
  },
  contacts: {
    badge: "Contacts",
    title: "Contact messages workspace",
    description:
      "Review website contact messages, subjects, and follow-up status for this hotel only."
  },
  testimonials: {
    badge: "Testimonials",
    title: "Testimonials workspace",
    description:
      "Approve or pause hotel-specific guest reviews in a simple moderation flow."
  }
};
let staffAutoRefreshTimer = null;
let staffAutoRefreshInFlight = false;
let staffCompactViewport = window.innerWidth <= 1080;
let staffAlertAudioContext = null;
let staffSoundUnlocked = false;
let staffLiveRefreshNoticeTimer = null;
let staffLiveRefreshOverrideActive = false;
let staffSoundRuntimeUnlockBound = false;
let staffAutoRefreshSoundPlayed = false;
let staffAutoRefreshFreshCounts = {};

function normalizeStaffRoleValue(role = "") {
  return String(role || "").trim().toLowerCase() === "owner" ? "owner" : "staff";
}

function isStaffManagerSession(staffUser = STAFF_STATE.staffUser || {}) {
  return Boolean(staffUser?.isManager) || normalizeStaffRoleValue(staffUser?.role) === "owner";
}

function getAllowedStaffViews(staffUser = STAFF_STATE.staffUser || {}) {
  return isStaffManagerSession(staffUser) ? STAFF_MANAGER_VIEWS : STAFF_BASIC_VIEWS;
}

function getDefaultStaffView(staffUser = STAFF_STATE.staffUser || {}) {
  return isStaffManagerSession(staffUser) ? "dashboard" : "orders";
}

function canStaffAccessView(view = "", staffUser = STAFF_STATE.staffUser || {}) {
  return getAllowedStaffViews(staffUser).includes(view);
}

function $(selector) {
  return document.querySelector(selector);
}

function getStaffToken() {
  return localStorage.getItem(STAFF_TOKEN_KEY) || "";
}

function setStaffToken(token) {
  localStorage.setItem(STAFF_TOKEN_KEY, token);
}

function clearStaffToken() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
}

function isStaffSoundAlertEnabled() {
  return localStorage.getItem(STAFF_SOUND_ALERT_ENABLED_KEY) === "true";
}

function setStaffSoundAlertEnabled(enabled) {
  localStorage.setItem(STAFF_SOUND_ALERT_ENABLED_KEY, enabled ? "true" : "false");
}

function isStaffBrowserAlertEnabled() {
  return localStorage.getItem(STAFF_BROWSER_ALERT_ENABLED_KEY) === "true";
}

function setStaffBrowserAlertEnabled(enabled) {
  localStorage.setItem(STAFF_BROWSER_ALERT_ENABLED_KEY, enabled ? "true" : "false");
}

function canUseStaffSoundAlerts() {
  return (
    typeof window !== "undefined" &&
    (typeof window.AudioContext === "function" ||
      typeof window.webkitAudioContext === "function")
  );
}

function hasStaffBrowserAlertRuntime() {
  return typeof window !== "undefined" && typeof window.Notification === "function";
}

function isStaffBrowserAlertContextSupported() {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname || "";
  const isTrustedLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");

  return Boolean(window.isSecureContext) || isTrustedLocalHost;
}

function canUseStaffBrowserAlerts() {
  return hasStaffBrowserAlertRuntime() && isStaffBrowserAlertContextSupported();
}

function hasStaffBrowserAlertPermission() {
  return canUseStaffBrowserAlerts() && window.Notification.permission === "granted";
}

function isStaffBrowserAlertActive() {
  return isStaffBrowserAlertEnabled() && hasStaffBrowserAlertPermission();
}

function ensureStaffAlertAudioContext() {
  if (staffAlertAudioContext || !canUseStaffSoundAlerts()) {
    return staffAlertAudioContext;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  staffAlertAudioContext = new AudioContextClass();
  return staffAlertAudioContext;
}

async function unlockStaffSoundAlerts() {
  const audioContext = ensureStaffAlertAudioContext();
  if (!audioContext) return false;

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    staffSoundUnlocked = audioContext.state === "running";
  } catch (error) {
    console.warn("Staff sound alert unlock failed:", error);
    staffSoundUnlocked = false;
  }

  return staffSoundUnlocked;
}

function bindStaffSoundRuntimeUnlock() {
  if (staffSoundRuntimeUnlockBound) return;

  const unlockOnInteraction = () => {
    if (!isStaffSoundAlertEnabled() || staffSoundUnlocked) {
      return;
    }

    void unlockStaffSoundAlerts();
  };

  window.addEventListener("pointerdown", unlockOnInteraction, true);
  window.addEventListener("keydown", unlockOnInteraction, true);
  window.addEventListener("touchstart", unlockOnInteraction, true);
  staffSoundRuntimeUnlockBound = true;
}

function updateStaffSoundAlertToggle() {
  const button = $("#staffSoundAlertToggleBtn");
  if (!button) return;

  if (!canUseStaffSoundAlerts()) {
    button.disabled = true;
    button.textContent = "Sound unavailable";
    button.setAttribute("aria-pressed", "false");
    return;
  }

  const enabled = isStaffSoundAlertEnabled();
  button.disabled = false;
  button.textContent = enabled ? "Sound alerts on" : "Sound alerts off";
  button.setAttribute("aria-pressed", String(enabled));
}

function updateStaffBrowserAlertToggle() {
  const button = $("#staffBrowserAlertToggleBtn");
  if (!button) return;

  if (!canUseStaffBrowserAlerts()) {
    button.disabled = true;
    button.textContent = hasStaffBrowserAlertRuntime()
      ? "Browser alerts need localhost/https"
      : "Browser alerts unavailable";
    button.setAttribute("aria-pressed", "false");
    return;
  }

  const permission = window.Notification.permission;
  if (permission === "denied") {
    if (isStaffBrowserAlertEnabled()) {
      setStaffBrowserAlertEnabled(false);
    }

    button.disabled = true;
    button.textContent = "Browser alerts blocked";
    button.setAttribute("aria-pressed", "false");
    return;
  }

  const enabled = isStaffBrowserAlertEnabled() && permission === "granted";
  button.disabled = false;
  button.textContent = enabled ? "Browser alerts on" : "Browser alerts off";
  button.setAttribute("aria-pressed", String(enabled));
}

async function ensureStaffBrowserAlertPermission() {
  if (!canUseStaffBrowserAlerts()) return "denied";

  if (window.Notification.permission === "granted") {
    return "granted";
  }

  if (window.Notification.permission === "denied") {
    return "denied";
  }

  try {
    return await window.Notification.requestPermission();
  } catch (error) {
    console.warn("Staff browser alert permission request failed:", error);
    return window.Notification.permission || "denied";
  }
}

function showStaffBrowserNotification(
  title = "Staff alert",
  body = "",
  options = {}
) {
  if (!isStaffBrowserAlertActive()) {
    return false;
  }

  try {
    const notification = new window.Notification(title, {
      body,
      tag: options.tag || `staff-browser-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`,
      renotify: options.renotify !== false
    });

    if (typeof options.onClick === "function") {
      notification.onclick = () => {
        try {
          options.onClick(notification);
        } catch (error) {
          console.warn("Staff browser alert click failed:", error);
        }
      };
    }

    window.setTimeout(() => {
      notification.close();
    }, options.durationMs || 12000);

    return true;
  } catch (error) {
    console.warn("Staff browser alert failed:", error);
    return false;
  }
}

function playStaffAlertTone() {
  const audioContext = ensureStaffAlertAudioContext();
  if (!audioContext || !staffSoundUnlocked || !isStaffSoundAlertEnabled()) {
    return false;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.exponentialRampToValueAtTime(740, now + 0.18);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.24);
  return true;
}

function getNewStaffRecords(previousRecords = [], nextRecords = []) {
  if (!Array.isArray(previousRecords) || !Array.isArray(nextRecords) || !previousRecords.length) {
    return [];
  }

  const previousIds = new Set(previousRecords.map(getStaffRecordId).filter(Boolean));
  if (!previousIds.size) return [];

  return nextRecords.filter((record) => {
    const recordId = getStaffRecordId(record);
    return recordId && !previousIds.has(recordId);
  });
}

function showStaffOrderBrowserAlert(newOrders = []) {
  if (
    !Array.isArray(newOrders) ||
    !newOrders.length ||
    !isStaffBrowserAlertActive()
  ) {
    return false;
  }

  const primaryOrder = newOrders[0] || {};
  const sourceMeta = getStaffOrderSourceMeta(primaryOrder);
  const totalLabel = formatMoney(getStaffOrderTotal(primaryOrder));
  const customerLabel = primaryOrder.customerName || "Guest";
  const detailParts = [customerLabel];

  if (sourceMeta.detail) {
    detailParts.push(sourceMeta.detail);
  }

  if (totalLabel) {
    detailParts.push(totalLabel);
  }

  const title =
    newOrders.length > 1
      ? `${newOrders.length} new orders received`
      : `New ${sourceMeta.label} order`;
  const body =
    newOrders.length > 1
      ? `${detailParts.join(" • ")} • plus ${newOrders.length - 1} more`
      : detailParts.join(" • ");

  return showStaffBrowserNotification(title, body, {
    tag: `staff-order-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`,
    renotify: true,
    onClick(notification) {
      try {
        window.focus();
      } catch (error) {
        console.warn("Staff browser alert focus failed:", error);
      }

      openStaffView("orders");
      notification.close();
    }
  });
}

function getStaffFreshViewLabel(view = "") {
  return STAFF_VIEW_META[view]?.badge || "Updates";
}

function getStaffFreshNoticeMessage(view = "", freshCount = 0) {
  const viewLabel = getStaffFreshViewLabel(view);
  const itemLabelMap = {
    orders: ["order", "orders"],
    support: ["support request", "support requests"],
    reservations: ["reservation", "reservations"],
    inquiries: ["inquiry", "inquiries"],
    contacts: ["contact message", "contact messages"],
    testimonials: ["testimonial", "testimonials"]
  };
  const [singularLabel, pluralLabel] = itemLabelMap[view] || ["record", "records"];
  const safeCount = Number(freshCount) || 0;

  return safeCount > 1
    ? `${safeCount} new ${pluralLabel} in ${viewLabel}`
    : `New ${singularLabel} in ${viewLabel}`;
}

function getStaffBrowserAlertPayload(view = "", newRecords = []) {
  if (!Array.isArray(newRecords) || !newRecords.length) {
    return null;
  }

  const primaryRecord = newRecords[0] || {};
  const count = newRecords.length;

  if (view === "orders") {
    const sourceMeta = getStaffOrderSourceMeta(primaryRecord);
    const totalLabel = formatMoney(getStaffOrderTotal(primaryRecord));
    const customerLabel = primaryRecord.customerName || "Guest";
    const detailParts = [customerLabel];

    if (sourceMeta.detail) {
      detailParts.push(sourceMeta.detail);
    }

    if (totalLabel) {
      detailParts.push(totalLabel);
    }

    return {
      title: count > 1 ? `${count} new orders received` : `New ${sourceMeta.label} order`,
      body: count > 1 ? `${detailParts.join(" | ")} | plus ${count - 1} more` : detailParts.join(" | "),
      tag: `staff-order-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`
    };
  }

  if (view === "support") {
    const requestType = normalizeStatus(primaryRecord.requestType) === "bill" ? "Bill request" : "Staff help";
    const detailParts = [
      requestType,
      primaryRecord.tableNumber ? `Table ${primaryRecord.tableNumber}` : "",
      primaryRecord.orderId ? `Order ${primaryRecord.orderId}` : ""
    ].filter(Boolean);

    return {
      title: count > 1 ? `${count} new support requests` : "New support request",
      body: count > 1 ? `${detailParts.join(" | ")} | plus ${count - 1} more` : detailParts.join(" | "),
      tag: `staff-support-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`
    };
  }

  if (view === "reservations") {
    const detailParts = [
      primaryRecord.name || "Guest",
      primaryRecord.date || "",
      primaryRecord.time || ""
    ].filter(Boolean);

    return {
      title: count > 1 ? `${count} new reservations` : "New reservation",
      body: count > 1 ? `${detailParts.join(" | ")} | plus ${count - 1} more` : detailParts.join(" | "),
      tag: `staff-reservation-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`
    };
  }

  if (view === "inquiries") {
    const detailParts = [
      primaryRecord.name || "Guest",
      primaryRecord.eventType || "Event inquiry",
      primaryRecord.date || ""
    ].filter(Boolean);

    return {
      title: count > 1 ? `${count} new inquiries` : "New inquiry",
      body: count > 1 ? `${detailParts.join(" | ")} | plus ${count - 1} more` : detailParts.join(" | "),
      tag: `staff-inquiry-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`
    };
  }

  if (view === "contacts") {
    const detailParts = [
      primaryRecord.name || "Guest",
      primaryRecord.subject || "Website contact"
    ].filter(Boolean);

    return {
      title: count > 1 ? `${count} new contact messages` : "New contact message",
      body: count > 1 ? `${detailParts.join(" | ")} | plus ${count - 1} more` : detailParts.join(" | "),
      tag: `staff-contact-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`
    };
  }

  if (view === "testimonials") {
    const stars = Number.isFinite(Number(primaryRecord.stars))
      ? `${Number(primaryRecord.stars)} star${Number(primaryRecord.stars) === 1 ? "" : "s"}`
      : "";
    const detailParts = [
      primaryRecord.name || "Guest",
      stars
    ].filter(Boolean);

    return {
      title: count > 1 ? `${count} new testimonials` : "New testimonial",
      body: count > 1 ? `${detailParts.join(" | ")} | plus ${count - 1} more` : detailParts.join(" | "),
      tag: `staff-testimonial-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`
    };
  }

  return {
    title: getStaffFreshNoticeMessage(view, count),
    body: `${count} new record${count === 1 ? "" : "s"} available now.`,
    tag: `staff-generic-alert-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`
  };
}

function showStaffRecordBrowserAlert(view = "", newRecords = []) {
  if (!Array.isArray(newRecords) || !newRecords.length || !isStaffBrowserAlertActive()) {
    return false;
  }

  const payload = getStaffBrowserAlertPayload(view, newRecords);
  if (!payload) {
    return false;
  }

  return showStaffBrowserNotification(payload.title, payload.body, {
    tag: payload.tag,
    renotify: true,
    onClick(notification) {
      try {
        window.focus();
      } catch (error) {
        console.warn("Staff browser alert focus failed:", error);
      }

      openStaffView(view || "orders");
      notification.close();
    }
  });
}

function handleStaffFreshRecords(view = "", newRecords = [], { playSound = true } = {}) {
  if (!Array.isArray(newRecords) || !newRecords.length) {
    return false;
  }

  markStaffFreshData(view);
  staffAutoRefreshFreshCounts[view] =
    (Number(staffAutoRefreshFreshCounts[view]) || 0) + newRecords.length;

  if (playSound && !staffAutoRefreshSoundPlayed) {
    playStaffAlertTone();
    staffAutoRefreshSoundPlayed = true;
  }

  showStaffRecordBrowserAlert(view, newRecords);
  return true;
}

function resetStaffAutoRefreshFreshSummary() {
  staffAutoRefreshFreshCounts = {};
}

function getStaffAutoRefreshFreshNoticeMessage() {
  const freshEntries = Object.entries(staffAutoRefreshFreshCounts).filter(
    ([, count]) => Number(count) > 0
  );

  if (!freshEntries.length) {
    return "";
  }

  if (freshEntries.length === 1) {
    const [view, count] = freshEntries[0];
    return getStaffFreshNoticeMessage(view, count);
  }

  const viewLabels = freshEntries.map(([view]) => getStaffFreshViewLabel(view));

  if (viewLabels.length === 2) {
    return `New activity in ${viewLabels[0]} and ${viewLabels[1]}`;
  }

  const leadingLabels = viewLabels.slice(0, -1);
  const lastLabel = viewLabels[viewLabels.length - 1];
  return `New activity in ${leadingLabels.join(", ")}, and ${lastLabel}`;
}

function resetStaffDashboardState() {
  resetStaffAutoRefreshFreshSummary();
  STAFF_STATE.staffUser = null;
  STAFF_STATE.activeView = "dashboard";
  STAFF_STATE.orders = [];
  STAFF_STATE.tableOrderMenu = [];
  STAFF_STATE.tableOrderCart = {};
  STAFF_STATE.tableOrderMenuLoaded = false;
  STAFF_STATE.tableOrderMenuQuery = "";
  STAFF_STATE.tableOrderMenuCategory = "all";
  STAFF_STATE.dashboardReports = null;
  STAFF_STATE.dashboardReportsFreshnessLabel = "";
  STAFF_STATE.itemSalesReports = null;
  STAFF_STATE.supportRequests = [];
  STAFF_STATE.reservations = [];
  STAFF_STATE.inquiries = [];
  STAFF_STATE.contactSubmissions = [];
  STAFF_STATE.testimonials = [];
  STAFF_STATE.supportRequestsLoaded = false;
  STAFF_STATE.reservationsLoaded = false;
  STAFF_STATE.inquiriesLoaded = false;
  STAFF_STATE.contactSubmissionsLoaded = false;
  STAFF_STATE.testimonialsLoaded = false;
  applyStaffRoleWorkspaceAccess({});
  showStaffView("dashboard");
  setStaffDashboardSummaryEmpty("Login to load the dashboard summary.");
  setStaffSectionLastUpdated("#staffDashboardLastUpdated", "Not refreshed yet");
  renderStaffTableOrderMenu();
  renderStaffTableOrderCart();
  updateStaffViewTabCounts();
}

function setStaffLoginStatus(message = "", isError = false) {
  const status = $("#staffLoginStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("is-error", !!isError);
}

function setStaffLiveRefreshStatus(message = "Live updates on", mode = "live") {
  const status = $("#staffLiveRefreshStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("is-live", mode === "live");
  status.classList.toggle("is-warning", mode === "warning");
  status.classList.toggle("is-muted", mode === "muted");
}

function flashStaffLiveRefreshNotice(
  message = "New order detected",
  mode = "warning",
  durationMs = 6000
) {
  if (staffLiveRefreshNoticeTimer) {
    window.clearTimeout(staffLiveRefreshNoticeTimer);
    staffLiveRefreshNoticeTimer = null;
  }

  staffLiveRefreshOverrideActive = true;
  setStaffLiveRefreshStatus(message, mode);

  staffLiveRefreshNoticeTimer = window.setTimeout(() => {
    staffLiveRefreshOverrideActive = false;
    setStaffLiveRefreshStatus(`Updated ${formatStaffRefreshTime()}`, "live");
    staffLiveRefreshNoticeTimer = null;
  }, durationMs);
}

function setStaffSectionLastUpdated(selector, message = "") {
  const element = $(selector);
  if (!element) return;

  element.textContent = message || "Not refreshed yet";
}

function getStaffViewMeta(view = "dashboard") {
  return STAFF_VIEW_META[view] || STAFF_VIEW_META.dashboard;
}

function updateStaffWorkspaceContext(view = "dashboard") {
  const meta = getStaffViewMeta(view);
  const title = $("#staffWorkspaceTitle");
  const badge = $("#staffWorkspaceViewBadge");
  const description = $("#staffWorkspaceDescription");

  if (title) title.textContent = meta.title;
  if (badge) badge.textContent = meta.badge;
  if (description) description.textContent = meta.description;
}

function updateStaffWorkspaceHotelBadge(staffUser = STAFF_STATE.staffUser || {}) {
  const badge = $("#staffWorkspaceHotelBadge");
  if (!badge) return;

  badge.textContent = `Hotel: ${staffUser?.hotelSlug || "this hotel"}`;
}

function updateStaffRoleWorkspaceCopy(staffUser = STAFF_STATE.staffUser || {}) {
  const heroKicker = document.querySelector(".staff-dashboard-hero .staff-kicker");
  const heroCopy = document.querySelector(".staff-dashboard-hero .staff-dashboard-copy");
  const sidebarCopy = document.querySelector(".staff-sidebar-copy");
  const sidebarNote = document.querySelector(".staff-sidebar-note .staff-hint");

  if (isStaffManagerSession(staffUser)) {
    if (heroKicker) heroKicker.textContent = "Owner Workspace";
    if (heroCopy) {
      heroCopy.textContent =
        "A limited, hotel-scoped view for orders, billing, table support, reservations, inquiries, contact messages, and guest reviews. Open the section you need without leaving the workspace.";
    }
    if (sidebarCopy) {
      sidebarCopy.textContent =
        "Move between live hotel sections from one structured workspace while keeping the same limited hotel-scoped access model.";
    }
    if (sidebarNote) {
      sidebarNote.textContent =
        "Orders, reservations, inquiries, contacts, support requests, and testimonial moderation stay limited to the logged-in hotel only.";
    }
    return;
  }

  if (heroKicker) heroKicker.textContent = "Staff Workspace";
  if (heroCopy) {
    heroCopy.textContent =
      "A focused, hotel-scoped view for live orders, billing actions, and table support. Keep day-to-day service moving without exposing manager reports or oversight sections.";
  }
  if (sidebarCopy) {
    sidebarCopy.textContent =
      "Move between live order and table-support sections while keeping this workspace focused on day-to-day hotel operations.";
  }
  if (sidebarNote) {
    sidebarNote.textContent =
      "Order records and table support stay limited to the logged-in hotel. Manager summaries and oversight sections stay hidden for this role.";
  }
}

function applyStaffRoleWorkspaceAccess(staffUser = STAFF_STATE.staffUser || {}) {
  const allowedViews = getAllowedStaffViews(staffUser);
  const defaultView = getDefaultStaffView(staffUser);
  const dashboardWrap = $("#staffDashboardWrap");
  const sectionCount = document.querySelector(".staff-sidebar-section-count");

  if (dashboardWrap) {
    dashboardWrap.dataset.staffRole = normalizeStaffRoleValue(staffUser?.role);
  }

  document.querySelectorAll("[data-staff-view]").forEach((button) => {
    const view = button.dataset.staffView || "";
    const isAllowed = allowedViews.includes(view);
    button.hidden = !isAllowed;
    button.disabled = !isAllowed;
    button.tabIndex = isAllowed ? 0 : -1;

    if (!isAllowed) {
      button.classList.remove("is-active", "has-fresh-data");
      button.setAttribute("aria-selected", "false");
    }
  });

  if (sectionCount) {
    sectionCount.textContent = String(allowedViews.length);
    sectionCount.setAttribute("aria-label", `${allowedViews.length} available sections`);
  }

  updateStaffRoleWorkspaceCopy(staffUser);

  if (!canStaffAccessView(STAFF_STATE.activeView, staffUser)) {
    STAFF_STATE.activeView = defaultView;
  }
}

function isStaffCompactViewport() {
  return window.innerWidth <= 1080;
}

function setStaffSidebarExpanded(isExpanded = true) {
  const dashboardWrap = $("#staffDashboardWrap");
  const toggleButton = $("#staffSidebarToggleBtn");
  const expanded = !isStaffCompactViewport() ? true : !!isExpanded;

  if (dashboardWrap) {
    dashboardWrap.classList.toggle("is-sidebar-collapsed", !expanded);
  }

  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", String(expanded));
    toggleButton.textContent = expanded ? "Hide sections" : "Show sections";
  }
}

function syncStaffSidebarForViewport() {
  staffCompactViewport = isStaffCompactViewport();
  setStaffSidebarExpanded(!staffCompactViewport);
}

function handleStaffViewportChange() {
  const isCompact = isStaffCompactViewport();
  if (isCompact === staffCompactViewport) return;

  staffCompactViewport = isCompact;
  setStaffSidebarExpanded(!isCompact);
}

function escapeHTML(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function formatMoney(value) {
  const numberValue = getNumberValue(value);
  return numberValue === null ? "Rs. 0.00" : `Rs. ${numberValue.toFixed(2)}`;
}

function formatOrderDate(value = "") {
  if (!value) return "Time not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatStaffRefreshTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStaffLastUpdatedLabel(value = new Date()) {
  const time = formatStaffRefreshTime(value);
  return time ? `Updated ${time}` : "Updated just now";
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getStaffRecordStatusLabel(status = "", type = "") {
  const normalizedStatus = normalizeStatus(status);

  if (type === "order" && STAFF_ORDER_STATUS_LABELS[normalizedStatus]) {
    return STAFF_ORDER_STATUS_LABELS[normalizedStatus];
  }

  return normalizedStatus
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "New";
}

function getStaffOrderItems(order = {}) {
  return Array.isArray(order.items) ? order.items : [];
}

function getStaffOrderTotals(order = {}) {
  return order.totals && typeof order.totals === "object" && !Array.isArray(order.totals)
    ? order.totals
    : {};
}

function getStaffOrderTotal(order = {}) {
  const totals = getStaffOrderTotals(order);
  const itemSubtotal = getStaffOrderItems(order).reduce((sum, item) => {
    const qty = getNumberValue(item?.qty) || 0;
    const price = getNumberValue(item?.price) || 0;
    return sum + qty * price;
  }, 0);

  return (
    getNumberValue(totals.gpayFinalTotal) ??
    getNumberValue(totals.final) ??
    getNumberValue(totals.total) ??
    getNumberValue(totals.normalTotal) ??
    itemSubtotal
  );
}

function getStaffOrderLineTotal(item = {}) {
  const qty = getNumberValue(item?.qty) || 0;
  const price = getNumberValue(item?.price) || 0;
  return qty * price;
}

function getStaffOrderPaymentStatus(order = {}) {
  return order.paymentStatus || "unpaid";
}

function getStaffOrderBillingStatus(order = {}) {
  return order.billingStatus || "not_billed";
}

function getStaffOrderTableLabel(order = {}) {
  return order.tableNumber || "No table";
}

function getStaffOrderAddonMeta(order = {}) {
  const entryType = normalizeStatus(order.orderEntryType);
  const parentOrderId = String(order.parentOrderId || "").trim();
  const sequenceLabel = String(order.orderSequenceLabel || "").trim();
  const addonSequence = Number(order.addonSequence || 0);
  const isAddon =
    entryType === "add_on" ||
    entryType === "addon" ||
    Boolean(parentOrderId);

  return {
    isAddon,
    parentOrderId,
    sequenceLabel,
    addonSequence: Number.isInteger(addonSequence) && addonSequence > 0 ? addonSequence : null,
    label: sequenceLabel || (parentOrderId ? `Add-on for #${parentOrderId}` : "Add-on order")
  };
}

function getStaffOrderId(order = {}) {
  return String(order.id || "").trim();
}

function getStaffOrderCreatedAtValue(order = {}) {
  const timestamp = new Date(order.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildStaffOrderCardsMarkup(orders = []) {
  const visibleOrderIds = new Set(orders.map(getStaffOrderId).filter(Boolean));
  const addOnsByParentId = orders.reduce((groups, order) => {
    const addonMeta = getStaffOrderAddonMeta(order);

    if (addonMeta.isAddon && addonMeta.parentOrderId && visibleOrderIds.has(addonMeta.parentOrderId)) {
      const groupedAddOns = groups.get(addonMeta.parentOrderId) || [];
      groupedAddOns.push(order);
      groups.set(addonMeta.parentOrderId, groupedAddOns);
    }

    return groups;
  }, new Map());
  const familyLatestCreatedAt = orders.reduce((groups, order) => {
    const addonMeta = getStaffOrderAddonMeta(order);
    const orderId = getStaffOrderId(order);
    const familyId =
      addonMeta.isAddon && addonMeta.parentOrderId && visibleOrderIds.has(addonMeta.parentOrderId)
        ? addonMeta.parentOrderId
        : orderId;

    if (!familyId) {
      return groups;
    }

    const nextTimestamp = getStaffOrderCreatedAtValue(order);
    const currentTimestamp = groups.get(familyId) || 0;
    groups.set(familyId, Math.max(currentTimestamp, nextTimestamp));
    return groups;
  }, new Map());

  return orders
    .filter((order) => {
      const addonMeta = getStaffOrderAddonMeta(order);
      return !(addonMeta.isAddon && addonMeta.parentOrderId && visibleOrderIds.has(addonMeta.parentOrderId));
    })
    .sort((firstOrder, secondOrder) => {
      const firstId = getStaffOrderId(firstOrder);
      const secondId = getStaffOrderId(secondOrder);
      const firstTimestamp = familyLatestCreatedAt.get(firstId) || getStaffOrderCreatedAtValue(firstOrder);
      const secondTimestamp = familyLatestCreatedAt.get(secondId) || getStaffOrderCreatedAtValue(secondOrder);

      if (firstTimestamp !== secondTimestamp) {
        return secondTimestamp - firstTimestamp;
      }

      return secondId.localeCompare(firstId, undefined, { numeric: true, sensitivity: "base" });
    })
    .map((order) => {
      const addonMeta = getStaffOrderAddonMeta(order);
      const orderId = getStaffOrderId(order);
      const childAddOns = orderId ? addOnsByParentId.get(orderId) || [] : [];

      if (!childAddOns.length) {
        return buildStaffOrderCard(order);
      }

      return `
        <section class="staff-order-family" aria-label="Order ${escapeHTML(orderId)} with add-ons">
          ${buildStaffOrderCard(order)}
          <div class="staff-order-family-addons">
            <p class="staff-order-family-label">${escapeHTML(childAddOns.length)} add-on ${childAddOns.length === 1 ? "order" : "orders"} for #${escapeHTML(orderId)}</p>
            ${childAddOns.map(buildStaffOrderCard).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function getStaffOrderSourceMeta(order = {}) {
  const source = normalizeStatus(order.orderSource);
  const orderType = normalizeStatus(order.orderType);
  const tableNumber = String(order.tableNumber || "").trim();
  const isStaffTableOrder = source === "staff";
  const isQrTableOrder =
    Boolean(tableNumber) ||
    orderType === "dine-in" ||
    source === "qr" ||
    source === "table" ||
    source === "dine-in";

  if (isStaffTableOrder) {
    return {
      key: "staff-table",
      label: "Staff Table",
      detail: tableNumber ? `Table ${tableNumber}` : "Dine-in",
      badgeClass: "is-important"
    };
  }

  if (isQrTableOrder) {
    return {
      key: "qr-table",
      label: "QR Table",
      detail: tableNumber ? `Table ${tableNumber}` : "Dine-in",
      badgeClass: "is-important"
    };
  }

  return {
    key: "website",
    label: "Website",
    detail: "Online order",
    badgeClass: ""
  };
}

function getStaffOrderSourceKey(order = {}) {
  return getStaffOrderSourceMeta(order).key || "website";
}

function isStaffTableActivitySource(sourceKey = "") {
  return sourceKey === "qr-table" || sourceKey === "staff-table";
}

function getStaffPaymentBadgeClass(paymentStatus = "") {
  return normalizeStatus(paymentStatus) === "paid" ? "is-success" : "is-danger";
}

function getStaffBillingBadgeClass(billingStatus = "") {
  return normalizeStatus(billingStatus) === "billed" ? "is-success" : "is-warning";
}

function getStaffRouteTransferMeta(order = {}) {
  const routeTransfer =
    order.routeTransfer && typeof order.routeTransfer === "object" && !Array.isArray(order.routeTransfer)
      ? order.routeTransfer
      : {};
  const transferStatus = normalizeStatus(routeTransfer.transferStatus);
  const settlementStatus = normalizeStatus(routeTransfer.settlementStatus);
  const routeStatus = normalizeStatus(routeTransfer.routeStatus);
  const hasRouteSignal =
    !!transferStatus ||
    !!settlementStatus ||
    !!routeStatus ||
    !!routeTransfer.transferRequested;

  if (!hasRouteSignal) {
    return {
      visible: false,
      label: "",
      detail: "",
      badgeClass: ""
    };
  }

  if (transferStatus === "processed" || settlementStatus === "settled") {
    return {
      visible: true,
      label: "Owner Transfer: Processed",
      detail: settlementStatus ? `Settlement: ${settlementStatus}` : "",
      badgeClass: "is-success"
    };
  }

  if (["failed", "reversed", "partially_reversed"].includes(transferStatus)) {
    return {
      visible: true,
      label: `Owner Transfer: ${transferStatus.replace(/_/g, " ")}`,
      detail: routeTransfer.transferError || "Needs admin review",
      badgeClass: "is-danger"
    };
  }

  if (transferStatus || routeTransfer.transferRequested) {
    return {
      visible: true,
      label: `Owner Transfer: ${transferStatus || "requested"}`,
      detail: settlementStatus ? `Settlement: ${settlementStatus}` : "Waiting for Razorpay update",
      badgeClass: "is-warning"
    };
  }

  return {
    visible: true,
    label: `Route: ${routeStatus || "not active"}`,
    detail: "Normal platform settlement",
    badgeClass: ""
  };
}

function getStaffRecordStatusBadgeClass(status = "", type = "") {
  const normalizedStatus = normalizeStatus(status);
  const normalizedType = normalizeStatus(type);

  if (["cancelled", "closed"].includes(normalizedStatus)) {
    return "is-danger";
  }

  if (
    ["completed", "converted"].includes(normalizedStatus) ||
    (normalizedType === "reservation" && ["confirmed", "seated"].includes(normalizedStatus)) ||
    (normalizedType === "inquiry" && normalizedStatus === "contacted") ||
    (normalizedType === "contact" && ["contacted", "resolved"].includes(normalizedStatus)) ||
    (normalizedType === "support" && ["acknowledged", "resolved"].includes(normalizedStatus))
  ) {
    return "is-success";
  }

  return "is-warning";
}

function buildStaffOrderItemsList(order = {}) {
  const items = getStaffOrderItems(order);

  if (!items.length) {
    return `<p class="staff-order-note">No items found for this order.</p>`;
  }

  return `
    <ol class="staff-order-items">
      ${items
        .map((item) => {
          const name = item?.name || item?.id || "Item";
          const qty = getNumberValue(item?.qty) || 0;
          const price = getNumberValue(item?.price);
          const priceLabel = price === null ? "" : ` - ${formatMoney(price)}`;

          return `<li>${escapeHTML(name)} x ${escapeHTML(qty)}${escapeHTML(priceLabel)}</li>`;
        })
        .join("")}
    </ol>
  `;
}

function getStaffOrdersSummary(orders = []) {
  return orders.reduce(
    (summary, order) => {
      const total = getStaffOrderTotal(order);
      const paymentStatus = normalizeStatus(getStaffOrderPaymentStatus(order));
      const billingStatus = normalizeStatus(getStaffOrderBillingStatus(order));
      const sourceKey = getStaffOrderSourceKey(order);

      summary.totalOrders += 1;
      summary.totalEarnings += total;

      if (paymentStatus === "paid") {
        summary.paidOrders += 1;
        summary.paidEarnings += total;
      } else {
        summary.unpaidOrders += 1;
        summary.unpaidEarnings += total;
      }

      if (billingStatus === "billed") {
        summary.billedOrders += 1;
      } else {
        summary.unbilledOrders += 1;
      }

      if (isStaffTableActivitySource(sourceKey)) {
        summary.qrOrders += 1;
        summary.qrEarnings += total;
      } else {
        summary.websiteOrders += 1;
        summary.websiteEarnings += total;
      }

      return summary;
    },
    {
      totalOrders: 0,
      totalEarnings: 0,
      paidOrders: 0,
      unpaidOrders: 0,
      paidEarnings: 0,
      unpaidEarnings: 0,
      billedOrders: 0,
      unbilledOrders: 0,
      qrOrders: 0,
      websiteOrders: 0,
      qrEarnings: 0,
      websiteEarnings: 0
    }
  );
}

function getStaffOrderGroupSummary(orders = []) {
  const summary = getStaffOrdersSummary(orders);
  const latestTimestamp = orders.reduce(
    (maxTimestamp, order) => Math.max(maxTimestamp, getStaffOrderCreatedAtValue(order)),
    0
  );

  return {
    ...summary,
    latestActivityLabel: latestTimestamp ? formatOrderDate(new Date(latestTimestamp).toISOString()) : "No activity yet"
  };
}

function buildStaffSummaryCard(label, value, note, className = "") {
  const cardClassName = ["staff-summary-card", className].filter(Boolean).join(" ");
  return `
    <article class="${escapeHTML(cardClassName)}">
      <p class="staff-summary-label">${escapeHTML(label)}</p>
      <p class="staff-summary-value">${escapeHTML(value)}</p>
      <p class="staff-summary-note">${escapeHTML(note)}</p>
    </article>
  `;
}

function setStaffDashboardSummaryEmpty(
  message = "No orders found for this hotel in the selected range.",
  isLoading = false
) {
  const summaryWrap = $("#staffDashboardSummary");
  const reportsCopy = $("#staffDashboardReportsCopy");
  const reportsWrap = $("#staffDashboardReports");
  const insightsCopy = $("#staffDashboardAiInsightsCopy");
  const insightsWrap = $("#staffDashboardAiInsights");
  const itemSalesCopy = $("#staffDashboardItemSalesCopy");
  const itemSalesWrap = $("#staffDashboardItemSales");
  const supportSummaryWrap = $("#staffDashboardSupportSummary");
  const empty = $("#staffDashboardEmpty");

  if (summaryWrap) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
  }

  if (reportsCopy) {
    reportsCopy.hidden = true;
    reportsCopy.textContent = "Quick daily, weekly, and monthly order reports for this hotel.";
  }

  if (reportsWrap) {
    reportsWrap.hidden = true;
    reportsWrap.innerHTML = "";
  }

  if (insightsCopy) {
    insightsCopy.hidden = true;
    insightsCopy.textContent =
      "Read-only manager insights grounded only in the report cards already loaded for this hotel.";
  }

  if (insightsWrap) {
    insightsWrap.hidden = true;
    insightsWrap.innerHTML = "";
  }

  if (itemSalesCopy) {
    itemSalesCopy.hidden = true;
    itemSalesCopy.textContent =
      "Read-only sold-item patterns from hotel-scoped saved orders. Low-selling currently means low among items that were actually sold in the selected report window.";
  }

  if (itemSalesWrap) {
    itemSalesWrap.hidden = true;
    itemSalesWrap.innerHTML = "";
  }

  if (supportSummaryWrap) {
    supportSummaryWrap.hidden = true;
    supportSummaryWrap.innerHTML = "";
  }

  if (empty) {
    empty.hidden = false;
    empty.textContent = message;
    empty.classList.toggle("is-loading", !!isLoading);
  }
}

function renderStaffOrdersSummary(orders = []) {
  if (!isStaffManagerSession()) {
    setStaffDashboardSummaryEmpty("Manager access required for the dashboard summary.");
    return;
  }

  const summaryWrap = $("#staffDashboardSummary");
  const empty = $("#staffDashboardEmpty");
  if (!summaryWrap) return;

  if (!orders.length) {
    setStaffDashboardSummaryEmpty();
    renderStaffDashboardSupportSummary(STAFF_STATE.supportRequests);
    return;
  }

  const summary = getStaffOrdersSummary(orders);

  summaryWrap.hidden = false;
  if (empty) empty.hidden = true;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Total earnings",
      formatMoney(summary.totalEarnings),
      `${summary.totalOrders} order${summary.totalOrders === 1 ? "" : "s"} in this view`
    ),
    buildStaffSummaryCard(
      "Paid vs unpaid",
      `${summary.paidOrders} paid / ${summary.unpaidOrders} unpaid`,
      `${formatMoney(summary.paidEarnings)} paid - ${formatMoney(summary.unpaidEarnings)} pending`
    ),
    buildStaffSummaryCard(
      "Billing status",
      `${summary.billedOrders} billed / ${summary.unbilledOrders} unbilled`,
      "Track what still needs bill closure"
    ),
    buildStaffSummaryCard(
      "Order sources",
      `${summary.qrOrders} table / ${summary.websiteOrders} website`,
      `${formatMoney(summary.qrEarnings)} table - ${formatMoney(summary.websiteEarnings)} website`
    )
  ].join("");
  renderStaffDashboardSupportSummary(STAFF_STATE.supportRequests);
}

function buildStaffReportNote(summary = {}) {
  return [
    `${summary.totalOrders || 0} order${summary.totalOrders === 1 ? "" : "s"}`,
    `${summary.paidOrders || 0} paid / ${summary.unpaidOrders || 0} unpaid`,
    `${summary.qrOrders || 0} QR / ${summary.websiteOrders || 0} website`
  ].join(" - ");
}

function getStaffReportSummary(reports = STAFF_STATE.dashboardReports, key = "") {
  if (!reports || typeof reports !== "object") {
    return {};
  }

  return reports[key] && typeof reports[key] === "object" ? reports[key] : {};
}

function buildStaffDashboardAiInsightLine(label, copy, options = {}) {
  const isFeatured = Boolean(options.isFeatured);
  const featuredBadgeLabel = String(options.featuredBadgeLabel || "Best current signal").trim() || "Best current signal";

  return `
    <li class="staff-ai-insights-item${isFeatured ? " is-featured" : ""}">
      <div class="staff-ai-insights-item-head">
        <p class="staff-ai-insights-item-label">${escapeHTML(label)}</p>
        ${
          isFeatured
            ? `<span class="staff-ai-insights-item-badge">${escapeHTML(featuredBadgeLabel)}</span>`
            : ""
        }
      </div>
      <p class="staff-ai-insights-item-copy">${escapeHTML(copy)}</p>
    </li>
  `;
}

function getStaffDashboardAiItemSalesInsight(itemSalesReports = STAFF_STATE.itemSalesReports) {
  const period = getPreferredStaffItemSalesPeriod(itemSalesReports);
  const summary = getStaffItemSalesReportSummary(itemSalesReports, period.key);
  const menuMoversLead =
    period.key === "month"
      ? "This month's menu movers"
      : period.key === "week"
        ? "Menu movers for the last 7 days"
        : "Today's menu movers";

  if (!summary || Number(summary.totalDistinctItems || 0) <= 0) {
    return {
      label: "Menu movers",
      copy: `${menuMoversLead} are still building for this hotel, so Smart Waiter is waiting before calling out top or low-selling dishes.`
    };
  }

  const topItems = Array.isArray(summary.topItems) ? summary.topItems : [];
  const lowItems = Array.isArray(summary.lowItems) ? summary.lowItems : [];
  const topItem = topItems[0] || null;
  const lowItem = lowItems[0] || null;
  const topName = String(topItem?.itemName || topItem?.itemId || "").trim();
  const lowName = String(lowItem?.itemName || lowItem?.itemId || "").trim();
  const sameLeadItem =
    topItem &&
    lowItem &&
    String(topItem.itemId || "").trim() &&
    String(topItem.itemId || "").trim() === String(lowItem.itemId || "").trim();

  if (topItem && lowItem && !sameLeadItem && topName && lowName) {
    return {
      label: "Menu movers",
      copy: `${menuMoversLead} show ${topName} leading at ${topItem.quantitySold || 0} sold for ${formatMoney(topItem.revenue || 0)}, while ${lowName} is currently the lightest seller among sold items at ${lowItem.quantitySold || 0} sold for ${formatMoney(lowItem.revenue || 0)}.`
    };
  }

  if (topItem && topName) {
    return {
      label: "Menu movers",
      copy: `${menuMoversLead} currently have ${topName} as the clearest seller at ${topItem.quantitySold || 0} sold across ${topItem.orderCount || 0} order${Number(topItem.orderCount || 0) === 1 ? "" : "s"}, bringing in ${formatMoney(topItem.revenue || 0)}.`
    };
  }

  return {
    label: "Menu movers",
    copy: `${menuMoversLead} are available, but there is not enough stable variety yet to describe top and low-selling dishes confidently.`
  };
}

function getStaffDashboardAiOperationalWatchInsight(
  reports = STAFF_STATE.dashboardReports,
  itemSalesReports = STAFF_STATE.itemSalesReports
) {
  const today = getStaffReportSummary(reports, "today");
  const week = getStaffReportSummary(reports, "week");
  const todayOrders = Number(today.totalOrders || 0);
  const todayUnbilledOrders = Number(today.unbilledOrders || 0);
  const weekUnpaidOrders = Number(week.unpaidOrders || 0);
  const weekUnpaidEarnings = Number(week.unpaidEarnings || 0);
  const hasTodayBillingWatch = todayOrders > 0 && todayUnbilledOrders > 0;
  const hasWeeklyPaymentWatch = weekUnpaidOrders > 0;
  const period = getPreferredStaffItemSalesPeriod(itemSalesReports);
  const itemSummary = getStaffItemSalesReportSummary(itemSalesReports, period.key);
  const topItem = Array.isArray(itemSummary?.topItems) ? itemSummary.topItems[0] || null : null;
  const lowItem = Array.isArray(itemSummary?.lowItems) ? itemSummary.lowItems[0] || null : null;
  const topItemId = String(topItem?.itemId || "").trim();
  const lowItemId = String(lowItem?.itemId || "").trim();
  const lowItemName = String(lowItem?.itemName || lowItemId || "").trim();
  const hasDistinctLowSeller =
    Number(itemSummary?.totalDistinctItems || 0) > 1 &&
    lowItem &&
    lowItemName &&
    (!topItemId || topItemId !== lowItemId);
  const operationalWatchLead =
    hasWeeklyPaymentWatch && hasTodayBillingWatch
      ? "The active watch across the last 7 days and today"
      : hasWeeklyPaymentWatch
        ? "The last 7 days operational watch"
        : hasTodayBillingWatch
          ? "Today's operational watch"
          : `${period.label} operational watch`;
  const watchParts = [];

  if (hasWeeklyPaymentWatch) {
    watchParts.push(
      `${weekUnpaidOrders} unpaid order${weekUnpaidOrders === 1 ? "" : "s"} from the last 7 days still hold ${formatMoney(weekUnpaidEarnings)} in pending collection`
    );
  }

  if (hasTodayBillingWatch) {
    watchParts.push(
      `${todayUnbilledOrders} of today's order${todayUnbilledOrders === 1 ? "" : "s"} still need bill closure`
    );
  }

  if (hasDistinctLowSeller) {
    watchParts.push(
      `${lowItemName} is currently the slowest-moving sold item in ${period.label.toLowerCase()} at ${lowItem.quantitySold || 0} sold`
    );
  }

  if (!watchParts.length) {
    return {
      label: "Operational watchlist",
      copy: `${operationalWatchLead} looks calm: unpaid carryover is clear, today's bill closure looks steady, and no slower-moving sold item needs a caution note yet.`
    };
  }

  return {
    label: "Operational watchlist",
    copy: `${operationalWatchLead} is ${watchParts.join("; ")}.`
  };
}

function getStaffDashboardAiSourceBalanceInsight(reports = STAFF_STATE.dashboardReports) {
  const month = getStaffReportSummary(reports, "month");
  const monthQrOrders = Number(month.qrOrders || 0);
  const monthWebsiteOrders = Number(month.websiteOrders || 0);
  const monthQrEarnings = Number(month.qrEarnings || 0);
  const monthWebsiteEarnings = Number(month.websiteEarnings || 0);
  const totalOrders = monthQrOrders + monthWebsiteOrders;

  if (totalOrders <= 0) {
    return {
      label: "Source balance",
      copy: "This month is still too quiet to flag a table versus website balance caution yet."
    };
  }

  const qrShare = monthQrOrders / totalOrders;
  const websiteShare = monthWebsiteOrders / totalOrders;
  const qrDominant = qrShare >= websiteShare;
  const dominantLabel = qrDominant ? "Table" : "Website";
  const supportingLabel = qrDominant ? "website" : "table";
  const dominantOrders = qrDominant ? monthQrOrders : monthWebsiteOrders;
  const supportingOrders = qrDominant ? monthWebsiteOrders : monthQrOrders;
  const dominantRevenue = qrDominant ? monthQrEarnings : monthWebsiteEarnings;
  const supportingRevenue = qrDominant ? monthWebsiteEarnings : monthQrEarnings;
  const dominantShare = qrDominant ? qrShare : websiteShare;
  const shareLabel = `${Math.round(dominantShare * 100)}%`;

  if (totalOrders >= 4 && dominantShare >= 0.75) {
    return {
      label: "Source balance",
      copy: `${dominantLabel} ordering is carrying about ${shareLabel} of this month's order count at ${dominantOrders} order${dominantOrders === 1 ? "" : "s"} and ${formatMoney(dominantRevenue)}, while ${supportingLabel} is still lighter at ${supportingOrders} order${supportingOrders === 1 ? "" : "s"} and ${formatMoney(supportingRevenue)}. This is worth watching before the mix becomes too one-sided.`
    };
  }

  if (totalOrders >= 4 && dominantShare >= 0.65) {
    return {
      label: "Source balance",
      copy: `${dominantLabel} ordering is the stronger lane this month at about ${shareLabel} of order count, but the mix is still broad enough that this reads as a watch item rather than a concern.`
    };
  }

  return {
    label: "Source balance",
    copy: `This month still looks reasonably balanced between table and website ordering, with ${monthQrOrders} table order${monthQrOrders === 1 ? "" : "s"} and ${monthWebsiteOrders} website order${monthWebsiteOrders === 1 ? "" : "s"}.`
  };
}

function getStaffDashboardAiQuietStateInsight(
  reports = STAFF_STATE.dashboardReports,
  itemSalesReports = STAFF_STATE.itemSalesReports
) {
  const today = getStaffReportSummary(reports, "today");
  const week = getStaffReportSummary(reports, "week");
  const month = getStaffReportSummary(reports, "month");
  const period = getPreferredStaffItemSalesPeriod(itemSalesReports);
  const itemSummary = getStaffItemSalesReportSummary(itemSalesReports, period.key);
  const todayOrders = Number(today.totalOrders || 0);
  const todayUnbilledOrders = Number(today.unbilledOrders || 0);
  const weekOrders = Number(week.totalOrders || 0);
  const weekUnpaidOrders = Number(week.unpaidOrders || 0);
  const monthOrders = Number(month.totalOrders || 0);
  const distinctSoldItems = Number(itemSummary?.totalDistinctItems || 0);
  const quietSnapshotLabel =
    todayOrders > 0
      ? "Today"
      : weekOrders > 0
        ? "Last 7 days"
        : monthOrders > 0
          ? "This month"
          : "Today, last 7 days, and this month";
  const hasMeaningfulSourcePattern = monthOrders >= 4;
  const hasMeaningfulSoldItemPattern = distinctSoldItems >= 2;

  if (
    weekUnpaidOrders > 0 ||
    todayUnbilledOrders > 0 ||
    todayOrders >= 2 ||
    weekOrders >= 4 ||
    monthOrders >= 6 ||
    hasMeaningfulSourcePattern ||
    hasMeaningfulSoldItemPattern
  ) {
    return null;
  }

  if (monthOrders <= 0) {
    return {
      label: "Quiet dashboard",
      copy: `${quietSnapshotLabel} is still very quiet for this hotel, so Smart Waiter is keeping the summary cautious until more order movement builds up.`
    };
  }

  return {
    label: "Quiet dashboard",
    copy: `${quietSnapshotLabel} is the clearest quiet snapshot here, and this hotel is still in a light-activity window with ${monthOrders} month-to-date order${monthOrders === 1 ? "" : "s"} and ${weekOrders} order${weekOrders === 1 ? "" : "s"} in the last 7 days, so the current AI summary should be read as an early signal rather than a strong trend.`
  };
}

function getStaffDashboardAiConfidenceNote(
  reports = STAFF_STATE.dashboardReports,
  itemSalesReports = STAFF_STATE.itemSalesReports
) {
  const today = getStaffReportSummary(reports, "today");
  const week = getStaffReportSummary(reports, "week");
  const month = getStaffReportSummary(reports, "month");
  const period = getPreferredStaffItemSalesPeriod(itemSalesReports);
  const itemSummary = getStaffItemSalesReportSummary(itemSalesReports, period.key);
  const todayOrders = Number(today.totalOrders || 0);
  const todayUnbilledOrders = Number(today.unbilledOrders || 0);
  const weekUnpaidOrders = Number(week.unpaidOrders || 0);
  const monthQrOrders = Number(month.qrOrders || 0);
  const monthWebsiteOrders = Number(month.websiteOrders || 0);
  const hasMonthlySourceTrend =
    monthQrOrders > 0 ||
    monthWebsiteOrders > 0;
  const hasSoldItemSignal = Number(itemSummary?.totalDistinctItems || 0) > 0;
  const quietStateInsight = getStaffDashboardAiQuietStateInsight(reports, itemSalesReports);

  if (weekUnpaidOrders > 0) {
    return `Strongest signal right now: Last 7 days, because pending collection follow-up is still active.`;
  }

  if (todayUnbilledOrders > 0) {
    return `Strongest signal right now: Today, because bill closure still needs attention on live orders.`;
  }

  if (quietStateInsight) {
    if (todayOrders > 0) {
      return `Confidence is intentionally soft right now: Today offers the clearest live read, but overall activity is still light.`;
    }

    if (hasMonthlySourceTrend) {
      return `Confidence is intentionally soft right now: This month offers the clearest pattern so far, but the order sample is still light.`;
    }

    if (hasSoldItemSignal) {
      return `Confidence is intentionally soft right now: ${period.label} offers the clearest sold-item read so far, but the sample is still early.`;
    }
  }

  if (todayOrders > 0) {
    return `Strongest signal right now: Today, because the clearest live pace read is coming from current order activity.`;
  }

  if (hasMonthlySourceTrend) {
    return `Strongest signal right now: This month, because source mix is the clearest stable trend available.`;
  }

  if (hasSoldItemSignal) {
    return `Strongest signal right now: ${period.label}, because sold-item movement is the clearest stable pattern available.`;
  }

  return "Confidence is still light here because this hotel does not have enough current report movement yet.";
}

function getStaffDashboardAiFreshnessNote(
  reports = STAFF_STATE.dashboardReports,
  itemSalesReports = STAFF_STATE.itemSalesReports
) {
  const freshnessLabel = String(STAFF_STATE.dashboardReportsFreshnessLabel || "").trim();
  const quietStateInsight = getStaffDashboardAiQuietStateInsight(reports, itemSalesReports);

  if (quietStateInsight) {
    return freshnessLabel
      ? `Insight snapshot: ${freshnessLabel}. Activity is still quiet, so treat this as a light checkpoint.`
      : "Insight snapshot is waiting for the first manager report refresh while activity is still quiet.";
  }

  return freshnessLabel
    ? `Insight snapshot: ${freshnessLabel}.`
    : "Insight snapshot is waiting for the first manager report refresh.";
}

function getStaffDashboardAiFeaturedLabel(
  reports = STAFF_STATE.dashboardReports,
  itemSalesReports = STAFF_STATE.itemSalesReports
) {
  const today = getStaffReportSummary(reports, "today");
  const week = getStaffReportSummary(reports, "week");
  const month = getStaffReportSummary(reports, "month");
  const weekUnpaidOrders = Number(week.unpaidOrders || 0);
  const todayUnbilledOrders = Number(today.unbilledOrders || 0);
  const todayOrders = Number(today.totalOrders || 0);
  const monthQrOrders = Number(month.qrOrders || 0);
  const monthWebsiteOrders = Number(month.websiteOrders || 0);
  const monthTotalOrders = monthQrOrders + monthWebsiteOrders;
  const dominantShare = monthTotalOrders
    ? Math.max(monthQrOrders, monthWebsiteOrders) / monthTotalOrders
    : 0;
  const quietStateInsight = getStaffDashboardAiQuietStateInsight(reports, itemSalesReports);
  const itemPeriod = getPreferredStaffItemSalesPeriod(itemSalesReports);
  const itemSummary = getStaffItemSalesReportSummary(itemSalesReports, itemPeriod.key);
  const hasSoldItemSignal = Number(itemSummary?.totalDistinctItems || 0) > 0;

  if (weekUnpaidOrders > 0) {
    return "Payment watch";
  }

  if (todayUnbilledOrders > 0) {
    return "Operational watchlist";
  }

  if (monthTotalOrders >= 4 && dominantShare >= 0.75) {
    return "Source balance";
  }

  if (quietStateInsight) {
    return "";
  }

  if (todayOrders > 0) {
    return "Today at a glance";
  }

  if (hasSoldItemSignal) {
    return "Menu movers";
  }

  if (quietStateInsight) {
    return "Quiet dashboard";
  }

  return "Source mix";
}

function getStaffDashboardAiFeaturedBadgeLabel(featuredLabel = "") {
  const normalizedLabel = String(featuredLabel || "").trim();
  const cautionLabels = new Set(["Payment watch", "Operational watchlist", "Source balance"]);
  const calmSummaryLabels = new Set(["Today at a glance", "Source mix", "Menu movers", "Quiet dashboard"]);

  if (cautionLabels.has(normalizedLabel)) {
    return "Watch now";
  }

  if (calmSummaryLabels.has(normalizedLabel)) {
    return "Worth noting";
  }

  return "Best current signal";
}

function getStaffDashboardAiInsightItems(
  reports = STAFF_STATE.dashboardReports,
  itemSalesReports = STAFF_STATE.itemSalesReports
) {
  const today = getStaffReportSummary(reports, "today");
  const week = getStaffReportSummary(reports, "week");
  const month = getStaffReportSummary(reports, "month");

  const todayOrders = Number(today.totalOrders || 0);
  const weekUnpaidOrders = Number(week.unpaidOrders || 0);
  const monthQrOrders = Number(month.qrOrders || 0);
  const monthWebsiteOrders = Number(month.websiteOrders || 0);
  const monthQrEarnings = Number(month.qrEarnings || 0);
  const monthWebsiteEarnings = Number(month.websiteEarnings || 0);
  const todayAtAGlanceLead = "Today's at-a-glance view";
  const paymentWatchLead = "The last 7 days payment watch";
  const sourceMixLead = "This month's source mix";

  const items = [];
  const quietStateInsight = getStaffDashboardAiQuietStateInsight(
    reports,
    itemSalesReports
  );

  items.push({
    label: "Today at a glance",
    copy: todayOrders
      ? `${todayAtAGlanceLead} is running at ${formatMoney(today.totalEarnings || 0)} from ${todayOrders} order${todayOrders === 1 ? "" : "s"}, with ${today.paidOrders || 0} already marked paid.`
      : `${todayAtAGlanceLead} does not have any recorded orders yet in this hotel's manager report.`
  });

  if (quietStateInsight) {
    items.push(quietStateInsight);
  }

  items.push({
    label: "Payment watch",
    copy: weekUnpaidOrders
      ? `${paymentWatchLead} still shows ${weekUnpaidOrders} unpaid order${weekUnpaidOrders === 1 ? "" : "s"} worth ${formatMoney(week.unpaidEarnings || 0)}, so payment follow-up is still active.`
      : `${paymentWatchLead} shows all reported orders marked paid, covering ${formatMoney(week.paidEarnings || 0)} in confirmed paid revenue.`
  });

  if (monthQrOrders === 0 && monthWebsiteOrders === 0) {
    items.push({
      label: "Source mix",
      copy: `${sourceMixLead} does not have enough order-source activity yet to explain a table versus website trend.`
    });
  } else if (monthQrOrders > monthWebsiteOrders) {
    items.push({
      label: "Source mix",
      copy: `${sourceMixLead} shows table ordering leading at ${monthQrOrders} order${monthQrOrders === 1 ? "" : "s"} and ${formatMoney(monthQrEarnings)}, ahead of website ordering at ${monthWebsiteOrders} order${monthWebsiteOrders === 1 ? "" : "s"} and ${formatMoney(monthWebsiteEarnings)}.`
    });
  } else if (monthWebsiteOrders > monthQrOrders) {
    items.push({
      label: "Source mix",
      copy: `${sourceMixLead} shows website ordering leading at ${monthWebsiteOrders} order${monthWebsiteOrders === 1 ? "" : "s"} and ${formatMoney(monthWebsiteEarnings)}, ahead of table ordering at ${monthQrOrders} order${monthQrOrders === 1 ? "" : "s"} and ${formatMoney(monthQrEarnings)}.`
    });
  } else {
    items.push({
      label: "Source mix",
      copy: `${sourceMixLead} is evenly split by order count, with ${monthQrOrders} table order${monthQrOrders === 1 ? "" : "s"} and ${monthWebsiteOrders} website order${monthWebsiteOrders === 1 ? "" : "s"}, while revenue is ${formatMoney(monthQrEarnings)} versus ${formatMoney(monthWebsiteEarnings)}.`
    });
  }

  items.push(getStaffDashboardAiSourceBalanceInsight(reports));
  items.push(getStaffDashboardAiOperationalWatchInsight(reports, itemSalesReports));
  items.push(getStaffDashboardAiItemSalesInsight(itemSalesReports));

  return items;
}

function renderStaffDashboardAiInsights(reports = STAFF_STATE.dashboardReports) {
  const insightsCopy = $("#staffDashboardAiInsightsCopy");
  const insightsWrap = $("#staffDashboardAiInsights");

  if (!insightsWrap) return;

  if (!isStaffManagerSession()) {
    if (insightsCopy) insightsCopy.hidden = true;
    insightsWrap.hidden = true;
    insightsWrap.innerHTML = "";
    return;
  }

  const hasReports = reports && typeof reports === "object";
  if (!hasReports) {
    if (insightsCopy) insightsCopy.hidden = true;
    insightsWrap.hidden = true;
    insightsWrap.innerHTML = "";
    return;
  }

  const insightItems = getStaffDashboardAiInsightItems(
    reports,
    STAFF_STATE.itemSalesReports
  );
  const featuredLabel = getStaffDashboardAiFeaturedLabel(
    reports,
    STAFF_STATE.itemSalesReports
  );
  const featuredBadgeLabel = getStaffDashboardAiFeaturedBadgeLabel(featuredLabel);
  const confidenceNote = getStaffDashboardAiConfidenceNote(
    reports,
    STAFF_STATE.itemSalesReports
  );
  const freshnessNote = getStaffDashboardAiFreshnessNote(
    reports,
    STAFF_STATE.itemSalesReports
  );

  if (insightsCopy) {
    insightsCopy.hidden = false;
  }

  insightsWrap.hidden = false;
  insightsWrap.innerHTML = `
    <div class="staff-ai-insights-head">
      <div>
        <p class="staff-ai-insights-kicker">Manager AI Insights</p>
        <h4 class="staff-ai-insights-title">Read-only hotel insight summary</h4>
      </div>
      <div class="staff-ai-insights-meta">
        <p class="staff-ai-insights-note">Grounded only in the current today, last 7 days, this month, and sold-item reports already loaded for this hotel.</p>
        <p class="staff-ai-insights-confidence">${escapeHTML(confidenceNote)}</p>
        <p class="staff-ai-insights-freshness">${escapeHTML(freshnessNote)}</p>
      </div>
    </div>
    <ul class="staff-ai-insights-list">
      ${insightItems
        .map(({ label, copy }) =>
          buildStaffDashboardAiInsightLine(label, copy, {
            isFeatured: label === featuredLabel,
            featuredBadgeLabel
          })
        )
        .join("")}
    </ul>
  `;
}

function getStaffItemSalesReportSummary(reports = STAFF_STATE.itemSalesReports, key = "") {
  if (!reports || typeof reports !== "object") {
    return null;
  }

  const summary = reports[key];
  return summary && typeof summary === "object" ? summary : null;
}

function getPreferredStaffItemSalesPeriod(reports = STAFF_STATE.itemSalesReports) {
  const periodOptions = [
    { key: "month", label: "This month" },
    { key: "week", label: "Last 7 days" },
    { key: "today", label: "Today" }
  ];

  return (
    periodOptions.find(({ key }) => {
      const summary = getStaffItemSalesReportSummary(reports, key);
      return summary && Number(summary.totalDistinctItems || 0) > 0;
    }) || periodOptions[0]
  );
}

function buildStaffItemSalesListMarkup(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return `
      <li class="staff-item-sales-row">
        <p class="staff-item-sales-name">No sold items yet</p>
        <p class="staff-item-sales-copy">This report window does not have enough sold-item history yet.</p>
      </li>
    `;
  }

  return items
    .map((item) => {
      const itemName = String(item?.itemName || item?.itemId || "Unnamed item").trim();
      const quantitySold = Number(item?.quantitySold || 0);
      const revenue = Number(item?.revenue || 0);
      const orderCount = Number(item?.orderCount || 0);

      return `
        <li class="staff-item-sales-row">
          <p class="staff-item-sales-name">${escapeHTML(itemName)}</p>
          <p class="staff-item-sales-copy">${escapeHTML(`${quantitySold} sold across ${orderCount} order${orderCount === 1 ? "" : "s"} - ${formatMoney(revenue)}`)}</p>
        </li>
      `;
    })
    .join("");
}

function buildStaffItemSalesCard({
  title = "",
  label = "",
  note = "",
  items = [],
  className = ""
} = {}) {
  const cardClassName = ["staff-summary-card", "staff-item-sales-card", className]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${escapeHTML(cardClassName)}">
      <p class="staff-summary-label">${escapeHTML(label)}</p>
      <p class="staff-summary-value">${escapeHTML(title)}</p>
      <p class="staff-item-sales-period">${escapeHTML(note)}</p>
      <ul class="staff-item-sales-list">
        ${buildStaffItemSalesListMarkup(items)}
      </ul>
    </article>
  `;
}

function renderStaffDashboardItemSalesReports(reports = STAFF_STATE.itemSalesReports) {
  const itemSalesCopy = $("#staffDashboardItemSalesCopy");
  const itemSalesWrap = $("#staffDashboardItemSales");

  if (!itemSalesWrap) return;

  if (!isStaffManagerSession()) {
    if (itemSalesCopy) itemSalesCopy.hidden = true;
    itemSalesWrap.hidden = true;
    itemSalesWrap.innerHTML = "";
    return;
  }

  const period = getPreferredStaffItemSalesPeriod(reports);
  const summary = getStaffItemSalesReportSummary(reports, period.key);

  if (!summary) {
    if (itemSalesCopy) itemSalesCopy.hidden = true;
    itemSalesWrap.hidden = true;
    itemSalesWrap.innerHTML = "";
    return;
  }

  const distinctItems = Number(summary.totalDistinctItems || 0);
  const unitsSold = Number(summary.totalUnitsSold || 0);
  const totalRevenue = Number(summary.totalRevenue || 0);

  if (itemSalesCopy) {
    itemSalesCopy.hidden = false;
    itemSalesCopy.textContent =
      `${period.label} sold-item snapshot for this hotel: ${distinctItems} distinct sold item${distinctItems === 1 ? "" : "s"}, ${unitsSold} unit${unitsSold === 1 ? "" : "s"}, and ${formatMoney(totalRevenue)} in item revenue. Low-selling still means low among sold items only.`;
  }

  itemSalesWrap.hidden = false;
  itemSalesWrap.innerHTML = [
    buildStaffItemSalesCard({
      label: `${period.label} top sellers`,
      title: "Top-selling items",
      note: `${distinctItems} sold item${distinctItems === 1 ? "" : "s"} in this report window`,
      items: Array.isArray(summary.topItems) ? summary.topItems : []
    }),
    buildStaffItemSalesCard({
      label: `${period.label} low sellers`,
      title: "Low-selling items",
      note: "Low means lowest among items that still sold in this report window",
      items: Array.isArray(summary.lowItems) ? summary.lowItems : [],
      className: "is-low-selling"
    })
  ].join("");
}

function renderStaffDashboardReports(reports = STAFF_STATE.dashboardReports) {
  const reportsCopy = $("#staffDashboardReportsCopy");
  const reportsWrap = $("#staffDashboardReports");
  if (!reportsWrap) return;

  const hasReports = reports && typeof reports === "object";
  if (!hasReports) {
    if (reportsCopy) reportsCopy.hidden = true;
    reportsWrap.hidden = true;
    reportsWrap.innerHTML = "";
    renderStaffDashboardAiInsights(null);
    renderStaffDashboardItemSalesReports(null);
    return;
  }

  const periods = [
    { key: "today", label: "Today" },
    { key: "week", label: "Last 7 days" },
    { key: "month", label: "This month" }
  ];

  if (reportsCopy) reportsCopy.hidden = false;
  reportsWrap.hidden = false;
  reportsWrap.innerHTML = periods
    .map(({ key, label }) => {
      const summary = reports[key] && typeof reports[key] === "object" ? reports[key] : {};
      return buildStaffSummaryCard(
        `${label} report`,
        formatMoney(summary.totalEarnings || 0),
        buildStaffReportNote(summary)
      );
    })
    .join("");
  renderStaffDashboardAiInsights(reports);
  renderStaffDashboardItemSalesReports(STAFF_STATE.itemSalesReports);
}

function renderStaffOrdersQuickReports(reports = STAFF_STATE.dashboardReports) {
  const reportsCopy = $("#staffOrdersReportsCopy");
  const reportsWrap = $("#staffOrdersReports");
  if (!reportsWrap) return;

  if (!isStaffManagerSession()) {
    if (reportsCopy) reportsCopy.hidden = true;
    reportsWrap.hidden = true;
    reportsWrap.innerHTML = "";
    return;
  }

  const hasReports = reports && typeof reports === "object";
  if (!hasReports) {
    if (reportsCopy) reportsCopy.hidden = true;
    reportsWrap.hidden = true;
    reportsWrap.innerHTML = "";
    return;
  }

  const activeRange = $("#staffOrdersRangeInput")?.value || "";
  const periods = [
    { key: "today", label: "Today" },
    { key: "week", label: "Last 7 days" },
    { key: "month", label: "This month" }
  ];

  if (reportsCopy) reportsCopy.hidden = false;
  reportsWrap.hidden = false;
  reportsWrap.innerHTML = periods
    .map(({ key, label }) => {
      const summary = reports[key] && typeof reports[key] === "object" ? reports[key] : {};
      const isActivePeriod = key === activeRange;
      return buildStaffSummaryCard(
        `${label} report`,
        formatMoney(summary.totalEarnings || 0),
        buildStaffReportNote(summary),
        isActivePeriod ? "is-active-period" : ""
      );
    })
    .join("");
}

function getStaffOrdersAttentionSummary(orders = []) {
  return orders.reduce(
    (summary, order) => {
      const total = getStaffOrderTotal(order);
      const orderStatus = normalizeStatus(order.status);
      const paymentStatus = normalizeStatus(getStaffOrderPaymentStatus(order));
      const billingStatus = normalizeStatus(getStaffOrderBillingStatus(order));

      if (orderStatus === "new") {
        summary.newOrders += 1;
      }

      if (paymentStatus !== "paid") {
        summary.unpaidOrders += 1;
        summary.unpaidAmount += total;
      }

      if (billingStatus !== "billed") {
        summary.unbilledOrders += 1;
        summary.unbilledAmount += total;
      }

      return summary;
    },
    {
      newOrders: 0,
      unpaidOrders: 0,
      unpaidAmount: 0,
      unbilledOrders: 0,
      unbilledAmount: 0
    }
  );
}

function renderStaffOrdersAttentionSummary(orders = []) {
  const copy = $("#staffOrdersAttentionCopy");
  const wrap = $("#staffOrdersAttentionSummary");
  if (!wrap) return;

  if (!orders.length) {
    if (copy) copy.hidden = true;
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  const summary = getStaffOrdersAttentionSummary(orders);

  if (copy) copy.hidden = false;
  wrap.hidden = false;
  wrap.innerHTML = [
    buildStaffSummaryCard(
      "New orders",
      `${summary.newOrders}`,
      summary.newOrders
        ? "Fresh orders still waiting for acknowledgement"
        : "No newly received orders in this view",
      "is-attention-new"
    ),
    buildStaffSummaryCard(
      "Unpaid",
      `${summary.unpaidOrders}`,
      `${formatMoney(summary.unpaidAmount)} still pending payment`,
      "is-attention-payment"
    ),
    buildStaffSummaryCard(
      "Unbilled",
      `${summary.unbilledOrders}`,
      `${formatMoney(summary.unbilledAmount)} still open for billing`,
      "is-attention-billing"
    )
  ].join("");
}

function countStaffRecordsByStatus(records = []) {
  return records.reduce(
    (counts, record) => {
      const status = normalizeStatus(record.status) || "new";
      counts.total += 1;
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    { total: 0 }
  );
}

function renderStaffReservationsSummary(reservations = []) {
  const summaryWrap = $("#staffReservationsSummary");
  if (!summaryWrap) return;

  if (!reservations.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = countStaffRecordsByStatus(reservations);

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Reservations",
      `${counts.total}`,
      "Total reservation requests in this view"
    ),
    buildStaffSummaryCard(
      "New",
      `${counts.new || 0}`,
      "Fresh requests waiting for attention"
    ),
    buildStaffSummaryCard(
      "Confirmed",
      `${counts.confirmed || 0}`,
      "Reservations confirmed by the hotel"
    ),
    buildStaffSummaryCard(
      "Completed / Cancelled",
      `${(counts.completed || 0) + (counts.cancelled || 0)}`,
      `${counts.completed || 0} completed - ${counts.cancelled || 0} cancelled`
    )
  ].join("");
}

function renderStaffInquiriesSummary(inquiries = []) {
  const summaryWrap = $("#staffInquiriesSummary");
  if (!summaryWrap) return;

  if (!inquiries.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = countStaffRecordsByStatus(inquiries);

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Inquiries",
      `${counts.total}`,
      "Total inquiry requests in this view"
    ),
    buildStaffSummaryCard(
      "New",
      `${counts.new || 0}`,
      "Fresh inquiries waiting for reply"
    ),
    buildStaffSummaryCard(
      "Contacted",
      `${counts.contacted || 0}`,
      "Guests already contacted"
    ),
    buildStaffSummaryCard(
      "Converted / Closed",
      `${(counts.converted || 0) + (counts.closed || 0)}`,
      `${counts.converted || 0} converted - ${counts.closed || 0} closed`
    )
  ].join("");
}

function renderStaffContactsSummary(contactSubmissions = []) {
  const summaryWrap = $("#staffContactsSummary");
  if (!summaryWrap) return;

  if (!contactSubmissions.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = countStaffRecordsByStatus(contactSubmissions);

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Contact messages",
      `${counts.total}`,
      "Total contact form messages in this view"
    ),
    buildStaffSummaryCard(
      "New",
      `${counts.new || 0}`,
      "Fresh contact messages waiting for reply"
    ),
    buildStaffSummaryCard(
      "Contacted",
      `${counts.contacted || 0}`,
      "Guests already contacted"
    ),
    buildStaffSummaryCard(
      "Resolved / Closed",
      `${(counts.resolved || 0) + (counts.closed || 0)}`,
      `${counts.resolved || 0} resolved - ${counts.closed || 0} closed`
    )
  ].join("");
}

function getStaffSupportRequestCounts(supportRequests = []) {
  return supportRequests.reduce(
    (summary, supportRequest) => {
      const status = normalizeStatus(supportRequest.status) || "new";
      const requestType = normalizeStatus(supportRequest.requestType);

      summary.total += 1;
      summary[status] = (summary[status] || 0) + 1;

      if (requestType === "bill") {
        summary.bill += 1;
      } else if (requestType === "help") {
        summary.help += 1;
      }

      return summary;
    },
    { total: 0, bill: 0, help: 0 }
  );
}

function getStaffOpenSupportRequestCount(supportRequests = STAFF_STATE.supportRequests) {
  const counts = getStaffSupportRequestCounts(supportRequests);
  return (counts.new || 0) + (counts.acknowledged || 0);
}

function renderStaffDashboardSupportSummary(supportRequests = []) {
  const summaryWrap = $("#staffDashboardSupportSummary");
  if (!summaryWrap) return;

  if (!isStaffManagerSession()) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  if (!supportRequests.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = getStaffSupportRequestCounts(supportRequests);
  const openCount = getStaffOpenSupportRequestCount(supportRequests);

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Table support",
      `${openCount} open`,
      `${counts.bill || 0} bill - ${counts.help || 0} help requests`
    ),
    buildStaffSummaryCard(
      "New requests",
      `${counts.new || 0}`,
      "Fresh requests from tracking pages"
    ),
    buildStaffSummaryCard(
      "Acknowledged",
      `${counts.acknowledged || 0}`,
      "Staff already noticed these"
    ),
    buildStaffSummaryCard(
      "Resolved / Closed",
      `${counts.resolved || 0} resolved`,
      `${counts.closed || 0} closed`
    )
  ].join("");
}

function renderStaffSupportSummary(supportRequests = []) {
  const summaryWrap = $("#staffSupportSummary");
  if (!summaryWrap) return;

  if (!supportRequests.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = getStaffSupportRequestCounts(supportRequests);

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Support requests",
      `${counts.total}`,
      "Total table requests in this view"
    ),
    buildStaffSummaryCard(
      "Bill requests",
      `${counts.bill || 0}`,
      "Customers asking to close the bill"
    ),
    buildStaffSummaryCard(
      "Help requests",
      `${counts.help || 0}`,
      "Customers asking for staff assistance"
    ),
    buildStaffSummaryCard(
      "Open / Resolved",
      `${(counts.new || 0) + (counts.acknowledged || 0)} open / ${counts.resolved || 0} resolved`,
      `${counts.closed || 0} closed`
    )
  ].join("");
}

function renderStaffTestimonialsSummary(testimonials = []) {
  const summaryWrap = $("#staffTestimonialsSummary");
  if (!summaryWrap) return;

  if (!testimonials.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = testimonials.reduce(
    (summary, testimonial) => {
      summary.total += 1;

      if (testimonial.isApproved === true) {
        summary.approved += 1;
      } else {
        summary.pending += 1;
      }

      if (testimonial.isArchived === true || testimonial.isActive === false) {
        summary.hidden += 1;
      }

      return summary;
    },
    { total: 0, approved: 0, pending: 0, hidden: 0 }
  );

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Testimonials",
      `${counts.total}`,
      "Total guest reviews in this view"
    ),
    buildStaffSummaryCard(
      "Pending approval",
      `${counts.pending}`,
      "Reviews waiting before public display"
    ),
    buildStaffSummaryCard(
      "Approved",
      `${counts.approved}`,
      "Reviews allowed by approval status"
    ),
    buildStaffSummaryCard(
      "Inactive / Archived",
      `${counts.hidden}`,
      "Still hidden even if approved"
    )
  ].join("");
}

function getStaffSelectedSourceFilter() {
  return $("#staffOrdersSourceInput")?.value || "all";
}

function getStaffSelectedTableFilter() {
  return $("#staffOrdersTableInput")?.value || "all";
}

function getStaffSelectedPaymentFilter() {
  return $("#staffOrdersPaymentInput")?.value || "all";
}

function getStaffSelectedBillingFilter() {
  return $("#staffOrdersBillingInput")?.value || "all";
}

function getStaffSelectedOrderStatusFilter() {
  return $("#staffOrdersStatusInput")?.value || "all";
}

function isStaffAttentionFilterEnabled() {
  return $("#staffOrdersAttentionToggle")?.getAttribute("aria-pressed") === "true";
}

function setStaffAttentionFilterEnabled(isEnabled) {
  const button = $("#staffOrdersAttentionToggle");
  if (!button) return;

  const pressed = isEnabled ? "true" : "false";
  button.setAttribute("aria-pressed", pressed);
  button.classList.toggle("is-active", !!isEnabled);
}

function getStaffOrdersSearchTerm() {
  return String($("#staffOrdersSearchInput")?.value || "").trim().toLowerCase();
}

function getStaffSelectedRecordStatusFilter(selector) {
  return $(selector)?.value || "all";
}

function getStaffSelectedApprovalFilter() {
  return $("#staffTestimonialsApprovalInput")?.value || "all";
}

function filterStaffRecordsByStatus(records = [], statusFilter = "all") {
  if (statusFilter === "all") {
    return records;
  }

  return records.filter((record) => normalizeStatus(record.status) === statusFilter);
}

function getStaffSelectedRangeLabel() {
  const input = $("#staffOrdersRangeInput");
  return input?.selectedOptions?.[0]?.textContent?.trim() || "selected range";
}

function getStaffSelectedFilterLabels() {
  const sourceInput = $("#staffOrdersSourceInput");
  const tableInput = $("#staffOrdersTableInput");
  const paymentInput = $("#staffOrdersPaymentInput");
  const billingInput = $("#staffOrdersBillingInput");
  const statusInput = $("#staffOrdersStatusInput");
  const searchTerm = getStaffOrdersSearchTerm();
  const attentionOnly = isStaffAttentionFilterEnabled();

  return [
    sourceInput,
    tableInput,
    paymentInput,
    billingInput,
    statusInput
  ]
    .filter((input) => input && input.value !== "all")
    .map((input) => input.selectedOptions?.[0]?.textContent?.trim() || input.value)
    .concat(attentionOnly ? ["Needs attention"] : [])
    .concat(searchTerm ? [`Search: ${searchTerm}`] : []);
}

function getStaffOrderSearchBlob(order = {}) {
  const createdByStaff = order.createdByStaff && typeof order.createdByStaff === "object"
    ? order.createdByStaff
    : {};

  return [
    order.id,
    order.customerName,
    order.customerPhone,
    order.customerAddress,
    order.tableNumber,
    order.orderSequenceLabel,
    order.billNumber,
    order.createdByStaffId,
    createdByStaff.displayName
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getStaffAvailableTableNumbers(orders = STAFF_STATE.orders) {
  return Array.from(
    new Set(
      orders
        .map((order) => String(order.tableNumber || "").trim())
        .filter(Boolean)
    )
  ).sort((firstTable, secondTable) =>
    firstTable.localeCompare(secondTable, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function updateStaffOrderTableFilterOptions(orders = STAFF_STATE.orders) {
  const tableInput = $("#staffOrdersTableInput");
  if (!tableInput) return;

  const previousValue = tableInput.value || "all";
  const tableNumbers = getStaffAvailableTableNumbers(orders);

  tableInput.innerHTML = [
    '<option value="all" selected>All tables</option>',
    ...tableNumbers.map((tableNumber) => `<option value="${escapeHTML(tableNumber)}">${escapeHTML(tableNumber)}</option>`)
  ].join("");

  if (tableNumbers.includes(previousValue)) {
    tableInput.value = previousValue;
  } else {
    tableInput.value = "all";
  }
}

function getStaffVisibleOrders() {
  const sourceFilter = getStaffSelectedSourceFilter();
  const tableFilter = getStaffSelectedTableFilter();
  const paymentFilter = getStaffSelectedPaymentFilter();
  const billingFilter = getStaffSelectedBillingFilter();
  const orderStatusFilter = getStaffSelectedOrderStatusFilter();
  const attentionOnly = isStaffAttentionFilterEnabled();
  const searchTerm = getStaffOrdersSearchTerm();

  return STAFF_STATE.orders.filter((order) => {
    const sourceMatches =
      sourceFilter === "all" || getStaffOrderSourceKey(order) === sourceFilter;
    const tableMatches =
      tableFilter === "all" || String(order.tableNumber || "").trim() === tableFilter;
    const paymentStatus = normalizeStatus(getStaffOrderPaymentStatus(order));
    const paymentMatches =
      paymentFilter === "all" ||
      (paymentFilter === "paid" && paymentStatus === "paid") ||
      (paymentFilter === "unpaid" && paymentStatus !== "paid");
    const billingStatus = normalizeStatus(getStaffOrderBillingStatus(order));
    const billingMatches =
      billingFilter === "all" ||
      (billingFilter === "billed" && billingStatus === "billed") ||
      (billingFilter === "unbilled" && billingStatus !== "billed");
    const orderStatusMatches =
      orderStatusFilter === "all" ||
      normalizeStatus(order.status) === orderStatusFilter;
    const needsAttention =
      normalizeStatus(order.status) === "new" ||
      paymentStatus !== "paid" ||
      billingStatus !== "billed";
    const attentionMatches = !attentionOnly || needsAttention;
    const searchMatches =
      !searchTerm || getStaffOrderSearchBlob(order).includes(searchTerm);

    return sourceMatches && tableMatches && paymentMatches && billingMatches && orderStatusMatches && attentionMatches && searchMatches;
  });
}

function renderCurrentStaffOrders() {
  renderStaffOrders(getStaffVisibleOrders());
}

function getStaffVisibleReservations() {
  return filterStaffRecordsByStatus(
    STAFF_STATE.reservations,
    getStaffSelectedRecordStatusFilter("#staffReservationsStatusInput")
  );
}

function getStaffVisibleInquiries() {
  return filterStaffRecordsByStatus(
    STAFF_STATE.inquiries,
    getStaffSelectedRecordStatusFilter("#staffInquiriesStatusInput")
  );
}

function getStaffVisibleContacts() {
  return filterStaffRecordsByStatus(
    STAFF_STATE.contactSubmissions,
    getStaffSelectedRecordStatusFilter("#staffContactsStatusInput")
  );
}

function getStaffVisibleSupportRequests() {
  return filterStaffRecordsByStatus(
    STAFF_STATE.supportRequests,
    getStaffSelectedRecordStatusFilter("#staffSupportStatusInput")
  );
}

function getStaffVisibleTestimonials() {
  const approvalFilter = getStaffSelectedApprovalFilter();

  if (approvalFilter === "approved") {
    return STAFF_STATE.testimonials.filter((testimonial) => testimonial.isApproved === true);
  }

  if (approvalFilter === "pending") {
    return STAFF_STATE.testimonials.filter((testimonial) => testimonial.isApproved !== true);
  }

  return STAFF_STATE.testimonials;
}

function getStaffSelectedRecordStatusLabel(selector) {
  const input = $(selector);
  return input?.selectedOptions?.[0]?.textContent?.trim() || "selected status";
}

function getStaffReservationsEmptyMessage() {
  if (!STAFF_STATE.reservations.length) {
    return "No reservations found for this hotel and selected range.";
  }

  return `No reservations match ${escapeHTML(getStaffSelectedRecordStatusLabel("#staffReservationsStatusInput"))}.`;
}

function getStaffInquiriesEmptyMessage() {
  if (!STAFF_STATE.inquiries.length) {
    return "No inquiries found for this hotel and selected range.";
  }

  return `No inquiries match ${escapeHTML(getStaffSelectedRecordStatusLabel("#staffInquiriesStatusInput"))}.`;
}

function getStaffContactsEmptyMessage() {
  if (!STAFF_STATE.contactSubmissions.length) {
    return "No contact messages found for this hotel and selected range.";
  }

  return `No contact messages match ${escapeHTML(getStaffSelectedRecordStatusLabel("#staffContactsStatusInput"))}.`;
}

function getStaffSupportEmptyMessage() {
  if (!STAFF_STATE.supportRequests.length) {
    return "No table support requests found for this hotel and selected range.";
  }

  return `No table support requests match ${escapeHTML(getStaffSelectedRecordStatusLabel("#staffSupportStatusInput"))}.`;
}

function getStaffTestimonialsEmptyMessage() {
  if (!STAFF_STATE.testimonials.length) {
    return "No testimonials found for this hotel and selected range.";
  }

  const input = $("#staffTestimonialsApprovalInput");
  const label = input?.selectedOptions?.[0]?.textContent?.trim() || "selected approval filter";
  return `No testimonials match ${escapeHTML(label)}.`;
}

function renderCurrentStaffReservations() {
  const reservations = getStaffVisibleReservations();
  renderStaffReservationsSummary(reservations);
  renderStaffRecordList(
    "#staffReservationsContent",
    reservations,
    buildStaffReservationCard,
    getStaffReservationsEmptyMessage()
  );
}

function renderCurrentStaffInquiries() {
  const inquiries = getStaffVisibleInquiries();
  renderStaffInquiriesSummary(inquiries);
  renderStaffRecordList(
    "#staffInquiriesContent",
    inquiries,
    buildStaffInquiryCard,
    getStaffInquiriesEmptyMessage()
  );
}

function renderCurrentStaffContacts() {
  const contactSubmissions = getStaffVisibleContacts();
  renderStaffContactsSummary(contactSubmissions);
  renderStaffRecordList(
    "#staffContactsContent",
    contactSubmissions,
    buildStaffContactCard,
    getStaffContactsEmptyMessage()
  );
}

function renderCurrentStaffSupportRequests() {
  const supportRequests = getStaffVisibleSupportRequests();
  renderStaffSupportSummary(supportRequests);
  renderStaffRecordList(
    "#staffSupportContent",
    supportRequests,
    buildStaffSupportRequestCard,
    getStaffSupportEmptyMessage()
  );
}

function renderCurrentStaffTestimonials() {
  const testimonials = getStaffVisibleTestimonials();
  renderStaffTestimonialsSummary(testimonials);
  renderStaffRecordList(
    "#staffTestimonialsContent",
    testimonials,
    buildStaffTestimonialCard,
    getStaffTestimonialsEmptyMessage()
  );
}

function resetStaffViewFilters() {
  const searchInput = $("#staffOrdersSearchInput");
  const sourceInput = $("#staffOrdersSourceInput");
  const tableInput = $("#staffOrdersTableInput");
  const paymentInput = $("#staffOrdersPaymentInput");
  const billingInput = $("#staffOrdersBillingInput");
  const statusInput = $("#staffOrdersStatusInput");

  if (searchInput) searchInput.value = "";
  if (sourceInput) sourceInput.value = "all";
  if (tableInput) tableInput.value = "all";
  if (paymentInput) paymentInput.value = "all";
  if (billingInput) billingInput.value = "all";
  if (statusInput) statusInput.value = "all";
  setStaffAttentionFilterEnabled(false);

  renderCurrentStaffOrders();
}

function renderStaffFilterStatus(visibleOrders = []) {
  const status = $("#staffOrdersFilterStatus");
  if (!status) return;

  if (!STAFF_STATE.orders.length) {
    status.hidden = true;
    status.textContent = "";
    return;
  }

  const visibleCount = visibleOrders.length;
  const totalCount = STAFF_STATE.orders.length;
  const visibleOrderWord = visibleCount === 1 ? "order" : "orders";
  const activeFilters = getStaffSelectedFilterLabels();
  const activeFilterText = activeFilters.length
    ? `Active filters: ${activeFilters.join(", ")}.`
    : "No extra filters active.";

  status.hidden = false;
  status.textContent = `Showing ${visibleCount} ${visibleOrderWord} of ${totalCount} total from ${getStaffSelectedRangeLabel()}. ${activeFilterText}`;
}

function clearStaffFilterStatus() {
  const status = $("#staffOrdersFilterStatus");
  if (!status) return;

  status.hidden = true;
  status.textContent = "";
}

function getStaffEmptyOrdersMessage() {
  if (!STAFF_STATE.orders.length) {
    return `No orders found for this hotel in ${escapeHTML(getStaffSelectedRangeLabel())}.`;
  }

  const activeFilters = getStaffSelectedFilterLabels();

  if (activeFilters.length) {
    return `No orders match these filters: ${escapeHTML(activeFilters.join(", "))}. Use Clear Filters to see all loaded orders.`;
  }

  return "No orders found for this hotel and selected range.";
}

function buildStaffBillTotalsRows(order = {}) {
  const totals = getStaffOrderTotals(order);
  const rows = [];
  const subtotal = getNumberValue(totals.subtotal);
  const gst = getNumberValue(totals.gst);
  const deliveryCharge = getNumberValue(totals.deliveryCharge);
  const normalTotal = getNumberValue(totals.normalTotal);
  const upiDiscountPercent = getNumberValue(totals.upiDiscountPercent);
  const gpayDiscount = getNumberValue(totals.gpayDiscount);
  const gpayFinalTotal = getNumberValue(totals.gpayFinalTotal);

  if (subtotal !== null) {
    rows.push(`<tr><th>Subtotal</th><td>${escapeHTML(formatMoney(subtotal))}</td></tr>`);
  }

  if (gst !== null) {
    rows.push(`<tr><th>GST</th><td>${escapeHTML(formatMoney(gst))}</td></tr>`);
  }

  if (deliveryCharge !== null && deliveryCharge > 0) {
    rows.push(
      `<tr><th>Delivery Charge</th><td>${escapeHTML(formatMoney(deliveryCharge))}</td></tr>`
    );
  }

  if (normalTotal !== null) {
    rows.push(`<tr><th>Original Total</th><td>${escapeHTML(formatMoney(normalTotal))}</td></tr>`);
  }

  if (gpayDiscount !== null) {
    const discountLabel = upiDiscountPercent !== null
      ? `Google Pay Discount (${formatDiscountPercent(upiDiscountPercent)})`
      : "Google Pay Discount";
    rows.push(`<tr><th>${escapeHTML(discountLabel)}</th><td>-${escapeHTML(formatMoney(gpayDiscount))}</td></tr>`);
  }

  if (gpayFinalTotal !== null) {
    rows.push(`<tr><th>Final Paid Amount</th><td>${escapeHTML(formatMoney(gpayFinalTotal))}</td></tr>`);
  } else {
    rows.push(`<tr><th>Total</th><td>${escapeHTML(formatMoney(getStaffOrderTotal(order)))}</td></tr>`);
  }

  return rows.join("");
}

function getStaffOrderChildAddOns(parentOrder = {}) {
  const parentOrderId = getStaffOrderId(parentOrder);
  if (!parentOrderId) return [];

  return STAFF_STATE.orders
    .filter((order) => {
      const addonMeta = getStaffOrderAddonMeta(order);
      return addonMeta.isAddon && addonMeta.parentOrderId === parentOrderId;
    })
    .sort((firstOrder, secondOrder) => {
      const firstMeta = getStaffOrderAddonMeta(firstOrder);
      const secondMeta = getStaffOrderAddonMeta(secondOrder);
      const firstSequence = firstMeta.addonSequence || Number.MAX_SAFE_INTEGER;
      const secondSequence = secondMeta.addonSequence || Number.MAX_SAFE_INTEGER;

      if (firstSequence !== secondSequence) {
        return firstSequence - secondSequence;
      }

      return new Date(firstOrder.createdAt || 0) - new Date(secondOrder.createdAt || 0);
    });
}

function getStaffOrderFamilyTotal(parentOrder = {}, childAddOns = []) {
  return [parentOrder, ...childAddOns].reduce(
    (sum, order) => sum + getStaffOrderTotal(order),
    0
  );
}

function getStaffOrderFamilyActionHint(order = {}, childAddOns = []) {
  const addonMeta = getStaffOrderAddonMeta(order);

  if (addonMeta.isAddon) {
    return addonMeta.parentOrderId
      ? `This add-on is billed separately from parent order #${addonMeta.parentOrderId}.`
      : "This add-on is billed separately from its parent order.";
  }

  if (!childAddOns.length) {
    return "";
  }

  return `${childAddOns.length} add-on ${childAddOns.length === 1 ? "order is" : "orders are"} linked to this table order. Billing and payment actions still update only the selected order.`;
}

function isStaffOrderBilled(order = {}) {
  return normalizeStatus(getStaffOrderBillingStatus(order)) === "billed";
}

function isStaffOrderPaid(order = {}) {
  return normalizeStatus(getStaffOrderPaymentStatus(order)) === "paid";
}

function isStaffOrderFamilyFullyBilled(parentOrder = {}, childAddOns = []) {
  return [parentOrder, ...childAddOns].every(isStaffOrderBilled);
}

function isStaffOrderFamilyFullyPaid(parentOrder = {}, childAddOns = []) {
  return [parentOrder, ...childAddOns].every(isStaffOrderPaid);
}

function buildStaffBillItemsRows(order = {}) {
  const items = getStaffOrderItems(order);

  if (!items.length) {
    return `<tr><td colspan="5">No items found for this order.</td></tr>`;
  }

  return items
    .map((item, index) => {
      const qty = getNumberValue(item?.qty) || 0;
      const price = getNumberValue(item?.price) || 0;
      const lineTotal = getStaffOrderLineTotal(item);

      return `
        <tr>
          <td>${escapeHTML(index + 1)}</td>
          <td>${escapeHTML(item?.name || item?.id || "Item")}</td>
          <td>${escapeHTML(qty)}</td>
          <td>${escapeHTML(formatMoney(price))}</td>
          <td>${escapeHTML(formatMoney(lineTotal))}</td>
        </tr>
      `;
    })
    .join("");
}

function buildStaffBillAddonSections(childAddOns = []) {
  if (!childAddOns.length) return "";

  return `
    <section class="addon-section">
      <h3>Additional table orders</h3>
      ${childAddOns
        .map((addOn) => {
          const addonMeta = getStaffOrderAddonMeta(addOn);

          return `
            <article class="addon-bill">
              <div class="addon-bill-head">
                <strong>${escapeHTML(addonMeta.label || `Add-on Order ${addOn.id || ""}`)}</strong>
                <span>${escapeHTML(formatOrderDate(addOn.createdAt))}</span>
              </div>
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
                <tbody>${buildStaffBillItemsRows(addOn)}</tbody>
              </table>
              <p class="addon-total">Add-on total: ${escapeHTML(formatMoney(getStaffOrderTotal(addOn)))}</p>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function getStaffBillTitle(order = {}) {
  const addonMeta = getStaffOrderAddonMeta(order);

  if (addonMeta.isAddon) {
    return addonMeta.sequenceLabel || `Add-on Order ${order.id || ""}`;
  }

  return order.billNumber || `Draft Bill - Order ${order.id || ""}`;
}

function buildStaffBillPrintDocument(order = {}) {
  const sourceMeta = getStaffOrderSourceMeta(order);
  const sourceDetail = sourceMeta.detail ? ` (${sourceMeta.detail})` : "";
  const addonMeta = getStaffOrderAddonMeta(order);
  const childAddOns = addonMeta.isAddon ? [] : getStaffOrderChildAddOns(order);
  const itemRows = buildStaffBillItemsRows(order);
  const addonSections = buildStaffBillAddonSections(childAddOns);
  const familyTotal = getStaffOrderFamilyTotal(order, childAddOns);
  const hasChildAddOns = childAddOns.length > 0;
  const createdByLabel = getStaffOrderCreatedByLabel(order);

  const billTitle = getStaffBillTitle(order);

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
    .addon-section { margin-top: 22px; padding-top: 16px; border-top: 1px solid #ddd; }
    .addon-section h3 { margin: 0 0 12px; font-size: 16px; }
    .addon-bill { margin-top: 14px; padding: 12px; border: 1px solid #ddd; border-radius: 10px; }
    .addon-bill-head { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
    .addon-total,
    .family-total { margin: 12px 0 0; text-align: right; font-weight: 700; }
    .family-total { padding-top: 12px; border-top: 2px solid #111; }
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
        <h1>${escapeHTML(order.hotelName || "Hotel")}</h1>
        <h2>${escapeHTML(billTitle)}</h2>
      </div>
      <div class="muted">
        <p>Order: ${escapeHTML(order.id || "")}</p>
        ${addonMeta.isAddon ? `<p>Add-on: ${escapeHTML(addonMeta.label)}</p>` : ""}
        ${addonMeta.parentOrderId ? `<p>Parent Order: ${escapeHTML(addonMeta.parentOrderId)}</p>` : ""}
        ${order.billNumber ? `<p>Bill Number: ${escapeHTML(order.billNumber)}</p>` : ""}
        <p>Created: ${escapeHTML(formatOrderDate(order.createdAt))}</p>
        <p>Billed: ${escapeHTML(order.billedAt || "Not billed yet")}</p>
      </div>
    </header>

    <section class="grid">
      <div class="row"><strong>Customer:</strong> ${escapeHTML(order.customerName || "Not provided")}</div>
      <div class="row"><strong>Phone:</strong> ${escapeHTML(order.customerPhone || "Not provided")}</div>
      <div class="row"><strong>Address:</strong> ${escapeHTML(order.customerAddress || "Not provided")}</div>
      <div class="row"><strong>Table:</strong> ${escapeHTML(getStaffOrderTableLabel(order))}</div>
      <div class="row"><strong>Order Type:</strong> ${escapeHTML(order.orderType || "dine-in")}</div>
      <div class="row"><strong>Payment:</strong> ${escapeHTML(order.paymentMethod || "")}</div>
      <div class="row"><strong>Payment Status:</strong> ${escapeHTML(getStaffOrderPaymentStatus(order))}</div>
      <div class="row"><strong>Billing Status:</strong> ${escapeHTML(getStaffOrderBillingStatus(order))}</div>
      <div class="row"><strong>Source:</strong> ${escapeHTML(sourceMeta.label + sourceDetail)}</div>
      ${createdByLabel ? `<div class="row"><strong>Taken By:</strong> ${escapeHTML(createdByLabel)}</div>` : ""}
      ${addonMeta.isAddon ? `<div class="row"><strong>Add-on:</strong> ${escapeHTML(addonMeta.label)}</div>` : ""}
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
      <tbody>${buildStaffBillTotalsRows(order)}</tbody>
    </table>
    ${addonSections}
    ${hasChildAddOns ? `<p class="family-total">Combined table total: ${escapeHTML(formatMoney(familyTotal))}</p>` : ""}

    <div class="note">
      <strong>Note:</strong> ${escapeHTML(order.note || "No note")}
    </div>
  </div>
</body>
</html>`;
}

function openStaffOrderBill(order = {}) {
  const printWindow = window.open("", "_blank", "width=780,height=900");

  if (!printWindow) {
    window.alert("Please allow popups to open the bill view.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildStaffBillPrintDocument(order));
  printWindow.document.close();
  printWindow.focus();
}

function getStaffOrderCreatedByLabel(order = {}) {
  const createdByStaff = order.createdByStaff && typeof order.createdByStaff === "object"
    ? order.createdByStaff
    : {};
  const displayName = String(createdByStaff.displayName || "").trim();
  const createdByStaffId = String(order.createdByStaffId || createdByStaff.id || "").trim();

  if (displayName) {
    return `Staff - ${displayName}`;
  }

  return createdByStaffId ? `Staff #${createdByStaffId}` : "";
}

function buildStaffOrderCard(order = {}) {
  const orderId = order.id || "";
  const paymentStatus = getStaffOrderPaymentStatus(order);
  const billingStatus = getStaffOrderBillingStatus(order);
  const tableLabel = getStaffOrderTableLabel(order);
  const sourceMeta = getStaffOrderSourceMeta(order);
  const sourceBadgeClass = sourceMeta.badgeClass ? ` ${sourceMeta.badgeClass}` : "";
  const sourceDetail = sourceMeta.detail ? ` (${sourceMeta.detail})` : "";
  const paymentBadgeClass = getStaffPaymentBadgeClass(paymentStatus);
  const billingBadgeClass = getStaffBillingBadgeClass(billingStatus);
  const orderStatus = order.status || "new";
  const orderStatusLabel = getStaffRecordStatusLabel(orderStatus, "order");
  const orderStatusBadgeClass = getStaffRecordStatusBadgeClass(orderStatus, "order");
  const normalizedOrderStatus = normalizeStatus(orderStatus);
  const routeTransferMeta = getStaffRouteTransferMeta(order);
  const addonMeta = getStaffOrderAddonMeta(order);
  const childAddOns = addonMeta.isAddon ? [] : getStaffOrderChildAddOns(order);
  const safeOrderId = escapeHTML(orderId);
  const addonCardClass = addonMeta.isAddon ? " is-addon" : "";
  const freshOrderCardClass = normalizedOrderStatus === "new" && !addonMeta.isAddon ? " is-new-order" : "";
  const titlePrefix = addonMeta.isAddon ? `${addonMeta.label} - ` : "";
  const customerIdentity = order.customerName || order.customerPhone || sourceMeta.label;
  const familyActionHint = getStaffOrderFamilyActionHint(order, childAddOns);
  const createdByLabel = getStaffOrderCreatedByLabel(order);
  const canManageBilling = isStaffManagerSession();
  const markBilledDisabled =
    !orderId || normalizeStatus(billingStatus) === "billed" ? "disabled" : "";
  const markPaidDisabled =
    !orderId || normalizeStatus(paymentStatus) === "paid" ? "disabled" : "";
  const markBilledLabel = markBilledDisabled
    ? "Billed"
    : childAddOns.length
      ? "Mark Parent Billed"
      : "Mark Billed";
  const markPaidLabel = markPaidDisabled
    ? "Paid"
    : childAddOns.length
      ? "Mark Parent Paid"
      : "Mark Paid";
  const markFamilyBilledDisabled =
    !orderId || !childAddOns.length || isStaffOrderFamilyFullyBilled(order, childAddOns) ? "disabled" : "";
  const markFamilyPaidDisabled =
    !orderId || !childAddOns.length || isStaffOrderFamilyFullyPaid(order, childAddOns) ? "disabled" : "";
  const markFamilyBilledLabel = markFamilyBilledDisabled ? "Full Table Billed" : "Mark Full Table Billed";
  const markFamilyPaidLabel = markFamilyPaidDisabled ? "Full Table Paid" : "Mark Full Table Paid";
  const note = order.note ? `<p class="staff-order-note"><strong>Note:</strong> ${escapeHTML(order.note)}</p>` : "";
  const billingActionButtons = canManageBilling
    ? `
        <button class="staff-btn secondary" type="button" data-staff-mark-billed data-order-id="${safeOrderId}" ${markBilledDisabled}>
          ${escapeHTML(markBilledLabel)}
        </button>
        <button class="staff-btn secondary" type="button" data-staff-mark-paid data-order-id="${safeOrderId}" ${markPaidDisabled}>
          ${escapeHTML(markPaidLabel)}
        </button>
        ${
          childAddOns.length
            ? `
              <button class="staff-btn secondary" type="button" data-staff-mark-family-billed data-order-id="${safeOrderId}" ${markFamilyBilledDisabled}>
                ${escapeHTML(markFamilyBilledLabel)}
              </button>
              <button class="staff-btn secondary" type="button" data-staff-mark-family-paid data-order-id="${safeOrderId}" ${markFamilyPaidDisabled}>
                ${escapeHTML(markFamilyPaidLabel)}
              </button>
            `
            : ""
        }
      `
    : "";

  return `
    <article class="staff-order-card${addonCardClass}${freshOrderCardClass}">
      <div class="staff-order-topline">
        <div class="staff-order-title-block">
          <h3 class="staff-order-title">${escapeHTML(titlePrefix)}Order #${safeOrderId}</h3>
          <p class="staff-order-subtitle">${escapeHTML(customerIdentity)}</p>
        </div>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(order.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        ${normalizedOrderStatus === "new" && !addonMeta.isAddon ? '<span class="staff-badge is-alert">Fresh order</span>' : ""}
        ${addonMeta.isAddon ? `<span class="staff-badge is-addon">Add-on${addonMeta.parentOrderId ? ` for #${escapeHTML(addonMeta.parentOrderId)}` : ""}</span>` : ""}
        <span class="staff-badge${sourceBadgeClass}">Source: ${escapeHTML(sourceMeta.label + sourceDetail)}</span>
        <span class="staff-badge is-important">Table: ${escapeHTML(tableLabel)}</span>
        <span class="staff-badge">Total: ${escapeHTML(formatMoney(getStaffOrderTotal(order)))}</span>
        <span class="staff-badge ${orderStatusBadgeClass}">Status: ${escapeHTML(orderStatusLabel)}</span>
        <span class="staff-badge ${paymentBadgeClass}">Payment: ${escapeHTML(paymentStatus)}</span>
        <span class="staff-badge ${billingBadgeClass}">Billing: ${escapeHTML(billingStatus)}</span>
        ${
          routeTransferMeta.visible
            ? `<span class="staff-badge ${routeTransferMeta.badgeClass}" title="${escapeHTML(routeTransferMeta.detail)}">${escapeHTML(routeTransferMeta.label)}</span>`
            : ""
        }
      </div>

      <div class="staff-order-meta">
        <span>Customer: ${escapeHTML(order.customerName || "Not provided")}</span>
        <span>Phone: ${escapeHTML(order.customerPhone || "Not provided")}</span>
        <span>Address: ${escapeHTML(order.customerAddress || "Not provided")}</span>
        <span>Method: ${escapeHTML(order.paymentMethod || "Not provided")}</span>
        ${createdByLabel ? `<span>Taken By: ${escapeHTML(createdByLabel)}</span>` : ""}
        ${addonMeta.sequenceLabel ? `<span>Sequence: ${escapeHTML(addonMeta.sequenceLabel)}</span>` : ""}
        ${addonMeta.parentOrderId ? `<span>Parent order: #${escapeHTML(addonMeta.parentOrderId)}</span>` : ""}
        ${order.billNumber ? `<span>Bill: ${escapeHTML(order.billNumber)}</span>` : ""}
        ${
          routeTransferMeta.visible && routeTransferMeta.detail
            ? `<span>${escapeHTML(routeTransferMeta.detail)}</span>`
            : ""
        }
      </div>

      ${buildStaffOrderItemsList(order)}
      ${note}
      ${familyActionHint ? `<p class="staff-order-family-hint">${escapeHTML(familyActionHint)}</p>` : ""}

      <div class="staff-order-actions">
        ${billingActionButtons}
        <button class="staff-btn secondary" type="button" data-staff-view-bill data-order-id="${safeOrderId}">
          View Bill
        </button>
      </div>
      ${buildStaffRecordStatusControls("order", order, STAFF_ORDER_STATUS_OPTIONS)}
    </article>
  `;
}

function buildStaffOrderSourceGroup(sourceKey, orders = []) {
  if (!orders.length) {
    return "";
  }

  const sourceGroupMeta = {
    "qr-table": {
      title: "QR Table Orders",
      accentClass: "is-qr-table",
      note: "Orders placed after scanning a table QR code, shown by latest table activity first."
    },
    "staff-table": {
      title: "Staff Table Orders",
      accentClass: "is-staff-table",
      note: "Orders entered by staff from the table order pad, shown by latest table activity first."
    },
    website: {
      title: "Website Orders",
      accentClass: "is-website",
      note: "Orders placed from the normal public website flow, shown by latest order activity first."
    }
  };
  const meta = sourceGroupMeta[sourceKey] || sourceGroupMeta.website;
  const summary = getStaffOrderGroupSummary(orders);
  const countLabel = `${summary.totalOrders} order${summary.totalOrders === 1 ? "" : "s"}`;

  return `
    <section class="staff-order-group ${escapeHTML(meta.accentClass)}" aria-label="${escapeHTML(meta.title)}">
      <div class="staff-order-group-header">
        <div>
          <h3 class="staff-order-group-title">${escapeHTML(meta.title)}</h3>
          <p class="staff-order-group-note">${escapeHTML(meta.note)}</p>
        </div>
        <div class="staff-order-group-metrics">
          <span class="staff-order-group-count">${escapeHTML(countLabel)}</span>
          <span class="staff-order-group-count">Total: ${escapeHTML(formatMoney(summary.totalEarnings))}</span>
          <span class="staff-order-group-count">${escapeHTML(`${summary.paidOrders} paid / ${summary.unpaidOrders} unpaid`)}</span>
          <span class="staff-order-group-count">${escapeHTML(`${summary.billedOrders} billed / ${summary.unbilledOrders} open`)}</span>
          <span class="staff-order-group-count">Latest: ${escapeHTML(summary.latestActivityLabel)}</span>
        </div>
      </div>
      <div class="staff-order-group-list">
        ${buildStaffOrderCardsMarkup(orders)}
      </div>
    </section>
  `;
}

function buildStaffOrdersListMarkup(orders = []) {
  if (getStaffSelectedSourceFilter() !== "all") {
    return buildStaffOrderCardsMarkup(orders);
  }

  const qrOrders = orders.filter((order) => getStaffOrderSourceKey(order) === "qr-table");
  const staffTableOrders = orders.filter((order) => getStaffOrderSourceKey(order) === "staff-table");
  const websiteOrders = orders.filter((order) => getStaffOrderSourceKey(order) === "website");

  return [
    buildStaffOrderSourceGroup("qr-table", qrOrders),
    buildStaffOrderSourceGroup("staff-table", staffTableOrders),
    buildStaffOrderSourceGroup("website", websiteOrders)
  ].join("");
}

function setStaffRecordsLoading(selector, message, isLoading = true) {
  const content = $(selector);
  if (!content) return;

  content.className = isLoading
    ? "staff-empty staff-section-stage is-loading"
    : "staff-empty staff-section-stage";
  content.textContent = message;
}

function buildStaffRecordStatusOptions(statuses = [], selectedStatus = "", type = "") {
  const normalizedSelectedStatus = normalizeStatus(selectedStatus);

  return statuses
    .map((status) => {
      const isSelected = normalizeStatus(status) === normalizedSelectedStatus ? "selected" : "";
      const label = getStaffRecordStatusLabel(status, type);

      return `<option value="${escapeHTML(status)}" ${isSelected}>${escapeHTML(label)}</option>`;
    })
    .join("");
}

function buildStaffRecordStatusControls(type = "", record = {}, statuses = []) {
  const recordId = record.id || "";
  const safeRecordId = escapeHTML(recordId);
  const selectedStatus = record.status || "new";
  const selectDisabled = recordId ? "" : "disabled";
  const buttonDisabled = "disabled";

  return `
    <div class="staff-order-actions staff-record-status-actions">
      <span class="staff-status-control-label">Update status</span>
      <select class="staff-select staff-status-select" data-staff-record-status-select data-record-type="${escapeHTML(type)}" data-record-id="${safeRecordId}" data-current-status="${escapeHTML(selectedStatus)}" ${selectDisabled}>
        ${buildStaffRecordStatusOptions(statuses, selectedStatus, type)}
      </select>
      <button class="staff-btn secondary" type="button" data-staff-update-record-status data-record-type="${escapeHTML(type)}" data-record-id="${safeRecordId}" ${buttonDisabled}>
        Update Status
      </button>
    </div>
  `;
}

function clearStaffRecordSummary(selector) {
  const summaryWrap = $(selector);
  if (!summaryWrap) return;

  summaryWrap.hidden = true;
  summaryWrap.innerHTML = "";
}

function buildStaffReservationCard(reservation = {}) {
  const status = reservation.status || "new";
  const statusBadgeClass = getStaffRecordStatusBadgeClass(status, "reservation");

  return `
    <article class="staff-order-card">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Reservation #${escapeHTML(reservation.id || "")}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(reservation.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        <span class="staff-badge is-important">Guests: ${escapeHTML(reservation.guests || "Not provided")}</span>
        <span class="staff-badge">Date: ${escapeHTML(reservation.date || "Not provided")}</span>
        <span class="staff-badge">Time: ${escapeHTML(reservation.time || "Not provided")}</span>
        <span class="staff-badge ${statusBadgeClass}">Status: ${escapeHTML(status)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Name: ${escapeHTML(reservation.name || "Not provided")}</span>
        <span>Phone: ${escapeHTML(reservation.phone || "Not provided")}</span>
        <span>Hotel: ${escapeHTML(reservation.hotelName || reservation.hotelSlug || "This hotel")}</span>
      </div>

      <p class="staff-order-note"><strong>Note:</strong> ${escapeHTML(reservation.note || "No note")}</p>
      ${buildStaffRecordStatusControls("reservation", reservation, STAFF_RESERVATION_STATUS_OPTIONS)}
    </article>
  `;
}

function buildStaffInquiryCard(inquiry = {}) {
  const status = inquiry.status || "new";
  const statusBadgeClass = getStaffRecordStatusBadgeClass(status, "inquiry");

  return `
    <article class="staff-order-card">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Inquiry #${escapeHTML(inquiry.id || "")}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(inquiry.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        <span class="staff-badge is-important">Event: ${escapeHTML(inquiry.eventType || "Not provided")}</span>
        <span class="staff-badge">Date: ${escapeHTML(inquiry.date || "Not provided")}</span>
        <span class="staff-badge">Guests: ${escapeHTML(inquiry.guests || "Not provided")}</span>
        <span class="staff-badge ${statusBadgeClass}">Status: ${escapeHTML(status)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Name: ${escapeHTML(inquiry.name || "Not provided")}</span>
        <span>Phone: ${escapeHTML(inquiry.phone || "Not provided")}</span>
        <span>Hotel: ${escapeHTML(inquiry.hotelName || inquiry.hotelSlug || "This hotel")}</span>
      </div>

      <p class="staff-order-note"><strong>Requirements:</strong> ${escapeHTML(inquiry.specialRequirements || "No requirements")}</p>
      ${buildStaffRecordStatusControls("inquiry", inquiry, STAFF_INQUIRY_STATUS_OPTIONS)}
    </article>
  `;
}

function buildStaffContactCard(contactSubmission = {}) {
  const status = contactSubmission.status || "new";
  const statusBadgeClass = getStaffRecordStatusBadgeClass(status, "contact");

  return `
    <article class="staff-order-card">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Contact #${escapeHTML(contactSubmission.id || "")}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(contactSubmission.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        <span class="staff-badge is-important">Website contact</span>
        <span class="staff-badge">Sheet: ${escapeHTML(contactSubmission.googleSheetStatus || "not tracked")}</span>
        <span class="staff-badge ${statusBadgeClass}">Status: ${escapeHTML(status)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Name: ${escapeHTML(contactSubmission.name || "Not provided")}</span>
        <span>Email: ${escapeHTML(contactSubmission.email || "Not provided")}</span>
        <span>Hotel: ${escapeHTML(contactSubmission.hotelName || contactSubmission.hotelSlug || "This hotel")}</span>
      </div>

      <p class="staff-order-note"><strong>Subject:</strong> ${escapeHTML(contactSubmission.subject || "No subject")}</p>
      <p class="staff-order-note"><strong>Message:</strong> ${escapeHTML(contactSubmission.message || "No message")}</p>
      ${buildStaffRecordStatusControls("contact", contactSubmission, STAFF_CONTACT_STATUS_OPTIONS)}
    </article>
  `;
}

function getStaffSupportRequestOrderContext(supportRequest = {}) {
  const orderId = String(supportRequest.orderId || "").trim();
  if (!orderId) return null;

  const order = findStaffOrder(orderId);
  if (!order) return null;

  const paymentStatus = normalizeStatus(order.paymentStatus);
  const billingStatus = normalizeStatus(order.billingStatus);
  const billNumber = String(order.billNumber || "").trim();
  const customerBillReady =
    Boolean(billNumber) ||
    ["billed", "closed"].includes(billingStatus) ||
    paymentStatus === "paid";

  return {
    order,
    paymentStatus,
    billingStatus,
    billNumber,
    customerBillReady
  };
}

function buildStaffSupportRequestCard(supportRequest = {}) {
  const status = supportRequest.status || "new";
  const statusBadgeClass = getStaffRecordStatusBadgeClass(status, "support");
  const requestType = normalizeStatus(supportRequest.requestType);
  const requestLabel = requestType === "bill" ? "Bill request" : "Staff help";
  const isNewSupportRequest = normalizeStatus(status) === "new";
  const orderContext = getStaffSupportRequestOrderContext(supportRequest);
  const paymentBadgeClass = orderContext?.paymentStatus === "paid" ? "is-success" : "is-warning";
  const billingBadgeClass =
    orderContext && ["billed", "closed"].includes(orderContext.billingStatus)
      ? "is-success"
      : "is-warning";
  const trackingNote = requestType !== "bill" || !orderContext
    ? ""
    : orderContext.customerBillReady
      ? `Customer bill is now visible on tracking${orderContext.billNumber ? ` as ${orderContext.billNumber}` : ""}.`
      : "Customer bill is not visible on tracking yet. Mark billed or paid when the bill is ready.";

  return `
    <article class="staff-order-card ${isNewSupportRequest ? "is-new-support" : ""}">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Support #${escapeHTML(supportRequest.id || "")}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(supportRequest.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        ${isNewSupportRequest ? '<span class="staff-badge is-alert">Needs attention</span>' : ""}
        <span class="staff-badge is-important">${escapeHTML(requestLabel)}</span>
        <span class="staff-badge">Order #${escapeHTML(supportRequest.orderId || "Not linked")}</span>
        <span class="staff-badge">Table: ${escapeHTML(supportRequest.tableNumber || "Not provided")}</span>
        ${orderContext ? `<span class="staff-badge ${paymentBadgeClass}">Payment: ${escapeHTML(getStaffRecordStatusLabel(orderContext.paymentStatus || "pending"))}</span>` : ""}
        ${orderContext ? `<span class="staff-badge ${billingBadgeClass}">Billing: ${escapeHTML(getStaffRecordStatusLabel(orderContext.billingStatus || "not_billed"))}</span>` : ""}
        ${orderContext?.billNumber ? `<span class="staff-badge is-success">Bill: ${escapeHTML(orderContext.billNumber)}</span>` : ""}
        <span class="staff-badge ${statusBadgeClass}">Status: ${escapeHTML(status)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Hotel: ${escapeHTML(supportRequest.hotelName || supportRequest.hotelSlug || "This hotel")}</span>
        <span>Order status: ${escapeHTML(supportRequest.orderStatus ? getStaffRecordStatusLabel(supportRequest.orderStatus, "order") : "Not tracked")}</span>
        <span>Source: ${escapeHTML(supportRequest.source || "order_tracking")}</span>
      </div>

      <p class="staff-order-note"><strong>Message:</strong> ${escapeHTML(supportRequest.message || "No message")}</p>
      ${trackingNote ? `<p class="staff-order-note"><strong>Tracking:</strong> ${escapeHTML(trackingNote)}</p>` : ""}
      ${buildStaffRecordStatusControls("support", supportRequest, STAFF_SUPPORT_STATUS_OPTIONS)}
    </article>
  `;
}

function buildStaffTestimonialCard(testimonial = {}) {
  const testimonialId = testimonial.id || "";
  const safeTestimonialId = escapeHTML(testimonialId);
  const isApproved = testimonial.isApproved === true;
  const isHidden = testimonial.isArchived === true || testimonial.isActive === false;
  const approvalBadgeClass = isApproved ? "is-success" : "is-warning";
  const visibilityLabel = isHidden ? "Hidden by active/archive state" : "Eligible for public display";
  const stars = Number.isFinite(Number(testimonial.stars)) ? Number(testimonial.stars) : 5;

  return `
    <article class="staff-order-card">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Testimonial #${safeTestimonialId}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(testimonial.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        <span class="staff-badge is-important">${escapeHTML(stars)} star${stars === 1 ? "" : "s"}</span>
        <span class="staff-badge ${approvalBadgeClass}">${isApproved ? "Approved" : "Pending approval"}</span>
        <span class="staff-badge ${isHidden ? "is-danger" : "is-success"}">${escapeHTML(visibilityLabel)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Name: ${escapeHTML(testimonial.name || "Guest")}</span>
        <span>Role: ${escapeHTML(testimonial.role || "Guest")}</span>
        <span>Hotel: ${escapeHTML(testimonial.hotelSlug || "This hotel")}</span>
      </div>

      <p class="staff-order-note"><strong>Review:</strong> ${escapeHTML(testimonial.text || "No review text")}</p>
      <div class="staff-order-actions">
        <button
          class="staff-btn secondary"
          type="button"
          data-staff-toggle-testimonial-approval
          data-testimonial-id="${safeTestimonialId}"
          data-approved="${escapeHTML(String(isApproved))}"
          ${testimonialId ? "" : "disabled"}>
          ${isApproved ? "Unapprove" : "Approve"}
        </button>
      </div>
    </article>
  `;
}

function renderStaffRecordList(selector, records = [], buildCard, emptyMessage = "No records found.") {
  const content = $(selector);
  if (!content) return;

  if (!records.length) {
    content.className = "staff-empty staff-section-stage";
    content.textContent = emptyMessage;
    return;
  }

  content.className = "staff-orders-list staff-section-stage";
  content.innerHTML = records.map(buildCard).join("");
}

function renderStaffOrders(orders = []) {
  const content = $("#staffOrdersContent");
  if (!content) return;

  renderStaffOrdersQuickReports(STAFF_STATE.dashboardReports);
  renderStaffOrdersAttentionSummary(orders);
  renderStaffFilterStatus(orders);

  if (!orders.length) {
    content.className = "staff-empty staff-section-stage";
    content.innerHTML = getStaffEmptyOrdersMessage();
    return;
  }

  content.className = "staff-orders-list staff-section-stage";
  content.innerHTML = buildStaffOrdersListMarkup(orders);
}

function normalizeStaffTableOrderMenuItem(item = {}) {
  const id = String(item.id || item.itemId || item.item_id || "").trim();
  const name = String(item.name || "").trim();

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    desc: String(item.desc || item.description || "").trim(),
    price: Number(item.price || 0) || 0,
    category: String(item.category || "others").trim() || "others",
    badge: String(item.badge || "").trim(),
    tag: String(item.tag || "").trim()
  };
}

function getStaffTableOrderCategoryLabel(category = "") {
  const normalized = String(category || "")
    .trim()
    .replace(/[-_]+/g, " ");

  if (!normalized) {
    return "Others";
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStaffTableOrderAvailableCategories() {
  return Array.from(
    new Set(
      STAFF_STATE.tableOrderMenu
        .map((item) => String(item.category || "others").trim() || "others")
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function getFilteredStaffTableOrderMenuItems() {
  const categoryFilter = String(STAFF_STATE.tableOrderMenuCategory || "all").trim() || "all";
  const searchQuery = String(STAFF_STATE.tableOrderMenuQuery || "")
    .trim()
    .toLowerCase();

  return STAFF_STATE.tableOrderMenu.filter((item) => {
    const itemCategory = String(item.category || "others").trim() || "others";
    const categoryMatches = categoryFilter === "all" || itemCategory === categoryFilter;
    const searchBlob = [item.name, item.desc, item.category, item.badge, item.tag]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const searchMatches = !searchQuery || searchBlob.includes(searchQuery);

    return categoryMatches && searchMatches;
  });
}

function getStaffTableOrderMenuItem(itemId = "") {
  const normalizedItemId = String(itemId || "").trim();
  return STAFF_STATE.tableOrderMenu.find((item) => item.id === normalizedItemId) || null;
}

function getStaffTableOrderItemQty(itemId = "") {
  return Number(STAFF_STATE.tableOrderCart[String(itemId || "").trim()] || 0) || 0;
}

function setStaffTableOrderItemQty(itemId = "", qty = 0) {
  const normalizedItemId = String(itemId || "").trim();
  const nextQty = Math.max(0, Math.min(100, Number(qty) || 0));

  if (!normalizedItemId) return;

  if (nextQty > 0) {
    STAFF_STATE.tableOrderCart = {
      ...STAFF_STATE.tableOrderCart,
      [normalizedItemId]: nextQty
    };
  } else {
    const nextCart = { ...STAFF_STATE.tableOrderCart };
    delete nextCart[normalizedItemId];
    STAFF_STATE.tableOrderCart = nextCart;
  }

  renderStaffTableOrderMenu();
  renderStaffTableOrderCart();
}

function getStaffTableOrderCartEntries() {
  return Object.entries(STAFF_STATE.tableOrderCart)
    .map(([itemId, qty]) => {
      const item = getStaffTableOrderMenuItem(itemId);
      const quantity = Number(qty || 0) || 0;

      if (!item || quantity <= 0) {
        return null;
      }

      return {
        ...item,
        qty: quantity,
        lineTotal: item.price * quantity
      };
    })
    .filter(Boolean);
}

function getStaffTableOrderCartTotal(entries = getStaffTableOrderCartEntries()) {
  return entries.reduce((sum, item) => sum + item.lineTotal, 0);
}

function setStaffTableOrderStatus(message = "", tone = "muted") {
  const status = $("#staffTableOrderStatus");
  if (!status) return;

  status.hidden = !message;
  status.textContent = message;
  status.dataset.statusTone = tone;
}

function setStaffTableOrderMenuLoading(message = "Loading menu...") {
  const content = $("#staffTableOrderMenuContent");
  if (!content) return;

  content.className = "staff-empty is-loading";
  content.textContent = message;
}

function renderStaffTableOrderMenuFilters() {
  const categoryFilter = $("#staffTableOrderCategoryFilter");
  const searchInput = $("#staffTableOrderSearchInput");
  const summary = $("#staffTableOrderFilterSummary");

  if (searchInput && searchInput.value !== STAFF_STATE.tableOrderMenuQuery) {
    searchInput.value = STAFF_STATE.tableOrderMenuQuery;
  }

  if (categoryFilter) {
    const categories = getStaffTableOrderAvailableCategories();
    categoryFilter.innerHTML = [
      '<option value="all">All categories</option>',
      ...categories.map(
        (category) =>
          `<option value="${escapeHTML(category)}">${escapeHTML(getStaffTableOrderCategoryLabel(category))}</option>`
      )
    ].join("");

    if (
      STAFF_STATE.tableOrderMenuCategory !== "all" &&
      !categories.includes(STAFF_STATE.tableOrderMenuCategory)
    ) {
      STAFF_STATE.tableOrderMenuCategory = "all";
    }

    categoryFilter.value = STAFF_STATE.tableOrderMenuCategory;
  }

  if (summary) {
    const filteredCount = getFilteredStaffTableOrderMenuItems().length;
    const totalCount = STAFF_STATE.tableOrderMenu.length;
    const activeCategory =
      STAFF_STATE.tableOrderMenuCategory === "all"
        ? "All categories"
        : getStaffTableOrderCategoryLabel(STAFF_STATE.tableOrderMenuCategory);
    const trimmedQuery = String(STAFF_STATE.tableOrderMenuQuery || "").trim();
    const bits = [`${filteredCount} of ${totalCount} items`, activeCategory];

    if (trimmedQuery) {
      bits.push(`Search: "${trimmedQuery}"`);
    }

    summary.textContent = bits.join(" | ");
  }
}

function buildStaffTableOrderMenuItemMarkup(item = {}) {
  const qty = getStaffTableOrderItemQty(item.id);
  const metaParts = [item.category, item.badge, item.tag].filter(Boolean);

  return `
    <article class="staff-table-order-item">
      <div class="staff-table-order-item-head">
        <div>
          <h4 class="staff-table-order-item-title">${escapeHTML(item.name)}</h4>
          ${metaParts.length ? `<p class="staff-table-order-item-meta">${escapeHTML(metaParts.join(" / "))}</p>` : ""}
        </div>
        <span class="staff-table-order-item-price">${escapeHTML(formatMoney(item.price))}</span>
      </div>
      ${item.desc ? `<p class="staff-table-order-item-meta">${escapeHTML(item.desc)}</p>` : ""}
      <div class="staff-table-order-qty" aria-label="Quantity for ${escapeHTML(item.name)}">
        <button class="staff-btn secondary" type="button" data-staff-table-order-minus="${escapeHTML(item.id)}" ${qty <= 0 ? "disabled" : ""}>-</button>
        <span class="staff-table-order-qty-value">${escapeHTML(qty)}</span>
        <button class="staff-btn secondary" type="button" data-staff-table-order-plus="${escapeHTML(item.id)}">+</button>
      </div>
    </article>
  `;
}

function renderStaffTableOrderMenu() {
  const content = $("#staffTableOrderMenuContent");
  if (!content) return;

  if (!STAFF_STATE.tableOrderMenuLoaded) {
    content.className = "staff-empty";
    content.textContent = "Open this view to load the menu.";
    return;
  }

  if (!STAFF_STATE.tableOrderMenu.length) {
    content.className = "staff-empty";
    content.textContent = "No available menu items found for this hotel.";
    renderStaffTableOrderMenuFilters();
    return;
  }

  const filteredItems = getFilteredStaffTableOrderMenuItems();
  renderStaffTableOrderMenuFilters();

  if (!filteredItems.length) {
    const detailBits = [];

    if (STAFF_STATE.tableOrderMenuCategory !== "all") {
      detailBits.push(getStaffTableOrderCategoryLabel(STAFF_STATE.tableOrderMenuCategory));
    }

    if (String(STAFF_STATE.tableOrderMenuQuery || "").trim()) {
      detailBits.push(`search "${String(STAFF_STATE.tableOrderMenuQuery || "").trim()}"`);
    }

    content.className = "staff-empty";
    content.textContent = detailBits.length
      ? `No menu items match ${detailBits.join(" and ")}.`
      : "No menu items match the current filters.";
    return;
  }

  content.className = "staff-table-order-menu-grid";
  content.innerHTML = filteredItems
    .map((item) => buildStaffTableOrderMenuItemMarkup(item))
    .join("");
}

function renderStaffTableOrderCart() {
  const summary = $("#staffTableOrderCartSummary");
  const submitButton = $("#staffTableOrderSubmitBtn");
  if (!summary) return;

  const entries = getStaffTableOrderCartEntries();

  if (!entries.length) {
    summary.innerHTML = `<p class="staff-empty">No items selected.</p>`;
    if (submitButton) submitButton.disabled = true;
    return;
  }

  summary.innerHTML = `
    <ul class="staff-table-order-cart-list">
      ${entries.map((item) => `
        <li class="staff-table-order-cart-row">
          <span>${escapeHTML(item.name)} x${escapeHTML(item.qty)}</span>
          <strong>${escapeHTML(formatMoney(item.lineTotal))}</strong>
        </li>
      `).join("")}
    </ul>
    <div class="staff-table-order-cart-total">
      <span>Subtotal</span>
      <strong>${escapeHTML(formatMoney(getStaffTableOrderCartTotal(entries)))}</strong>
    </div>
  `;

  if (submitButton) submitButton.disabled = false;
}

async function loadStaffTableOrderMenu({ silent = false } = {}) {
  try {
    if (!silent) {
      setStaffTableOrderMenuLoading();
      setStaffSectionLastUpdated("#staffTableOrderLastUpdated", "Refreshing menu...");
    }

    const result = await staffFetchJson(`${STAFF_API_BASE}/menu`);
    STAFF_STATE.tableOrderMenu = Array.isArray(result.items)
      ? result.items.map(normalizeStaffTableOrderMenuItem).filter(Boolean)
      : [];
    STAFF_STATE.tableOrderMenuCategory = "all";
    STAFF_STATE.tableOrderMenuLoaded = true;
    renderStaffTableOrderMenu();
    renderStaffTableOrderCart();
    setStaffSectionLastUpdated("#staffTableOrderLastUpdated", getStaffLastUpdatedLabel());
  } catch (error) {
    console.error("Staff table order menu load failed:", error);
    STAFF_STATE.tableOrderMenuLoaded = true;
    const content = $("#staffTableOrderMenuContent");
    if (content) {
      content.className = "staff-empty";
      content.textContent = error.message || "Failed to load menu.";
    }
    setStaffSectionLastUpdated("#staffTableOrderLastUpdated", "Menu load failed");
  }
}

function clearStaffTableOrderForm({ keepStatus = false } = {}) {
  $("#staffTableOrderForm")?.reset();
  STAFF_STATE.tableOrderCart = {};
  renderStaffTableOrderMenu();
  renderStaffTableOrderCart();

  if (!keepStatus) {
    setStaffTableOrderStatus("");
  }
}

async function handleStaffTableOrderSubmit(event) {
  event.preventDefault();

  const form = $("#staffTableOrderForm");
  const submitButton = $("#staffTableOrderSubmitBtn");
  const tableNumber = String($("#staffTableOrderTableInput")?.value || "").trim();
  const customerName = String($("#staffTableOrderCustomerNameInput")?.value || "").trim();
  const customerPhone = String($("#staffTableOrderCustomerPhoneInput")?.value || "").trim();
  const note = String($("#staffTableOrderNoteInput")?.value || "").trim();
  const entries = getStaffTableOrderCartEntries();

  if (!form || !tableNumber) {
    setStaffTableOrderStatus("Table number is required.", "warning");
    return;
  }

  if (!entries.length) {
    setStaffTableOrderStatus("Add at least one menu item.", "warning");
    return;
  }

  setStaffActionBusyState(submitButton, true);
  setStaffTableOrderStatus("Placing order...", "muted");

  try {
    await staffFetchJson(`${STAFF_API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tableNumber,
        customerName,
        customerPhone,
        note,
        items: entries.map((item) => ({
          id: item.id,
          qty: item.qty
        }))
      })
    });

    clearStaffTableOrderForm({ keepStatus: true });
    setStaffTableOrderStatus("Order saved.", "success");
    await loadStaffOrders();
    openStaffView("orders");
  } catch (error) {
    console.error("Staff table order submit failed:", error);
    setStaffTableOrderStatus(error.message || "Failed to place order.", "warning");
  } finally {
    setStaffActionBusyState(submitButton, false);
    if (submitButton) {
      submitButton.disabled = !getStaffTableOrderCartEntries().length;
    }
  }
}

function setStaffOrdersLoading(message = "Loading staff orders...") {
  const content = $("#staffOrdersContent");
  setStaffDashboardSummaryEmpty("Loading dashboard summary...", true);
  renderStaffOrdersQuickReports(null);
  renderStaffOrdersAttentionSummary([]);
  setStaffSectionLastUpdated("#staffDashboardLastUpdated", "Refreshing dashboard...");
  clearStaffFilterStatus();
  if (!content) return;

  content.className = "staff-empty staff-section-stage is-loading";
  content.textContent = message;
}

function showStaffLoginView(message = "") {
  const loginWrap = $("#staffLoginWrap");
  const dashboardWrap = $("#staffDashboardWrap");

  stopStaffAutoRefresh();
  resetStaffDashboardState();
  if (loginWrap) loginWrap.style.display = "grid";
  if (dashboardWrap) dashboardWrap.style.display = "none";
  syncStaffSidebarForViewport();

  if (message) {
    setStaffLoginStatus(message);
  }
}

function showStaffDashboardView(staffUser = {}) {
  const loginWrap = $("#staffLoginWrap");
  const dashboardWrap = $("#staffDashboardWrap");
  const hotelLabel = $("#staffSessionHotel");
  STAFF_STATE.staffUser = staffUser;
  applyStaffRoleWorkspaceAccess(staffUser);

  if (loginWrap) loginWrap.style.display = "none";
  if (dashboardWrap) dashboardWrap.style.display = "grid";
  if (hotelLabel) hotelLabel.textContent = staffUser.hotelSlug || "this hotel";
  updateStaffWorkspaceHotelBadge(staffUser);
  showStaffView(STAFF_STATE.activeView || getDefaultStaffView(staffUser));
  syncStaffSidebarForViewport();
  updateStaffSoundAlertToggle();
  updateStaffBrowserAlertToggle();
}

function showStaffView(view = "dashboard") {
  const nextView = canStaffAccessView(view) ? view : getDefaultStaffView();
  STAFF_STATE.activeView = nextView;

  document.querySelectorAll("[data-staff-view]").forEach((button) => {
    if (button.hidden) return;

    const isActive = button.dataset.staffView === nextView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll("[data-staff-view-panel]").forEach((panel) => {
    const panelView = panel.dataset.staffViewPanel || "";
    panel.hidden = !canStaffAccessView(panelView) || panelView !== nextView;
  });

  updateStaffWorkspaceContext(nextView);
}

function clearStaffFreshDataIndicator(view = "") {
  if (!view) return;

  document
    .querySelector(`[data-staff-view="${view}"]`)
    ?.classList.remove("has-fresh-data");
}

function markStaffFreshData(view = "") {
  if (!view || STAFF_STATE.activeView === view) return;

  document
    .querySelector(`[data-staff-view="${view}"]`)
    ?.classList.add("has-fresh-data");
}

function openStaffView(view = "dashboard") {
  const nextView = canStaffAccessView(view) ? view : getDefaultStaffView();
  showStaffView(nextView);
  clearStaffFreshDataIndicator(nextView);
  if (isStaffCompactViewport()) {
    setStaffSidebarExpanded(false);
  }

  if (nextView === "reservations" && !STAFF_STATE.reservationsLoaded) {
    void loadStaffReservations();
  }

  if (nextView === "support" && !STAFF_STATE.supportRequestsLoaded) {
    void loadStaffSupportRequests();
  }

  if (nextView === "table-order" && !STAFF_STATE.tableOrderMenuLoaded) {
    void loadStaffTableOrderMenu();
  }

  if (nextView === "inquiries" && !STAFF_STATE.inquiriesLoaded) {
    void loadStaffInquiries();
  }

  if (nextView === "contacts" && !STAFF_STATE.contactSubmissionsLoaded) {
    void loadStaffContacts();
  }

  if (nextView === "testimonials" && !STAFF_STATE.testimonialsLoaded) {
    void loadStaffTestimonials();
  }
}

function setStaffTabCount(selector, count) {
  const countEl = $(selector);
  if (!countEl) return;

  countEl.textContent = String(count || 0);
}

function updateStaffViewTabCounts() {
  setStaffTabCount("#staffOrdersTabCount", STAFF_STATE.orders.length);
  setStaffTabCount("#staffSupportTabCount", getStaffOpenSupportRequestCount());
  setStaffTabCount("#staffReservationsTabCount", STAFF_STATE.reservations.length);
  setStaffTabCount("#staffInquiriesTabCount", STAFF_STATE.inquiries.length);
  setStaffTabCount("#staffContactsTabCount", STAFF_STATE.contactSubmissions.length);
  setStaffTabCount("#staffTestimonialsTabCount", STAFF_STATE.testimonials.length);
}

function getStaffRecordId(record = {}) {
  return String(record?.id || record?.orderId || "").trim();
}

function hasNewStaffRecords(previousRecords = [], nextRecords = []) {
  return getNewStaffRecords(previousRecords, nextRecords).length > 0;
}

function setStaffFormDisabled(form, isDisabled) {
  if (!form) return;

  form.querySelectorAll("input, button, select").forEach((field) => {
    field.disabled = !!isDisabled;
  });
}

async function staffFetchJson(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  const token = getStaffToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.responseData = data;
    throw error;
  }

  return data;
}

function isStaffActionInProgress() {
  return Boolean(document.querySelector('[data-staff-action-busy="true"]'));
}

function setStaffActionBusyState(button, isBusy) {
  if (!button) return;

  if (isBusy) {
    button.disabled = true;
    button.dataset.staffActionBusy = "true";
    return;
  }

  delete button.dataset.staffActionBusy;
}

async function refreshStaffOperationalData({ silent = false } = {}) {
  if (
    staffAutoRefreshInFlight ||
    !getStaffToken() ||
    isStaffActionInProgress()
  ) {
    return;
  }

  staffAutoRefreshInFlight = true;
  if (silent) {
    staffAutoRefreshSoundPlayed = false;
    resetStaffAutoRefreshFreshSummary();
  }

  try {
    if (silent) {
      setStaffLiveRefreshStatus("Refreshing...", "muted");
    }

    const refreshTasks = [
      loadStaffOrders({ silent }),
      loadStaffSupportRequests({ silent })
    ];

    if (isStaffManagerSession()) {
      refreshTasks.push(
        loadStaffReservations({ silent }),
        loadStaffInquiries({ silent }),
        loadStaffContacts({ silent }),
        loadStaffTestimonials({ silent })
      );
    }

    await Promise.all(refreshTasks);

    if (silent) {
      const freshNoticeMessage = getStaffAutoRefreshFreshNoticeMessage();
      if (freshNoticeMessage) {
        flashStaffLiveRefreshNotice(freshNoticeMessage, "warning");
      }
    }

    if (silent && !staffLiveRefreshOverrideActive) {
      setStaffLiveRefreshStatus(`Updated ${formatStaffRefreshTime()}`, "live");
    }
  } catch (error) {
    console.warn("Staff auto-refresh failed:", error);

    if (silent) {
      setStaffLiveRefreshStatus("Refresh paused", "warning");
    }
  } finally {
    staffAutoRefreshInFlight = false;
    if (silent) {
      resetStaffAutoRefreshFreshSummary();
    }
  }
}

function stopStaffAutoRefresh() {
  if (staffLiveRefreshNoticeTimer) {
    window.clearTimeout(staffLiveRefreshNoticeTimer);
    staffLiveRefreshNoticeTimer = null;
  }

  staffLiveRefreshOverrideActive = false;
  if (!staffAutoRefreshTimer) {
    setStaffLiveRefreshStatus("Live updates off", "muted");
    return;
  }

  window.clearInterval(staffAutoRefreshTimer);
  staffAutoRefreshTimer = null;
  staffAutoRefreshInFlight = false;
  setStaffLiveRefreshStatus("Live updates off", "muted");
}

function startStaffAutoRefresh() {
  stopStaffAutoRefresh();
  setStaffLiveRefreshStatus("Live updates on", "live");
  staffAutoRefreshTimer = window.setInterval(() => {
    void refreshStaffOperationalData({ silent: true });
  }, STAFF_AUTO_REFRESH_INTERVAL_MS);
}

async function loadStaffOrders({ silent = false } = {}) {
  const range = $("#staffOrdersRangeInput")?.value || "recent";
  const previousOrders = STAFF_STATE.orders;

  try {
    if (!silent) {
      setStaffOrdersLoading();
      setStaffSectionLastUpdated("#staffOrdersLastUpdated", "Refreshing...");
      clearStaffFreshDataIndicator("orders");
    }

    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/orders?${params.toString()}`);
    const nextOrders = Array.isArray(result.orders) ? result.orders : [];
    const freshOrders = silent ? getNewStaffRecords(previousOrders, nextOrders) : [];
    handleStaffFreshRecords("orders", freshOrders);

    STAFF_STATE.orders = nextOrders;
    updateStaffOrderTableFilterOptions(STAFF_STATE.orders);
    updateStaffViewTabCounts();
    renderStaffOrdersSummary(STAFF_STATE.orders);
    renderCurrentStaffOrders();

    if (isStaffManagerSession()) {
      await loadStaffDashboardReports({ silent: true });
      setStaffSectionLastUpdated("#staffDashboardLastUpdated", getStaffLastUpdatedLabel());
    } else {
      STAFF_STATE.dashboardReports = null;
      renderStaffOrdersQuickReports(null);
      setStaffSectionLastUpdated("#staffDashboardLastUpdated", "Manager access required");
    }

    setStaffSectionLastUpdated("#staffOrdersLastUpdated", getStaffLastUpdatedLabel());
  } catch (error) {
    console.error("Staff orders load failed:", error);

    if (!silent) {
      setStaffOrdersLoading(error.message || "Failed to load staff orders.");
    } else {
      throw error;
    }
  }
}

async function loadStaffDashboardReports({ silent = false } = {}) {
  if (!isStaffManagerSession()) {
    STAFF_STATE.dashboardReports = null;
    STAFF_STATE.dashboardReportsFreshnessLabel = "";
    STAFF_STATE.itemSalesReports = null;
    renderStaffDashboardReports(null);
    renderStaffDashboardItemSalesReports(null);
    renderStaffOrdersQuickReports(null);
    return;
  }

  try {
    const result = await staffFetchJson(`${STAFF_API_BASE}/orders-reports`);
    STAFF_STATE.dashboardReports =
      result.reports && typeof result.reports === "object" ? result.reports : null;
    try {
      const itemSalesResult = await staffFetchJson(`${STAFF_API_BASE}/orders-item-sales-reports`);
      STAFF_STATE.itemSalesReports =
        itemSalesResult.itemSalesReports && typeof itemSalesResult.itemSalesReports === "object"
          ? itemSalesResult.itemSalesReports
          : null;
      } catch (itemSalesError) {
        console.warn("Staff item sales reports load failed:", itemSalesError);
        STAFF_STATE.itemSalesReports = null;
      }
      STAFF_STATE.dashboardReportsFreshnessLabel = getStaffLastUpdatedLabel();
      renderStaffDashboardReports(STAFF_STATE.dashboardReports);
      renderStaffOrdersQuickReports(STAFF_STATE.dashboardReports);
    } catch (error) {
      console.warn("Staff dashboard reports load failed:", error);
      STAFF_STATE.dashboardReports = null;
      STAFF_STATE.dashboardReportsFreshnessLabel = "";
      STAFF_STATE.itemSalesReports = null;
      renderStaffDashboardReports(null);
      renderStaffDashboardItemSalesReports(null);
    renderStaffOrdersQuickReports(null);

    if (!silent) {
      setStaffLiveRefreshStatus("Reports unavailable", "warning");
    }
  }
}

async function loadStaffReservations({ silent = false } = {}) {
  const range = $("#staffReservationsRangeInput")?.value || "recent";
  const previousReservations = STAFF_STATE.reservations;

  try {
    if (!silent) {
      clearStaffFreshDataIndicator("reservations");
      clearStaffRecordSummary("#staffReservationsSummary");
      setStaffRecordsLoading("#staffReservationsContent", "Loading reservations...");
    }
    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/reservations?${params.toString()}`);
    const nextReservations = Array.isArray(result.reservations)
      ? result.reservations
      : [];
    handleStaffFreshRecords(
      "reservations",
      silent ? getNewStaffRecords(previousReservations, nextReservations) : []
    );
    STAFF_STATE.reservations = nextReservations;
    STAFF_STATE.reservationsLoaded = true;
    updateStaffViewTabCounts();
    renderCurrentStaffReservations();
  } catch (error) {
    console.error("Staff reservations load failed:", error);
    if (!silent) {
      clearStaffRecordSummary("#staffReservationsSummary");
      setStaffRecordsLoading(
        "#staffReservationsContent",
        error.message || "Failed to load staff reservations.",
        false
      );
    } else {
      throw error;
    }
  }
}

async function loadStaffInquiries({ silent = false } = {}) {
  const range = $("#staffInquiriesRangeInput")?.value || "recent";
  const previousInquiries = STAFF_STATE.inquiries;

  try {
    if (!silent) {
      clearStaffFreshDataIndicator("inquiries");
      clearStaffRecordSummary("#staffInquiriesSummary");
      setStaffRecordsLoading("#staffInquiriesContent", "Loading inquiries...");
    }
    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/inquiries?${params.toString()}`);
    const nextInquiries = Array.isArray(result.inquiries) ? result.inquiries : [];
    handleStaffFreshRecords(
      "inquiries",
      silent ? getNewStaffRecords(previousInquiries, nextInquiries) : []
    );
    STAFF_STATE.inquiries = nextInquiries;
    STAFF_STATE.inquiriesLoaded = true;
    updateStaffViewTabCounts();
    renderCurrentStaffInquiries();
  } catch (error) {
    console.error("Staff inquiries load failed:", error);
    if (!silent) {
      clearStaffRecordSummary("#staffInquiriesSummary");
      setStaffRecordsLoading(
        "#staffInquiriesContent",
        error.message || "Failed to load staff inquiries.",
        false
      );
    } else {
      throw error;
    }
  }
}

async function loadStaffContacts({ silent = false } = {}) {
  const range = $("#staffContactsRangeInput")?.value || "recent";
  const previousContacts = STAFF_STATE.contactSubmissions;

  try {
    if (!silent) {
      clearStaffFreshDataIndicator("contacts");
      clearStaffRecordSummary("#staffContactsSummary");
      setStaffRecordsLoading("#staffContactsContent", "Loading contact messages...");
    }
    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/contact-submissions?${params.toString()}`);
    const nextContacts = Array.isArray(result.contactSubmissions)
      ? result.contactSubmissions
      : [];
    handleStaffFreshRecords(
      "contacts",
      silent ? getNewStaffRecords(previousContacts, nextContacts) : []
    );
    STAFF_STATE.contactSubmissions = nextContacts;
    STAFF_STATE.contactSubmissionsLoaded = true;
    updateStaffViewTabCounts();
    renderCurrentStaffContacts();
  } catch (error) {
    console.error("Staff contact submissions load failed:", error);
    if (!silent) {
      clearStaffRecordSummary("#staffContactsSummary");
      setStaffRecordsLoading(
        "#staffContactsContent",
        error.message || "Failed to load staff contact messages.",
        false
      );
    } else {
      throw error;
    }
  }
}

async function loadStaffSupportRequests({ silent = false } = {}) {
  const range = $("#staffSupportRangeInput")?.value || "recent";
  const previousSupportRequests = STAFF_STATE.supportRequests;

  try {
    if (!silent) {
      clearStaffRecordSummary("#staffSupportSummary");
      setStaffRecordsLoading("#staffSupportContent", "Loading table support requests...");
      setStaffSectionLastUpdated("#staffSupportLastUpdated", "Refreshing...");
      clearStaffFreshDataIndicator("support");
    }

    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/support-requests?${params.toString()}`);
    const nextSupportRequests = Array.isArray(result.supportRequests)
      ? result.supportRequests
      : [];

    handleStaffFreshRecords(
      "support",
      silent ? getNewStaffRecords(previousSupportRequests, nextSupportRequests) : []
    );

    STAFF_STATE.supportRequests = nextSupportRequests;
    STAFF_STATE.supportRequestsLoaded = true;
    updateStaffViewTabCounts();
    renderStaffDashboardSupportSummary(STAFF_STATE.supportRequests);
    renderCurrentStaffSupportRequests();
    setStaffSectionLastUpdated("#staffDashboardLastUpdated", getStaffLastUpdatedLabel());
    setStaffSectionLastUpdated("#staffSupportLastUpdated", getStaffLastUpdatedLabel());
  } catch (error) {
    console.error("Staff support requests load failed:", error);

    if (!silent) {
      renderStaffDashboardSupportSummary([]);
      clearStaffRecordSummary("#staffSupportSummary");
      setStaffRecordsLoading(
        "#staffSupportContent",
        error.message || "Failed to load staff support requests.",
        false
      );
    } else {
      throw error;
    }
  }
}

async function loadStaffTestimonials({ silent = false } = {}) {
  const range = $("#staffTestimonialsRangeInput")?.value || "recent";
  const previousTestimonials = STAFF_STATE.testimonials;

  try {
    if (!silent) {
      clearStaffFreshDataIndicator("testimonials");
      clearStaffRecordSummary("#staffTestimonialsSummary");
      setStaffRecordsLoading("#staffTestimonialsContent", "Loading testimonials...");
    }
    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/testimonials?${params.toString()}`);
    const nextTestimonials = Array.isArray(result.testimonials) ? result.testimonials : [];
    handleStaffFreshRecords(
      "testimonials",
      silent ? getNewStaffRecords(previousTestimonials, nextTestimonials) : []
    );
    STAFF_STATE.testimonials = nextTestimonials;
    STAFF_STATE.testimonialsLoaded = true;
    updateStaffViewTabCounts();
    renderCurrentStaffTestimonials();
  } catch (error) {
    console.error("Staff testimonials load failed:", error);
    if (!silent) {
      clearStaffRecordSummary("#staffTestimonialsSummary");
      setStaffRecordsLoading(
        "#staffTestimonialsContent",
        error.message || "Failed to load staff testimonials.",
        false
      );
    } else {
      throw error;
    }
  }
}

async function patchStaffOrderAction(orderId, action) {
  return staffFetchJson(
    `${STAFF_API_BASE}/orders/${encodeURIComponent(orderId)}/${action}`,
    {
      method: "PATCH"
    }
  );
}

function getStaffRecordStatusEndpoint(recordType = "") {
  if (recordType === "order") {
    return "orders";
  }

  if (recordType === "reservation") {
    return "reservations";
  }

  if (recordType === "inquiry") {
    return "inquiries";
  }

  if (recordType === "contact") {
    return "contact-submissions";
  }

  if (recordType === "support") {
    return "support-requests";
  }

  return "";
}

async function patchStaffRecordStatus(recordType, recordId, status) {
  const endpoint = getStaffRecordStatusEndpoint(recordType);

  if (!endpoint) {
    throw new Error("Unsupported staff record type");
  }

  return staffFetchJson(
    `${STAFF_API_BASE}/${endpoint}/${encodeURIComponent(recordId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    }
  );
}

async function patchStaffTestimonialApproval(testimonialId, isApproved) {
  return staffFetchJson(
    `${STAFF_API_BASE}/testimonials/${encodeURIComponent(testimonialId)}/approval`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ isApproved })
    }
  );
}

function findStaffOrder(orderId) {
  return STAFF_STATE.orders.find((order) => String(order.id) === String(orderId));
}

function getStaffOrderActionConfirmMessage(orderId, actionLabel, action = "") {
  const order = findStaffOrder(orderId) || {};
  const tableLabel = getStaffOrderTableLabel(order);
  const addonMeta = getStaffOrderAddonMeta(order);
  const childAddOns = addonMeta.isAddon ? [] : getStaffOrderChildAddOns(order);
  const isFamilyAction = action === "mark-family-billed" || action === "mark-family-paid";
  const familyWarning = isFamilyAction
    ? `${childAddOns.length + 1} linked order ${childAddOns.length + 1 === 1 ? "record" : "records"} will be updated for this table family.`
    : getStaffOrderFamilyActionHint(order, childAddOns);

  return [
    `${actionLabel} order ${orderId}?`,
    `Table: ${tableLabel}`,
    familyWarning ? `Important: ${familyWarning}` : "",
    "",
    "Only continue if the hotel operator has confirmed this change."
  ].filter((line) => line !== "").join("\n");
}

async function handleStaffOrderAction(button, action, actionLabel) {
  const orderId = button.dataset.orderId || "";

  if (!orderId) {
    return;
  }

  const confirmed = window.confirm(
    getStaffOrderActionConfirmMessage(orderId, actionLabel, action)
  );

  if (!confirmed) {
    return;
  }

  const originalText = button.textContent;

  try {
    setStaffActionBusyState(button, true);
    button.textContent = "Updating...";
    await patchStaffOrderAction(orderId, action);
    await loadStaffOrders();
  } catch (error) {
    console.error(`Staff ${action} failed:`, error);
    const managerAccessMessage =
      error?.status === 403
        ? "Manager access is required to update billing or payment from this staff panel."
        : error.message || `Failed to ${actionLabel.toLowerCase()}`;
    window.alert(managerAccessMessage);
    button.textContent = originalText;
    button.disabled = false;
  } finally {
    setStaffActionBusyState(button, false);
  }
}

function getStaffRecordStatusConfirmMessage(recordType, recordId, status) {
  const statusLabel = getStaffRecordStatusLabel(status, recordType);
  const recordLabel =
    recordType === "order"
      ? "order"
      : recordType === "reservation"
      ? "reservation"
      : recordType === "contact"
        ? "contact message"
        : recordType === "support"
          ? "support request"
        : "inquiry";

  return [
    `Update ${recordLabel} ${recordId} status to "${statusLabel}"?`,
    "",
    "Only continue if the hotel operator has confirmed this change."
  ].join("\n");
}

function hasStaffRecordStatusChanged(select) {
  if (!select) return false;

  return normalizeStatus(select.value) !== normalizeStatus(select.dataset.currentStatus);
}

function updateStaffRecordStatusButtonState(select) {
  const actions = select?.closest(".staff-record-status-actions");
  const button = actions?.querySelector("[data-staff-update-record-status]");

  if (!button) return;

  const hasRecordId = Boolean(select?.dataset.recordId);
  button.disabled = !hasRecordId || !hasStaffRecordStatusChanged(select);
}

async function handleStaffRecordStatusAction(button) {
  const recordType = button.dataset.recordType || "";
  const recordId = button.dataset.recordId || "";
  const card = button.closest(".staff-order-card");
  const select = card?.querySelector("[data-staff-record-status-select]");
  const status = select?.value || "";

  if (!recordType || !recordId || !status) {
    return;
  }

  if (!hasStaffRecordStatusChanged(select)) {
    updateStaffRecordStatusButtonState(select);
    return;
  }

  const confirmed = window.confirm(
    getStaffRecordStatusConfirmMessage(recordType, recordId, status)
  );

  if (!confirmed) {
    return;
  }

  const originalText = button.textContent;

  try {
    setStaffActionBusyState(button, true);
    button.textContent = "Updating...";
    await patchStaffRecordStatus(recordType, recordId, status);

    if (recordType === "reservation") {
      await loadStaffReservations();
    } else if (recordType === "inquiry") {
      await loadStaffInquiries();
    } else if (recordType === "contact") {
      await loadStaffContacts();
    } else if (recordType === "support") {
      await loadStaffSupportRequests();
    } else if (recordType === "order") {
      await loadStaffOrders();
    }
  } catch (error) {
    console.error(`Staff ${recordType} status update failed:`, error);
    window.alert(error.message || "Failed to update status");
    button.textContent = originalText;
    updateStaffRecordStatusButtonState(select);
  } finally {
    setStaffActionBusyState(button, false);
  }
}

async function handleStaffTestimonialApprovalAction(button) {
  const testimonialId = button.dataset.testimonialId || "";
  const currentApproved = button.dataset.approved === "true";
  const nextApproved = !currentApproved;

  if (!testimonialId) {
    return;
  }

  const actionLabel = nextApproved ? "approve" : "unapprove";
  const confirmed = window.confirm(
    [
      `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} testimonial ${testimonialId}?`,
      "",
      "This only changes approval for this hotel. It does not edit or delete the review."
    ].join("\n")
  );

  if (!confirmed) {
    return;
  }

  const originalText = button.textContent;

  try {
    setStaffActionBusyState(button, true);
    button.textContent = "Updating...";
    await patchStaffTestimonialApproval(testimonialId, nextApproved);
    await loadStaffTestimonials();
  } catch (error) {
    console.error("Staff testimonial approval update failed:", error);
    window.alert(error.message || "Failed to update testimonial approval");
    button.textContent = originalText;
    button.disabled = false;
  } finally {
    setStaffActionBusyState(button, false);
  }
}

async function loginStaff(hotelSlug, pin) {
  const response = await fetch(`${STAFF_API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hotelSlug, pin })
  });

  const data = await response.json().catch(() => ({}));
console.log({
  hotelSlug,
  pin
});
  if (!response.ok) {
    throw new Error(data.message || "Staff login failed");
  }

  return data;
}

async function checkExistingStaffSession() {
  const token = getStaffToken();

  if (!token) {
    showStaffLoginView();
    return false;
  }

  try {
    const result = await staffFetchJson(`${STAFF_API_BASE}/me`);
    showStaffDashboardView(result.staffUser || {});
    await loadStaffOrders();
    void loadStaffSupportRequests();
    startStaffAutoRefresh();
    updateStaffSoundAlertToggle();
    updateStaffBrowserAlertToggle();
    return true;
  } catch (error) {
    console.warn("Staff session invalid:", error);
    clearStaffToken();
    showStaffLoginView("Staff session expired. Please login again.");
    return false;
  }
}

function prefillStaffHotelSlug() {
  const input = $("#staffHotelSlugInput");
  if (!input || input.value.trim()) return;

  const params = new URLSearchParams(window.location.search);
  const hotelSlug =
    params.get("hotel") ||
    window.APP_RUNTIME_CONFIG?.DEFAULT_HOTEL_SLUG ||
    "";

  input.value = hotelSlug;
}

function bindStaffLoginForm() {
  const form = $("#staffLoginForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const hotelSlug = $("#staffHotelSlugInput")?.value.trim() || "";
    const pin = $("#staffPinInput")?.value.trim() || "";

    try {
      setStaffFormDisabled(form, true);
      setStaffLoginStatus("Checking staff access...");
      void unlockStaffSoundAlerts();

      const result = await loginStaff(hotelSlug, pin);
      if (!result.token) {
        throw new Error("Staff login did not return a session token");
      }

      setStaffToken(result.token);
      showStaffDashboardView(result.staffUser || {});
      await loadStaffOrders();
      void loadStaffSupportRequests();
      startStaffAutoRefresh();
    } catch (error) {
      console.error("Staff login failed:", error);
      clearStaffToken();
      showStaffLoginView(error.message || "Staff login failed");
      setStaffLoginStatus(error.message || "Staff login failed", true);
    } finally {
      setStaffFormDisabled(form, false);
    }
  });
}

function bindStaffLogout() {
  const button = $("#staffLogoutBtn");
  if (!button) return;

  button.addEventListener("click", () => {
    clearStaffToken();
    showStaffLoginView("Logged out.");
  });
}

function bindStaffSoundAlertToggle() {
  const button = $("#staffSoundAlertToggleBtn");
  if (!button || button.dataset.boundClick === "true") return;

  updateStaffSoundAlertToggle();

  button.addEventListener("click", async () => {
    if (!canUseStaffSoundAlerts()) {
      updateStaffSoundAlertToggle();
      return;
    }

    const nextEnabled = !isStaffSoundAlertEnabled();
    setStaffSoundAlertEnabled(nextEnabled);
    const unlocked = nextEnabled ? await unlockStaffSoundAlerts() : staffSoundUnlocked;
    updateStaffSoundAlertToggle();

    if (!nextEnabled) {
      setStaffLiveRefreshStatus("Sound alerts off", "muted");
      return;
    }

    if (!unlocked) {
      setStaffLiveRefreshStatus("Tap once to arm sound alerts", "warning");
      return;
    }

    playStaffAlertTone();
    setStaffLiveRefreshStatus("Sound alerts on", "live");
  });

  button.dataset.boundClick = "true";
}

function bindStaffBrowserAlertToggle() {
  const button = $("#staffBrowserAlertToggleBtn");
  if (!button || button.dataset.boundClick === "true") return;

  updateStaffBrowserAlertToggle();

  button.addEventListener("click", async () => {
    if (!canUseStaffBrowserAlerts()) {
      updateStaffBrowserAlertToggle();
      return;
    }

    if (isStaffBrowserAlertEnabled()) {
      setStaffBrowserAlertEnabled(false);
      updateStaffBrowserAlertToggle();
      setStaffLiveRefreshStatus("Browser alerts off", "muted");
      return;
    }

    const permission = await ensureStaffBrowserAlertPermission();
    const enabled = permission === "granted";
    setStaffBrowserAlertEnabled(enabled);
    updateStaffBrowserAlertToggle();

    if (!enabled) {
      setStaffLiveRefreshStatus("Browser alerts blocked", "warning");
      return;
    }

    showStaffBrowserNotification(
      "Staff browser alerts enabled",
      "New hotel orders will now trigger browser alerts for this workspace.",
      {
        tag: `staff-browser-alert-preview-${STAFF_STATE.staffUser?.hotelSlug || "hotel"}`,
        renotify: false,
        durationMs: 8000,
        onClick(notification) {
          try {
            window.focus();
          } catch (error) {
            console.warn("Staff browser alert preview focus failed:", error);
          }

          notification.close();
        }
      }
    );
    setStaffLiveRefreshStatus("Browser alerts on", "live");
  });

  button.dataset.boundClick = "true";
}

function bindStaffOrderActions() {
  const sidebarToggleButton = $("#staffSidebarToggleBtn");
  const refreshButton = $("#staffRefreshOrdersBtn");
  const rangeInput = $("#staffOrdersRangeInput");
  const ordersSearchInput = $("#staffOrdersSearchInput");
  const sourceInput = $("#staffOrdersSourceInput");
  const tableInput = $("#staffOrdersTableInput");
  const paymentInput = $("#staffOrdersPaymentInput");
  const billingInput = $("#staffOrdersBillingInput");
  const orderStatusInput = $("#staffOrdersStatusInput");
  const attentionToggle = $("#staffOrdersAttentionToggle");
  const clearFiltersButton = $("#staffClearFiltersBtn");
  const tableOrderForm = $("#staffTableOrderForm");
  const tableOrderClearButton = $("#staffTableOrderClearBtn");
  const tableOrderRefreshMenuButton = $("#staffRefreshTableOrderMenuBtn");
  const tableOrderSearchInput = $("#staffTableOrderSearchInput");
  const tableOrderCategoryFilter = $("#staffTableOrderCategoryFilter");
  const reservationsRefreshButton = $("#staffRefreshReservationsBtn");
  const reservationsRangeInput = $("#staffReservationsRangeInput");
  const reservationsStatusInput = $("#staffReservationsStatusInput");
  const inquiriesRefreshButton = $("#staffRefreshInquiriesBtn");
  const inquiriesRangeInput = $("#staffInquiriesRangeInput");
  const inquiriesStatusInput = $("#staffInquiriesStatusInput");
  const contactsRefreshButton = $("#staffRefreshContactsBtn");
  const contactsRangeInput = $("#staffContactsRangeInput");
  const contactsStatusInput = $("#staffContactsStatusInput");
  const supportRefreshButton = $("#staffRefreshSupportBtn");
  const supportRangeInput = $("#staffSupportRangeInput");
  const supportStatusInput = $("#staffSupportStatusInput");
  const testimonialsRefreshButton = $("#staffRefreshTestimonialsBtn");
  const testimonialsRangeInput = $("#staffTestimonialsRangeInput");
  const testimonialsApprovalInput = $("#staffTestimonialsApprovalInput");

  if (sidebarToggleButton) {
    sidebarToggleButton.addEventListener("click", () => {
      const dashboardWrap = $("#staffDashboardWrap");
      const isCollapsed = dashboardWrap?.classList.contains("is-sidebar-collapsed");
      setStaffSidebarExpanded(!!isCollapsed);
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      void loadStaffOrders();
    });
  }

  if (rangeInput) {
    rangeInput.addEventListener("change", () => {
      void loadStaffOrders();
    });
  }

  if (sourceInput) {
    sourceInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (tableInput) {
    tableInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (ordersSearchInput) {
    ordersSearchInput.addEventListener("input", () => {
      renderCurrentStaffOrders();
    });
  }

  if (paymentInput) {
    paymentInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (billingInput) {
    billingInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (orderStatusInput) {
    orderStatusInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (attentionToggle) {
    attentionToggle.addEventListener("click", () => {
      setStaffAttentionFilterEnabled(!isStaffAttentionFilterEnabled());
      renderCurrentStaffOrders();
    });
  }

  if (clearFiltersButton) {
    clearFiltersButton.addEventListener("click", () => {
      resetStaffViewFilters();
    });
  }

  if (tableOrderForm) {
    tableOrderForm.addEventListener("submit", (event) => {
      void handleStaffTableOrderSubmit(event);
    });
  }

  if (tableOrderClearButton) {
    tableOrderClearButton.addEventListener("click", () => {
      clearStaffTableOrderForm();
    });
  }

  if (tableOrderRefreshMenuButton) {
    tableOrderRefreshMenuButton.addEventListener("click", () => {
      void loadStaffTableOrderMenu();
    });
  }

  if (tableOrderSearchInput) {
    tableOrderSearchInput.addEventListener("input", () => {
      STAFF_STATE.tableOrderMenuQuery = String(tableOrderSearchInput.value || "").trimStart();
      renderStaffTableOrderMenu();
    });
  }

  if (tableOrderCategoryFilter) {
    tableOrderCategoryFilter.addEventListener("change", () => {
      STAFF_STATE.tableOrderMenuCategory =
        String(tableOrderCategoryFilter.value || "all").trim() || "all";
      renderStaffTableOrderMenu();
    });
  }

  document.querySelectorAll("[data-staff-view]").forEach((button) => {
    button.addEventListener("click", () => {
      openStaffView(button.dataset.staffView || "orders");
    });
  });

  if (reservationsRefreshButton) {
    reservationsRefreshButton.addEventListener("click", () => {
      void loadStaffReservations();
    });
  }

  if (reservationsRangeInput) {
    reservationsRangeInput.addEventListener("change", () => {
      void loadStaffReservations();
    });
  }

  if (reservationsStatusInput) {
    reservationsStatusInput.addEventListener("change", () => {
      renderCurrentStaffReservations();
    });
  }

  if (inquiriesRefreshButton) {
    inquiriesRefreshButton.addEventListener("click", () => {
      void loadStaffInquiries();
    });
  }

  if (inquiriesRangeInput) {
    inquiriesRangeInput.addEventListener("change", () => {
      void loadStaffInquiries();
    });
  }

  if (inquiriesStatusInput) {
    inquiriesStatusInput.addEventListener("change", () => {
      renderCurrentStaffInquiries();
    });
  }

  if (contactsRefreshButton) {
    contactsRefreshButton.addEventListener("click", () => {
      void loadStaffContacts();
    });
  }

  if (contactsRangeInput) {
    contactsRangeInput.addEventListener("change", () => {
      void loadStaffContacts();
    });
  }

  if (contactsStatusInput) {
    contactsStatusInput.addEventListener("change", () => {
      renderCurrentStaffContacts();
    });
  }

  if (supportRefreshButton) {
    supportRefreshButton.addEventListener("click", () => {
      void loadStaffSupportRequests();
    });
  }

  if (supportRangeInput) {
    supportRangeInput.addEventListener("change", () => {
      void loadStaffSupportRequests();
    });
  }

  if (supportStatusInput) {
    supportStatusInput.addEventListener("change", () => {
      renderCurrentStaffSupportRequests();
    });
  }

  if (testimonialsRefreshButton) {
    testimonialsRefreshButton.addEventListener("click", () => {
      void loadStaffTestimonials();
    });
  }

  if (testimonialsRangeInput) {
    testimonialsRangeInput.addEventListener("change", () => {
      void loadStaffTestimonials();
    });
  }

  if (testimonialsApprovalInput) {
    testimonialsApprovalInput.addEventListener("change", () => {
      renderCurrentStaffTestimonials();
    });
  }

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const statusSelect = target.closest("[data-staff-record-status-select]");
    if (statusSelect) {
      updateStaffRecordStatusButtonState(statusSelect);
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const tableOrderPlusButton = target.closest("[data-staff-table-order-plus]");
    if (tableOrderPlusButton) {
      const itemId = tableOrderPlusButton.dataset.staffTableOrderPlus || "";
      setStaffTableOrderItemQty(itemId, getStaffTableOrderItemQty(itemId) + 1);
      return;
    }

    const tableOrderMinusButton = target.closest("[data-staff-table-order-minus]");
    if (tableOrderMinusButton) {
      const itemId = tableOrderMinusButton.dataset.staffTableOrderMinus || "";
      setStaffTableOrderItemQty(itemId, getStaffTableOrderItemQty(itemId) - 1);
      return;
    }

    const markBilledButton = target.closest("[data-staff-mark-billed]");
    if (markBilledButton) {
      void handleStaffOrderAction(markBilledButton, "mark-billed", "Mark billed");
      return;
    }

    const markPaidButton = target.closest("[data-staff-mark-paid]");
    if (markPaidButton) {
      void handleStaffOrderAction(markPaidButton, "mark-paid", "Mark paid");
      return;
    }

    const markFamilyBilledButton = target.closest("[data-staff-mark-family-billed]");
    if (markFamilyBilledButton) {
      void handleStaffOrderAction(markFamilyBilledButton, "mark-family-billed", "Mark full table billed");
      return;
    }

    const markFamilyPaidButton = target.closest("[data-staff-mark-family-paid]");
    if (markFamilyPaidButton) {
      void handleStaffOrderAction(markFamilyPaidButton, "mark-family-paid", "Mark full table paid");
      return;
    }

    const viewBillButton = target.closest("[data-staff-view-bill]");
    if (viewBillButton) {
      const orderId = viewBillButton.dataset.orderId || "";
      const order = findStaffOrder(orderId);

      if (!order) {
        window.alert("Order not found in the current staff list.");
        return;
      }

      openStaffOrderBill(order);
      return;
    }

    const updateRecordStatusButton = target.closest("[data-staff-update-record-status]");
    if (updateRecordStatusButton) {
      void handleStaffRecordStatusAction(updateRecordStatusButton);
      return;
    }

    const testimonialApprovalButton = target.closest("[data-staff-toggle-testimonial-approval]");
    if (testimonialApprovalButton) {
      void handleStaffTestimonialApprovalAction(testimonialApprovalButton);
    }
  });
}

async function initStaffOrdersPage() {
  prefillStaffHotelSlug();
  bindStaffSoundRuntimeUnlock();
  bindStaffLoginForm();
  bindStaffLogout();
  bindStaffSoundAlertToggle();
  bindStaffBrowserAlertToggle();
  bindStaffOrderActions();
  syncStaffSidebarForViewport();
  await checkExistingStaffSession();
}

window.addEventListener("beforeunload", stopStaffAutoRefresh);
window.addEventListener("resize", handleStaffViewportChange);
document.addEventListener("DOMContentLoaded", initStaffOrdersPage);
