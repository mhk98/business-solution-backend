const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const NoticeService = require("./notice.service");

const createNotice = catchAsync(async (req, res) => {
  const result = await NoticeService.createNotice(req.body, req.user);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Notice created successfully",
    data: result,
  });
});

const getLatestNotice = catchAsync(async (req, res) => {
  const result = await NoticeService.getLatestNotice();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Latest notice fetched successfully",
    data: result,
  });
});

const getAllNotices = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["status", "searchTerm"]);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await NoticeService.getAllNotices(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notices fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const updateNotice = catchAsync(async (req, res) => {
  const result = await NoticeService.updateNotice(req.params.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notice updated successfully",
    data: result,
  });
});

const deleteNotice = catchAsync(async (req, res) => {
  const result = await NoticeService.deleteNotice(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notice deleted successfully",
    data: result,
  });
});

module.exports = {
  createNotice,
  getLatestNotice,
  getAllNotices,
  updateNotice,
  deleteNotice,
};
