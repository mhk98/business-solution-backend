const axios = require("axios");

const getSmsGatewayConfig = async () => {
  try {
    const db = require("../../models");
    const setting = await db.apiGatewaySetting?.findOne({
      where: { gatewayType: "sms" },
    });
    if (setting && !setting.isEnabled) return { disabled: true };
    return setting.config || null;
  } catch (error) {
    return null;
  }
};

const replacePlaceholders = (value, replacements) => {
  if (typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (_, key) => replacements[key] || "");
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      acc[key] = replacePlaceholders(item, replacements);
      return acc;
    }, {});
  }

  return value;
};

const parseJsonValue = (value, fallback = null, label = "JSON value") => {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Invalid ${label}:`, error?.message || error);
    return fallback;
  }
};

const parseJsonEnv = (envName, fallback = null) => {
  const rawValue = process.env[envName];
  return parseJsonValue(rawValue, fallback, `${envName} JSON`);
};

const buildPayload = ({ to, message, config = {} }) => {
  const replacements = {
    to,
    phone: to,
    mobile: to,
    message,
    encodedMessage: encodeURIComponent(message),
  };

  const bodyTemplate =
    parseJsonValue(config.bodyTemplate, null, "SMS body template") ||
    parseJsonEnv("SMS_API_BODY_TEMPLATE");
  if (bodyTemplate) return replacePlaceholders(bodyTemplate, replacements);

  const toField = config.toField || process.env.SMS_API_TO_FIELD || "to";
  const messageField =
    config.messageField || process.env.SMS_API_MESSAGE_FIELD || "message";

  return {
    [toField]: to,
    [messageField]: message,
  };
};

const buildQuery = ({ to, message, config = {} }) => {
  const queryTemplate =
    parseJsonValue(config.queryTemplate, null, "SMS query template") ||
    parseJsonEnv("SMS_API_QUERY_TEMPLATE");
  if (!queryTemplate) return null;

  return replacePlaceholders(queryTemplate, {
    to,
    phone: to,
    mobile: to,
    message,
    encodedMessage: encodeURIComponent(message),
  });
};

const sendSms = async ({ to, message }) => {
  const gatewayConfig = await getSmsGatewayConfig();
  if (gatewayConfig?.disabled) return null;
  const apiUrl = gatewayConfig?.apiUrl || process.env.SMS_API_URL;
  if (!apiUrl) {
    console.warn("SMS skipped: SMS_API_URL is not configured.");
    return null;
  }

  const phone = String(to || "").trim();
  const smsMessage = String(message || "").trim();
  if (!phone || !smsMessage) return null;

  const method = String(
    gatewayConfig?.method || process.env.SMS_API_METHOD || "POST",
  ).toUpperCase();
  const headers =
    parseJsonValue(gatewayConfig?.headers, null, "SMS headers") ||
    parseJsonEnv("SMS_API_HEADERS", {});
  const query = buildQuery({ to: phone, message: smsMessage, config: gatewayConfig });
  const payload = buildPayload({ to: phone, message: smsMessage, config: gatewayConfig });

  return axios({
    url: apiUrl,
    method,
    headers,
    params: query || (method === "GET" ? payload : undefined),
    data: method === "GET" ? undefined : payload,
    timeout: Number(gatewayConfig?.timeoutMs || process.env.SMS_API_TIMEOUT_MS || 10000),
  });
};

module.exports = sendSms;
