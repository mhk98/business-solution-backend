const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const Op = {lt: Symbol('lt'), lte: Symbol('lte'), in: Symbol('in'), ne: Symbol('ne')};
const sql = {fn(){}, col(){}, literal(){}};
const specs = [
 ['supplier','SupplierHistory','Supplier','supplierId','getSupplierReceivableReport','advance','totalPaid','grossDue'],
 ['supplier','SupplierHistory','Supplier','supplierId','getSupplierDueReport','due','grossDue','totalPaid'],
 ['dollarSupplier','DollarSupplierHistory','DollarSupplier','dollarSupplierId','getDollarSupplierReceivableReport','advance','totalPaid','grossDue'],
 ['dollarSupplier','DollarSupplierHistory','DollarSupplier','dollarSupplierId','getDollarSupplierDueReport','due','grossDue','totalPaid'],
 ['manufacturer','ManufacturerTransaction','Manufacturer','manufacturerId','getManufacturerReceivableReport','advance','totalCredit','totalDebit'],
 ['manufacturer','ManufacturerTransaction','Manufacturer','manufacturerId','getManufacturerDueReport','due','totalDebit','totalCredit'],
 ['packagingManufacturer','PackagingManufacturerTransaction','PackagingManufacturer','manufacturerId','getPackagingManufacturerReceivableReport','advance','totalCredit','totalDebit'],
 ['loan','LenderHistory','Loan','loanId','getLenderReceivableReport','advance','totalLoanPaid','totalLoanTaken'],
 ['loan','LenderHistory','Loan','loanId','getLenderPayableReport','due','totalLoanTaken','totalLoanPaid'],
];
function load(module, name, context) {
 const source = fs.readFileSync(`app/modules/${module}/${module}.service.js`, 'utf8');
 const start = source.indexOf(`const ${name} =`);
 const end = source.indexOf('\n};', start) + 3;
 return vm.runInNewContext(source.slice(start,end) + `\n${name};`, context);
}
(async () => {
 for (const [module, history, entity, id, name, field, positive, negative] of specs) {
  const entries = [ ['2026-07-10',100,0], ['2026-08-15',50,0], ['2026-09-05',0,150] ];
  const context = {Op, db: {Sequelize:sql,sequelize:sql}, toNumber:Number, normalizeAmount:Number};
  context[entity] = {findAll: async () => [{Id:1,name:'Example'}]};
  context[history] = {findAll: async ({where}) => {
   const rows = entries.filter(([date]) => !where.date || (where.date[Op.lt] ? date < where.date[Op.lt] : date <= where.date[Op.lte]));
   return [{[id]:1,[positive]:rows.reduce((s,r)=>s+r[1],0),[negative]:rows.reduce((s,r)=>s+r[2],0)}];
  }};
  const report = load(module,name,context);
  const august = await report({from:'2026-08-01',to:'2026-08-31'});
  assert.equal(august.data[0][field],150,name);
  assert.equal(august.meta.totalOpeningBalance,100,name);
  assert.equal(august.meta[field === 'due' ? 'totalDue':'totalAdvance'],150,name);
  const september = await report({from:'2026-08-01',to:'2026-09-30'});
  assert.equal(september.meta[field === 'due' ? 'totalDue':'totalAdvance'],0,name);
  const current = await report();
  assert.equal(current.meta[field === 'due' ? 'totalDue':'totalAdvance'],0,name);
 }
 for (const [module,model] of [['salesDue','SalesDue'],['salaryAdvance','SalaryAdvance']]) {
  const report = load(module,`get${model}Report`,{Op,[model]: {findAll: async ({where}) => [
   {date:'2026-07-01',name:'Old',amount:100,paidAmount:20},
   {date:'2026-09-01',name:'Future',amount:500,paidAmount:0}
  ].filter(r=> !where.date || r.date <= where.date[Op.lte])}});
  const result = await report({from:'2026-08-01',to:'2026-08-31'});
  assert.equal(result.meta.totalDue,80);
  assert.equal(result.data.length,1);
 }
 console.log('PASS: 9 ledger reports exclude later payments and carry opening balances; 2 entry reports exclude future entries.');
})().catch(e=>{console.error(e);process.exitCode=1;});
