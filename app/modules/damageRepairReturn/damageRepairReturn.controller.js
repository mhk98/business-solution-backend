const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const DamageRepairReturnService = require("./damageRepairReturn.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await DamageRepairReturnService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Damage Repairing Return created successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = req.query;
  const options = req.query;
  const result = await DamageRepairReturnService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Damage Repairing Return records retrieved successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await DamageRepairReturnService.deleteIdFromDB(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Damage Repairing Return record deleted successfully",
    data: result,
  });
});

module.exports = {
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
};
