// app/modules/overview/overview.controller.js

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const { OverviewFilterAbleFileds } = require("./overview.constants");
const OverviewService = require("./overview.service");

const getOverviewSummaryFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, OverviewFilterAbleFileds);

  const result = await OverviewService.getOverviewSummaryFromDB(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Overview summary fetched!!",
    data: result,
  });
});

const OverviewController = {
  getOverviewSummaryFromDB,
};

module.exports = OverviewController;
