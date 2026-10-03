// Date/time helpers for attendance. Everything is Bangladesh local time
// (UTC+6, no DST) handled as plain strings/minutes, so the result never
// depends on the server's own timezone.

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n) => String(n).padStart(2, "0");

const isYmd = (value) => YMD_RE.test(String(value || ""));

// Instant → { date: "YYYY-MM-DD", clock: "HH:MM:SS" } in Bangladesh time.
const toBdParts = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const iso = new Date(date.getTime() + BD_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), clock: iso.slice(11, 19) };
};

// "YYYY-MM-DD" + "HH:MM[:SS]" (Bangladesh) → Date instant.
const bdToInstant = (ymd, clock) => {
  const time = String(clock || "00:00:00");
  const full = time.length === 5 ? `${time}:00` : time;
  const date = new Date(`${ymd}T${full}+06:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const bdToday = () => toBdParts(new Date()).date;

const bdNowMinutes = () => {
  const { clock } = toBdParts(new Date());
  return clockToMinutes(clock);
};

// "HH:MM" / "HH:MM:SS" → minutes since midnight (fractional seconds dropped).
const clockToMinutes = (clock) => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(clock || "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const minutesToClock = (total) => {
  const value = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
};

const addDays = (ymd, days) => {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const dayDiff = (fromYmd, toYmd) =>
  Math.round((new Date(`${toYmd}T00:00:00Z`) - new Date(`${fromYmd}T00:00:00Z`)) / 86400000);

const dateRange = (fromYmd, toYmd) => {
  const dates = [];
  for (let d = fromYmd; d <= toYmd; d = addDays(d, 1)) dates.push(d);
  return dates;
};

const weekdayName = (ymd) => WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];

const monthBounds = (month) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return null;
  const from = `${match[1]}-${match[2]}-01`;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
  const to = addDays(next.toISOString().slice(0, 10), -1);
  return { from, to };
};

const normalizeWeekdays = (value) => {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = list.split(",");
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((day) => String(day || "").trim().toLowerCase())
    .map((day) => WEEKDAYS.find((name) => name.toLowerCase() === day || name.toLowerCase().slice(0, 3) === day))
    .filter(Boolean);
};

const minYmd = (...values) => values.filter(Boolean).sort()[0];
const maxYmd = (...values) => values.filter(Boolean).sort().at(-1);

module.exports = {
  WEEKDAYS,
  isYmd,
  toBdParts,
  bdToInstant,
  bdToday,
  bdNowMinutes,
  clockToMinutes,
  minutesToClock,
  addDays,
  dayDiff,
  dateRange,
  weekdayName,
  monthBounds,
  normalizeWeekdays,
  minYmd,
  maxYmd,
};
