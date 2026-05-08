"use strict";

(function configureRuntime() {
  const existingConfig = window.APP_RUNTIME_CONFIG || {};
  const hostname = window.location.hostname;

  const isLocalHost =
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");

  const localBackendUrl = "http://localhost:5000";
  const invalidRuntimeConfigBasePath = "/__missing-runtime-config__";

  function getMetaConfigElement(name) {
    return typeof document !== "undefined"
      ? document.querySelector(`meta[name="${name}"]`)
      : null;
  }

  function hasMetaConfigTag(name) {
    return Boolean(getMetaConfigElement(name));
  }

  function getMetaConfig(name) {
    const element = getMetaConfigElement(name);
    const content = element?.getAttribute("content");

    return typeof content === "string" && content.trim() ? content.trim() : "";
  }

  function cleanUrl(value, fallback) {
    const url =
      typeof value === "string" && value.trim()
        ? value.trim()
        : fallback;
    return url.replace(/\/+$/, "");
  }

  function cleanText(value, fallback = "") {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : fallback;
  }

  function cleanBoolean(value, fallback = false) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();

      if (normalizedValue === "true") {
        return true;
      }

      if (normalizedValue === "false") {
        return false;
      }
    }

    return fallback;
  }

  function deriveBackendBaseUrl(apiBaseUrl = "") {
    const normalizedUrl = cleanText(apiBaseUrl);

    if (!normalizedUrl) {
      return "";
    }

    return normalizedUrl.replace(/\/api\/?$/i, "");
  }

  const metaBackendBaseUrl = getMetaConfig("app-backend-base-url");
  const metaApiBaseUrl = getMetaConfig("app-api-base-url");
  const metaContactSheetUrl = getMetaConfig("app-contact-sheet-url");
  const metaAllowOrderWhatsAppFallbackOnSaveFailure = getMetaConfig(
    "app-allow-order-whatsapp-fallback-on-save-failure"
  );
  const metaOpenWhatsAppAfterVerifiedOnlinePayment = getMetaConfig(
    "app-open-whatsapp-after-verified-online-payment"
  );
  const hasBackendMetaTag = hasMetaConfigTag("app-backend-base-url");
  const hasApiMetaTag = hasMetaConfigTag("app-api-base-url");
  const hasContactSheetMetaTag = hasMetaConfigTag("app-contact-sheet-url");
  const hasOrderFallbackMetaTag = hasMetaConfigTag(
    "app-allow-order-whatsapp-fallback-on-save-failure"
  );
  const hasVerifiedPaymentWhatsAppMetaTag = hasMetaConfigTag(
    "app-open-whatsapp-after-verified-online-payment"
  );
  const configuredApiBaseUrl = cleanText(
    existingConfig.API_BASE_URL || metaApiBaseUrl
  );
  const configuredBackendBaseUrl = cleanText(
    existingConfig.BACKEND_BASE_URL ||
      metaBackendBaseUrl ||
      deriveBackendBaseUrl(configuredApiBaseUrl)
  );
  const hasExplicitBackendBaseUrl = Boolean(configuredBackendBaseUrl);
  const hasExplicitApiBaseUrl = Boolean(configuredApiBaseUrl);
  const hasExplicitRuntimeConfig =
    hasExplicitBackendBaseUrl || hasExplicitApiBaseUrl;
  const hasRuntimeMetaWiring = hasBackendMetaTag && hasApiMetaTag;
  const requiresExplicitRuntimeConfig = !isLocalHost;
  const hasMissingExplicitRuntimeConfig =
    requiresExplicitRuntimeConfig && !hasExplicitRuntimeConfig;
  const runtimeConfigDiagnostics = {
    hasBackendMetaTag,
    hasApiMetaTag,
    hasContactSheetMetaTag,
    hasOrderFallbackMetaTag,
    hasVerifiedPaymentWhatsAppMetaTag,
    hasRuntimeMetaWiring,
    hasExplicitBackendBaseUrl,
    hasExplicitApiBaseUrl,
    hasExplicitRuntimeConfig,
    requiresExplicitRuntimeConfig,
    hasMissingExplicitRuntimeConfig
  };

  const backendBaseUrl = hasMissingExplicitRuntimeConfig
    ? invalidRuntimeConfigBasePath
    : cleanUrl(configuredBackendBaseUrl, localBackendUrl);
  const apiBaseUrl = hasMissingExplicitRuntimeConfig
    ? `${invalidRuntimeConfigBasePath}/api`
    : cleanUrl(configuredApiBaseUrl, `${backendBaseUrl}/api`);

  if (hasMissingExplicitRuntimeConfig && typeof console !== "undefined") {
    console.error(
      "[app-config] Missing explicit runtime config on a non-local page. Configure <meta name=\"app-backend-base-url\"> and <meta name=\"app-api-base-url\"> or stamp them with the frontend runtime prepare script before sharing this page."
    );
  }

  if (!hasRuntimeMetaWiring && typeof console !== "undefined") {
    console.warn(
      "[app-config] Runtime config meta wiring is incomplete on this page. Add both <meta name=\"app-backend-base-url\"> and <meta name=\"app-api-base-url\"> to keep deployment wiring explicit."
    );
  }

  window.APP_RUNTIME_CONFIG = {
    API_BASE_URL: apiBaseUrl,
    BACKEND_BASE_URL: backendBaseUrl,
    RUNTIME_CONFIG_INVALID: hasMissingExplicitRuntimeConfig,
    RUNTIME_CONFIG_DIAGNOSTICS: runtimeConfigDiagnostics,
    RUNTIME_CONFIG_ERROR: hasMissingExplicitRuntimeConfig
      ? "missing-explicit-runtime-config"
      : "",
    RUNTIME_CONFIG_SOURCE: cleanText(
      existingConfig.RUNTIME_CONFIG_SOURCE,
      configuredApiBaseUrl || configuredBackendBaseUrl
        ? "explicit-runtime-config"
        : isLocalHost
          ? "localhost-default"
          : hasMissingExplicitRuntimeConfig
            ? "missing-explicit-runtime-config"
            : "derived-default"
    ),

    DEFAULT_HOTEL_SLUG: cleanText(
      existingConfig.DEFAULT_HOTEL_SLUG
    ),

    CONTACT_SHEET_URL: cleanText(
      existingConfig.CONTACT_SHEET_URL || metaContactSheetUrl
    ),

    ALLOW_ORDER_WHATSAPP_FALLBACK_ON_SAVE_FAILURE: cleanBoolean(
      existingConfig.ALLOW_ORDER_WHATSAPP_FALLBACK_ON_SAVE_FAILURE,
      cleanBoolean(metaAllowOrderWhatsAppFallbackOnSaveFailure, true)
    ),

    OPEN_WHATSAPP_AFTER_VERIFIED_ONLINE_PAYMENT: cleanBoolean(
      existingConfig.OPEN_WHATSAPP_AFTER_VERIFIED_ONLINE_PAYMENT,
      cleanBoolean(metaOpenWhatsAppAfterVerifiedOnlinePayment, false)
    ),

    PAYMENT_GATEWAY_ENABLED:
      typeof existingConfig.PAYMENT_GATEWAY_ENABLED === "boolean"
        ? existingConfig.PAYMENT_GATEWAY_ENABLED
        : true,

    PAYMENT_GATEWAY_PROVIDER:
      existingConfig.PAYMENT_GATEWAY_PROVIDER || "razorpay",

    PAYMENT_GATEWAY_CHECKOUT_ENABLED:
      typeof existingConfig.PAYMENT_GATEWAY_CHECKOUT_ENABLED === "boolean"
        ? existingConfig.PAYMENT_GATEWAY_CHECKOUT_ENABLED
        : true,

    PAYMENT_GATEWAY_SCRIPT_URL:
      existingConfig.PAYMENT_GATEWAY_SCRIPT_URL ||
      "https://checkout.razorpay.com/v1/checkout.js"
  };
})();
