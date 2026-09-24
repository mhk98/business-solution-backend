const { checkStockLedgerIntegrity } = require("../../shared/stockLedgerIntegrity");
const {
  recomputeAverageCosts,
  registerAverageCostHooks,
} = require("../../shared/averageCostRunner");

// Hourly safety net for the StockMovement ledger the dated stock reports are
// built on: any stock change some flow forgot to log is found within the hour
// and reconciled on that same day (see shared/stockLedgerIntegrity.js).
// STOCK_LEDGER_AUTOFIX=false only reports gaps without writing.
const CHECK_INTERVAL_MS = Number(
  process.env.STOCK_LEDGER_INTEGRITY_MS || 60 * 60 * 1000,
);
const AUTO_FIX = process.env.STOCK_LEDGER_AUTOFIX !== "false";

const runCheck = async () => {
  try {
    const result = await checkStockLedgerIntegrity({ autoFix: AUTO_FIX });
    if (result.mismatches.length) {
      console.warn(
        `[stockLedgerIntegrity] ${result.mismatches.length} untracked stock change(s)${AUTO_FIX ? " reconciled" : ""}:`,
        result.mismatches.map((m) => `${m.type} ${m.name}: ledger ${m.ledger} → live ${m.live}`),
      );
    }
  } catch (error) {
    console.error("[stockLedgerIntegrity] check failed:", error.message);
  }
  // Weighted-average costing safety net (normally triggered per stock change).
  try {
    await recomputeAverageCosts();
  } catch (error) {
    console.error("[averageCost] hourly recompute failed:", error.message);
  }
};

let intervalHandle = null;
let firstRunHandle = null;

const startStockLedgerIntegrityCheck = () => {
  if (intervalHandle) return;
  registerAverageCostHooks();
  // First run a minute after boot, so startup isn't slowed down.
  firstRunHandle = setTimeout(runCheck, 60 * 1000);
  firstRunHandle.unref?.();
  intervalHandle = setInterval(runCheck, CHECK_INTERVAL_MS);
  intervalHandle.unref?.();
};

const stopStockLedgerIntegrityCheck = () => {
  clearTimeout(firstRunHandle);
  clearInterval(intervalHandle);
  firstRunHandle = null;
  intervalHandle = null;
};

module.exports = { startStockLedgerIntegrityCheck, stopStockLedgerIntegrityCheck };
