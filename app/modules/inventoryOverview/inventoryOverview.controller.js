// // app/modules/InventoryOverview/InventoryOverview.controller.js

// const catchAsync = require("../../../shared/catchAsync");
// const pick = require("../../../shared/pick");
// const sendResponse = require("../../../shared/sendResponse");
// const {
//   InventoryOverviewFilterAbleFileds,
// } = require("./inventoryOverview.constants");
// const InventoryOverviewService = require("./inventoryOverview.service");

// // const getInventoryOverviewSummaryFromDB = catchAsync(async (req, res) => {
// //   const filters = pick(req.query, InventoryOverviewFilterAbleFileds);

// //   const result =
// //     await InventoryOverviewService.getInventoryOverviewSummaryFromDB(filters);

// //   sendResponse(res, {
// //     statusCode: 200,
// //     success: true,
// //     message: "InventoryOverview summary fetched!!",
// //     data: result,
// //   });
// // });

// // GET /inventory-overview/list?from=2026-02-01&to=2026-02-29&name=Attar

// const getInventoryOverviewList = catchAsync(async (req, res) => {
//   const filters = pick(req.query, InventoryOverviewFilterAbleFileds);

//   // const { from, to, name } = req.query;

//   const result =
//     await InventoryOverviewService.getInventoryOverviewSummaryFromDB(filters);

//   res.status(200).json({
//     success: true,
//     message: "Inventory overview list fetched!",
//     meta: result.meta,
//     data: result.data,
//   });
// });

// const InventoryOverviewController = {
//   getInventoryOverviewList,
// };

// module.exports = InventoryOverviewController;

// app/modules/InventoryOverview/inventoryOverview.controller.js

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const {
  InventoryOverviewFilterAbleFileds,
} = require("./inventoryOverview.constants");
const InventoryOverviewService = require("./inventoryOverview.service");

// ✅ GET /inventory-overview/list?from=&to=&name=&page=&limit=
const getInventoryOverviewList = catchAsync(async (req, res) => {
  const filters = pick(req.query, InventoryOverviewFilterAbleFileds);

  const result =
    await InventoryOverviewService.getInventoryOverviewListFromDB(filters);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Inventory overview list fetched!",
    meta: result.meta,
    data: result.data,
  });
});

// ✅ GET /inventory-overview/summary?from=&to=
const getInventoryOverviewSummary = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["from", "to", "name", "source"]);

  const result =
    await InventoryOverviewService.getInventoryOverviewSummaryFromDB(filters);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "InventoryOverview summary fetched!!",
    data: result,
  });
});

module.exports = {
  getInventoryOverviewList,
  getInventoryOverviewSummary,
};
