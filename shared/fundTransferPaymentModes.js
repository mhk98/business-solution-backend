const db = require('../models');

// Read transfers as paired movements; do not create duplicate cash ledger rows.
const getFundTransferPaymentModeRows = async (where = {}) => {
  const rows = await db.fundTransfer.findAll({
    where: { ...where, status: 'Active' },
    attributes: [
      'fromPaymentMode', 'toPaymentMode',
      [db.Sequelize.fn('SUM', db.Sequelize.col('amount')), 'total'],
    ],
    group: ['fromPaymentMode', 'toPaymentMode'],
    paranoid: true,
    raw: true,
  });
  return rows.flatMap((row) => [
    { paymentMode: row.fromPaymentMode, paymentStatus: 'CashOut', total: row.total },
    { paymentMode: row.toPaymentMode, paymentStatus: 'CashIn', total: row.total },
  ]);
};

module.exports = { getFundTransferPaymentModeRows };
