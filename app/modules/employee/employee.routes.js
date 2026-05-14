const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const EmployeeController = require("./employee.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "employee", entityLabel: "Employee" }),
  EmployeeController.insertIntoDB,
);
router.get("/", auth(), EmployeeController.getAllFromDB);
router.get("/all", auth(), EmployeeController.getAllFromDBWithoutQuery);
router.get("/", auth(), EmployeeController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "employee", entityLabel: "Employee" }),
  EmployeeController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  applyApprovalWorkflow({ modelKey: "employee", entityLabel: "Employee" }),
  EmployeeController.updateOneFromDB,
);

router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "employee", entityLabel: "Employee" }),
);

const EmployeeRoutes = router;
module.exports = EmployeeRoutes;
