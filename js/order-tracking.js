"use strict";

(function initOrderTrackingPage() {
  const REFRESH_INTERVAL_MS = 20000;
  const TRACKING_STEPS = ["new", "confirmed", "preparing", "completed"];
  const STATUS_LABELS = {
    new: "Received",
    confirmed: "Confirmed",
    preparing: "Preparing",
    completed: "Completed / Served",
    cancelled: "Cancelled",
    payment_pending: "Payment Pending",
    payment_failed: "Payment Failed"
  };
  const STATUS_DETAILS = {
    new: "Your order has reached the hotel. Staff will confirm it shortly.",
    confirmed: "The hotel has confirmed your order and it is queued for preparation.",
    preparing: "The kitchen is preparing your food now.",
    completed: "Your order is completed. For table orders, please contact staff if you need anything else.",
    cancelled: "This order has been cancelled by the hotel team.",
    payment_pending: "Your online payment is still being confirmed. Please do not place a duplicate order yet.",
    payment_failed: "Payment could not be confirmed for this order. Please contact the hotel or try another payment option."
  };

  const CLOSED_TRACKING_STATUSES = new Set(["completed", "cancelled", "payment_failed"]);
  let refreshTimer = null;
  let latestOrder = null;
  let latestStatus = "";
  let hasRenderedFirstOrder = false;

  const $ = (selector) => document.querySelector(selector);

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

  const API_BASE = (
    window.APP_RUNTIME_CONFIG?.API_BASE_URL || getDefaultApiBaseUrl()
  ).replace(/\/+$/, "");

  function normalizeText(value = "", maxLength = 160) {
    const text = typeof value === "string"
      ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
      : "";
    return text.slice(0, maxLength);
  }

  function getTrackingContext() {
    const params = new URLSearchParams(window.location.search);

    return {
      hotelSlug: normalizeText(params.get("hotel") || params.get("hotelSlug"), 120),
      orderId: normalizeText(params.get("order") || params.get("orderId"), 120),
      token: normalizeText(params.get("token"), 200)
    };
  }

  function setText(selector, value) {
    const element = $(selector);
    if (!element) return;
    element.textContent = value;
  }

  function formatMoney(value = 0) {
    const amount = Number(value || 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return `Rs. ${safeAmount.toFixed(2)}`;
  }

  function formatDateTime(value = "") {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function isClosedTrackingStatus(status = "") {
    return CLOSED_TRACKING_STATUSES.has(normalizeText(status, 60).toLowerCase());
  }

  function isTableOrder(order = {}) {
    const tableNumber = normalizeText(order.tableNumber, 80);
    const source = normalizeText(order.orderSource, 40).toLowerCase();
    const orderType = normalizeText(order.orderType, 40).toLowerCase();

    return Boolean(
      tableNumber ||
      source === "qr" ||
      source === "table" ||
      orderType === "dine-in" ||
      orderType === "dine_in"
    );
  }

  function canAddMoreItems(order = {}) {
    const status = normalizeText(order.status, 60).toLowerCase();
    const paymentStatus = normalizeText(order.paymentStatus, 60).toLowerCase();
    const billingStatus = normalizeText(order.billingStatus, 60).toLowerCase();

    return (
      isTableOrder(order) &&
      !isClosedTrackingStatus(status) &&
      status !== "payment_pending" &&
      !["paid", "refunded"].includes(paymentStatus) &&
      !["bill_ready", "billed", "closed"].includes(billingStatus)
    );
  }

  function setTrackingUpdatedHint(message = "", state = "live") {
    const hint = $("#trackingUpdatedHint");
    if (!hint) return;

    hint.textContent = message;
    hint.dataset.state = state;
  }

  function stopAutoRefresh() {
    if (!refreshTimer) return;

    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function getStatusLabel(status = "") {
    const normalizedStatus = normalizeText(status, 60).toLowerCase();
    return STATUS_LABELS[normalizedStatus] || normalizedStatus || "New";
  }

  function getStatusDetail(status = "") {
    const normalizedStatus = normalizeText(status, 60).toLowerCase();
    return STATUS_DETAILS[normalizedStatus] || "The hotel team will update this order as it moves forward.";
  }

  function getSourceLabel(order = {}) {
    if (isTableOrder(order)) {
      return "QR / Table";
    }

    return "Website";
  }

  function hasTableActions(order = {}) {
    const actions = order.actions && typeof order.actions === "object"
      ? order.actions
      : {};

    return (
      actions.tableActionsEnabled === true &&
      Boolean(actions.requestBillWhatsappLink || actions.callStaffWhatsappLink)
    );
  }

  function setTableSupportStatus(message = "", type = "info") {
    const status = $("#trackingTableActionStatus");
    if (!status) return;

    status.textContent = message;
    status.hidden = !message;
    status.dataset.status = type;
  }

  function queueTableSupportRequest(action = "") {
    const requestAction = normalizeText(action, 20).toLowerCase();
    const context = getTrackingContext();
    const order = latestOrder || {};

    if (!requestAction || !hasTableActions(order) || !context.hotelSlug || !context.orderId || !context.token) {
      return;
    }

    const actionLabel = requestAction === "bill" ? "Bill request" : "Staff help request";
    const url = `${API_BASE}/order-tracking/${encodeURIComponent(context.hotelSlug)}/${encodeURIComponent(context.orderId)}/support-requests`;
    const body = JSON.stringify({
      token: context.token,
      action: requestAction
    });

    setTableSupportStatus(`${actionLabel} is being sent. WhatsApp will open as backup.`, "info");

    void fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body,
      keepalive: true
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn("Table support request was not saved:", payload.message || response.statusText);
        setTableSupportStatus("WhatsApp opened. The dashboard save did not complete, so staff can still receive your message there.", "warning");
        return;
      }

      if (payload.saved === false) {
        setTableSupportStatus("WhatsApp opened. Staff can receive your message there while dashboard storage is being prepared.", "warning");
        return;
      }

      setTableSupportStatus(`${actionLabel} sent to the hotel dashboard. WhatsApp is also available as backup.`, "success");
    }).catch((error) => {
      console.warn("Table support request save skipped:", error.message);
      setTableSupportStatus("WhatsApp opened. The dashboard save could not finish, so staff can still receive your message there.", "warning");
    });
  }

  function getTotalValue(totals = {}) {
    return Number(
      totals.total ||
      totals.gatewayAmount ||
      totals.gpayFinalTotal ||
      totals.normalTotal ||
      0
    );
  }

  function getOrderAddOns(order = {}) {
    return Array.isArray(order.addOns) ? order.addOns : [];
  }

  function getOrderCombinedTotal(order = {}) {
    return [order, ...getOrderAddOns(order)].reduce(
      (sum, currentOrder) => sum + getTotalValue(currentOrder.totals || {}),
      0
    );
  }

  function updateCombinedTotal(order = {}) {
    const row = $("#trackingCombinedTotalRow");
    const value = $("#trackingCombinedTotal");
    const addOns = getOrderAddOns(order);

    if (!row || !value) return;

    if (!addOns.length) {
      row.hidden = true;
      value.textContent = formatMoney(0);
      return;
    }

    value.textContent = formatMoney(getOrderCombinedTotal(order));
    row.hidden = false;
  }

  function getCombinedPaymentLabel(order = {}) {
    const records = [order, ...getOrderAddOns(order)];
    const statuses = records.map((record) => normalizeText(record.paymentStatus, 60).toLowerCase());

    if (statuses.every((status) => status === "paid")) {
      return "All Paid";
    }

    if (statuses.some((status) => status === "paid")) {
      return "Partly Paid";
    }

    if (statuses.some((status) => ["initiated", "pending", "payment_pending"].includes(status))) {
      return "Payment Pending";
    }

    return "Unpaid / Pending";
  }

  function getCombinedBillingLabel(order = {}) {
    const records = [order, ...getOrderAddOns(order)];
    const statuses = records.map((record) => normalizeText(record.billingStatus, 60).toLowerCase());

    if (statuses.every((status) => ["billed", "closed"].includes(status))) {
      return "All Billed";
    }

    if (statuses.some((status) => ["billed", "closed"].includes(status))) {
      return "Partly Billed";
    }

    return "Not Billed";
  }

  function updateCombinedStateRows(order = {}) {
    const addOns = getOrderAddOns(order);
    const paymentRow = $("#trackingCombinedPaymentRow");
    const paymentValue = $("#trackingCombinedPaymentStatus");
    const billingRow = $("#trackingCombinedBillingRow");
    const billingValue = $("#trackingCombinedBillingStatus");

    if (!paymentRow || !paymentValue || !billingRow || !billingValue) return;

    if (!addOns.length) {
      paymentRow.hidden = true;
      billingRow.hidden = true;
      paymentValue.textContent = "-";
      billingValue.textContent = "-";
      return;
    }

    paymentValue.textContent = getCombinedPaymentLabel(order);
    billingValue.textContent = getCombinedBillingLabel(order);
    paymentRow.hidden = false;
    billingRow.hidden = false;
  }

  function markAppReady() {
    const loader = $("#loader");

    document.body.classList.remove("app-booting");
    document.body.classList.add("app-ready");

    if (loader) {
      loader.classList.add("hidden");
    }
  }

  function setMessage(message = "", type = "info") {
    const messageBox = $("#trackingMessage");
    if (!messageBox) return;

    if (!message) {
      messageBox.hidden = true;
      messageBox.textContent = "";
      return;
    }

    messageBox.hidden = false;
    messageBox.dataset.type = type;
    messageBox.textContent = message;
  }

  function getStatusChangeMessage(previousStatus = "", nextStatus = "") {
    const previousLabel = getStatusLabel(previousStatus);
    const nextLabel = getStatusLabel(nextStatus);

    if (!previousStatus || previousStatus === nextStatus) return "";

    return `Order status updated: ${previousLabel} to ${nextLabel}.`;
  }

  function setLoading(isLoading) {
    const refreshButton = $("#refreshTrackingBtn");
    if (!refreshButton) return;

    refreshButton.disabled = !!isLoading;
    refreshButton.classList.toggle("is-loading", !!isLoading);
  }

  function updateBackToMenuLink(order = latestOrder) {
    const link = $("#backToMenuLink");
    if (!link) return;

    const context = getTrackingContext();
    const hotelSlug = normalizeText(order?.hotelSlug || context.hotelSlug, 120);
    const tableNumber = normalizeText(order?.tableNumber, 80);
    const orderSource = normalizeText(order?.orderSource, 40);
    const params = new URLSearchParams();

    if (hotelSlug) params.set("hotel", hotelSlug);
    if (tableNumber) params.set("table", tableNumber);
    if (orderSource) params.set("source", orderSource);

    link.href = `menu.html${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function updateAddMoreItemsLink(order = latestOrder) {
    const link = $("#addMoreItemsLink");
    if (!link) return;

    const context = getTrackingContext();
    const hotelSlug = normalizeText(order?.hotelSlug || context.hotelSlug, 120);
    const orderId = normalizeText(order?.id || context.orderId, 120);
    const token = normalizeText(context.token, 200);
    const tableNumber = normalizeText(order?.tableNumber, 80);
    const orderSource = normalizeText(order?.orderSource, 40) || "qr";

    if (!canAddMoreItems(order) || !hotelSlug || !orderId || !token || !tableNumber) {
      link.hidden = true;
      link.href = "menu.html";
      return;
    }

    const params = new URLSearchParams({
      hotel: hotelSlug,
      table: tableNumber,
      source: orderSource,
      addToOrder: orderId,
      addToken: token
    });

    link.href = `menu.html?${params.toString()}`;
    link.hidden = false;
  }

  function updateStatusBadge(order = {}) {
    const badge = $("#trackingStatusBadge");
    if (!badge) return;

    const status = normalizeText(order.status || "new", 60).toLowerCase();
    badge.dataset.status = status;
    badge.textContent = getStatusLabel(status);
    setText("#trackingStatusDescription", getStatusDetail(status));
  }

  function updateTimeline(order = {}) {
    const timeline = $("#trackingTimeline");
    if (!timeline) return;

    const status = normalizeText(order.status || "new", 60).toLowerCase();
    timeline.dataset.status = status;
    const activeIndex = TRACKING_STEPS.includes(status)
      ? TRACKING_STEPS.indexOf(status)
      : status === "cancelled" || status === "payment_failed"
        ? -1
        : 0;

    timeline.querySelectorAll("li").forEach((item, index) => {
      item.classList.toggle("is-active", index === activeIndex);
      item.classList.toggle("is-complete", activeIndex >= 0 && index < activeIndex);
      item.classList.toggle("is-muted", activeIndex < 0);
      item.toggleAttribute("aria-current", index === activeIndex);
    });
  }

  function updateTableActions(order = {}) {
    const section = $("#trackingTableActions");
    if (!section) return;

    const actions = order.actions && typeof order.actions === "object"
      ? order.actions
      : {};
    const requestBillLink = $("#requestBillLink");
    const callStaffLink = $("#callStaffLink");

    if (!hasTableActions(order)) {
      section.hidden = true;
      setTableSupportStatus("");
      return;
    }

    if (requestBillLink) {
      requestBillLink.href = actions.requestBillWhatsappLink || "#";
      requestBillLink.hidden = !actions.requestBillWhatsappLink;
    }

    if (callStaffLink) {
      callStaffLink.href = actions.callStaffWhatsappLink || "#";
      callStaffLink.hidden = !actions.callStaffWhatsappLink;
    }

    section.hidden = false;
  }

  function updateClosedOrderMessage(order = {}) {
    const status = normalizeText(order.status || "new", 60).toLowerCase();

    if (isTableOrder(order) && isClosedTrackingStatus(status)) {
      setMessage(
        "This table order is now closed. If you are a new guest at this table, please start a fresh order from the menu.",
        "info"
      );
      return true;
    }

    return false;
  }

  function updateStatusChangeNotice(order = {}) {
    const nextStatus = normalizeText(order.status || "new", 60).toLowerCase();
    const statusChangeMessage = getStatusChangeMessage(latestStatus, nextStatus);
    let noticeShown = false;

    if (hasRenderedFirstOrder && statusChangeMessage) {
      setMessage(statusChangeMessage, isClosedTrackingStatus(nextStatus) ? "info" : "success");
      noticeShown = true;
    }

    latestStatus = nextStatus;
    hasRenderedFirstOrder = true;
    return noticeShown;
  }

  function renderItems(items = []) {
    const container = $("#trackingItems");
    if (!container) return;

    container.innerHTML = "";

    if (!Array.isArray(items) || !items.length) {
      const empty = document.createElement("p");
      empty.className = "tracking-empty";
      empty.textContent = "No order items found for this tracking link.";
      container.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "tracking-item";

      const detail = document.createElement("div");
      const name = document.createElement("strong");
      const qty = document.createElement("span");
      const amount = document.createElement("span");

      name.textContent = item.name || "Menu item";
      qty.textContent = `Qty ${Number(item.qty || 0)}`;
      amount.textContent = formatMoney(item.lineTotal || Number(item.price || 0) * Number(item.qty || 0));

      detail.appendChild(name);
      detail.appendChild(qty);
      row.appendChild(detail);
      row.appendChild(amount);
      container.appendChild(row);
    });
  }

  function renderAddonItems(container, items = []) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(items) || !items.length) {
      const empty = document.createElement("p");
      empty.className = "tracking-empty";
      empty.textContent = "No add-on items found.";
      container.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "tracking-addon-item";

      const name = document.createElement("span");
      const amount = document.createElement("strong");

      name.textContent = `${item.name || "Menu item"} x${Number(item.qty || 0)}`;
      amount.textContent = formatMoney(item.lineTotal || Number(item.price || 0) * Number(item.qty || 0));

      row.appendChild(name);
      row.appendChild(amount);
      container.appendChild(row);
    });
  }

  function renderAddOns(addOns = []) {
    const section = $("#trackingAddons");
    const list = $("#trackingAddonsList");
    if (!section || !list) return;

    list.innerHTML = "";

    if (!Array.isArray(addOns) || !addOns.length) {
      section.hidden = true;
      return;
    }

    addOns.forEach((addOn) => {
      const card = document.createElement("article");
      const head = document.createElement("div");
      const title = document.createElement("h4");
      const meta = document.createElement("p");
      const items = document.createElement("div");
      const total = document.createElement("p");
      const totals = addOn.totals || {};

      card.className = "tracking-addon-card";
      head.className = "tracking-addon-card__head";
      title.textContent = addOn.orderSequenceLabel || `Add-on Order #${addOn.id || ""}`;
      meta.textContent = `${getStatusLabel(addOn.status)} - ${formatDateTime(addOn.createdAt)}`;
      items.className = "tracking-addon-card__items";
      total.className = "tracking-addon-card__total";
      total.textContent = `Add-on total: ${formatMoney(getTotalValue(totals))}`;

      head.appendChild(title);
      head.appendChild(meta);
      renderAddonItems(items, addOn.items);
      card.appendChild(head);
      card.appendChild(items);
      card.appendChild(total);
      list.appendChild(card);
    });

    section.hidden = false;
  }

  function renderOrder(order = {}) {
    latestOrder = order;

    document.title = `Track Order #${order.id || ""}`;
    setText("#trackingSubtitle", `${order.hotelName || "Your hotel"} is updating this order as it moves forward.`);
    setText("#trackingOrderId", order.id ? `#${order.id}` : "Order");
    setText("#trackingHotelName", order.hotelName || order.hotelSlug || "-");
    setText("#trackingOrderSource", getSourceLabel(order));
    setText("#trackingTableNumber", order.tableNumber || "Not a table order");
    setText("#trackingCreatedAt", formatDateTime(order.createdAt));

    const totals = order.totals || {};
    setText("#trackingSubtotal", formatMoney(totals.subtotal));
    setText("#trackingGst", formatMoney(totals.gst));
    setText("#trackingTotal", formatMoney(getTotalValue(totals)));
    updateCombinedTotal(order);
    setText("#trackingPaymentStatus", order.paymentStatus || order.paymentMethod || "-");
    setText("#trackingBillingStatus", order.billingStatus || "-");
    updateCombinedStateRows(order);
    setTrackingUpdatedHint(
      `Updated ${formatDateTime(new Date().toISOString())}. Auto-refresh runs every 20 seconds.`,
      isClosedTrackingStatus(order.status) ? "closed" : "live"
    );

    renderItems(order.items);
    renderAddOns(order.addOns);
    updateStatusBadge(order);
    updateTimeline(order);
    updateBackToMenuLink(order);
    updateAddMoreItemsLink(order);
    updateTableActions(order);
    const statusNoticeShown = updateStatusChangeNotice(order);
    const closedMessageShown = updateClosedOrderMessage(order);

    if (!closedMessageShown && !statusNoticeShown) {
      setMessage("");
    }

    if (isClosedTrackingStatus(order.status)) {
      stopAutoRefresh();
      setTrackingUpdatedHint(
        `Closed ${formatDateTime(new Date().toISOString())}. Auto-refresh stopped for this order.`,
        "closed"
      );
    }
  }

  async function fetchTracking() {
    const context = getTrackingContext();

    if (!context.hotelSlug || !context.orderId || !context.token) {
      throw new Error("Tracking link is missing hotel, order, or token information.");
    }

    const url = `${API_BASE}/order-tracking/${encodeURIComponent(context.hotelSlug)}/${encodeURIComponent(context.orderId)}?token=${encodeURIComponent(context.token)}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || "Unable to load order tracking.");
    }

    return payload.order;
  }

  async function loadTracking({ silent = false } = {}) {
    try {
      setLoading(true);
      if (silent) {
        setTrackingUpdatedHint("Refreshing status...", "refreshing");
      }

      const order = await fetchTracking();
      renderOrder(order);
    } catch (error) {
      console.error("Order tracking load failed:", error);
      if (!silent) {
        setMessage(error.message || "Unable to load this tracking link.", "error");
        updateStatusBadge({ status: "error" });
        setText("#trackingStatusBadge", "Unavailable");
      } else {
        setTrackingUpdatedHint(
          "Live refresh paused. Tap Refresh Status to try again.",
          "warning"
        );
      }
    } finally {
      setLoading(false);
      markAppReady();
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    refreshTimer = window.setInterval(() => {
      void loadTracking({ silent: true });
    }, REFRESH_INTERVAL_MS);
  }

  function bindEvents() {
    const refreshButton = $("#refreshTrackingBtn");

    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        void loadTracking();
      });
    }

    document.querySelectorAll("[data-tracking-support-action]").forEach((link) => {
      link.addEventListener("click", () => {
        queueTableSupportRequest(link.dataset.trackingSupportAction || "");
      });
    });

    window.addEventListener("beforeunload", () => {
      stopAutoRefresh();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    updateBackToMenuLink();
    void loadTracking();
    startAutoRefresh();
  });
})();
