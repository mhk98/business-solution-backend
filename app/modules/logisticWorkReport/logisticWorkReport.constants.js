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
  "entryUpdate",
  "returnSheetReceived",
  "exchangePrint",
  "missingProblemParcelFollowup",
  "holdParcelReceived",
  "csProblemSolve",
  "pendingAssign",
  "completedPendingAssign",
];

module.exports = {
  LogisticWorkReportFilterableFields,
  LogisticWorkReportSearchableFields,
  LogisticWorkReportNumericFields,
};
