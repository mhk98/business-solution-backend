const router = require("express").Router();
const auth = require("../../middlewares/auth");
const { requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const LogisticUpdateController = require("./logisticUpdate.controller");

const permissions = [
  "logistic_update",
  "logistic_work_reports",
  "employee_profile",
  "employee_list",
  "employee_management",
];

router.post("/create", auth(), requireAnyPermission(permissions), LogisticUpdateController.createUpdate);
router.get("/", auth(), requireAnyPermission(permissions), LogisticUpdateController.getAll);
router.get("/departments", auth(), requireAnyPermission(permissions), LogisticUpdateController.getDepartments);
router.put("/:id", auth(), requireAnyPermission(permissions), LogisticUpdateController.updateOne);
router.get("/:id", auth(), requireAnyPermission(permissions), LogisticUpdateController.getDataById);

module.exports = router;
