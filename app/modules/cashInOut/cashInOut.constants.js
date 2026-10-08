const CashInOutFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "bankAccount",
  "paymentStatus",
  "startDate",
  "endDate",
  "category",
  "categoryId",
  "lender",
  "loanId",
  "voucherNo",
  "refNo",
  "bookId",
  "supplierId",
  "dollarSupplierId",
  "ownerId",
  "directorId",
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
