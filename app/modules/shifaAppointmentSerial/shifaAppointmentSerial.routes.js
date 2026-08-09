const router = require("express").Router();
const auth = require("../../middlewares/auth");
const { requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const ShifaAppointmentSerialController = require("./shifaAppointmentSerial.controller");

const appointmentSerialPermissions = [
  "shifa",
  "shifa_appointment_serial",
  "employee_profile",
  "employee_list",
  "employee_management",
];

router.post(
  "/create",
  auth(),
  requireAnyPermission(appointmentSerialPermissions),
  ShifaAppointmentSerialController.createSerial,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(appointmentSerialPermissions),
  ShifaAppointmentSerialController.getAllSerials,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(appointmentSerialPermissions),
  ShifaAppointmentSerialController.getDataById,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(appointmentSerialPermissions),
  ShifaAppointmentSerialController.updateSerial,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(appointmentSerialPermissions),
  ShifaAppointmentSerialController.deleteSerial,
);

module.exports = router;
