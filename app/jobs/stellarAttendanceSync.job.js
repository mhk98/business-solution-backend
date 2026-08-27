const stellarAttendanceService = require("../modules/stellarAttendance/stellarAttendance.service");

// Keeps today's attendance log in sync with the Stellar device API so
// Dashboard/Attendance data stays fresh without needing anyone to keep the
// Attendance page open (the frontend only re-syncs every 30 minutes, and
// only while that page is mounted). fetchLogs() already enforces the
// server-side rate limit (StellarAttendanceSyncState), so firing this more
// often than that limit is harmless — extra ticks just get skipped.
const SYNC_INTERVAL_MS = Number(
  process.env.STELLAR_ATTENDANCE_SYNC_CRON_MS || 5 * 60 * 1000,
);

const formatDateOnly = (date) => date.toISOString().slice(0, 10);

const runSync = async () => {
  const today = formatDateOnly(new Date());

  try {
    await stellarAttendanceService.fetchLogs({
      start_date: today,
      end_date: today,
      sync: "true",
    });
  } catch (error) {
    console.error("[stellarAttendanceSync] sync failed:", error.message);
  }
};

let intervalHandle = null;

const startStellarAttendanceSync = () => {
  if (intervalHandle) return;

  runSync();
  intervalHandle = setInterval(runSync, SYNC_INTERVAL_MS);
  intervalHandle.unref?.();
};

const stopStellarAttendanceSync = () => {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
};

module.exports = { startStellarAttendanceSync, stopStellarAttendanceSync };
