// Profit & Loss invoice email (Daily P&L By Product / By User, Intransit P&L).
// Built to read on a phone without media queries — many mail apps (Gmail's
// included) ignore them: no fixed-width tables, wide data is shown as stacked
// cards, and the header blocks wrap under each other on narrow screens.
const esc = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtCurrency = (value) => {
  const n = Number(value) || 0;
  return (
    "৳" +
    n.toLocaleString("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

const fmtNum = (value) => (Number(value) || 0).toLocaleString();

const moneyColor = (value) => ((Number(value) || 0) >= 0 ? "#059669" : "#dc2626");

const sectionTitle = (title) =>
  `<h3 style="margin:22px 0 10px;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">${esc(title)}</h3>`;

// One "label ……… value" line; stays a single row at any width.
const summaryRow = (label, value, { strong = false, color = "#0f172a", shaded = false } = {}) => `
        <tr${shaded ? ' style="background:#f8fafc;"' : ""}>
          <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;${strong ? "font-weight:700;color:#0f172a;" : ""}">${esc(label)}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;font-weight:700;font-size:${strong ? "15px" : "13px"};color:${color};">${esc(value)}</td>
        </tr>`;

// A small "label / value" block that wraps onto the next line when space runs out.
const chip = (label, value, color = "#0f172a") =>
  `<span style="display:inline-block;margin:4px 6px 0 0;padding:5px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;line-height:1.3;color:#64748b;">${esc(label)}<br /><strong style="font-size:12.5px;color:${color};">${esc(value)}</strong></span>`;

const card = (inner) =>
  `<div style="margin:0 0 8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;">${inner}</div>`;

const profitLossInvoiceTemplate = ({
  companyName = process.env.MAIL_BRAND_NAME || "Business Solution",
  reportTitle = "Profit & Loss Invoice",
  reportDate = "",
  invoiceNumber = "",
  salesType = "",
  selectedProducts = [],
  employeeReports = [],
  calculationSummary = {},
  supportEmail = process.env.MAIL_SUPPORT_EMAIL || process.env.MAIL_FROM_EMAIL || "",
}) => {
  const {
    totalCost = 0,
    totalRevenue = 0,
    revenue = 0,
    grossProfit = 0,
    marketingCost = 0,
    otherCost = 0,
    incentiveType = "flat",
    incentiveValue = 0,
    incentiveAmount = 0,
    returnRate = 0,
    returnDeduction = 0,
    finalProfit = 0,
    totalOrder,
  } = calculationSummary;

  // ── Calculation summary ──────────────────────────────────────────────────
  const effectiveTotalRevenue = Number(totalRevenue) || Number(revenue) || 0;
  const breakdownSection = `
      ${sectionTitle("Calculation Summary")}
      <table role="presentation" width="100%" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
        ${totalOrder !== undefined && totalOrder !== null ? summaryRow("Total Order", fmtNum(totalOrder)) : ""}
        ${summaryRow(Number(totalCost) > 0 ? "Total Sale" : "Total Revenue", fmtCurrency(effectiveTotalRevenue))}
        ${Number(totalCost) > 0 ? summaryRow("Total Purchase", fmtCurrency(totalCost)) : ""}
        ${summaryRow("Gross Profit", fmtCurrency(grossProfit), { strong: true, color: moneyColor(grossProfit), shaded: true })}
        ${summaryRow("Marketing Spends", fmtCurrency(marketingCost))}
        ${summaryRow("Other Expenses", fmtCurrency(otherCost))}
        ${
          Number(incentiveAmount)
            ? summaryRow(
                `Incentive${incentiveType === "percentage" ? ` (${(Number(incentiveValue) || 0).toFixed(2)}%)` : ""}`,
                fmtCurrency(incentiveAmount),
              )
            : ""
        }
        ${summaryRow(`Return (${(Number(returnRate) || 0).toFixed(2)}%)`, fmtCurrency(returnDeduction))}
        ${summaryRow((Number(finalProfit) || 0) >= 0 ? "Net Profit" : "Net Loss", fmtCurrency(finalProfit), {
          strong: true,
          color: moneyColor(finalProfit),
          shaded: true,
        })}
      </table>`;

  // ── Products (Daily Profit & Loss By Product, Intransit) ─────────────────
  const productSection = selectedProducts.length
    ? `
      ${sectionTitle(`Products (${selectedProducts.length})`)}
      ${selectedProducts
        .map((p) =>
          card(`
        <div style="font-size:13.5px;font-weight:700;color:#0f172a;">${esc(p.name)}</div>
        ${p.sku ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">${esc(p.sku)}</div>` : ""}
        <div>
          ${chip("Units", fmtNum(p.unitsSold))}
          ${chip("Purchase", fmtCurrency(p.totalCost))}
          ${chip("Sale", fmtCurrency(p.totalRevenue))}
          ${chip("Profit/Loss", fmtCurrency(p.profit), moneyColor(p.profit))}
        </div>`),
        )
        .join("")}`
    : "";

  // ── Employee reports (Daily Profit & Loss By User) ───────────────────────
  const employeeSection = employeeReports.length
    ? `
      ${sectionTitle(`Employee Reports (${employeeReports.length})`)}
      ${employeeReports
        .map((r) =>
          card(`
        <table role="presentation" width="100%" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0;font-size:13.5px;font-weight:700;color:#0f172a;">${esc(r.name)}</td>
            <td style="padding:0;text-align:right;white-space:nowrap;font-size:11px;color:#94a3b8;">${esc(r.reportDate)}</td>
          </tr>
        </table>
        <div>
          ${chip("Assign", fmtNum(r.totalAssign))}
          ${chip("Order", fmtNum(r.totalOrder))}
          ${chip("Amount", fmtCurrency(r.totalAmount))}
          ${chip("Failed", r.failed ?? 0)}
          ${chip("Pending", r.pending ?? 0)}
          ${chip("Inbox", r.inbox ?? 0)}
          ${chip("Call", r.call ?? 0)}
          ${chip("WhatsApp", r.whatsapp ?? 0)}
        </div>`),
        )
        .join("")}`
    : "";

  const metaLine = (label, value) =>
    value
      ? `<div style="margin:0 0 4px;color:#e0e7ff;font-size:12px;"><strong style="color:#ffffff;">${esc(label)}:</strong> ${esc(value)}</div>`
      : "";

  return `
<meta name="viewport" content="width=device-width, initial-scale=1" />
<div style="margin:0;padding:12px 8px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">

    <div style="padding:18px 16px;background:#1e3a8a;background:linear-gradient(135deg,#0f172a,#1d4ed8);">
      <div style="display:inline-block;width:100%;max-width:330px;vertical-align:top;margin:0 0 8px;">
        <div style="margin:0;color:#ffffff;font-size:19px;font-weight:700;line-height:1.3;">${esc(companyName)}</div>
        <div style="margin:4px 0 0;color:#dbeafe;font-size:13px;">${esc(reportTitle)}</div>
      </div>
      <div style="display:inline-block;width:100%;max-width:240px;vertical-align:top;">
        ${metaLine("Invoice No", invoiceNumber)}
        ${metaLine("Date", reportDate)}
        ${metaLine("Sales Type", salesType)}
      </div>
    </div>

    <div style="padding:4px 16px 20px;">
      ${breakdownSection}
      ${productSection}
      ${employeeSection}

      ${
        supportEmail
          ? `<p style="margin:20px 0 0;color:#4b5563;font-size:13px;line-height:1.7;">
        If you have any questions, please contact us at
        <a href="mailto:${esc(supportEmail)}" style="color:#1d4ed8;text-decoration:none;word-break:break-all;">${esc(supportEmail)}</a>.
      </p>`
          : ""
      }
    </div>

    <div style="padding:12px 16px;border-top:1px solid #e5e7eb;background:#f9fafb;">
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
        This is an automated message from ${esc(companyName)}.
      </p>
    </div>
  </div>
</div>
  `;
};

module.exports = profitLossInvoiceTemplate;
