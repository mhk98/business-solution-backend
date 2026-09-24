const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const [moduleName, model, move] of [
  ['inTransitProduct','InTransitProduct','moveItemFromInventory'],
  ['returnProduct','ReturnProduct','moveItemFromInventory'],
  ['damageProduct','DamageProduct','moveDamageProductItem'],
  ['damageRepaired','DamageRepaired','moveDamageRepairedItem'],
]) {
  test(`${moduleName} bulk movement receives the same backdated date as its source row`, async () => {
    const source=fs.readFileSync(`app/modules/${moduleName}/${moduleName}.service.js`,'utf8');
    const start=source.indexOf('const insertBulkIntoDB =');
    const end=source.indexOf('\n};',start)+3;
    const movementDates=[], sourceDates=[];
    const t={};
    const context={
      db:{sequelize:{transaction:async(fn)=>fn(t)}},
      getBulkItems:data=>data.items,
      pendingMark:()=>0, assignPendingSource:async()=>{},
      normalizeOptionalForeignKey:value=>value||null,
      User:{findAll:async()=>[]}, Op:{ne:Symbol(),in:Symbol()},
      [move]:async(item,transaction,date)=>{assert.equal(transaction,t);movementDates.push(date);return item;},
      [model]:{create:async(row)=>{sourceDates.push(row.date);return {Id:sourceDates.length,...row};}},
    };
    const insert=vm.runInNewContext(source.slice(start,end)+'\ninsertBulkIntoDB;',context);
    await insert({date:'2026-08-25',items:[{productId:1,quantity:3},{productId:2,quantity:4}]});
    assert.deepEqual(movementDates,['2026-08-25','2026-08-25']);
    assert.deepEqual(sourceDates,movementDates);
  });
}

test('Stock Movement date filter uses transaction date, with deterministic ordering and legacy ItemStock alias',async()=>{
  const context={module:{exports:{}},require:name=>{
    if(name==='sequelize')return {Op};
    if(name.endsWith('paginationHelper'))return {calculatePagination:()=>({page:1,limit:10,skip:0})};
    if(name.endsWith('stockMovement.constants'))return {StockMovementSearchableFields:['name']};
    if(name.endsWith('stockReportBalances'))return {parseMetadata:value=>value||{}};
    if(name==='../../../models')return {stockMovement:{findOne:async()=>null,findAll:async options=>{query=options;return [];},count:async()=>0}};
  }};
  const Op={and:Symbol(),gte:Symbol(),lte:Symbol(),in:Symbol(),like:Symbol(),or:Symbol()};
  let query;
  vm.runInNewContext(fs.readFileSync('app/modules/stockMovement/stockMovement.service.js','utf8'),context);
  await context.module.exports.getAllFromDB({startDate:'2026-06-01',endDate:'2026-06-30',stockType:'ItemStock'},{});
  const filters=query.where[Op.and];
  assert.equal(filters[1].date[Op.gte],'2026-06-01');
  assert.equal(filters[1].date[Op.lte],'2026-06-30');
  assert.equal(JSON.stringify(filters[0].stockType[Op.in]),JSON.stringify(['ItemStock','PackagingStock']));
  assert.equal(query.order[0][0],'date');
});
