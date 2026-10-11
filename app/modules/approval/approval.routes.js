const router = require("express").Router();
const auth = require("../../middlewares/auth");
const ApprovalController = require("./approval.controller");

// Open to every signed-in user; the service answers isApprover=false (and
// refuses approve/reject) for anyone who is not admin, superAdmin or a department head.
router.get("/pending", auth(), ApprovalController.listPending);
router.post("/:key/approve", auth(), ApprovalController.approve);
router.post("/:key/reject", auth(), ApprovalController.reject);

module.exports = router;
