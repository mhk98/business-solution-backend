const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ItemRequisitionService = require("./itemRequision.service");
const {
  ItemRequisitionFilterAbleFileds,
} = require("./itemRequision.constants");

const getUserDisplayName = (user = {}) => {
  const fullName = `${user.FirstName || ""} ${user.LastName || ""}`.trim();
  return fullName || user.Name || user.name || user.Email || user.email || null;
};

const insertIntoDB = catchAsync(async (req, res) => {
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;
  const result = await ItemRequisitionService.insertIntoDB({
    ...req.body,
    procurement: getUserDisplayName(req.user),
    userId: req.user?.Id || req.body.userId,
    file,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Item requisition data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ItemRequisitionFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ItemRequisitionService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Item requisition data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ItemRequisitionService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Item requisition data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;
  const { procurement: _procurement, ...body } = req.body;
  const result = await ItemRequisitionService.updateOneFromDB(req.params.id, {
    ...body,
    file,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Item requisition updated successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ItemRequisitionService.deleteIdFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Item requisition deleted successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await ItemRequisitionService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Item requisition data fetched!!",
    data: result,
  });
});

const ItemRequisitionController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = ItemRequisitionController;
