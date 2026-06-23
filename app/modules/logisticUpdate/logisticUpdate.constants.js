const LOGISTIC_UPDATE_TYPES = [
  "Entry Update",
  "Return Sheet Received",
  "Missing Parcel and Problem Parcel Followup",
  "Hold Parcel Received",
];

const LogisticUpdateFilterableFields = [
  "updateType",
  "startDate",
  "endDate",
  "departmentId",
];

module.exports = {
  LOGISTIC_UPDATE_TYPES,
  LogisticUpdateFilterableFields,
};
