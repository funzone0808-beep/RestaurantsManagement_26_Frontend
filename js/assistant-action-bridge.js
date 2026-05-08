"use strict";

(function initSmartWaiterActionBridge(globalScope) {
  const DEFAULT_SURFACE = "smart_waiter";
  const VALIDATED_REQUEST_CONTRACTS = Object.freeze({
    request_bill: Object.freeze({
      actionType: "request_bill",
      actionFamily: "table_support",
      executionKind: "validated_request",
      executionMode: "deferred",
      hotelScoped: true,
      tokenScoped: true,
      confirmationRequired: true,
      confirmationTitle: "Send a bill request for this table?",
      confirmationMessage:
        "This should stay behind the existing token-scoped tracking flow and should only send the normal validated bill request after the guest confirms it.",
      confirmLabel: "Send bill request",
      cancelLabel: "Not now",
      allowedPageScopes: Object.freeze(["order_tracking"]),
      requiredContextKeys: Object.freeze([
        "trackingHotelSlug",
        "trackingOrderId",
        "trackingToken"
      ]),
      backendRouteKey: "tracking_support_requests",
      backendIntent: "bill",
      fallbackHelperAction: "request_bill"
    }),
    call_staff: Object.freeze({
      actionType: "call_staff",
      actionFamily: "table_support",
      executionKind: "validated_request",
      executionMode: "deferred",
      hotelScoped: true,
      tokenScoped: true,
      confirmationRequired: true,
      confirmationTitle: "Call staff to this table now?",
      confirmationMessage:
        "This should stay behind the existing token-scoped tracking flow and should only send the normal validated staff-help request after the guest confirms it.",
      confirmLabel: "Call staff",
      cancelLabel: "Not now",
      allowedPageScopes: Object.freeze(["order_tracking"]),
      requiredContextKeys: Object.freeze([
        "trackingHotelSlug",
        "trackingOrderId",
        "trackingToken"
      ]),
      backendRouteKey: "tracking_support_requests",
      backendIntent: "help",
      fallbackHelperAction: "call_staff"
    })
  });

  function normalizeText(value = "", maxLength = 120) {
    return String(value || "")
      .trim()
      .slice(0, maxLength);
  }

  function cloneList(values = []) {
    return Array.isArray(values) ? [...values] : [];
  }

  function buildValidatedRequestContract(actionType = "", overrides = {}) {
    const normalizedType = normalizeText(actionType, 40).toLowerCase();
    const template = VALIDATED_REQUEST_CONTRACTS[normalizedType];

    if (!template) {
      return null;
    }

    const safeOverrides = overrides && typeof overrides === "object" ? overrides : {};
    const surface = normalizeText(safeOverrides.surface, 80) || DEFAULT_SURFACE;
    const sourceAction =
      normalizeText(safeOverrides.sourceAction, 40).toLowerCase() || normalizedType;

    return {
      actionType: template.actionType,
      actionFamily: template.actionFamily,
      executionKind: template.executionKind,
      executionMode: template.executionMode,
      hotelScoped: template.hotelScoped,
      tokenScoped: template.tokenScoped,
      confirmationRequired: template.confirmationRequired,
      confirmationTitle: template.confirmationTitle,
      confirmationMessage: template.confirmationMessage,
      confirmLabel: template.confirmLabel,
      cancelLabel: template.cancelLabel,
      allowedPageScopes: cloneList(template.allowedPageScopes),
      requiredContextKeys: cloneList(template.requiredContextKeys),
      backendRouteKey: template.backendRouteKey,
      backendIntent: template.backendIntent,
      fallbackHelperAction: template.fallbackHelperAction,
      surface,
      sourceAction
    };
  }

  const bridgeApi = Object.freeze({
    isValidatedRequestAction(actionType = "") {
      const normalizedType = normalizeText(actionType, 40).toLowerCase();
      return Boolean(VALIDATED_REQUEST_CONTRACTS[normalizedType]);
    },
    listValidatedRequestActionTypes() {
      return Object.keys(VALIDATED_REQUEST_CONTRACTS);
    },
    getValidatedRequestConfirmationContract(actionType = "", overrides = {}) {
      return buildValidatedRequestContract(actionType, overrides);
    }
  });

  globalScope.SMART_WAITER_ACTION_BRIDGE = bridgeApi;
})(window);
