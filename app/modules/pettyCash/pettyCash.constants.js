const pettyCashFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "paymentStatus",
  "status",
  "startDate",
  "endDate",
  "category",
  "mode",
  "bookId",
];

const pettyCashSearchableFields = [
  "status",
  "remarks",
  "paymentMode",
  "paymentStatus",
  "category",
  "amount",
]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  pettyCashFilterAbleFields,
  pettyCashSearchableFields,
};
