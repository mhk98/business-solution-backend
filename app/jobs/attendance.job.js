const { recomputeNow, registerAttendanceHooks } = require("../modules/attendance/attendance.recompute");
const { getPolicy } = require("../modules/attendance/attendance.policy");
const { addDays, bdToday } = require("../modules/attendance/attendance.time");

// Keeps AttendanceDays current without anyone opening a page:
//  - every 5 min: yesterday + today (live status, night shifts ending today)
//  - every 6 h:   the policy's recomputeDays window, so late changes that
//                 slipped past the model hooks still land.
const LIVE_INTERVAL_MS = Number(process.env.ATTENDANCE_LIVE_MS || 5 * 60 * 1000);
const SWEEP_INTERVAL_MS = Number(process.env.ATTENDANCE_SWEEP_MS || 6 * 60 * 60 * 1000);

const runLive = async () => {
  try {
    const today = bdToday();
    await recomputeNow({ from: addDays(today, -1), to: today });
  } catch (error) {
    console.error("[attendance] live recompute failed:", error.message);
  }
};

const runSweep = async () => {
  try {
    const policy = await getPolicy({ fresh: true });
    const today = bdToday();
    await recomputeNow({ from: addDays(today, -Math.max(Number(policy.recomputeDays) || 7, 1)), to: today });
  } catch (error) {
    console.error("[attendance] sweep recompute failed:", error.message);
  }
};

let liveHandle = null;
let sweepHandle = null;
let firstRunHandle = null;

const startAttendanceJobs = () => {
  if (liveHandle) return;
  registerAttendanceHooks();
  // Give models/index.js time to add the new columns before the first run.
  firstRunHandle = setTimeout(runSweep, 90 * 1000);
  firstRunHandle.unref?.();
  liveHandle = setInterval(runLive, LIVE_INTERVAL_MS);
  liveHandle.unref?.();
  sweepHandle = setInterval(runSweep, SWEEP_INTERVAL_MS);
  sweepHandle.unref?.();
};

const stopAttendanceJobs = () => {
  clearTimeout(firstRunHandle);
  clearInterval(liveHandle);
  clearInterval(sweepHandle);
  firstRunHandle = null;
  liveHandle = null;
  sweepHandle = null;
};

module.exports = { startAttendanceJobs, stopAttendanceJobs };
