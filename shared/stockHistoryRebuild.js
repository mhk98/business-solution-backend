const { toBaseStockPayload } = require('../helpers/unitConversionHelper');
const { getInventoryDisplayQuantity } = require('./variantQuantity');
const { createPoolKeyResolver, POOLS } = require('./stockReportBalances');
const TABLES = {
  ProductStock: 'InventoryMasters', DamageStock: 'DamageStocks', RepairingStock: 'DamageReparingStocks',
  ItemStock: 'ItemMasters', FactoryStock: 'ManufactureStocks',
  PackagingItemStock: 'PackagingItemStocks', PackagingFactoryStock: 'PackagingFactoryStocks',
};
const parse = (value) => typeof value === 'string' ? JSON.parse(value || '[]') : value || [];
const base = (row) => toBaseStockPayload(row.unit, row.unitValue).unitValue;
const round = (value) => Math.round(value * 100) / 100;

// Reconstructs the effective transaction history from the currently retained
// source documents. Deleted/cancelled documents are excluded (restated history).
// Never silently invent a missing reference or an initial stock balance.
function buildStockHistory(data) {
  const stocksByType = Object.fromEntries(Object.entries(TABLES).map(([type, table]) => [type, data[table] || []]));
  const keyFor = createPoolKeyResolver(stocksByType);
  const events = [], issues = [];
  const active = (table) => (data[table] || []).filter((row) => !row.deletedAt);
  const byId = (table, id) => (data[table] || []).find((row) => Number(row.Id) === Number(id));
  function add(type, sourceType, row, stock, change, extra = {}) {
    if (!change) return;
    if (!stock || !row.date) { issues.push({ sourceType, sourceId: row.Id, type, error: 'Missing stock reference or effective date' }); return; }
    const pool = POOLS[type];
    events.push({ sourceType, sourceId: row.Id, operation: 'REBUILD', stockType: type,
      stockRowId: stock.Id, productId: stock.productId || null,
      itemId: pool.id === 'packagingItemId' ? stock.packagingItemId : stock.itemId || null,
      manufacturerId: stock.manufacturerId || null, variantKey: stock.variantKey || null,
      name: stock.name, unit: stock.unit || 'Pcs', date: String(row.date).slice(0,10),
      quantityChange: round(change), sourceCreatedAt: row.createdAt, ...extra });
  }
  const productStock = (type, productId) => stocksByType[type].find((s) => Number(s.productId) === Number(productId) && !s.deletedAt)
    || stocksByType[type].find((s) => Number(s.productId) === Number(productId));
  const materialStock = (type, row) => stocksByType[type].find((s) =>
    Number(s[POOLS[type].id]) === Number(row.itemId ?? row.packagingItemId) &&
    Number(s.manufacturerId || 0) === Number(row.manufacturerId || 0) &&
    String(s.variantKey || '') === String(row.variantKey || ''));
  const lines = (row) => { const items = parse(row.items); return items.length ? items : [row]; };
  for (const row of active('ReceivedProducts')) for (const line of lines(row)) {
    add('ProductStock', 'ReceivedProduct', row, productStock('ProductStock', line.productId), getInventoryDisplayQuantity(line));
  }
  for (const [table, source, sign] of [['IntransitProducts','InTransitProduct',-1],['ReturnProducts','ReturnProduct',1],['PurchaseReturnProducts','PurchaseReturnProduct',-1]]) {
    for (const row of active(table)) for (const line of lines(row)) {
      const inventory = byId('InventoryMasters', line.inventoryId || line.receivedId || line.productId);
      add('ProductStock', source, row, inventory, sign * getInventoryDisplayQuantity(line));
    }
  }
  for (const row of active('PosReports')) for (const line of parse(row.items)) {
    const stock = byId('InventoryMasters', line.inventoryId || line.Id || line.receivedId || line.productId);
    add('ProductStock','PosReport',row,stock,-getInventoryDisplayQuantity({...line,quantity:line.qty ?? line.quantity}));
  }
  for (const row of active('CourierNoEntries').filter((r) => r.courierStatus === 'Received')) {
    add('ProductStock','CourierNoEntry',row,byId('InventoryMasters',row.productId),getInventoryDisplayQuantity(row));
  }
  for (const row of active('DamageProducts')) for (const line of lines(row)) {
    const qty = getInventoryDisplayQuantity(line);
    if (row.source === 'Damage Return') {
      add('DamageStock','DamageReturn',row,productStock('DamageStock',line.productId),-qty);
    } else {
      const stock = byId('InventoryMasters',line.productId || line.receivedId);
      add('ProductStock','DamageProduct',row,stock,-qty);
      add('DamageStock','DamageProduct',row,productStock('DamageStock',stock?.productId),qty);
    }
  }
  for (const row of active('DamageRepairs')) for (const line of lines(row)) {
    const qty = getInventoryDisplayQuantity(line);
    if (row.source === 'Damage Repairing Return') add('RepairingStock','DamageRepairReturn',row,productStock('RepairingStock',line.productId),-qty);
    else {
      const stock = byId('DamageStocks',line.productId || line.receivedId);
      add('DamageStock','DamageRepair',row,stock,-qty);
      add('RepairingStock','DamageRepair',row,productStock('RepairingStock',stock?.productId),qty);
    }
  }
  for (const row of active('DamageRepaireds')) for (const line of lines(row)) {
    const stock = byId('DamageReparingStocks',line.productId || line.receivedId);
    const qty = getInventoryDisplayQuantity(line);
    add('RepairingStock','DamageRepaired',row,stock,-qty);
    add('ProductStock','DamageRepaired',row,productStock('ProductStock',stock?.productId),qty);
  }
  for (const row of active('Manufactures')) add('ItemStock','ItemPurchase',row,materialStock('ItemStock',row),base(row));
  for (const row of active('ManufactureProductions')) {
    add('ItemStock','Factory',row,materialStock('ItemStock',{...row,manufacturerId:null}),-base(row));
    add('FactoryStock','Factory',row,materialStock('FactoryStock',row),base(row));
  }
  for (const [table,type,source] of [['StockAdjustments','ItemStock','StockAdjustment'],['FactoryStockAdjustments','FactoryStock','FactoryStockAdjustment'],['PackagingItemStockAdjustments','PackagingItemStock','PackagingItemStockAdjustment'],['PackagingFactoryStockAdjustments','PackagingFactoryStock','PackagingFactoryStockAdjustment']]) {
    for (const row of active(table)) {
      if (!['in','out'].includes(String(row.stock).toLowerCase())) { issues.push({source,sourceId:row.Id,error:'Unknown adjustment direction'});continue; }
      add(type,source,row,materialStock(type,row),base(row)*(String(row.stock).toLowerCase()==='in'?1:-1));
    }
  }
  for (const row of active('Mixers')) {
    const marker = '__MIXER_META__=';
    const source = row.entryType === 'combo_production' ? 'ComboProduction' : 'Mixer';
    if (!String(row.note).includes(marker)) { issues.push({source,sourceId:row.Id,error:'Missing material metadata'});continue; }
    const meta = JSON.parse(row.note.slice(row.note.indexOf(marker)+marker.length));
    for (const line of meta.mixItems || []) {
      const item = byId('ItemMasters',line.manufactureId);
      const manufacturerId = meta.manufacturerId || row.manufacturerId;
      const type = manufacturerId ? 'FactoryStock' : 'ItemStock';
      const stock = manufacturerId ? materialStock(type,{...item,manufacturerId}) : item;
      add(type,source,row,stock,-base(line));
    }
    for (const line of meta.packagingItems || []) add('ItemStock',source,row,byId('ItemMasters',line.itemMasterId),-base(line));
    // Finished output is already represented by its ReceivedProduct document.
  }
  for (const row of active('PackagingItemPurchases')) add('PackagingItemStock','PackagingItemPurchase',row,materialStock('PackagingItemStock',row),base(row));
  for (const row of active('PackagingFactories')) {
    add('PackagingItemStock','PackagingFactory',row,materialStock('PackagingItemStock',{...row,manufacturerId:null}),-base(row));
    add('PackagingFactoryStock','PackagingFactory',row,materialStock('PackagingFactoryStock',row),base(row));
  }
  // Packaging Mixer: consumes Packaging Factory Stock lines, produces the
  // finished item into its Item Stock row (the variant-less row, oldest first —
  // the same row packagingMixer.service's adjustItemStock picks).
  for (const row of active('PackagingMixers')) {
    for (const line of parse(row.packagingItems)) {
      add('PackagingFactoryStock','PackagingMixer',row,byId('PackagingFactoryStocks',line.packagingFactoryStockId),-base(line));
    }
    const target = (data.ItemMasters || [])
      .filter((s) => Number(s.itemId) === Number(row.itemId) && !s.variantKey)
      .sort((a,b) => Number(!!a.deletedAt) - Number(!!b.deletedAt) || String(a.createdAt).localeCompare(String(b.createdAt)))[0];
    add('ItemStock','PackagingMixer',row,target,base(row));
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||String(a.sourceCreatedAt).localeCompare(String(b.sourceCreatedAt))||a.sourceId-b.sourceId);
  const balances = new Map();
  for (const event of events) {
    const key = keyFor(event);
    event.balanceBefore = balances.get(key) || 0;
    event.balanceAfter = round(event.balanceBefore+event.quantityChange);
    event.direction = event.quantityChange > 0 ? 'IN' : 'OUT';
    balances.set(key,event.balanceAfter);
  }
  return { events, balances, issues, stocksByType };
}
module.exports = { buildStockHistory, TABLES };
