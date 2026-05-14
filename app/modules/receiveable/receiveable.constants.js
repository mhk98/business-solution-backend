const ReceiveableFilterAbleFields = [
  "searchTerm",
  "name",
  "startDate",
  "endDate",
];

// ✅ শুধু text field searchable হবে
const ReceiveableSearchableFields = ["name"];

module.exports = {
  ReceiveableFilterAbleFields,
  ReceiveableSearchableFields,
};
