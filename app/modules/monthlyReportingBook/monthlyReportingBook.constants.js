const MonthlyReportingBookSummaryFilterAbleFields = [
  "month",
  "year",
  "startDate",
  "endDate",
  "bookId",
  "categoryId",
  "searchTerm",
];

const MonthlyReportingBookTransactionFilterAbleFields = [
  "month",
  "year",
  "startDate",
  "endDate",
  "bookId",
  "categoryId",
  "searchTerm",
];

const MonthlyReportingBookStatementFilterAbleFields = [
  "month",
  "year",
  "startDate",
  "endDate",
  "bookId",
  "includeInventoryStockReport",
];

module.exports = {
  MonthlyReportingBookSummaryFilterAbleFields,
  MonthlyReportingBookTransactionFilterAbleFields,
  MonthlyReportingBookStatementFilterAbleFields,
};
