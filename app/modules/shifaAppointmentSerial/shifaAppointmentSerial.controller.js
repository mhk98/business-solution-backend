const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ShifaAppointmentSerialService = require("./shifaAppointmentSerial.service");
const { ShifaAppointmentSerialFilterableFields } = require("./shifaAppointmentSerial.constants");

const createSerial = catchAsync(async (req, res) => {
  const result = await ShifaAppointmentSerialService.createSerial(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Appointment serial created successfully",
    data: result,
  });
});

const getAllSerials = catchAsync(async (req, res) => {
  const filters = pick(req.query, ShifaAppointmentSerialFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ShifaAppointmentSerialService.getAllSerials(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Appointment serials fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ShifaAppointmentSerialService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Appointment serial fetched successfully",
    data: result,
  });
});

const updateSerial = catchAsync(async (req, res) => {
  const result = await ShifaAppointmentSerialService.updateSerial(req.params.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Appointment serial updated successfully",
    data: result,
  });
});

const deleteSerial = catchAsync(async (req, res) => {
  const result = await ShifaAppointmentSerialService.deleteSerial(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Appointment serial deleted successfully",
    data: result,
  });
});

module.exports = {
  createSerial,
  getAllSerials,
  getDataById,
  updateSerial,
  deleteSerial,
};
