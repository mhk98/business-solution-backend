const EmployeeWorkReportFilterableFields = [
  "searchTerm",
  "reportDate",
  "userId",
  "employeeId",
  "startDate",
  "endDate",
  "saleType",
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
  "notResponseGiven",
  "notResponseReceived",
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
  "callReceiveDone",
  "whatsappDone",
  "whatsappReceived",
  "totalAssign",
  "totalOrder",
  "totalAmount",
  "codChangeDiscount",
  "shippingCharge",
  "advancePayment",
];

module.exports = {
  EmployeeWorkReportFilterableFields,
  EmployeeWorkReportSearchableFields,
  EmployeeWorkReportNumericFields,
  EmployeeWorkReportSaleTypes,
};
