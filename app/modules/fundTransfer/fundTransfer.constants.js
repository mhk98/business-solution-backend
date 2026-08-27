const FundTransferFilterAbleFields = [
  "searchTerm",
  "startDate",
  "endDate",
  "bookId",
  "fromPaymentMode",
  "toPaymentMode",
  "fromBankAccount",
  "toBankAccount",
  "voucherNo",
  "status",
];

const FundTransferSearchableFields = [
  "note",
  "remarks",
  "voucherNo",
  "fromBankName",
  "toBankName",
  "fromPaymentMode",
  "toPaymentMode",
  "status",
];

module.exports = {
  FundTransferFilterAbleFields,
  FundTransferSearchableFields,
};
