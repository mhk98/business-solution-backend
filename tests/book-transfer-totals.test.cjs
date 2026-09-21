const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const Op=Object.fromEntries(['and','gte','lte','eq','like','or'].map(k=>[k,Symbol(k)]));
const entries=[{bookId:1,date:'2026-07-28',status:'Active',fromPaymentMode:'Bank',toPaymentMode:'Cash',amount:390010},{bookId:1,date:'2026-08-01',status:'Active',fromPaymentMode:'Bank',toPaymentMode:'Cash',amount:900},{bookId:1,date:'2026-07-28',status:'Inactive',fromPaymentMode:'Bank',toPaymentMode:'Cash',amount:700}];
const match=(r,w)=>Reflect.ownKeys(w).every(k=>k===Op.and?w[k].every(c=>match(r,c)):typeof w[k]==='object'?Reflect.ownKeys(w[k]).every(o=>o===Op.gte?r[k]>=w[k][o]:o===Op.lte?r[k]<=w[k][o]:r[k]===w[k][o]):r[k]===w[k]);
const source=fs.readFileSync('app/modules/cashInOut/cashInOut.service.js','utf8');
const helper=source.slice(source.indexOf('const getBookTransferTotals ='),source.indexOf('// const getAllFromDB'));
const a=source.indexOf('\nconst getAllFromDB ='),b=source.indexOf('const getLoanSummaries',a);
const f=vm.runInNewContext(helper+source.slice(a,b)+'\ngetAllFromDB',{Op,toDateOnly:v=>v,db:{fundTransfer:{sum:async(_,q)=>{assert.equal(q.paranoid,true);return entries.filter(r=>match(r,q.where)).reduce((s,r)=>s+r.amount,0)}}},paginationHelpers:{calculatePagination:()=>({page:1,limit:10,skip:0})},CashInOut:{findAll:async()=>[],count:async()=>0,sum:async(_,q)=>q.where[Op.and].at(-1).paymentStatus==='CashIn'?32914591.39:32212457.26},Loan:{},Owner:{},Director:{},Category:{}});
(async()=>{const base={bookId:1,startDate:'2026-07-01',endDate:'2026-07-31'};
const bank=(await f({...base,paymentMode:'Bank'},{})).meta;assert.equal(bank.transferCashOut,390010);assert.equal(bank.transferCashIn,0);assert.equal(Math.round(bank.netBalance*100)/100,312124.13);
const cash=(await f({...base,paymentMode:'Cash'},{})).meta;assert.equal(cash.transferCashIn,390010);assert.equal(cash.transferCashOut,0);
const all=(await f(base,{})).meta;assert.equal(all.transferCashIn,all.transferCashOut);
for(const filters of [{bookId:2},{endDate:'2026-07-27'},{categoryId:5},{paymentMode:'Bank',paymentStatus:'CashIn'}]){const r=(await f({...base,...filters},{})).meta;assert.equal(r.transferCashIn+r.transferCashOut,0)}
console.log('PASS: Book endpoint Bank 702134.13 -> 312124.13; Cash +390010; combined net unchanged; book/date/category/status filters.');})().catch(e=>{console.error(e);process.exitCode=1});
