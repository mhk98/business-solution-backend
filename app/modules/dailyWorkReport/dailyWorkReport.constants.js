const DailyWorkReportFilterableFields = [
  "searchTerm",
  "reportDate",
  "status",
  "taskStatus",
  "userId",
  "employeeId",
  "departmentId",
  "startDate",
  "endDate",
];

const DailyWorkReportSearchableFields = [
  "todayWork",
  "tomorrowPlan",
  "blockers",
];

module.exports = {
  DailyWorkReportFilterableFields,
  DailyWorkReportSearchableFields,
};
