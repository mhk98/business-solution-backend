const nodemailer = require("nodemailer");
const path = require("path");

const getEmailGatewayConfig = async () => {
  try {
    const db = require("../../models");
    const setting = await db.apiGatewaySetting?.findOne({
      where: { gatewayType: "email" },
    });
    if (setting && !setting.isEnabled) return { disabled: true };
    return setting.config || null;
  } catch (error) {
    return null;
  }
};

const sendEmail = async ({ to, subject, htmlContent, filePath = null }) => {
  sendEmail.lastError = null;

  const gatewayConfig = await getEmailGatewayConfig();
  if (gatewayConfig?.disabled) return false;
  const smtpPort = Number(gatewayConfig?.smtpPort || process.env.SMTP_PORT || 465);
  const smtpSecure =
    String(gatewayConfig?.smtpSecure ?? process.env.SMTP_SECURE ?? "true").toLowerCase() === "true";
  const smtpUser =
    gatewayConfig?.smtpUser || process.env.SMTP_USER || "info@hadiyaworld.com";
  const smtpPass = gatewayConfig?.smtpPass || process.env.SMTP_PASS;
  const fromEmail = gatewayConfig?.fromEmail || process.env.MAIL_FROM_EMAIL || smtpUser;
  const fromName =
    gatewayConfig?.fromName ||
    gatewayConfig?.brandName ||
    process.env.MAIL_FROM_NAME ||
    "Business Solution";

  if (!smtpPass) {
    const message = "SMTP_PASS is not configured.";
    sendEmail.lastError = { message };
    console.error("❌ Email error:", message);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: gatewayConfig?.smtpHost || process.env.SMTP_HOST || "smtp.hostinger.com",
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: to,
    subject: subject,
    html: htmlContent,
    attachments: filePath
      ? [{ filename: path.basename(filePath), path: filePath }]
      : [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (info.accepted.length > 0) {
      console.log("✅ Email successfully sent to:", info.accepted.join(", "));
      return true;
    } else {
      const message = "SMTP server did not accept any recipients.";
      sendEmail.lastError = { message };
      console.log("❌ Email sending failed:", message);
      return false;
    }
  } catch (error) {
    const isRateLimited =
      error?.responseCode === 451 ||
      String(error?.response || error?.message || "")
        .toLowerCase()
        .includes("ratelimit");

    if (isRateLimited) {
      const message =
        "SMTP rate limit exceeded. Try again later or increase provider limit.";
      sendEmail.lastError = {
        message,
        code: error?.code,
        responseCode: error?.responseCode,
      };
      console.warn(
        `⚠️ Email not sent to ${to}: SMTP rate limit exceeded. Try again later or increase provider limit.`,
      );
    } else {
      sendEmail.lastError = {
        message: error?.message || "Unknown SMTP error",
        code: error?.code,
        responseCode: error?.responseCode,
      };
      console.error("❌ Email error:", error?.message || error);
    }
    return false;
  }
};

module.exports = sendEmail;
