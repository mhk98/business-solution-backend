const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const ApiGatewaySetting = db.apiGatewaySetting;
const VALID_GATEWAY_TYPES = new Set(["sms", "email"]);

const parseConfig = (config = {}) => {
  if (!config) return {};
  if (typeof config === "object" && !Array.isArray(config)) return config;

  try {
    const parsed = JSON.parse(config);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
};

const pickAllowedConfig = (gatewayType, config = {}) => {
  const parsedConfig = parseConfig(config);
  if (!parsedConfig || typeof parsedConfig !== "object" || Array.isArray(parsedConfig)) {
    return {};
  }

  if (gatewayType === "email") {
    return {
      smtpHost: parsedConfig.smtpHost || "",
      smtpPort: parsedConfig.smtpPort || "",
      smtpSecure: Boolean(parsedConfig.smtpSecure),
      smtpUser: parsedConfig.smtpUser || "",
      smtpPass: parsedConfig.smtpPass || "",
      fromEmail: parsedConfig.fromEmail || "",
      fromName: parsedConfig.fromName || "",
      supportEmail: parsedConfig.supportEmail || "",
      brandName: parsedConfig.brandName || "",
    };
  }

  return {
    apiUrl: parsedConfig.apiUrl || "",
    method: String(parsedConfig.method || "POST").toUpperCase(),
    apiKey: parsedConfig.apiKey || "",
    apiKeyField: parsedConfig.apiKeyField || "api_key",
    smsType: parsedConfig.smsType || "text",
    typeField: parsedConfig.typeField || "type",
    headers: parsedConfig.headers || "",
    bodyTemplate: parsedConfig.bodyTemplate || "",
    queryTemplate: parsedConfig.queryTemplate || "",
    toField: parsedConfig.toField || "to",
    messageField: parsedConfig.messageField || "message",
    senderId: parsedConfig.senderId || "",
    senderField: parsedConfig.senderField || "",
    timeoutMs: parsedConfig.timeoutMs || 10000,
  };
};

const validateGatewayType = (gatewayType) => {
  const type = String(gatewayType || "").toLowerCase();
  if (!VALID_GATEWAY_TYPES.has(type)) {
    throw new ApiError(400, "Invalid gateway type");
  }
  return type;
};

const maskSensitiveConfig = (setting) => {
  if (!setting) return null;

  const plain = setting.toJSON ? setting.toJSON() : setting;
  const config = { ...parseConfig(plain.config) };

  if (config.smtpPass) config.smtpPass = "********";
  if (config.headers) config.headers = "********";
  if (config.apiKey) config.apiKey = "********";

  return {
    ...plain,
    config,
  };
};

const getGatewaySetting = async (gatewayType, { masked = true } = {}) => {
  const type = validateGatewayType(gatewayType);
  const setting = await ApiGatewaySetting.findOne({
    where: { gatewayType: type },
  });

  if (!masked) return setting;
  return maskSensitiveConfig(setting);
};

const getGatewaySettings = async () => {
  const settings = await ApiGatewaySetting.findAll({
    order: [["gatewayType", "ASC"]],
  });
  return settings.map(maskSensitiveConfig);
};

const upsertGatewaySetting = async (gatewayType, payload = {}, actor = {}) => {
  const type = validateGatewayType(gatewayType);
  const existing = await ApiGatewaySetting.findOne({
    where: { gatewayType: type },
  });

  const incomingConfig = pickAllowedConfig(type, payload.config || payload);
  const existingConfig = parseConfig(existing?.config);
  const config = { ...existingConfig, ...incomingConfig };

  Object.entries(incomingConfig).forEach(([key, value]) => {
    if (value === "********") {
      config[key] = existingConfig[key] || "";
    }
  });

  const data = {
    gatewayType: type,
    isEnabled:
      typeof payload.isEnabled === "boolean"
        ? payload.isEnabled
        : existing?.isEnabled ?? true,
    config,
    updatedBy: actor?.Id || null,
  };

  await ApiGatewaySetting.upsert({
    ...data,
    createdBy: existing?.createdBy || actor?.Id || null,
  });

  const setting = await ApiGatewaySetting.findOne({
    where: { gatewayType: type },
  });

  return maskSensitiveConfig(setting);
};

module.exports = {
  getGatewaySetting,
  getGatewaySettings,
  upsertGatewaySetting,
};
