const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { calculateMixerPurchasePrice } = require('../shared/mixerPurchaseCost');
const { toBaseStockPayload } = require('../helpers/unitConversionHelper');

test('latest dated active purchase wins, including zero, with base-unit conversion', async () => {
  const purchases = [
    {itemId:1, unit:'Kg', unitValue:2, cost:600},
    {itemId:1, unit:'Kg', unitValue:10, cost:1000},
    {itemId:2, unit:'Pcs', unitValue:2, cost:0},
    {itemId:2, unit:'Pcs', unitValue:2, cost:80},
  ];
  const db = {manufacture:{findAll:async options=>{
    assert.equal(options.paranoid,true);
    assert.equal(JSON.stringify(options.order),JSON.stringify([['date','DESC'],['Id','DESC']]));
    return purchases;
  }},itemMaster:{findAll:async()=>[]}};
  const context={module:{exports:{}},require:name=>name==='../models'?db:name==='sequelize'?{Op:{ne:Symbol(),or:Symbol()}}:{toBaseStockPayload}};
  vm.runInNewContext(fs.readFileSync('shared/itemUnitCostResolver.js','utf8'),context);
  const resolve=await context.module.exports.buildItemUnitCostResolver();
  assert.equal(resolve(1),0.3);
  assert.equal(resolve(2,50),0);
  assert.equal(resolve(3,12),12);
});

test('Mixer uses purchase cost, converts material units, includes packaging/wages/other costs', async () => {
  const db={itemMaster:{findOne:async({where})=>({itemId:where.Id,unit:where.Id===1?'Gram':'Pcs',unitValue:1,cost:99999})}};
  const price=await calculateMixerPurchasePrice({db,unitCostOf:id=>id===1?0.3:2,
    mixItems:[{manufactureId:1,unit:'Kg',unitValue:2}],
    packagingItems:[{itemMasterId:2,unit:'Pcs',unitValue:100}],
    combo:100,unitWage:5,othersCost:50});
  assert.equal(price,13.5);
});

test('missing ingredients fail instead of silently storing a partial cost',async()=>{
  await assert.rejects(calculateMixerPurchasePrice({db:{itemMaster:{findOne:async()=>null}},unitCostOf:()=>2,
    mixItems:[{manufactureId:99,unitValue:1}],combo:1}),/not found/);
});

test('legacy incompatible units cannot silently misprice a batch', async () => {
  await assert.rejects(calculateMixerPurchasePrice({
    db:{itemMaster:{findOne:async()=>({itemId:1,unit:'Ml',unitValue:10,cost:20})}},
    unitCostOf:()=>2,mixItems:[{manufactureId:1,unit:'Pcs',unitValue:5}],combo:1,
  }),/Unit mismatch/);
});
