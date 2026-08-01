const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const ApiGatewaySetting = db.apiGatewaySetting;
const VALID_GATEWAY_TYPES = new Set(["sms", "email"]);

const pickAllowedConfig = (gatewayType, config = {}) => {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  if (gatewayType === "email") {
    return {
      smtpHost: config.smtpHost || "",
      smtpPort: config.smtpPort || "",
      smtpSecure: Boolean(config.smtpSecure),
      smtpUser: config.smtpUser || "",
      smtpPass: config.smtpPass || "",
      fromEmail: config.fromEmail || "",
      fromName: config.fromName || "",
      supportEmail: config.supportEmail || "",
      brandName: config.brandName || "",
    };
  }

  return {
    apiUrl: config.apiUrl || "",
    method: String(config.method || "POST").toUpperCase(),
    headers: config.headers || "",
    bodyTemplate: config.bodyTemplate || "",
    queryTemplate: config.queryTemplate || "",
    toField: config.toField || "to",
    messageField: config.messageField || "message",
    timeoutMs: config.timeoutMs || 10000,
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
  const config = { ...(plain.config || {}) };

  if (config.smtpPass) config.smtpPass = "********";
  if (config.headers) config.headers = "********";

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
  const existingConfig = existing?.config || {};
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
