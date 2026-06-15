const EmployeeWorkReportFilterableFields = [
  "searchTerm",
  "reportDate",
  "userId",
  "employeeId",
  "startDate",
  "endDate",
];

const EmployeeWorkReportSearchableFields = ["name"];

const EmployeeWorkReportSaleTypes = [
  "Regular Sale",
  "Up Sale",
  "Cross Sale",
  "Organic Sale",
  "Office Sale",
];

const EmployeeWorkReportNumericFields = [
  "failedGiven",
  "failedReceived",
  "pendingGiven",
  "pendingReceived",
  "pendingReturnReceived",
  "leadGiven",
  "leadReceived",
  "crossReceived",
  "canceledReceived",
  "holdReceived",
  "ideskGiven",
  "ideskReceived",
  "callDone",
  "callReceived",
  "whatsappDone",
  "whatsappReceived",
  "totalAssign",
  "totalOrder",
  "totalAmount",
];

module.exports = {
  EmployeeWorkReportFilterableFields,
  EmployeeWorkReportSearchableFields,
  EmployeeWorkReportNumericFields,
  EmployeeWorkReportSaleTypes,
};
