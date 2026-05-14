const KPIFilterAbleFileds = [
  "searchTerm",
  "startDate",
  "endDate",
  "status",
  "userId",
  "employeeId",
  "departmentId",
  "designationId",
  "teamId",
  "periodType",
];

const KPISearchableFields = ["note", "status", "$employee.name$"];
const KPIEmployeeOptionFilterAbleFields = ["searchTerm", "status"];

module.exports = {
  KPIFilterAbleFileds,
  KPISearchableFields,
  KPIEmployeeOptionFilterAbleFields,
};
