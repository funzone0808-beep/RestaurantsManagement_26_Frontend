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
  const SMART_WAITER_TRACKING_CONTEXT_EVENT = "smartwaiter:tracking-context";
  const TRACKING_ASSISTANT_READY_MESSAGE = "Smart Waiter is ready for safe tracking questions.";
  const TRACKING_ASSISTANT_SYNCED_MESSAGE = "Smart Waiter is synced to the latest tracking state.";
  const TRACKING_ASSISTANT_CLOSED_MESSAGE = "This tracked order is now closed. Smart Waiter is limited to final read-only status on this page.";
  const TRACKING_ASSISTANT_REPLY_READY_MESSAGE = "Read-only tracking reply ready.";
  const TRACKING_ASSISTANT_SAFE_PROMPTS = new Set([
    "What is my order status?",
    "Can I add more items?",
    "Is my bill ready?",
    "How do I request the bill?",
    "How do I call staff?"
  ]);
  const TRACKING_ASSISTANT_SUPPORT_PROMPTS = new Set([
    "How do I request the bill?",
    "How do I call staff?"
  ]);
  let refreshTimer = null;
  let latestOrder = null;
  let latestStatus = "";
  let hasRenderedFirstOrder = false;
  let trackingAssistantActivePrompt = "";
  let trackingAssistantLoading = false;
  let latestTrackingAssistantReply = null;

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

  function publishSmartWaiterTrackingContext(context = null) {
    if (typeof window === "undefined") return;

    window.SMART_WAITER_TRACKING_CONTEXT =
      context && typeof context === "object" ? context : null;

    if (
      typeof window.dispatchEvent === "function" &&
      typeof window.CustomEvent === "function"
    ) {
      window.dispatchEvent(
        new window.CustomEvent(SMART_WAITER_TRACKING_CONTEXT_EVENT, {
          detail: {
            context: window.SMART_WAITER_TRACKING_CONTEXT
          }
        })
      );
    }
  }

  function buildSmartWaiterTrackingContext(order = latestOrder) {
    const trackingContext = getTrackingContext();
    const safeOrder = order && typeof order === "object" ? order : {};
    const normalizedStatus = normalizeText(safeOrder.status || "new", 60).toLowerCase();
    const addOns = Array.isArray(safeOrder.addOns) ? safeOrder.addOns : [];
    const tableOrder = isTableOrder(safeOrder);
    const canAddItems = canAddMoreItems(safeOrder);
    const billReady = canViewBill(safeOrder);
    const tableActionsReady = hasTableActions(safeOrder);

    return {
      pageScope: "order_tracking",
      hotelSlug: normalizeText(safeOrder.hotelSlug || trackingContext.hotelSlug, 120),
      hotelName: normalizeText(safeOrder.hotelName, 160),
      orderId: normalizeText(safeOrder.id || trackingContext.orderId, 120),
      trackingToken: normalizeText(trackingContext.token, 200),
      orderType: normalizeText(safeOrder.orderType, 40),
      orderSource: normalizeText(safeOrder.orderSource, 40),
      tableNumber: normalizeText(safeOrder.tableNumber, 80),
      status: normalizedStatus,
      statusLabel: getStatusLabel(normalizedStatus),
      statusDetail: getStatusDetail(normalizedStatus),
      paymentStatus: normalizeText(safeOrder.paymentStatus, 60),
      billingStatus: normalizeText(safeOrder.billingStatus, 60),
      billNumber: normalizeText(safeOrder.billNumber, 120),
      isTableOrder: tableOrder,
      isClosed: isClosedTrackingStatus(normalizedStatus),
      canAddMoreItems: canAddItems,
      canViewBill: billReady,
      hasTableActions: tableActionsReady,
      addOnCount: addOns.length,
      actionAvailability: {
        addMoreItems: canAddItems,
        viewBill: billReady,
        requestBill: tableActionsReady && !billReady,
        callStaff: tableActionsReady
      },
      refreshedAt: new Date().toISOString()
    };
  }

  function syncSmartWaiterTrackingContext(order = latestOrder) {
    publishSmartWaiterTrackingContext(buildSmartWaiterTrackingContext(order));
  }

  function clearSmartWaiterTrackingContext() {
    publishSmartWaiterTrackingContext(null);
  }

  function getTrackingAssistantElements() {
    return {
      section: $("#trackingSmartWaiter"),
      intro: $("#trackingSmartWaiterIntro"),
      pill: $("#trackingSmartWaiterPill"),
      prompts: $("#trackingSmartWaiterPrompts"),
      promptHint: $("#trackingSmartWaiterPromptHint"),
      status: $("#trackingSmartWaiterStatus"),
      reply: $("#trackingSmartWaiterReply"),
      followUps: $("#trackingSmartWaiterFollowUps"),
      helpers: $("#trackingSmartWaiterHelpers"),
      preview: $("#trackingSmartWaiterPreview"),
      previewTitle: $("#trackingSmartWaiterPreviewTitle"),
      previewMessage: $("#trackingSmartWaiterPreviewMessage"),
      previewConfirm: $("#trackingSmartWaiterPreviewConfirm"),
      previewCancel: $("#trackingSmartWaiterPreviewCancel"),
      answer: $("#trackingSmartWaiterAnswer"),
      disclaimer: $("#trackingSmartWaiterDisclaimer")
    };
  }

  function buildTrackingAssistantRequestContext(order = latestOrder) {
    const publishedContext =
      window.SMART_WAITER_TRACKING_CONTEXT &&
      typeof window.SMART_WAITER_TRACKING_CONTEXT === "object"
        ? window.SMART_WAITER_TRACKING_CONTEXT
        : null;
    const trackingContext = getTrackingContext();
    const safeOrder = order && typeof order === "object" ? order : {};
    const hotelSlug = normalizeText(
      publishedContext?.hotelSlug || safeOrder.hotelSlug || trackingContext.hotelSlug,
      120
    );
    const orderId = normalizeText(
      publishedContext?.orderId || safeOrder.id || trackingContext.orderId,
      120
    );
    const token = normalizeText(
      publishedContext?.trackingToken || trackingContext.token,
      200
    );

    if (!hotelSlug || !orderId || !token) {
      return null;
    }

    return {
      pageScope: "order_tracking",
      trackingHotelSlug: hotelSlug,
      trackingOrderId: orderId,
      trackingToken: token,
      orderType: normalizeText(
        publishedContext?.orderType || safeOrder.orderType,
        40
      ),
      orderSource: normalizeText(
        publishedContext?.orderSource || safeOrder.orderSource,
        40
      ),
      tableNumber: normalizeText(
        publishedContext?.tableNumber || safeOrder.tableNumber,
        80
      )
    };
  }

  function setTrackingAssistantStatus(message = TRACKING_ASSISTANT_READY_MESSAGE, options = {}) {
    const { loading = false } = options;
    const { status } = getTrackingAssistantElements();

    if (!status) return;

    status.textContent = message || "";
    status.classList.toggle("is-loading", !!loading);
  }

  function setTrackingAssistantLoading(isLoading) {
    trackingAssistantLoading = !!isLoading;
    const { section } = getTrackingAssistantElements();

    if (!section) return;

    section.querySelectorAll("[data-tracking-assistant-prompt]").forEach((button) => {
      button.disabled = trackingAssistantLoading;
      button.classList.toggle(
        "is-active",
        trackingAssistantLoading &&
          normalizeText(button.dataset.trackingAssistantPrompt, 120) === trackingAssistantActivePrompt
      );
    });
  }

  function setTrackingAssistantActivePrompt(prompt = "") {
    trackingAssistantActivePrompt = normalizeText(prompt, 120);
    setTrackingAssistantLoading(trackingAssistantLoading);
  }

  function clearTrackingAssistantReply() {
    const {
      reply,
      followUps,
      helpers,
      preview,
      previewTitle,
      previewMessage,
      previewConfirm,
      previewCancel,
      answer,
      disclaimer
    } = getTrackingAssistantElements();

    if (!reply || !followUps || !helpers || !answer || !disclaimer) return;

    latestTrackingAssistantReply = null;
    reply.hidden = true;
    followUps.hidden = true;
    followUps.innerHTML = "";
    helpers.hidden = true;
    helpers.innerHTML = "";
    if (preview) {
      preview.hidden = true;
    }
    if (previewTitle) {
      previewTitle.textContent = "";
    }
    if (previewMessage) {
      previewMessage.textContent = "";
    }
    if (previewConfirm) {
      previewConfirm.textContent = "";
    }
    if (previewCancel) {
      previewCancel.textContent = "";
    }
    answer.textContent = "";
    disclaimer.textContent = "";
  }

  function hideTrackingAssistant() {
    const { section } = getTrackingAssistantElements();
    if (!section) return;

    section.hidden = true;
    setTrackingAssistantActivePrompt("");
    setTrackingAssistantLoading(false);
    clearTrackingAssistantReply();
    setTrackingAssistantStatus(TRACKING_ASSISTANT_READY_MESSAGE);
  }

  function syncTrackingAssistantAvailability(order = latestOrder) {
    const elements = getTrackingAssistantElements();
    if (!elements.section) return;

    const context = buildTrackingAssistantRequestContext(order);

    if (!context) {
      hideTrackingAssistant();
      return;
    }

    elements.section.hidden = false;
    if (elements.intro) {
      elements.intro.textContent = context.tableNumber
        ? `Ask safe read-only questions for Table ${context.tableNumber}.`
        : "Ask safe read-only questions about this tracked order.";
    }

    if (elements.pill) {
      elements.pill.textContent = context.tableNumber
        ? `Table ${context.tableNumber}`
        : "Read only";
    }

    syncTrackingAssistantPromptVisibility(order);
    syncTrackingAssistantReplyState(order);

    if (!trackingAssistantLoading && elements.status) {
      setTrackingAssistantStatus(getTrackingAssistantSyncedStatusMessage(order));
    }
  }

  function getTrackingAssistantSyncedStatusMessage(order = latestOrder) {
    const safeOrder = order && typeof order === "object" ? order : {};
    const normalizedStatus = normalizeText(safeOrder.status, 60).toLowerCase();

    if (isClosedTrackingStatus(normalizedStatus)) {
      return TRACKING_ASSISTANT_CLOSED_MESSAGE;
    }

    if (latestTrackingAssistantReply && typeof latestTrackingAssistantReply === "object") {
      const previewContract = getTrackingAssistantPreviewContract(
        getTrackingAssistantHelperActions(latestTrackingAssistantReply, order)
      );

      if (previewContract) {
        return getTrackingAssistantPreviewStatusMessage(previewContract);
      }
    }

    if (latestTrackingAssistantReply && typeof latestTrackingAssistantReply === "object") {
      return TRACKING_ASSISTANT_SYNCED_MESSAGE;
    }

    return TRACKING_ASSISTANT_READY_MESSAGE;
  }

  function getTrackingAssistantVisiblePromptSet(order = latestOrder) {
    const safeOrder = order && typeof order === "object" ? order : {};
    const visiblePrompts = new Set([
      "What is my order status?",
      "Is my bill ready?"
    ]);
    const requestBillLink = $("#requestBillLink");
    const callStaffLink = $("#callStaffLink");

    if (canAddMoreItems(safeOrder)) {
      visiblePrompts.add("Can I add more items?");
    }

    if (hasTableActions(safeOrder) && requestBillLink && !requestBillLink.hidden) {
      visiblePrompts.add("How do I request the bill?");
    }

    if (hasTableActions(safeOrder) && callStaffLink && !callStaffLink.hidden) {
      visiblePrompts.add("How do I call staff?");
    }

    return visiblePrompts;
  }

  function syncTrackingAssistantPromptVisibility(order = latestOrder) {
    const { prompts, promptHint } = getTrackingAssistantElements();
    if (!prompts) return;

    const visiblePrompts = getTrackingAssistantVisiblePromptSet(order);
    let shouldClearActivePrompt = false;

    prompts.querySelectorAll("[data-tracking-assistant-prompt]").forEach((button) => {
      const prompt = normalizeText(button.dataset.trackingAssistantPrompt, 120);
      const shouldShow = visiblePrompts.has(prompt);

      button.hidden = !shouldShow;

      if (!shouldShow && trackingAssistantActivePrompt === prompt) {
        shouldClearActivePrompt = true;
      }
    });

    if (shouldClearActivePrompt) {
      trackingAssistantActivePrompt = "";
      setTrackingAssistantLoading(trackingAssistantLoading);
    }

    if (promptHint) {
      const safeOrder = order && typeof order === "object" ? order : {};
      const showClosedPromptHint =
        isClosedTrackingStatus(safeOrder.status) && visiblePrompts.size <= 2;

      promptHint.hidden = !showClosedPromptHint;
      promptHint.textContent = showClosedPromptHint
        ? "This order is closed, so Smart Waiter now keeps only final status and bill-readiness questions."
        : "";
    }
  }

  function getTrackingAssistantSafeFollowUps(assistant = {}) {
    const followUpPrompts = Array.isArray(assistant.followUpPrompts)
      ? assistant.followUpPrompts
      : [];
    const visiblePrompts = getTrackingAssistantVisiblePromptSet();

    return followUpPrompts
      .map((prompt) => normalizeText(prompt, 120))
      .filter(
        (prompt) =>
          TRACKING_ASSISTANT_SAFE_PROMPTS.has(prompt) &&
          visiblePrompts.has(prompt) &&
          (!TRACKING_ASSISTANT_SUPPORT_PROMPTS.has(prompt) || visiblePrompts.has(prompt))
      )
      .slice(0, 3);
  }

  function getTrackingAssistantHelperActions(assistant = {}, order = latestOrder) {
    const helpers = [];
    const safeOrder = order && typeof order === "object" ? order : {};
    const mode = normalizeText(assistant?.meta?.mode, 80).toLowerCase();
    const viewBillLink = $("#trackingViewBillLink");
    const addMoreItemsLink = $("#addMoreItemsLink");
    const requestBillLink = $("#requestBillLink");
    const callStaffLink = $("#callStaffLink");

    if (
      mode === "tracking_bill_ready" &&
      canViewBill(safeOrder) &&
      viewBillLink &&
      !viewBillLink.hidden
    ) {
      helpers.push({
        type: "view_bill",
        label: "Open the real View Bill control"
      });
    }

    if (
      mode === "tracking_add_more" &&
      canAddMoreItems(safeOrder) &&
      addMoreItemsLink &&
      !addMoreItemsLink.hidden
    ) {
      helpers.push({
        type: "add_more_items",
        label: "Open the real Add More Items control"
      });
    }

    if (
      mode === "tracking_request_bill" &&
      requestBillLink &&
      !requestBillLink.hidden
    ) {
      helpers.push({
        type: "request_bill",
        label: "Open the real Request Bill control"
      });
    }

    if (
      mode === "tracking_call_staff" &&
      callStaffLink &&
      !callStaffLink.hidden
    ) {
      helpers.push({
        type: "call_staff",
        label: "Open the real Call Staff control"
      });
    }

    return helpers;
  }

  function getTrackingAssistantHelperTarget(helperType = "") {
    const normalizedType = normalizeText(helperType, 40).toLowerCase();
    return normalizedType === "view_bill"
      ? $("#trackingViewBillLink")
      : normalizedType === "add_more_items"
        ? $("#addMoreItemsLink")
        : normalizedType === "request_bill"
          ? $("#requestBillLink")
          : normalizedType === "call_staff"
            ? $("#callStaffLink")
            : null;
  }

  function getTrackingAssistantHelperUnavailableMessage(helperType = "") {
    const normalizedType = normalizeText(helperType, 40).toLowerCase();
    return normalizedType === "view_bill"
      ? "The View Bill control is not available right now."
      : normalizedType === "add_more_items"
        ? "The Add More Items control is not available right now."
        : normalizedType === "request_bill"
          ? "The Request Bill control is not available right now."
          : "The Call Staff control is not available right now.";
  }

  function getTrackingAssistantHelperReadyMessage(helperType = "") {
    const normalizedType = normalizeText(helperType, 40).toLowerCase();
    return normalizedType === "view_bill"
      ? "The real View Bill control is ready on this page."
      : normalizedType === "add_more_items"
        ? "The real Add More Items control is ready on this page."
        : normalizedType === "request_bill"
          ? "The real Request Bill control is ready on this page."
        : "The real Call Staff control is ready on this page.";
  }

  function getSmartWaiterActionBridge() {
    const bridge = window.SMART_WAITER_ACTION_BRIDGE;
    return bridge &&
      typeof bridge.getValidatedRequestConfirmationContract === "function"
      ? bridge
      : null;
  }

  function getTrackingAssistantValidatedRequestContract(helperType = "") {
    const normalizedType = normalizeText(helperType, 40).toLowerCase();

    if (normalizedType !== "request_bill" && normalizedType !== "call_staff") {
      return null;
    }

    return (
      getSmartWaiterActionBridge()?.getValidatedRequestConfirmationContract(
        normalizedType,
        {
          surface: "tracking_smart_waiter",
          sourceAction: normalizedType
        }
      ) || null
    );
  }

  function getTrackingAssistantHelperActionDefinition(helperType = "") {
    const normalizedType = normalizeText(helperType, 40).toLowerCase();
    return getTrackingAssistantHelperActionRegistry()[normalizedType] || null;
  }

  function getTrackingAssistantPreviewContract(helperActions = []) {
    return helperActions
      .map((helper) => getTrackingAssistantHelperActionDefinition(helper?.type))
      .map((definition) => definition?.futureValidatedRequestContract || null)
      .find(Boolean);
  }

  function getTrackingAssistantPreviewStatusMessage(previewContract = null) {
    const actionType = normalizeText(previewContract?.actionType, 40).toLowerCase();

    return actionType === "request_bill"
      ? "Preview only: Smart Waiter is showing how a future bill-request confirmation could look. It still will not send a bill request from here."
      : actionType === "call_staff"
        ? "Preview only: Smart Waiter is showing how a future call-staff confirmation could look. It still will not send a staff-help request from here."
        : TRACKING_ASSISTANT_REPLY_READY_MESSAGE;
  }

  function renderTrackingAssistantConfirmationPreview(helperActions = []) {
    const {
      preview,
      previewTitle,
      previewMessage,
      previewConfirm,
      previewCancel
    } = getTrackingAssistantElements();

    if (!preview || !previewTitle || !previewMessage || !previewConfirm || !previewCancel) {
      return;
    }

    const previewContract = getTrackingAssistantPreviewContract(helperActions);

    if (!previewContract) {
      preview.hidden = true;
      previewTitle.textContent = "";
      previewMessage.textContent = "";
      previewConfirm.textContent = "";
      previewCancel.textContent = "";
      return;
    }

    previewTitle.textContent = previewContract.confirmationTitle || "Future confirmation";
    previewMessage.textContent =
      previewContract.confirmationMessage ||
      "This future action should stay behind the normal validated tracking request flow.";
    previewConfirm.textContent = previewContract.confirmLabel || "Confirm";
    previewCancel.textContent = previewContract.cancelLabel || "Cancel";
    preview.hidden = false;

    return previewContract;
  }

  function scrollToTrackingAssistantHelperTarget(helperType = "") {
    const normalizedType = normalizeText(helperType, 40).toLowerCase();
    const target = getTrackingAssistantHelperTarget(normalizedType);

    if (!target || target.hidden) {
      setTrackingAssistantStatus(getTrackingAssistantHelperUnavailableMessage(normalizedType));
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    if (typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }

    setTrackingAssistantStatus(getTrackingAssistantHelperReadyMessage(normalizedType));
  }

  function getTrackingAssistantHelperActionRegistry() {
    return {
      view_bill: {
        safetyLevel: "navigation",
        run() {
          scrollToTrackingAssistantHelperTarget("view_bill");
        }
      },
      add_more_items: {
        safetyLevel: "navigation",
        run() {
          scrollToTrackingAssistantHelperTarget("add_more_items");
        }
      },
      request_bill: {
        safetyLevel: "navigation",
        futureValidatedRequestContract:
          getTrackingAssistantValidatedRequestContract("request_bill"),
        run() {
          scrollToTrackingAssistantHelperTarget("request_bill");
        }
      },
      call_staff: {
        safetyLevel: "navigation",
        futureValidatedRequestContract:
          getTrackingAssistantValidatedRequestContract("call_staff"),
        run() {
          scrollToTrackingAssistantHelperTarget("call_staff");
        }
      }
    };
  }

  function handleTrackingAssistantHelperAction(helperType = "") {
    const normalizedType = normalizeText(helperType, 40).toLowerCase();
    const actionDefinition = getTrackingAssistantHelperActionDefinition(normalizedType);

    if (!actionDefinition || typeof actionDefinition.run !== "function") {
      console.warn("Blocked unsupported tracking Smart Waiter helper action:", normalizedType);
      return;
    }

    actionDefinition.run();
  }

  function renderTrackingAssistantReply(assistant = {}) {
    const { reply, followUps, helpers, answer, disclaimer } = getTrackingAssistantElements();

    if (!reply || !followUps || !helpers || !answer || !disclaimer) return;

    latestTrackingAssistantReply =
      assistant && typeof assistant === "object"
        ? {
            answer: assistant.answer || "",
            disclaimer: assistant.disclaimer || "",
            meta: assistant.meta && typeof assistant.meta === "object"
              ? { ...assistant.meta }
              : {},
            followUpPrompts: Array.isArray(assistant.followUpPrompts)
              ? [...assistant.followUpPrompts]
              : []
          }
        : null;

    const safeFollowUps = getTrackingAssistantSafeFollowUps(assistant);
    const helperActions = getTrackingAssistantHelperActions(assistant);

    answer.textContent = assistant.answer || "I could not prepare a safe tracking reply just now.";
    disclaimer.textContent =
      assistant.disclaimer ||
      "This Smart Waiter card reads only this tracking page's token-scoped order state and does not change the order.";
    followUps.innerHTML = safeFollowUps
      .map(
        (prompt) => `
          <button
            type="button"
            class="tracking-smart-waiter__chip"
            data-tracking-assistant-prompt="${prompt.replace(/"/g, "&quot;")}"
          >
            ${prompt}
          </button>
        `
      )
      .join("");
    followUps.hidden = !safeFollowUps.length;
    helpers.innerHTML = helperActions
      .map(
        (helper) => `
          <button
            type="button"
            class="tracking-smart-waiter__helper-btn"
            data-tracking-assistant-helper="${helper.type}"
          >
            ${helper.label}
          </button>
        `
      )
      .join("");
    helpers.hidden = !helperActions.length;
    return renderTrackingAssistantConfirmationPreview(helperActions);
    reply.hidden = false;
  }

  function syncTrackingAssistantReplyState(order = latestOrder) {
    const { reply } = getTrackingAssistantElements();

    if (
      !reply ||
      reply.hidden ||
      !latestTrackingAssistantReply ||
      typeof latestTrackingAssistantReply !== "object"
    ) {
      return;
    }

    const safeFollowUps = getTrackingAssistantSafeFollowUps(latestTrackingAssistantReply);
    const helperActions = getTrackingAssistantHelperActions(latestTrackingAssistantReply, order);
    const { followUps, helpers } = getTrackingAssistantElements();

    if (followUps) {
      followUps.innerHTML = safeFollowUps
        .map(
          (prompt) => `
            <button
              type="button"
              class="tracking-smart-waiter__chip"
              data-tracking-assistant-prompt="${prompt.replace(/"/g, "&quot;")}"
            >
              ${prompt}
            </button>
          `
        )
        .join("");
      followUps.hidden = !safeFollowUps.length;
    }

    if (helpers) {
      helpers.innerHTML = helperActions
        .map(
          (helper) => `
            <button
              type="button"
              class="tracking-smart-waiter__helper-btn"
              data-tracking-assistant-helper="${helper.type}"
            >
              ${helper.label}
            </button>
          `
        )
        .join("");
      helpers.hidden = !helperActions.length;
    }

    renderTrackingAssistantConfirmationPreview(helperActions);
  }

  async function requestTrackingAssistantReply(message = "") {
    const prompt = normalizeText(message, 120);
    const context = buildTrackingAssistantRequestContext();
    const hotelSlug = normalizeText(context?.trackingHotelSlug, 120);

    if (!prompt || !context || !hotelSlug) {
      setTrackingAssistantStatus(
        "Smart Waiter could not verify the current tracking context. Please refresh the tracking page and try again."
      );
      clearTrackingAssistantReply();
      return;
    }

    try {
      setTrackingAssistantActivePrompt(prompt);
      setTrackingAssistantLoading(true);
      setTrackingAssistantStatus("Smart Waiter is checking this tracked order...", {
        loading: true
      });

      const response = await fetch(
        `${API_BASE}/public/assistant/menu/${encodeURIComponent(hotelSlug)}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: prompt,
            context
          })
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Smart Waiter could not read this tracked order.");
      }

      const previewContract = renderTrackingAssistantReply(payload.assistant || {});
      setTrackingAssistantStatus(
        previewContract
          ? getTrackingAssistantPreviewStatusMessage(previewContract)
          : TRACKING_ASSISTANT_REPLY_READY_MESSAGE
      );
    } catch (error) {
      console.error("Tracking Smart Waiter request failed:", error);
      clearTrackingAssistantReply();
      setTrackingAssistantStatus(
        error.message || "Smart Waiter could not read this tracked order right now."
      );
    } finally {
      setTrackingAssistantLoading(false);
      setTrackingAssistantActivePrompt("");
    }
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

    const isBillRequest = requestAction === "bill";
    const actionLabel = isBillRequest ? "Bill request" : "Staff help request";
    const url = `${API_BASE}/order-tracking/${encodeURIComponent(context.hotelSlug)}/${encodeURIComponent(context.orderId)}/support-requests`;
    const body = JSON.stringify({
      token: context.token,
      action: requestAction
    });

    setTableSupportStatus(
      isBillRequest
        ? "Sending your bill request. WhatsApp is also available as backup."
        : "Sending your staff request. WhatsApp is also available as backup.",
      "info"
    );

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
        setTableSupportStatus(
          isBillRequest
            ? "We could not save your bill request to the dashboard. WhatsApp opened as backup so staff can still receive it there."
            : "We could not save your staff request to the dashboard. WhatsApp opened as backup so staff can still receive it there.",
          "warning"
        );
        return;
      }

      if (payload.saved === false) {
        setTableSupportStatus(
          isBillRequest
            ? "Your bill request was not stored in the dashboard yet. WhatsApp is available as backup so staff can still receive it there."
            : "Your staff request was not stored in the dashboard yet. WhatsApp is available as backup so staff can still receive it there.",
          "warning"
        );
        return;
      }

      setTableSupportStatus(
        isBillRequest
          ? "Your bill request has been sent. Please wait for owner/staff confirmation."
          : "Your staff request has been sent. Please wait for owner/staff confirmation.",
        "success"
      );
    }).catch((error) => {
      console.warn("Table support request save skipped:", error.message);
      setTableSupportStatus(
        isBillRequest
          ? "We could not complete your bill request in the dashboard. WhatsApp opened as backup so staff can still receive it there."
          : "We could not complete your staff request in the dashboard. WhatsApp opened as backup so staff can still receive it there.",
        "warning"
      );
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

  function canViewBill(order = {}) {
    const billNumber = normalizeText(order.billNumber, 120);
    const billingStatus = normalizeText(order.billingStatus, 60).toLowerCase();
    const paymentStatus = normalizeText(order.paymentStatus, 60).toLowerCase();

    return (
      Boolean(billNumber) ||
      ["billed", "closed"].includes(billingStatus) ||
      paymentStatus === "paid"
    );
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
    const title = $("#trackingTableActionsTitle");
    const description = $("#trackingTableActionsDescription");
    const billReady = canViewBill(order);

    if (!hasTableActions(order)) {
      section.hidden = true;
      setTableSupportStatus("");
      return;
    }

    if (title) {
      title.textContent = billReady
        ? "Your bill is ready"
        : "Need anything at your table?";
    }

    if (description) {
      description.textContent = billReady
        ? "You can review the bill above. If you still need help at your table, call staff here and they can assist you."
        : "These actions use the same hotel WhatsApp flow, so staff can receive your table and order details quickly.";
    }

    if (requestBillLink) {
      requestBillLink.href = actions.requestBillWhatsappLink || "#";
      requestBillLink.hidden = billReady || !actions.requestBillWhatsappLink;
    }

    if (callStaffLink) {
      callStaffLink.href = actions.callStaffWhatsappLink || "#";
      callStaffLink.hidden = !actions.callStaffWhatsappLink;
    }

    if (billReady) {
      setTableSupportStatus(
        "Your bill is now available above. Please review it and wait for owner/staff confirmation if any final payment step is still pending.",
        "success"
      );
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

  function renderBillItems(container, items = []) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(items) || !items.length) {
      const empty = document.createElement("p");
      empty.className = "tracking-empty";
      empty.textContent = "No bill items are available yet.";
      container.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      const detail = document.createElement("div");
      const name = document.createElement("strong");
      const qty = document.createElement("span");
      const amount = document.createElement("strong");

      row.className = "tracking-bill-item";
      detail.className = "tracking-bill-item__detail";
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

  function renderBillAddOns(addOns = []) {
    const section = $("#trackingBillAddons");
    const list = $("#trackingBillAddonsList");
    if (!section || !list) return;

    list.innerHTML = "";

    if (!Array.isArray(addOns) || !addOns.length) {
      section.hidden = true;
      return;
    }

    addOns.forEach((addOn) => {
      const card = document.createElement("article");
      const head = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      const itemsWrap = document.createElement("div");
      const total = document.createElement("p");

      card.className = "tracking-bill-addon-card";
      head.className = "tracking-bill-addon-card__head";
      title.textContent = addOn.orderSequenceLabel || `Add-on Order #${addOn.id || ""}`;
      meta.textContent = `${getStatusLabel(addOn.status)} - ${formatDateTime(addOn.createdAt)}`;
      itemsWrap.className = "tracking-bill-addon-card__items";
      total.className = "tracking-bill-addon-card__total";
      total.textContent = `Add-on total: ${formatMoney(getTotalValue(addOn.totals || {}))}`;

      head.appendChild(title);
      head.appendChild(meta);
      renderBillItems(itemsWrap, addOn.items);
      card.appendChild(head);
      card.appendChild(itemsWrap);
      card.appendChild(total);
      list.appendChild(card);
    });

    section.hidden = false;
  }

  function renderBillView(order = {}) {
    const section = $("#trackingBillView");
    const link = $("#trackingViewBillLink");
    const billNumberRow = $("#trackingBillNumberRow");
    const billNumberPill = $("#trackingBillNumberPill");
    const billNumber = normalizeText(order.billNumber, 120);
    const addOns = getOrderAddOns(order);
    const totals = order.totals || {};
    const isVisible = canViewBill(order);

    if (!section || !link) return;

    if (!isVisible) {
      section.hidden = true;
      link.hidden = true;
      if (billNumberPill) {
        billNumberPill.hidden = true;
        billNumberPill.textContent = "Bill";
      }
      if (billNumberRow) {
        billNumberRow.hidden = true;
      }
      renderBillAddOns([]);
      return;
    }

    const billIntro = billNumber
      ? `Bill ${billNumber} is now ready to review for this order.`
      : "Your hotel has marked this order billed or paid. You can review the bill details below.";

    setText("#trackingBillIntro", billIntro);
    setText("#trackingBillOrderId", order.id ? `#${order.id}` : "-");
    setText("#trackingBillSource", getSourceLabel(order));
    setText("#trackingBillCreatedAt", formatDateTime(order.createdAt));
    setText("#trackingBillPaymentStatus", order.paymentStatus || order.paymentMethod || "-");
    setText("#trackingBillBillingStatus", order.billingStatus || "-");
    setText("#trackingBillSubtotal", formatMoney(totals.subtotal));
    setText("#trackingBillGst", formatMoney(totals.gst));
    setText("#trackingBillTotal", formatMoney(getTotalValue(totals)));
    setText("#trackingBillNumberValue", billNumber || "-");
    setText("#trackingBillPaymentLabel", order.paymentStatus || order.paymentMethod || "-");
    setText("#trackingBillBillingLabel", order.billingStatus || "-");

    const combinedTotalRow = $("#trackingBillCombinedTotalRow");
    const combinedTotalValue = $("#trackingBillCombinedTotal");
    const combinedPaymentRow = $("#trackingBillCombinedPaymentRow");
    const combinedPaymentValue = $("#trackingBillCombinedPayment");
    const combinedBillingRow = $("#trackingBillCombinedBillingRow");
    const combinedBillingValue = $("#trackingBillCombinedBilling");

    if (billNumberRow) {
      billNumberRow.hidden = !billNumber;
    }

    if (billNumberPill) {
      billNumberPill.hidden = !billNumber;
      billNumberPill.textContent = billNumber ? `Bill ${billNumber}` : "Bill";
    }

    if (combinedTotalRow && combinedTotalValue) {
      combinedTotalRow.hidden = !addOns.length;
      combinedTotalValue.textContent = formatMoney(getOrderCombinedTotal(order));
    }

    if (combinedPaymentRow && combinedPaymentValue && combinedBillingRow && combinedBillingValue) {
      combinedPaymentRow.hidden = !addOns.length;
      combinedBillingRow.hidden = !addOns.length;
      combinedPaymentValue.textContent = addOns.length ? getCombinedPaymentLabel(order) : "-";
      combinedBillingValue.textContent = addOns.length ? getCombinedBillingLabel(order) : "-";
    }

    renderBillItems($("#trackingBillItems"), order.items);
    renderBillAddOns(addOns);
    link.hidden = false;
    section.hidden = false;
  }

  function renderOrder(order = {}) {
    latestOrder = order;
    syncSmartWaiterTrackingContext(order);

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
    renderBillView(order);
    updateStatusBadge(order);
    updateTimeline(order);
    updateBackToMenuLink(order);
    updateAddMoreItemsLink(order);
    updateTableActions(order);
    syncTrackingAssistantAvailability(order);
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
      clearSmartWaiterTrackingContext();
      hideTrackingAssistant();
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
    const trackingAssistantSection = $("#trackingSmartWaiter");

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

    if (trackingAssistantSection) {
      trackingAssistantSection.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tracking-assistant-prompt]");
        if (button && !trackingAssistantLoading) {
          void requestTrackingAssistantReply(button.dataset.trackingAssistantPrompt || "");
          return;
        }

        const helperButton = event.target.closest("[data-tracking-assistant-helper]");
        if (!helperButton || trackingAssistantLoading) {
          return;
        }

        handleTrackingAssistantHelperAction(
          helperButton.dataset.trackingAssistantHelper || ""
        );
      });
    }

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
