const SHIFA_REPORT_TYPES = {
  CALL_HISTORY: "call_history",
  STARTING_SITUATION: "starting_situation",
  PROBLEM_HISTORY: "problem_history",
  PATIENT_UPDATE: "patient_update",
};

const ShifaReportTypeValues = Object.values(SHIFA_REPORT_TYPES);

const ShifaReportFilterableFields = [
  "searchTerm",
  "reportType",
  "name",
  "phone",
  "reportDate",
  "userId",
  "employeeId",
  "startDate",
  "endDate",
];

const ShifaReportSearchableFields = [
  "name",
  "phone",
  "callerName",
  "relation",
  "address",
  "callHistory",
  "startingSituation",
  "problemHistory",
  "patientUpdate",
  "notes",
];

const ShifaReportTextFields = [
  "phone",
  "age",
  "gender",
  "address",
  "callerName",
  "relation",
  "callHistory",
  "startingSituation",
  "problemHistory",
  "patientUpdate",
  "notes",
  "nextFollowUpDate",
];

const ShifaReportNumericFields = [
  "phoneCalled",
  "phoneNotReceived",
  "phoneOff",
  "numberBusy",
  "refusedCall",
  "callCut",
  "started",
  "notStarted",
  "startingOther",
  "spousePractice",
  "evilEye",
  "marriageObstacle",
  "livelihoodObstacle",
  "jinnAndMagic",
  "separation",
  "noChild",
  "problemOther",
  "improving",
  "notImproving",
];

module.exports = {
  SHIFA_REPORT_TYPES,
  ShifaReportTypeValues,
  ShifaReportFilterableFields,
  ShifaReportSearchableFields,
  ShifaReportTextFields,
  ShifaReportNumericFields,
};
