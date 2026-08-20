const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const DamageReturnService = require("./damageReturn.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await DamageReturnService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Damage Return created successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = req.query;
  const options = req.query;
  const result = await DamageReturnService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Damage Return records retrieved successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await DamageReturnService.deleteIdFromDB(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Damage Return record deleted successfully",
    data: result,
  });
});

module.exports = {
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
};
