const BankAccountFilterAbleFields = ["searchTerm", "accountType"];
const BankAccountSearchableFields = ["bankName", "accountNumber"];

// Payment modes that are backed by a BankAccount row (Cash is not).
const ACCOUNT_TYPES = ["Bank", "Bkash", "Nagad", "Rocket"];

module.exports = {
  BankAccountFilterAbleFields,
  BankAccountSearchableFields,
  ACCOUNT_TYPES,
};
