const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PackagingManufacturerController = require("./packagingManufacturer.controller");
const router = require("express").Router();

router.post("/create", auth(), requireMenuPermission("packaging_manufacturer"), applyApprovalWorkflow({ modelKey: "packagingManufacturer", entityLabel: "Packaging Manufacturer" }), PackagingManufacturerController.insertIntoDB);
router.get("/", auth(), requireMenuPermission("packaging_manufacturer"), PackagingManufacturerController.getAllFromDB);
router.get("/all", auth(), requireMenuPermission("packaging_manufacturer"), PackagingManufacturerController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), requireMenuPermission("packaging_manufacturer"), PackagingManufacturerController.getDataById);
router.post("/:id/pay", auth(), requireMenuPermission("packaging_manufacturer"), PackagingManufacturerController.payManufacturerAmount);
router.delete("/:id", auth(), requireMenuPermission("packaging_manufacturer"), applyApprovalWorkflow({ modelKey: "packagingManufacturer", entityLabel: "Packaging Manufacturer" }), PackagingManufacturerController.deleteIdFromDB);
router.put("/:id", auth(), requireMenuPermission("packaging_manufacturer"), applyApprovalWorkflow({ modelKey: "packagingManufacturer", entityLabel: "Packaging Manufacturer" }), PackagingManufacturerController.updateOneFromDB);
router.post("/:id/approve", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), requireMenuPermission("packaging_manufacturer"), approvePendingWorkflow({ modelKey: "packagingManufacturer", entityLabel: "Packaging Manufacturer" }));

module.exports = router;
