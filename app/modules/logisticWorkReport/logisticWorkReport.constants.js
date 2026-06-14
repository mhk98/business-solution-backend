const LogisticWorkReportFilterableFields = [
  "searchTerm",
  "name",
  "reportDate",
  "userId",
  "employeeId",
  "startDate",
  "endDate",
];

const LogisticWorkReportSearchableFields = ["name"];

const LogisticWorkReportNumericFields = [
  "pending",
  "cancelRequest",
  "cancelApprove",
  "cancelResend",
  "incomingReceive",
  "incomingSolve",
];

module.exports = {
  LogisticWorkReportFilterableFields,
  LogisticWorkReportSearchableFields,
  LogisticWorkReportNumericFields,
};
