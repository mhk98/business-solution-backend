// Cash direction alone does not identify a loan transaction. Each loan account
// represents one direction; use separate accounts when a party has both.
const summarizeLoan = (loanType = "BORROWED", cashIn = 0, cashOut = 0) => {
  cashIn = Number(cashIn || 0);
  cashOut = Number(cashOut || 0);
  const lent = loanType === "LENT";
  return {
    totalLoanTaken: lent ? 0 : cashIn,
    totalLoanPaid: lent ? 0 : cashOut,
    totalLoanGiven: lent ? cashOut : 0,
    totalLoanRecovered: lent ? cashIn : 0,
    principalAmount: lent ? cashOut : cashIn,
    principalSettled: lent ? cashIn : cashOut,
    outstandingBalance: lent ? cashOut - cashIn : cashIn - cashOut,
    // Keep the historical signed cash balance for existing integrations.
    netBalance: cashIn - cashOut,
    loanPayable: Math.max(cashIn - cashOut, 0),
    loanReceivable: Math.max(cashOut - cashIn, 0),
  };
};
const sumLoanBalances = (rows) => Object.fromEntries(
  Object.keys(summarizeLoan()).map((key) => [key,
    rows.reduce((sum, row) => sum + Number(row[key] || 0), 0),
  ]),
);
const transactionType = (loanType, paymentStatus) => loanType === "LENT"
  ? (paymentStatus === "CashOut" ? "LOAN_GIVEN" : "LOAN_RECOVERED")
  : (paymentStatus === "CashIn" ? "LOAN_TAKEN" : "LOAN_REPAID");
// Two-way party ledger: balance = CashIn - CashOut (positive = company owes the
// party, negative = party owes the company). A row's meaning depends on the
// balance just before it, e.g. CashIn while the party owes us is a recovery.
const ledgerEntryType = (balanceBefore, paymentStatus, amount) => {
  const before = Number(balanceBefore || 0);
  const value = Number(amount || 0);
  if (paymentStatus === "CashIn") {
    if (before >= 0) return "LOAN_TAKEN";
    return value <= -before ? "LOAN_RECOVERED" : "RECOVERED_AND_TAKEN";
  }
  if (before <= 0) return "LOAN_GIVEN";
  return value <= before ? "LOAN_REPAID" : "REPAID_AND_GIVEN";
};
module.exports = { summarizeLoan, sumLoanBalances, transactionType, ledgerEntryType };
