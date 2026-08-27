const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const MonthlyReportingBookService = require("./monthlyReportingBook.service");
const {
  MonthlyReportingBookSummaryFilterAbleFields,
  MonthlyReportingBookTransactionFilterAbleFields,
  MonthlyReportingBookStatementFilterAbleFields,
} = require("./monthlyReportingBook.constants");

const getMonthlySummary = catchAsync(async (req, res) => {
  const filters = pick(req.query, MonthlyReportingBookSummaryFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await MonthlyReportingBookService.getMonthlySummary(
    filters,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Monthly Reporting Book summary fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getMonthlyTransactions = catchAsync(async (req, res) => {
  const filters = pick(
    req.query,
    MonthlyReportingBookTransactionFilterAbleFields,
  );
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await MonthlyReportingBookService.getMonthlyTransactions(
    filters,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Monthly Reporting Book transactions fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getBookStatement = catchAsync(async (req, res) => {
  const filters = pick(req.query, MonthlyReportingBookStatementFilterAbleFields);

  const result = await MonthlyReportingBookService.getBookStatement(filters);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Book statement fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const MonthlyReportingBookController = {
  getMonthlySummary,
  getMonthlyTransactions,
  getBookStatement,
};

module.exports = MonthlyReportingBookController;
