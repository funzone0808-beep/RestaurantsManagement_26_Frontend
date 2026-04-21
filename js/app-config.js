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

  // 🔥 YOUR RAILWAY BACKEND URL
  const productionBackendUrl =
    "https://my-projectbackendpaymentgateway-production.up.railway.app";

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

  // ✅ FINAL BACKEND URL LOGIC
  const backendBaseUrl = cleanUrl(
    existingConfig.BACKEND_BASE_URL,
    isLocalHost ? localBackendUrl : productionBackendUrl
  );

  window.APP_RUNTIME_CONFIG = {
    // ✅ API BASE URL (AUTO BUILT)
    API_BASE_URL: cleanUrl(
      existingConfig.API_BASE_URL,
      `${backendBaseUrl}/api`
    ),

    BACKEND_BASE_URL: backendBaseUrl,

    DEFAULT_HOTEL_SLUG: cleanText(
      existingConfig.DEFAULT_HOTEL_SLUG
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