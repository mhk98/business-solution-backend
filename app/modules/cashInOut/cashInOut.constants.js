const CashInOutFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "paymentStatus",
  "startDate",
  "endDate",
  "category",
  "lender",
  "loanId",
  "voucherNo",
  "bookId",
];

const CashInOutSearchableFields = [
  "status",
  "remarks",
  "amount",
  "paymentMode",
  "paymentStatus",
  "category",
  "bankAccount",
  "voucherNo",
]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  CashInOutFilterAbleFields,
  CashInOutSearchableFields,
};
