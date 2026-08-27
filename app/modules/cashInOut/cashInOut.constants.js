const CashInOutFilterAbleFields = [
  "searchTerm",
  "paymentMode",
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
