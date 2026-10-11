const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const ApprovalService = require("./approval.service");

const listPending = catchAsync(async (req, res) => {
  const result = await ApprovalService.listPending(req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pending approvals fetched successfully",
    meta: { isApprover: result.isApprover, count: result.items.length },
    data: result.items,
  });
});

const approve = catchAsync(async (req, res) => {
  const result = await ApprovalService.approve(req.params.key, req.user, req);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Approved",
    data: result,
  });
});

const reject = catchAsync(async (req, res) => {
  const result = await ApprovalService.reject(req.params.key, req.user, req.body?.note);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Rejected",
    data: result,
  });
});

module.exports = {
  listPending,
  approve,
  reject,
};
