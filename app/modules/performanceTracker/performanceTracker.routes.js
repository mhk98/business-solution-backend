const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const controller = require("./performanceTracker.controller");
const router = require("express").Router();

const permissions = ["marketing", "automated_performance_tracker"];

router.get("/dashboard", auth(), requireAnyPermission(permissions), controller.getDashboard);
router.get("/compare", auth(), requireAnyPermission(permissions), controller.getCompare);

router.post("/channels/create", auth(), requireAnyPermission(permissions), controller.createChannel);
router.get("/channels", auth(), requireAnyPermission(permissions), controller.getChannels);
router.get("/channels/all", auth(), requireAnyPermission(permissions), controller.getAllChannels);
router.put("/channels/:id", auth(), requireAnyPermission(permissions), controller.updateChannel);
router.delete("/channels/:id", auth(), requireAnyPermission(permissions), controller.deleteChannel);

router.post("/entries/create", auth(), requireAnyPermission(permissions), controller.createEntry);
router.get("/entries", auth(), requireAnyPermission(permissions), controller.getEntries);
router.get("/entries/all", auth(), requireAnyPermission(permissions), controller.getAllEntries);
router.put("/entries/:id", auth(), requireAnyPermission(permissions), controller.updateEntry);
router.delete("/entries/:id", auth(), requireAnyPermission(permissions), controller.deleteEntry);

router.get("/targets", auth(), requireAnyPermission(permissions), controller.getTargets);
router.put("/targets", auth(), requireAnyPermission(permissions), controller.saveTargets);

module.exports = router;
