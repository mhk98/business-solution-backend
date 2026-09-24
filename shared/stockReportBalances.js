const { getInventoryDisplayQuantity } = require('./variantQuantity');

const POOLS = {
  ProductStock: { model: 'inventoryMaster', prefix: 'stockProduct', id: 'productId' },
  DamageStock: { model: 'damageStock', prefix: 'damageStock', id: 'productId' },
  RepairingStock: { model: 'damageReparingStock', prefix: 'repairingStock', id: 'productId' },
  ItemStock: { model: 'itemMaster', prefix: 'itemStock', id: 'itemId' },
  FactoryStock: { model: 'manufactureStock', prefix: 'factoryStock', id: 'itemId' },
  PackagingItemStock: { model: 'packagingItemStock', prefix: 'packagingItemStock', id: 'packagingItemId' },
  PackagingFactoryStock: { model: 'packagingFactoryStock', prefix: 'packagingFactoryStock', id: 'packagingItemId' },
};
const normalizeStockType = (type) => type === 'PackagingStock' ? 'ItemStock' : type;
const businessDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const number = (value) => Number(value || 0);
const stockQuantity = (row, pool) => pool.id === 'productId'
  ? getInventoryDisplayQuantity(row) : number(row.unitValue);

// Product movements contain the whole product balance. Material balances are
// per physical stock row (manufacturer and variant), not per item catalogue ID.
const createPoolKeyResolver = (stocksByType) => (row) => {
  const type = normalizeStockType(row.stockType);
  const pool = POOLS[type];
  if (!pool) return null;
  if (pool.id === 'productId') return `${type}:product:${row.productId}`;
  const stocks = stocksByType[type] || [];
  const direct = stocks.find((stock) => Number(stock.Id) === Number(row.stockRowId));
  if (direct) return `${type}:row:${direct.Id}`;
  const candidates = stocks.filter((stock) =>
    Number(stock[pool.id]) === Number(row.itemId) &&
    number(stock.manufacturerId) === number(row.manufacturerId) &&
    String(stock.variantKey || '') === String(row.variantKey || ''));
  // Old Mixer entries sometimes put the output product ID on a material
  // movement. Do not use that ID to split a uniquely identified stock row.
  const exact = candidates.length === 1 ? candidates[0] : candidates.find((stock) =>
    number(stock.productId) === number(row.productId));
  return exact ? `${type}:row:${exact.Id}` :
    `${type}:item:${row.itemId}:manufacturer:${row.manufacturerId || ''}:variant:${row.variantKey || ''}:product:${row.productId || ''}`;
};

const parseMetadata = (value) => {
  if (typeof value !== 'string') return value || {};
  try { return JSON.parse(value); } catch { return {}; }
};
const effectiveLedgerRows = (rows) => {
  const control = rows.filter((row) => row.operation === 'HISTORY_REBUILD')
    .sort((a,b) => number(b.Id) - number(a.Id))[0];
  const cutoff = number(parseMetadata(control?.metadata).supersedesThroughId);
  return rows.filter((row) => row.operation !== 'HISTORY_REBUILD' &&
    (!cutoff || number(row.Id) > cutoff || !POOLS[normalizeStockType(row.stockType)]));
};

const REVERSAL_OPERATIONS = new Set(['DELETE', 'UPDATE_REVERSE', 'REVERSE']);
const dateKey = (value) => value instanceof Date ? businessDate(value) : String(value || '').slice(0, 10);
const round2 = (value) => Math.round(value * 100) / 100;

// Pool key + live quantity for every non-deleted stock row (the anchor).
const liveBalances = (stocksByType = {}) => {
  const live = new Map();
  for (const [type, rows] of Object.entries(stocksByType)) {
    const pool = POOLS[type];
    if (!pool) continue;
    for (const stock of rows || []) {
      if (stock.deletedAt) continue;
      const groupId = stock[pool.id];
      if (!groupId) continue;
      const key = pool.id === 'productId' ? `${type}:product:${groupId}` : `${type}:row:${stock.Id}`;
      const entry = live.get(key) || { type, groupId, name: stock.name, quantity: 0, createdDate: null };
      entry.quantity = round2(entry.quantity + stockQuantity(stock, pool));
      const created = stock.createdAt ? dateKey(stock.createdAt instanceof Date ? stock.createdAt : new Date(stock.createdAt)) : null;
      if (created && (!entry.createdDate || created < entry.createdDate)) entry.createdDate = created;
      live.set(key, entry);
    }
  }
  return live;
};

const previousDay = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Balances are anchored, then walked backwards over the logged changes:
//   balance at end of day D = anchor − Σ quantityChange dated after D
//                             (up to the anchor's own date).
// The anchor is the earliest month-end snapshot (OPENING_BALANCE row) dated on
// or after D, else the LIVE stock quantity. Recorded balanceBefore/After are
// snapshots taken when a row was entered, so a backdated entry or a change
// that was never logged makes them wrong; anchoring keeps today's closing equal
// to the real stock. Snapshots cover the months before every movement was
// being logged (Intransit/POS outflows only from late Aug 2026), where walking
// back from live stock would subtract inflows without the missing outflows.
// A pool with neither (deleted stock row, no snapshot) sums forward from its
// first recorded balance.
const collectStockBalances = ({ movements, stocksByType, from, to }) => {
  const keyFor = createPoolKeyResolver(stocksByType);
  const live = liveBalances(stocksByType);
  const pools = new Map();
  const sorted = effectiveLedgerRows(movements).sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) ||
    String(a.createdAt).localeCompare(String(b.createdAt)) || number(a.Id) - number(b.Id));
  for (const row of sorted) {
    const type = normalizeStockType(row.stockType);
    const pool = POOLS[type];
    const groupId = pool?.id === 'productId' ? row.productId : row.itemId;
    const date = dateKey(row.date);
    if (!pool || !groupId || !date) continue;
    const key = keyFor(row);
    const entry = pools.get(key) || { type, groupId, name: row.name,
      firstBalance: null, changes: [], snapshots: [], averages: [], in: 0, out: 0 };
    entry.name = row.name || entry.name;
    pools.set(key, entry);
    if (row.averageCostAfter !== null && row.averageCostAfter !== undefined) {
      entry.averages.push({ date, id: number(row.Id), average: number(row.averageCostAfter) });
    }
    if (row.operation === 'OPENING_BALANCE') {
      entry.snapshots.push({ date, balance: number(row.balanceAfter) });
      continue;
    }
    if (entry.firstBalance === null) entry.firstBalance = number(row.balanceBefore);
    const change = number(row.quantityChange);
    entry.changes.push({ date, change });
    if (date > to || (from && date < from)) continue;
    if (REVERSAL_OPERATIONS.has(row.operation)) {
      // Undoing an earlier entry nets against that entry's own direction, so
      // an edited/deleted Mixer (+1306 then −1306) doesn't inflate In and Out.
      if (change < 0) entry.in += change;
      else entry.out -= change;
    } else {
      entry.in += Math.max(change, 0);
      entry.out += Math.max(-change, 0);
    }
  }
  for (const [key, anchor] of live) {
    if (!pools.has(key)) pools.set(key, { type: anchor.type, groupId: anchor.groupId, name: anchor.name,
      firstBalance: 0, changes: [], snapshots: [], averages: [], in: 0, out: 0 });
  }
  const balanceAt = (entry, anchor, day) => {
    const snapshot = entry.snapshots.filter((s) => s.date >= day)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const sumBetween = (after, through) => entry.changes
      .filter((c) => c.date > after && (!through || c.date <= through))
      .reduce((sum, c) => sum + c.change, 0);
    if (snapshot) return snapshot.balance - sumBetween(day, snapshot.date);
    // Before the stock row existed there was no stock, whatever was logged.
    // A backdated entry can predate the row's createdAt, so the pool starts at
    // whichever is earlier.
    const firstChange = entry.changes[0]?.date;
    const startDate = firstChange && firstChange < anchor?.createdDate ? firstChange : anchor?.createdDate;
    if (startDate && day < startDate) return 0;
    if (anchor) return anchor.quantity - sumBetween(day);
    return number(entry.firstBalance) + entry.changes
      .filter((c) => c.date <= day).reduce((sum, c) => sum + c.change, 0);
  };
  // Weighted-average cost on a day: the average after the last movement on or
  // before it; before go-live, the first recorded (seed) average; null when
  // the pool has none yet (callers fall back to the current price).
  const averageAt = (entry, day) => {
    const sorted = entry.averages.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    let result = null;
    for (const point of sorted) {
      if (point.date <= day) result = point.average;
      else return result === null ? point.average : result;
    }
    return result;
  };
  return [...pools.entries()].map(([key, entry]) => {
    const anchor = live.get(key);
    // Physical stock is never negative; a negative walk-back only means some
    // change before that date was never logged, so it is shown as 0.
    const closing = Math.max(0, balanceAt(entry, anchor, to));
    const opening = from ? Math.max(0, balanceAt(entry, anchor, previousDay(from))) : 0;
    return { type: entry.type, groupId: entry.groupId, name: anchor?.name || entry.name,
      opening: round2(opening), closing: round2(closing), in: round2(entry.in), out: round2(entry.out),
      openingAverage: from ? averageAt(entry, previousDay(from)) : null,
      closingAverage: averageAt(entry, to) };
  });
};

module.exports = { POOLS, liveBalances, normalizeStockType, businessDate, stockQuantity, createPoolKeyResolver, collectStockBalances, effectiveLedgerRows, parseMetadata };
