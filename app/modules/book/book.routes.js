const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const BookController = require("./book.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("book"),
  applyApprovalWorkflow({ modelKey: "book", entityLabel: "Book" }),
  BookController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("book"),
  BookController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("book"),
  BookController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("book"),

  BookController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("book"),
  applyApprovalWorkflow({ modelKey: "book", entityLabel: "Book" }),
  BookController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("book"),
  applyApprovalWorkflow({ modelKey: "book", entityLabel: "Book" }),
  BookController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("book"),
  approvePendingWorkflow({ modelKey: "book", entityLabel: "Book" }),
);
const BookRoutes = router;
module.exports = BookRoutes;
