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

// One export object — a second `module.exports =` used to overwrite this, so
// the summary's from/to were dropped and the DM cards ignored the date filter.
module.exports = {
  MarketingExpenseFilterAbleFields,
  MarketingExpenseSearchableFields,
  MarketingExpenseOverviewFilterAbleFileds,
};
