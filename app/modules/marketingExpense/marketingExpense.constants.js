const MarketingExpenseFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "paymentStatus",
  "startDate",
  "endDate",
  "category",
  "bookId",
];

const MarketingExpenseSearchableFields = [
  "status",
  "remarks",
  "paymentMode",
  "paymentStatus",
  "category",
]; // ✅ এখানে searchTerm দিবে না

// app/modules/overview/overview.constants.js

const MarketingExpenseOverviewFilterAbleFileds = ["from", "to"];

module.exports = { MarketingExpenseOverviewFilterAbleFileds };

module.exports = {
  MarketingExpenseFilterAbleFields,
  MarketingExpenseSearchableFields,
};
