const AttendanceEnrollmentFilterAbleFields = [
  "searchTerm",
  "employeeId",
  "attendanceDeviceId",
  "deviceUserId",
  "enrollmentStatus",
  "status",
];

const AttendanceEnrollmentSearchableFields = ["deviceUserId", "enrollmentStatus", "status", "note"];

module.exports = {
  AttendanceEnrollmentFilterAbleFields,
  AttendanceEnrollmentSearchableFields,
};
