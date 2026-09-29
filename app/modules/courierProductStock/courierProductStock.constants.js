const CourierProductStockFilterAbleFileds = [
  "searchTerm",
  "startDate",
  "endDate",
  "status",
];

const CourierProductStockSearchableFields = ["status"];

// "Approval Pending" is no longer offered (it stays in the model ENUM only so
// any older rows still load).
const CourierProductStockStatusOptions = ["Pending", "Return Request"];

module.exports = {
  CourierProductStockFilterAbleFileds,
  CourierProductStockSearchableFields,
  CourierProductStockStatusOptions,
};
