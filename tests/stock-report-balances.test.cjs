const test = require('node:test');
const assert = require('node:assert/strict');
const { collectStockBalances, POOLS, businessDate } = require('../shared/stockReportBalances');
const stock = (Id, itemId, manufacturerId, unitValue, extra={}) => ({ Id, itemId, manufacturerId, unitValue, ...extra });
const movement = (Id, stockType, itemId, manufacturerId, balanceAfter, extra={}) => ({
  Id, stockType, itemId, manufacturerId, balanceAfter, date:'2026-09-22', createdAt:`2026-09-22 12:00:${Id}`, quantityChange:balanceAfter, ...extra,
});
const report = (movements, stocksByType, extra={}) => collectStockBalances({
  movements, stocksByType, from:'2026-09-01', to:'2026-09-22', today:'2026-09-23', ...extra,
});

test('factory balances are summed across manufacturers and variants, without double-counting seeds', () => {
  const stocks={FactoryStock:[stock(1,7,1,10),stock(2,7,2,20),stock(3,7,2,5,{variantKey:'red'})]};
  const rows=report([
    movement(1,'FactoryStock',7,1,10,{operation:'OPENING_BALANCE'}),
    movement(2,'FactoryStock',7,1,10,{stockRowId:1}),
    movement(3,'FactoryStock',7,2,20,{stockRowId:2}),
    movement(4,'FactoryStock',7,2,5,{stockRowId:3,variantKey:'red'}),
  ],stocks);
  assert.equal(rows.length,3);
  assert.equal(rows.reduce((sum,row)=>sum+row.closing,0),35);
});

test('legacy PackagingStock is an ItemMaster balance, not PackagingItemStock', () => {
  const rows=report([
    movement(1,'ItemStock',12,null,100,{stockRowId:25}),
    movement(2,'PackagingStock',12,null,60,{stockRowId:25,productId:47,quantityChange:-40}),
  ],{ItemStock:[stock(25,12,null,60)]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].type,'ItemStock');
  assert.equal(rows[0].closing,60);
});

test('all seven current pools agree with live stock, including zero, variants and no movement history', () => {
  const stocks={}; const movements=[];
  for(const [type,pool] of Object.entries(POOLS)) {
    stocks[type]=[{Id:1,[pool.id]:7,name:type,quantity:3,unitValue:3}];
    movements.push(movement(1,type,7,null,999,{productId:7,stockRowId:1}));
  }
  stocks.ProductStock[0].quantity=0;
  stocks.DamageStock[0].variants=[{quantity:2},{quantity:3}];
  stocks.PackagingFactoryStock.push({Id:2,packagingItemId:8,unitValue:4});
  const current=report(movements,stocks,{to:'2026-09-23'});
  for(const [type] of Object.entries(POOLS)) {
    const expected=type==='ProductStock'?0:type==='DamageStock'?5:type==='PackagingFactoryStock'?7:3;
    assert.equal(current.filter(r=>r.type===type).reduce((s,r)=>s+r.closing,0),expected,type);
  }
  // Before the movement's date the balance is live stock minus that change
  // (3 − 999 here), never shown below zero.
  const historic=report(movements,stocks,{from:'2026-09-01',to:'2026-09-21'});
  for(const row of historic.filter(r=>r.type==='ItemStock')) assert.equal(row.closing,0);
});

test('a month-end snapshot anchors dates before full movement logging', () => {
  const rows=report([
    movement(1,'ProductStock',null,null,0,{productId:5,date:'2026-07-31',operation:'OPENING_BALANCE',balanceAfter:300}),
    movement(2,'ProductStock',null,null,0,{productId:5,date:'2026-07-20',quantityChange:100}),
    movement(3,'ProductStock',null,null,0,{productId:5,date:'2026-08-10',quantityChange:500}),
  ],{ProductStock:[{Id:1,productId:5,quantity:450}]},{from:'2026-07-01',to:'2026-07-31'});
  assert.equal(rows[0].closing,300);
  assert.equal(rows[0].opening,200);
});

test('backdated entries and unlogged changes cannot drift the balance away from live stock', () => {
  const rows=report([
    // entered first, dated later
    movement(1,'ProductStock',null,null,50,{productId:5,date:'2026-09-20',quantityChange:-10,balanceBefore:60}),
    // entered later, backdated; its snapshot balances are stale
    movement(2,'ProductStock',null,null,999,{productId:5,date:'2026-08-30',quantityChange:5,balanceBefore:994}),
    movement(3,'ProductStock',null,null,0,{productId:5,date:'2026-05-30',operation:'OPENING_BALANCE',balanceAfter:777}),
  ],{ProductStock:[{Id:1,productId:5,quantity:40}]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].closing,40);
  assert.equal(rows[0].out,10);
  assert.equal(rows[0].opening,50);
});

test('date range uses last movement for each pool before each cutoff and excludes future entries', () => {
  const rows=report([
    movement(1,'ProductStock',null,null,10,{productId:5,date:'2026-08-31'}),
    movement(2,'ProductStock',null,null,7,{productId:5,quantityChange:-3}),
    movement(3,'ProductStock',null,null,100,{productId:5,date:'2026-09-24'}),
  ],{ProductStock:[]});
  assert.equal(rows[0].opening,10);
  assert.equal(rows[0].closing,7);
  assert.equal(rows[0].out,3);
});

test('business-day boundary is Bangladesh midnight', () => {
  assert.equal(businessDate(new Date('2026-09-22T18:01:00Z')),'2026-09-23');
});

test('an edit reversal nets against In instead of adding to Out', () => {
  const rows=report([
    movement(1,'ProductStock',null,null,0,{productId:5,quantityChange:100}),
    movement(2,'ProductStock',null,null,0,{productId:5,quantityChange:-100,operation:'UPDATE_REVERSE'}),
    movement(3,'ProductStock',null,null,0,{productId:5,quantityChange:120,operation:'UPDATE_APPLY'}),
  ],{ProductStock:[{Id:1,productId:5,quantity:120}]});
  assert.equal(rows[0].in,120);
  assert.equal(rows[0].out,0);
  assert.equal(rows[0].opening,0);
});

test('a backdated first entry counts even though the stock row was created later', () => {
  const rows=report([
    movement(1,'DamageStock',null,null,0,{productId:5,date:'2026-09-20',quantityChange:3,createdAt:'2026-09-22 10:00:00'}),
  ],{DamageStock:[{Id:1,productId:5,quantity:3,createdAt:'2026-09-22T04:00:00Z'}]},{from:'2026-09-11',to:'2026-09-20'});
  assert.equal(rows[0].opening,0);
  assert.equal(rows[0].in,3);
  assert.equal(rows[0].closing,3);
});

test('dated averages: each date uses the average of its day, and before go-live the seed', () => {
  const rows=report([
    movement(1,'ProductStock',null,null,0,{productId:5,date:'2026-09-10',quantityChange:0,operation:'AVERAGE_SEED',averageCostAfter:100}),
    movement(2,'ProductStock',null,null,0,{productId:5,date:'2026-09-15',quantityChange:10,averageCostAfter:120}),
  ],{ProductStock:[{Id:1,productId:5,quantity:30}]},{from:'2026-09-12',to:'2026-09-20'});
  assert.equal(rows[0].openingAverage,100);
  assert.equal(rows[0].closingAverage,120);
  const early=report([
    movement(1,'ProductStock',null,null,0,{productId:5,date:'2026-09-10',quantityChange:0,operation:'AVERAGE_SEED',averageCostAfter:100}),
  ],{ProductStock:[{Id:1,productId:5,quantity:30}]},{from:'2026-08-01',to:'2026-08-31'});
  assert.equal(early[0].closingAverage,100);
});
