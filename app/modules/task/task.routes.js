const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const TaskController = require("./task.controller");

router.get(
  "/users",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  TaskController.getAssignableUsers,
);
router.get("/", auth(), TaskController.getTasks);
router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  TaskController.createTask,
);
router.put("/:id", auth(), TaskController.updateTask);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  TaskController.deleteTask,
);

module.exports = router;
