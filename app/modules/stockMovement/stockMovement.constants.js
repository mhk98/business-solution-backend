const StockMovementFilterableFields = [
  "searchTerm",
  "sourceType",
  "sourceId",
  "operation",
  "stockType",
  "itemId",
  "productId",
  "manufacturerId",
  "name",
  "startDate",
  "endDate",
];

const StockMovementSearchableFields = [
  "sourceType",
  "operation",
  "stockType",
  "name",
  "direction",
  "unit",
];

module.exports = {
  StockMovementFilterableFields,
  StockMovementSearchableFields,
};
