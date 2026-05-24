/* eslint-disable @typescript-eslint/no-var-requires */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("../db/db");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DataTypes, Op } = require("sequelize");

// =====================
// Define models
// =====================
db.user = require("../app/modules/user/user.model")(db.sequelize, DataTypes);
db.rolePermission =
  require("../app/modules/rolePermission/rolePermission.model")(
    db.sequelize,
    DataTypes,
  );
db.userLogHistory =
  require("../app/modules/userLogHistory/userLogHistory.model")(
    db.sequelize,
    DataTypes,
  );

db.product = require("../app/modules/product/product.model")(
  db.sequelize,
  DataTypes,
);
db.variation = require("../app/modules/variation/variation.model")(
  db.sequelize,
  DataTypes,
);
db.item = require("../app/modules/item/item.model")(db.sequelize, DataTypes);
db.itemMaster = require("../app/modules/itemMaster/itemMaster.model")(
  db.sequelize,
  DataTypes,
);
db.manufacture = require("../app/modules/manufacture/manufacture.model")(
  db.sequelize,
  DataTypes,
);
db.stockAdjustment =
  require("../app/modules/stockAdjustment/stockAdjustment.model")(
    db.sequelize,
    DataTypes,
  );
db.mixer = require("../app/modules/mixer/mixer.model")(db.sequelize, DataTypes);

db.receivedProduct =
  require("../app/modules/receivedProduct/receivedProduct.model")(
    db.sequelize,
    DataTypes,
  );
db.inventoryMaster =
  require("../app/modules/inventoryMaster/inventoryMaster.model")(
    db.sequelize,
    DataTypes,
  );

db.inTransitProduct =
  require("../app/modules/inTransitProduct/inTransitProduct.model")(
    db.sequelize,
    DataTypes,
  );

db.returnProduct = require("../app/modules/returnProduct/returnProduct.model")(
  db.sequelize,
  DataTypes,
);

db.purchaseReturnProduct =
  require("../app/modules/purchaseReturnProduct/purchaseReturnProduct.model")(
    db.sequelize,
    DataTypes,
  );

db.confirmOrder = require("../app/modules/confirmOrder/confirmOrder.model")(
  db.sequelize,
  DataTypes,
);

db.warrantyProduct =
  require("../app/modules/warrantyProduct/warrantyProduct.model")(
    db.sequelize,
    DataTypes,
  );

db.damageProduct = require("../app/modules/damageProduct/damageProduct.model")(
  db.sequelize,
  DataTypes,
);
db.damageStock = require("../app/modules/damageStock/damageStock.model")(
  db.sequelize,
  DataTypes,
);

db.damageReparingStock =
  require("../app/modules/damageReparingStock/damageReparingStock.model")(
    db.sequelize,
    DataTypes,
  );

db.damageRepair = require("../app/modules/damageRepair/damageRepair.model")(
  db.sequelize,
  DataTypes,
);

db.damageRepaired =
  require("../app/modules/damageRepaired/damageRepaired.model")(
    db.sequelize,
    DataTypes,
  );

db.meta = require("../app/modules/meta/meta.model")(db.sequelize, DataTypes);

db.asset = require("../app/modules/asset/asset.model")(db.sequelize, DataTypes);

db.assetsPurchase =
  require("../app/modules/assetsPurchase/assetsPurchase.model")(
    db.sequelize,
    DataTypes,
  );

db.assetsStock = require("../app/modules/assetsStock/assetsStock.model")(
  db.sequelize,
  DataTypes,
);

db.assetsSale = require("../app/modules/assetsSale/assetsSale.model")(
  db.sequelize,
  DataTypes,
);

db.assetsDamage = require("../app/modules/assetsDamage/assetsDamage.model")(
  db.sequelize,
  DataTypes,
);

db.cashIn = require("../app/modules/cashIn/cashIn.model")(
  db.sequelize,
  DataTypes,
);

db.pettyCash = require("../app/modules/pettyCash/pettyCash.model")(
  db.sequelize,
  DataTypes,
);
db.pettyCashRequisition =
  require("../app/modules/pettyCash/pettyCashRequisition.model")(
    db.sequelize,
    DataTypes,
  );
db.ledger = require("../app/modules/ledger/ledger.model")(
  db.sequelize,
  DataTypes,
);
db.ledgerHistory = require("../app/modules/ledgerHistory/ledgerHistory.model")(
  db.sequelize,
  DataTypes,
);

db.expense = require("../app/modules/expense/expense.model")(
  db.sequelize,
  DataTypes,
);

db.book = require("../app/modules/book/book.model")(db.sequelize, DataTypes);

db.profitLoss = require("../app/modules/profitLoss/profitLoss.model")(
  db.sequelize,
  DataTypes,
);

db.marketingBook = require("../app/modules/marketingBook/marketingBook.model")(
  db.sequelize,
  DataTypes,
);
db.marketingExpense =
  require("../app/modules/marketingExpense/marketingExpense.model")(
    db.sequelize,
    DataTypes,
  );
db.adsCampaignKPI =
  require("../app/modules/adsCampaignKPI/adsCampaignKPI.model")(
    db.sequelize,
    DataTypes,
  );
db.adsAccount = require("../app/modules/adsCampaignKPI/adsAccount.model")(
  db.sequelize,
  DataTypes,
);

db.category = require("../app/modules/category/category.model")(
  db.sequelize,
  DataTypes,
);

db.bankAccount = require("../app/modules/bankAccount/bankAccount.model")(
  db.sequelize,
  DataTypes,
);

db.supplier = require("../app/modules/supplier/supplier.model")(
  db.sequelize,
  DataTypes,
);

db.loan = require("../app/modules/loan/loan.model")(db.sequelize, DataTypes);

db.supplierHistory =
  require("../app/modules/supplierHistory/supplierHistory.model")(
    db.sequelize,
    DataTypes,
  );

db.warehouse = require("../app/modules/warehouse/warehouse.model")(
  db.sequelize,
  DataTypes,
);

db.cashInOut = require("../app/modules/cashInOut/cashInOut.model")(
  db.sequelize,
  DataTypes,
);

db.receiveable = require("../app/modules/receiveable/receiveable.model")(
  db.sequelize,
  DataTypes,
);

db.payable = require("../app/modules/payable/payable.model")(
  db.sequelize,
  DataTypes,
);

db.kpi = require("../app/modules/kpi/kpi.model")(db.sequelize, DataTypes);
db.kpiSetting = require("../app/modules/kpi/kpiSetting.model")(
  db.sequelize,
  DataTypes,
);
db.employee = require("../app/modules/employee/employee.model")(
  db.sequelize,
  DataTypes,
);

db.employeeList = require("../app/modules/employeeList/employeeList.model")(
  db.sequelize,
  DataTypes,
);
db.dailyWorkReport =
  require("../app/modules/dailyWorkReport/dailyWorkReport.model")(
    db.sequelize,
    DataTypes,
  );
db.dailyWorkReportTask =
  require("../app/modules/dailyWorkReport/dailyWorkReportTask.model")(
    db.sequelize,
    DataTypes,
  );
db.performanceEvaluation =
  require("../app/modules/dailyWorkReport/performanceEvaluation.model")(
    db.sequelize,
    DataTypes,
  );
db.performanceScore =
  require("../app/modules/dailyWorkReport/performanceScore.model")(
    db.sequelize,
    DataTypes,
  );
db.employeeWorkReport =
  require("../app/modules/employeeWorkReport/employeeWorkReport.model")(
    db.sequelize,
    DataTypes,
  );
db.logisticWorkReport =
  require("../app/modules/logisticWorkReport/logisticWorkReport.model")(
    db.sequelize,
    DataTypes,
  );

db.department = require("../app/modules/department/department.model")(
  db.sequelize,
  DataTypes,
);

db.designation = require("../app/modules/designation/designation.model")(
  db.sequelize,
  DataTypes,
);

db.team = require("../app/modules/team/team.model")(db.sequelize, DataTypes);

db.shift = require("../app/modules/shift/shift.model")(db.sequelize, DataTypes);

db.holiday = require("../app/modules/holiday/holiday.model")(
  db.sequelize,
  DataTypes,
);

db.attendanceDevice =
  require("../app/modules/attendanceDevice/attendanceDevice.model")(
    db.sequelize,
    DataTypes,
  );

db.attendanceEnrollment =
  require("../app/modules/attendanceEnrollment/attendanceEnrollment.model")(
    db.sequelize,
    DataTypes,
  );

db.attendanceLog = require("../app/modules/attendanceLog/attendanceLog.model")(
  db.sequelize,
  DataTypes,
);

db.attendanceSummary =
  require("../app/modules/attendanceSummary/attendanceSummary.model")(
    db.sequelize,
    DataTypes,
  );

db.attendanceRegularization =
  require("../app/modules/attendanceRegularization/attendanceRegularization.model")(
    db.sequelize,
    DataTypes,
  );

db.leaveType = require("../app/modules/leaveType/leaveType.model")(
  db.sequelize,
  DataTypes,
);

db.leaveRequest = require("../app/modules/leaveRequest/leaveRequest.model")(
  db.sequelize,
  DataTypes,
);

db.payrollRun = require("../app/modules/payrollRun/payrollRun.model")(
  db.sequelize,
  DataTypes,
);

db.payrollItem = require("../app/modules/payrollItem/payrollItem.model")(
  db.sequelize,
  DataTypes,
);

db.notification = require("../app/modules/notification/notification.model")(
  db.sequelize,
  DataTypes,
);
db.notice = require("../app/modules/notice/notice.model")(
  db.sequelize,
  DataTypes,
);
db.codCharge = require("../app/modules/chargeSetting/codCharge.model")(
  db.sequelize,
  DataTypes,
);
db.codChange = require("../app/modules/chargeSetting/codChange.model")(
  db.sequelize,
  DataTypes,
);
db.deliveryCharge =
  require("../app/modules/chargeSetting/deliveryCharge.model")(
    db.sequelize,
    DataTypes,
  );
db.deliveryAdvance =
  require("../app/modules/chargeSetting/deliveryAdvance.model")(
    db.sequelize,
    DataTypes,
  );
db.task = require("../app/modules/task/task.model")(db.sequelize, DataTypes);
db.chatConversation = require("../app/modules/chat/chatConversation.model")(
  db.sequelize,
  DataTypes,
);
db.chatMessage = require("../app/modules/chat/chatMessage.model")(
  db.sequelize,
  DataTypes,
);

db.salary = require("../app/modules/salary/salary.model")(
  db.sequelize,
  DataTypes,
);

db.logo = require("../app/modules/logo/logo.model")(db.sequelize, DataTypes);

db.purchaseRequisition =
  require("../app/modules/purchaseRequision/purchaseRequisition.model")(
    db.sequelize,
    DataTypes,
  );

db.assetsRequisition =
  require("../app/modules/assetsRequisition/assetsRequisition.model")(
    db.sequelize,
    DataTypes,
  );

db.posReport = require("../app/modules/posReport/posReport.model")(
  db.sequelize,
  DataTypes,
);

db.task.belongsTo(db.user, {
  foreignKey: "assignedToUserId",
  as: "assignedTo",
});
db.task.belongsTo(db.user, {
  foreignKey: "assignedByUserId",
  as: "assignedBy",
});

// =====================
// Associations
// লক্ষ্য: সব জায়গায় include এ as: "supplier" এবং as: "warehouse" কাজ করবে
// নিয়ম:
// 1) CHILD model এ belongsTo(..., { as: "supplier"/"warehouse" }) থাকবে
// 2) Parent side (Supplier/Warehouse hasMany) এ as দিবেন না (alias duplicate error হয়)
// =====================

//Variation relation with product
// db.product.hasMany(db.variation, { foreignKey: "productId" });
// db.variation.belongsTo(db.product, {
//   foreignKey: "productId",
//   as: "product",
// });

db.product.hasMany(db.variation, {
  foreignKey: "productId",
  as: "variations",
});

db.variation.belongsTo(db.product, {
  foreignKey: "productId",
  as: "product",
});
// ---- base product relations

db.supplier.hasMany(db.supplierHistory, { foreignKey: "supplierId" });
db.supplierHistory.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

db.book.hasMany(db.supplierHistory, { foreignKey: "bookId" });
db.supplierHistory.belongsTo(db.book, { foreignKey: "bookId", as: "book" });

db.item.hasMany(db.manufacture, { foreignKey: "itemId" });
db.manufacture.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.manufacture, { foreignKey: "productId" });
db.manufacture.belongsTo(db.product, { foreignKey: "productId" });

db.supplier.hasMany(db.manufacture, { foreignKey: "supplierId" });
db.manufacture.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});
db.supplier.hasMany(db.stockAdjustment, { foreignKey: "supplierId" });
db.stockAdjustment.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// db.item.hasMany(db.mixer, { foreignKey: "itemId" });
// db.mixer.belongsTo(db.item, { foreignKey: "itemId", as: "item" });

db.product.hasMany(db.mixer, { foreignKey: "productId" });
db.mixer.belongsTo(db.product, { foreignKey: "productId", as: "product" });

db.item.hasMany(db.itemMaster, { foreignKey: "itemId" });
db.itemMaster.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.itemMaster, { foreignKey: "productId" });
db.itemMaster.belongsTo(db.product, { foreignKey: "productId" });

db.product.hasMany(db.receivedProduct, { foreignKey: "productId" });
db.receivedProduct.belongsTo(db.product, { foreignKey: "productId" });

db.product.hasMany(db.inventoryMaster, { foreignKey: "productId" });
db.inventoryMaster.belongsTo(db.product, { foreignKey: "productId" });

// db.supplier.hasMany(db.inventoryMaster, { foreignKey: "supplierId" });
// db.inventoryMaster.belongsTo(db.supplier, { foreignKey: "supplierId" });

// db.warehouse.hasMany(db.inventoryMaster, { foreignKey: "warehousId" });
// db.inventoryMaster.belongsTo(db.warehouse, { foreignKey: "warehousId" });

db.inventoryMaster.hasMany(db.returnProduct, { foreignKey: "productId" });
db.returnProduct.belongsTo(db.inventoryMaster, { foreignKey: "productId" });

db.inventoryMaster.hasMany(db.inTransitProduct, { foreignKey: "productId" });
db.inTransitProduct.belongsTo(db.inventoryMaster, { foreignKey: "productId" });

db.inventoryMaster.hasMany(db.damageProduct, { foreignKey: "productId" });
db.damageProduct.belongsTo(db.inventoryMaster, { foreignKey: "productId" });

db.product.hasMany(db.damageStock, { foreignKey: "productId" });
db.damageStock.belongsTo(db.product, { foreignKey: "productId" });

db.damageStock.hasMany(db.damageRepair, { foreignKey: "productId" });
db.damageRepair.belongsTo(db.damageStock, { foreignKey: "productId" });

db.product.hasMany(db.damageReparingStock, { foreignKey: "productId" });
db.damageReparingStock.belongsTo(db.product, { foreignKey: "productId" });

db.damageReparingStock.hasMany(db.damageRepaired, { foreignKey: "productId" });
db.damageRepaired.belongsTo(db.damageReparingStock, {
  foreignKey: "productId",
});

// db.damageStock.hasMany(db.damageRepaired, { foreignKey: "productId" });
// db.damageRepaired.belongsTo(db.damageStock, { foreignKey: "productId" });

db.inventoryMaster.hasMany(db.purchaseReturnProduct, {
  foreignKey: "productId",
});
// NOTE: আপনার আগের মতোই রেখেছি (যদি ভুল হয়, receivedProduct/ product কোনটা হবে সেটা আপনার ডাটা কাঠামো অনুযায়ী ঠিক করবেন)
db.purchaseReturnProduct.belongsTo(db.inventoryMaster, {
  foreignKey: "productId",
});

// db.product.hasMany(db.confirmOrder, { foreignKey: "productId" });
// db.confirmOrder.belongsTo(db.product, { foreignKey: "productId" });

db.confirmOrder.belongsTo(db.product, {
  foreignKey: "productId",
  as: "product",
});
db.product.hasMany(db.confirmOrder, {
  foreignKey: "productId",
  as: "confirmOrders",
});

db.book.hasMany(db.cashInOut, { foreignKey: "bookId" });
db.cashInOut.belongsTo(db.book, { foreignKey: "bookId" });

db.book.hasMany(db.pettyCash, { foreignKey: "bookId" });
db.pettyCash.belongsTo(db.book, { foreignKey: "bookId", as: "book" });

db.book.hasMany(db.pettyCashRequisition, { foreignKey: "bookId" });
db.pettyCashRequisition.belongsTo(db.book, {
  foreignKey: "bookId",
  as: "book",
});

db.supplier.hasMany(db.ledger, { foreignKey: "supplierId" });
db.ledger.belongsTo(db.supplier, { foreignKey: "supplierId", as: "supplier" });

db.user.hasOne(db.employeeList, {
  foreignKey: "userId",
  as: "employeeProfile",
});
db.employeeList.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.user.hasMany(db.kpi, {
  foreignKey: "userId",
  as: "kpis",
});
db.kpi.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});
db.employeeList.hasMany(db.kpi, {
  foreignKey: "employeeId",
  as: "kpis",
});
db.kpi.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});
db.user.hasMany(db.dailyWorkReport, {
  foreignKey: "userId",
  as: "dailyWorkReports",
});
db.dailyWorkReport.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.employeeList.hasMany(db.dailyWorkReport, {
  foreignKey: "employeeId",
  as: "dailyWorkReports",
});
db.dailyWorkReport.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.user.hasMany(db.dailyWorkReport, {
  foreignKey: "reviewedByUserId",
  as: "reviewedDailyWorkReports",
});
db.dailyWorkReport.belongsTo(db.user, {
  foreignKey: "reviewedByUserId",
  as: "reviewedBy",
});

db.dailyWorkReport.hasMany(db.dailyWorkReportTask, {
  foreignKey: "reportId",
  as: "tasks",
});
db.dailyWorkReportTask.belongsTo(db.dailyWorkReport, {
  foreignKey: "reportId",
  as: "report",
});
db.task.hasMany(db.dailyWorkReportTask, {
  foreignKey: "taskId",
  as: "dailyReportUpdates",
});
db.dailyWorkReportTask.belongsTo(db.task, {
  foreignKey: "taskId",
  as: "linkedTask",
});

db.dailyWorkReport.hasOne(db.performanceEvaluation, {
  foreignKey: "reportId",
  as: "evaluation",
});
db.performanceEvaluation.belongsTo(db.dailyWorkReport, {
  foreignKey: "reportId",
  as: "report",
});
db.user.hasMany(db.performanceEvaluation, {
  foreignKey: "reviewedByUserId",
  as: "dailyWorkEvaluations",
});
db.performanceEvaluation.belongsTo(db.user, {
  foreignKey: "reviewedByUserId",
  as: "reviewedBy",
});

db.dailyWorkReport.hasOne(db.performanceScore, {
  foreignKey: "reportId",
  as: "performanceScore",
});
db.performanceScore.belongsTo(db.dailyWorkReport, {
  foreignKey: "reportId",
  as: "report",
});
db.employeeList.hasMany(db.performanceScore, {
  foreignKey: "employeeId",
  as: "performanceScores",
});
db.performanceScore.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});
db.user.hasMany(db.performanceScore, {
  foreignKey: "userId",
  as: "performanceScores",
});
db.performanceScore.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.user.hasMany(db.employeeWorkReport, {
  foreignKey: "userId",
  as: "employeeWorkReports",
});
db.employeeWorkReport.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.employeeList.hasMany(db.employeeWorkReport, {
  foreignKey: "employeeId",
  as: "employeeWorkReports",
});
db.employeeWorkReport.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.user.hasMany(db.logisticWorkReport, {
  foreignKey: "userId",
  as: "logisticWorkReports",
});
db.logisticWorkReport.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.employeeList.hasMany(db.logisticWorkReport, {
  foreignKey: "employeeId",
  as: "logisticWorkReports",
});
db.logisticWorkReport.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.user.hasMany(db.userLogHistory, {
  foreignKey: "userId",
  as: "activityLogs",
});
db.userLogHistory.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.user.hasMany(db.chatConversation, {
  foreignKey: "userOneId",
  as: "chatConversationsAsUserOne",
});
db.chatConversation.belongsTo(db.user, {
  foreignKey: "userOneId",
  as: "userOne",
});
db.user.hasMany(db.chatConversation, {
  foreignKey: "userTwoId",
  as: "chatConversationsAsUserTwo",
});
db.chatConversation.belongsTo(db.user, {
  foreignKey: "userTwoId",
  as: "userTwo",
});
db.chatConversation.hasMany(db.chatMessage, {
  foreignKey: "conversationId",
  as: "messages",
});
db.chatMessage.belongsTo(db.chatConversation, {
  foreignKey: "conversationId",
  as: "conversation",
});
db.chatConversation.belongsTo(db.chatMessage, {
  foreignKey: "lastMessageId",
  as: "lastMessage",
  constraints: false,
});
db.user.hasMany(db.chatMessage, {
  foreignKey: "senderUserId",
  as: "sentChatMessages",
});
db.chatMessage.belongsTo(db.user, {
  foreignKey: "senderUserId",
  as: "sender",
});
db.user.hasMany(db.chatMessage, {
  foreignKey: "receiverUserId",
  as: "receivedChatMessages",
});
db.chatMessage.belongsTo(db.user, {
  foreignKey: "receiverUserId",
  as: "receiver",
});

db.department.hasMany(db.designation, {
  foreignKey: "departmentId",
  as: "designations",
});
db.designation.belongsTo(db.department, {
  foreignKey: "departmentId",
  as: "department",
});

db.department.hasMany(db.team, {
  foreignKey: "departmentId",
  as: "teams",
});
db.team.belongsTo(db.department, {
  foreignKey: "departmentId",
  as: "department",
});

db.department.hasMany(db.employeeList, {
  foreignKey: "departmentId",
  as: "employees",
});
db.employeeList.belongsTo(db.department, {
  foreignKey: "departmentId",
  as: "department",
});

db.designation.hasMany(db.employeeList, {
  foreignKey: "designationId",
  as: "employees",
});
db.employeeList.belongsTo(db.designation, {
  foreignKey: "designationId",
  as: "designation",
});

db.shift.hasMany(db.employeeList, {
  foreignKey: "shiftId",
  as: "employees",
});
db.employeeList.belongsTo(db.shift, {
  foreignKey: "shiftId",
  as: "shift",
});

db.employeeList.hasMany(db.employeeList, {
  foreignKey: "reportingManagerId",
  as: "directReports",
});
db.employeeList.belongsTo(db.employeeList, {
  foreignKey: "reportingManagerId",
  as: "reportingManager",
});

db.employeeList.hasMany(db.employee, {
  foreignKey: "employeeListId",
  as: "payrolls",
});
db.employee.belongsTo(db.employeeList, {
  foreignKey: "employeeListId",
  as: "employeeProfile",
});
db.department.hasMany(db.employee, {
  foreignKey: "departmentId",
  as: "payrolls",
});
db.employee.belongsTo(db.department, {
  foreignKey: "departmentId",
  as: "department",
});
db.designation.hasMany(db.employee, {
  foreignKey: "designationId",
  as: "payrolls",
});
db.employee.belongsTo(db.designation, {
  foreignKey: "designationId",
  as: "designation",
});

db.employeeList.hasMany(db.attendanceEnrollment, {
  foreignKey: "employeeId",
  as: "attendanceEnrollments",
});
db.attendanceEnrollment.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.attendanceDevice.hasMany(db.attendanceEnrollment, {
  foreignKey: "attendanceDeviceId",
  as: "enrollments",
});
db.attendanceEnrollment.belongsTo(db.attendanceDevice, {
  foreignKey: "attendanceDeviceId",
  as: "device",
});

db.employeeList.hasMany(db.attendanceLog, {
  foreignKey: "employeeId",
  as: "attendanceLogs",
});
db.attendanceLog.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.attendanceDevice.hasMany(db.attendanceLog, {
  foreignKey: "attendanceDeviceId",
  as: "logs",
});
db.attendanceLog.belongsTo(db.attendanceDevice, {
  foreignKey: "attendanceDeviceId",
  as: "device",
});

db.employeeList.hasMany(db.attendanceSummary, {
  foreignKey: "employeeId",
  as: "attendanceSummaries",
});
db.attendanceSummary.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.shift.hasMany(db.attendanceSummary, {
  foreignKey: "shiftId",
  as: "attendanceSummaries",
});
db.attendanceSummary.belongsTo(db.shift, {
  foreignKey: "shiftId",
  as: "shift",
});

db.employeeList.hasMany(db.attendanceRegularization, {
  foreignKey: "employeeId",
  as: "attendanceRegularizations",
});
db.attendanceRegularization.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.user.hasMany(db.attendanceRegularization, {
  foreignKey: "requestedByUserId",
  as: "requestedAttendanceRegularizations",
});
db.attendanceRegularization.belongsTo(db.user, {
  foreignKey: "requestedByUserId",
  as: "requestedBy",
});

db.user.hasMany(db.attendanceRegularization, {
  foreignKey: "approvedByUserId",
  as: "approvedAttendanceRegularizations",
});
db.attendanceRegularization.belongsTo(db.user, {
  foreignKey: "approvedByUserId",
  as: "approvedBy",
});

db.leaveType.hasMany(db.leaveRequest, {
  foreignKey: "leaveTypeId",
  as: "leaveRequests",
});
db.leaveRequest.belongsTo(db.leaveType, {
  foreignKey: "leaveTypeId",
  as: "leaveType",
});

db.employeeList.hasMany(db.leaveRequest, {
  foreignKey: "employeeId",
  as: "leaveRequests",
});
db.leaveRequest.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.user.hasMany(db.leaveRequest, {
  foreignKey: "requestedByUserId",
  as: "requestedLeaveRequests",
});
db.leaveRequest.belongsTo(db.user, {
  foreignKey: "requestedByUserId",
  as: "requestedBy",
});

db.user.hasMany(db.leaveRequest, {
  foreignKey: "approvedByUserId",
  as: "approvedLeaveRequests",
});
db.leaveRequest.belongsTo(db.user, {
  foreignKey: "approvedByUserId",
  as: "approvedBy",
});

db.payrollRun.hasMany(db.payrollItem, {
  foreignKey: "payrollRunId",
  as: "items",
});
db.payrollItem.belongsTo(db.payrollRun, {
  foreignKey: "payrollRunId",
  as: "payrollRun",
});

db.employeeList.hasMany(db.payrollItem, {
  foreignKey: "employeeId",
  as: "payrollItems",
});
db.payrollItem.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.employeeList.hasMany(db.ledger, { foreignKey: "employeeId" });
db.ledger.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.ledger.hasMany(db.ledgerHistory, { foreignKey: "ledgerId" });
db.ledgerHistory.belongsTo(db.ledger, { foreignKey: "ledgerId", as: "ledger" });

db.supplier.hasMany(db.ledgerHistory, { foreignKey: "supplierId" });
db.ledgerHistory.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

db.employeeList.hasMany(db.ledgerHistory, { foreignKey: "employeeId" });
db.ledgerHistory.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.supplier.hasMany(db.cashInOut, { foreignKey: "supplierId" });
db.cashInOut.belongsTo(db.supplier, { foreignKey: "supplierId" });

db.loan.hasMany(db.cashInOut, { foreignKey: "loanId" });
db.cashInOut.belongsTo(db.loan, { foreignKey: "loanId", as: "loan" });

db.marketingBook.hasMany(db.marketingExpense, { foreignKey: "bookId" });
db.marketingExpense.belongsTo(db.marketingBook, { foreignKey: "bookId" });

// =====================
// Standard Supplier + Warehouse relations
// =====================

// ---- PurchaseRequisition
db.warehouse.hasMany(db.purchaseRequisition, { foreignKey: "warehouseId" });
db.purchaseRequisition.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.purchaseRequisition, { foreignKey: "supplierId" });
db.purchaseRequisition.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

db.asset.hasMany(db.purchaseRequisition, { foreignKey: "assetId" });
db.purchaseRequisition.belongsTo(db.asset, {
  foreignKey: "assetId",
  as: "asset",
});

// ---- ReceivedProduct
db.warehouse.hasMany(db.receivedProduct, { foreignKey: "warehouseId" });
db.receivedProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.receivedProduct, { foreignKey: "supplierId" });
db.receivedProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- PurchaseReturnProduct
db.warehouse.hasMany(db.purchaseReturnProduct, { foreignKey: "warehouseId" });
db.purchaseReturnProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.purchaseReturnProduct, { foreignKey: "supplierId" });
db.purchaseReturnProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- InTransitProduct
db.warehouse.hasMany(db.inTransitProduct, { foreignKey: "warehouseId" });
db.inTransitProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.inTransitProduct, { foreignKey: "supplierId" });
db.inTransitProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- ReturnProduct
db.warehouse.hasMany(db.returnProduct, { foreignKey: "warehouseId" });
db.returnProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.returnProduct, { foreignKey: "supplierId" });
db.returnProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- ConfirmOrder
db.warehouse.hasMany(db.confirmOrder, { foreignKey: "warehouseId" });
db.confirmOrder.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.confirmOrder, { foreignKey: "supplierId" });
db.confirmOrder.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- DamageProduct
db.warehouse.hasMany(db.damageProduct, { foreignKey: "warehouseId" });
db.damageProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.damageProduct, { foreignKey: "supplierId" });
db.damageProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- DamageRepair
db.warehouse.hasMany(db.damageRepair, { foreignKey: "warehouseId" });
db.damageRepair.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.damageRepair, { foreignKey: "supplierId" });
db.damageRepair.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- DamageRepaired
db.warehouse.hasMany(db.damageRepaired, { foreignKey: "warehouseId" });
db.damageRepaired.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.damageRepaired, { foreignKey: "supplierId" });
db.damageRepaired.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// =====================
// Assets relations
// =====================
db.assetsStock.hasMany(db.assetsPurchase, { foreignKey: "productId" });
db.assetsPurchase.belongsTo(db.assetsStock, {
  foreignKey: "productId",
  as: "assetStock",
});

db.asset.hasMany(db.assetsPurchase, { foreignKey: "assetId" });
db.assetsPurchase.belongsTo(db.asset, {
  foreignKey: "assetId",
  as: "asset",
});

db.asset.hasOne(db.assetsStock, { foreignKey: "assetId" });
db.assetsStock.belongsTo(db.asset, {
  foreignKey: "assetId",
  as: "asset",
});

db.asset.hasMany(db.assetsRequisition, { foreignKey: "assetId" });
db.assetsRequisition.belongsTo(db.asset, {
  foreignKey: "assetId",
  as: "asset",
});

db.assetsStock.hasMany(db.assetsSale, { foreignKey: "productId" });
db.assetsSale.belongsTo(db.assetsStock, {
  foreignKey: "productId",
  as: "assetStock",
});

db.assetsStock.hasMany(db.assetsDamage, { foreignKey: "productId" });
db.assetsDamage.belongsTo(db.assetsStock, {
  foreignKey: "productId",
  as: "assetStock",
});

// Payable relations
db.supplier.hasMany(db.payable, { foreignKey: "supplierId" });
db.payable.belongsTo(db.supplier, { foreignKey: "supplierId", as: "supplier" });

// =====================
// Sync
// NOTE: production এ force:true দিবেন না
// =====================

const ensureHolidayRangeColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.holiday.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.startDate) {
    await queryInterface.addColumn(tableName, "startDate", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  if (!tableDefinition.endDate) {
    await queryInterface.addColumn(tableName, "endDate", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  await db.sequelize.query(
    `UPDATE \`${tableName}\`
     SET startDate = COALESCE(startDate, holidayDate),
         endDate = COALESCE(endDate, holidayDate)
     WHERE holidayDate IS NOT NULL`,
  );
};

const ensureAttendanceDeviceApiKeyColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.attendanceDevice.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.apiKey) {
    await queryInterface.addColumn(tableName, "apiKey", {
      type: DataTypes.STRING(191),
      allowNull: true,
    });
  }

  if (!tableDefinition.pendingAction) {
    await queryInterface.addColumn(tableName, "pendingAction", {
      type: DataTypes.STRING(32),
      allowNull: true,
    });
  }

  if (!tableDefinition.approvalNote) {
    await queryInterface.addColumn(tableName, "approvalNote", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.requestedByUserId) {
    await queryInterface.addColumn(tableName, "requestedByUserId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const ensureEmployeeListColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.employeeList.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("employeeCode", {
    type: DataTypes.STRING(64),
    allowNull: true,
  });
  await maybeAddColumn("userId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("email", {
    type: DataTypes.STRING,
    allowNull: true,
  });
  await maybeAddColumn("phone", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await maybeAddColumn("departmentId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("designationId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("shiftId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("reportingManagerId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("employmentType", {
    type: DataTypes.STRING(64),
    allowNull: true,
  });
  await maybeAddColumn("joiningDate", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
  await maybeAddColumn("pendingAction", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await maybeAddColumn("approvalNote", {
    type: DataTypes.STRING,
    allowNull: true,
  });
  await maybeAddColumn("requestedByUserId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
};

const ensureEmployeeColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.employee.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("userId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("employeeListId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("departmentId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("designationId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
};

const ensureDailyWorkReportColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.dailyWorkReport.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("workStartTime", {
    type: DataTypes.TIME,
    allowNull: true,
  });
  await maybeAddColumn("workEndTime", {
    type: DataTypes.TIME,
    allowNull: true,
  });
  await maybeAddColumn("totalWorkingHours", {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    defaultValue: 0,
  });
};

const ensureEmployeeWorkReportColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.employeeWorkReport.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("saleType", {
    type: DataTypes.STRING(40),
    allowNull: true,
  });
  await maybeAddColumn("leadGiven", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("leadReceived", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("crossReceived", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
};

const ensureDailyWorkReportTaskColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.dailyWorkReportTask.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("taskId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("taskSource", {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: "Self-created",
  });
  await maybeAddColumn("progressPercent", {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("timeSpentMinutes", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("dueDate", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
  await maybeAddColumn("isDueToday", {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
};

const ensureKPIColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.kpi.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("employeeId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("userId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("designationType", {
    type: DataTypes.STRING(16),
    allowNull: true,
  });
  await maybeAddColumn("periodType", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await maybeAddColumn("periodStartDate", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
  await maybeAddColumn("periodEndDate", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });

  const rawColumns = [
    "confirmRaw",
    "deliveredRaw",
    "returnParcentRaw",
    "lateRaw",
    "absentRaw",
    "leaveRaw",
    "workingTimeRaw",
    "qcRaw",
    "overallBaviourRaw",
    "totalSaleAmountRaw",
  ];

  for (const columnName of rawColumns) {
    await maybeAddColumn(columnName, {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    });
  }

  const markColumns = [
    "confirm",
    "delivered",
    "returnParcent",
    "late",
    "absent",
    "leave",
    "workingTime",
    "qc",
    "overallBaviour",
    "totalSaleAmount",
  ];

  for (const columnName of markColumns) {
    const definition = {
      type:
        columnName === "totalSaleAmount"
          ? DataTypes.DECIMAL(12, 2)
          : DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    };

    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
      continue;
    }

    if (tableDefinition[columnName]) {
      await queryInterface.changeColumn(tableName, columnName, definition);
    }
  }
};

const ensureKPIDesignations = async () => {
  const Designation = db.designation;
  if (!Designation) return;

  await Promise.all(
    [
      { code: "CS", name: "CS" },
      { code: "UP", name: "UP" },
    ].map(async (item) => {
      const [row] = await Designation.findOrCreate({
        where: { code: item.code },
        defaults: {
          name: item.name,
          code: item.code,
          status: "Active",
        },
      });

      if (row.status !== "Active" || row.name !== item.name) {
        await row.update({
          name: item.name,
          status: "Active",
        });
      }
    }),
  );
};

const ensureStatusAndNoteColumns = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.note) {
    await queryInterface.addColumn(tableName, "note", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.status) {
    await queryInterface.addColumn(tableName, "status", {
      type: DataTypes.STRING(32),
      allowNull: true,
      defaultValue: "Active",
    });
  }
};

const ensureBatchIdColumn = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.batchId) {
    await queryInterface.addColumn(tableName, "batchId", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }
};

const ensureReceivedProductItemsColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.receivedProduct.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.items) {
    await queryInterface.addColumn(tableName, "items", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    });
  }
};

const ensurePurchaseRequisitionItemsColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.purchaseRequisition.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.items) {
    await queryInterface.addColumn(tableName, "items", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    });
  }
};

const ensurePurchaseReturnProductItemsColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.purchaseReturnProduct.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.items) {
    await queryInterface.addColumn(tableName, "items", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    });
  }
};

const ensureInventoryMovementItemsColumn = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.items) {
    await queryInterface.addColumn(tableName, "items", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    });
  }
};

const ensureProfitLossModeColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.profitLoss.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.mode) {
    await queryInterface.addColumn(tableName, "mode", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "product",
    });
  }

  if (!tableDefinition.date) {
    await queryInterface.addColumn(tableName, "date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }
};

const ensureApprovalColumns = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.pendingAction) {
    await queryInterface.addColumn(tableName, "pendingAction", {
      type: DataTypes.STRING(32),
      allowNull: true,
    });
  }

  if (!tableDefinition.approvalNote) {
    await queryInterface.addColumn(tableName, "approvalNote", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.requestedByUserId) {
    await queryInterface.addColumn(tableName, "requestedByUserId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const ensureAssetMovementColumns = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.productId) {
    await queryInterface.addColumn(tableName, "productId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.assetId) {
    await queryInterface.addColumn(tableName, "assetId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const ensureAssetIdColumn = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.assetId) {
    await queryInterface.addColumn(tableName, "assetId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const ensureAssetsStockColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.assetsStock.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.assetId) {
    await queryInterface.addColumn(tableName, "assetId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.price) {
    await queryInterface.addColumn(tableName, "price", {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      defaultValue: 0,
    });
  }
};

const ensureInventoryMinimumStockColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.inventoryMaster.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.minimumStock) {
    await queryInterface.addColumn(tableName, "minimumStock", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
  }
};

const ensurePurchaseRequisitionAssetColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.purchaseRequisition.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.productId) {
    await queryInterface.addColumn(tableName, "productId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.assetId) {
    await queryInterface.addColumn(tableName, "assetId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.bookId) {
    await queryInterface.addColumn(tableName, "bookId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.file) {
    await queryInterface.addColumn(tableName, "file", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.paymentMode) {
    await queryInterface.addColumn(tableName, "paymentMode", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.bankName) {
    await queryInterface.addColumn(tableName, "bankName", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.bankAccount) {
    await queryInterface.addColumn(tableName, "bankAccount", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }
};

const ensurePettyCashColumns = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.category) {
    await queryInterface.addColumn(tableName, "category", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.file) {
    await queryInterface.addColumn(tableName, "file", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.bookId) {
    await queryInterface.addColumn(tableName, "bookId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const ensureCreditLedgerColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();

  const ledgerTableName = db.ledger.getTableName();
  const ledgerTableDefinition =
    await queryInterface.describeTable(ledgerTableName);

  if (!ledgerTableDefinition.bookId) {
    await queryInterface.addColumn(ledgerTableName, "bookId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  const ledgerStringColumns = ["paymentMode", "bankName"];
  for (const columnName of ledgerStringColumns) {
    if (!ledgerTableDefinition[columnName]) {
      await queryInterface.addColumn(ledgerTableName, columnName, {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  }

  if (!ledgerTableDefinition.bankAccount) {
    await queryInterface.addColumn(ledgerTableName, "bankAccount", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }

  const ledgerHistoryTableName = db.ledgerHistory.getTableName();
  const ledgerHistoryTableDefinition = await queryInterface.describeTable(
    ledgerHistoryTableName,
  );

  const maybeAddLedgerHistoryColumn = async (columnName) => {
    if (!ledgerHistoryTableDefinition[columnName]) {
      await queryInterface.addColumn(ledgerHistoryTableName, columnName, {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      });
    }
  };

  const maybeAddLedgerHistoryStringColumn = async (columnName) => {
    if (!ledgerHistoryTableDefinition[columnName]) {
      await queryInterface.addColumn(ledgerHistoryTableName, columnName, {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  };

  await maybeAddLedgerHistoryColumn("bookId");
  await maybeAddLedgerHistoryStringColumn("paymentMode");
  await maybeAddLedgerHistoryStringColumn("bankName");
  if (!ledgerHistoryTableDefinition.bankAccount) {
    await queryInterface.addColumn(ledgerHistoryTableName, "bankAccount", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }
  await maybeAddLedgerHistoryColumn("supplierHistoryId");
  await maybeAddLedgerHistoryColumn("cashInOutId");
};

const ensureCashInOutLoanColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.cashInOut.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.loanId) {
    await queryInterface.addColumn(tableName, "loanId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const syncLoanRowsFromCashInOut = async () => {
  const loanRows = await db.cashInOut.findAll({
    attributes: [
      [db.Sequelize.fn("DISTINCT", db.Sequelize.col("lender")), "lender"],
    ],
    where: {
      category: { [Op.like]: "loan" },
      lender: { [Op.ne]: null },
    },
    raw: true,
    paranoid: false,
  });

  await Promise.all(
    loanRows
      .map((row) => String(row.lender || "").trim())
      .filter(Boolean)
      .map(async (loanName) => {
        const [loan] = await db.loan.findOrCreate({
          where: { name: loanName },
          defaults: { name: loanName, status: "Active" },
        });

        await db.cashInOut.update(
          { loanId: loan.Id },
          {
            where: {
              category: { [Op.like]: "loan" },
              lender: loanName,
              loanId: null,
            },
            paranoid: false,
          },
        );
      }),
  );
};

const ensureUserStatusColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.user.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.status) {
    await queryInterface.addColumn(tableName, "status", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "Active",
    });
  }

  await db.sequelize.query(
    `UPDATE \`${tableName}\`
     SET status = 'Active'
     WHERE status IS NULL OR TRIM(status) = ''`,
  );
};

const ensureUserRoleColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.user.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);
  const roleValues = [
    "superAdmin",
    "admin",
    "marketer",
    "leader",
    "inventor",
    "accountant",
    "logistics",
    "up",
    "cs",
    "staff",
    "employee",
    "user",
  ];
  const definition = {
    type: DataTypes.ENUM(...roleValues),
    allowNull: true,
    defaultValue: "user",
  };

  if (!tableDefinition.role) {
    await queryInterface.addColumn(tableName, "role", definition);
    return;
  }

  await queryInterface.changeColumn(tableName, "role", definition);
};

const ensureUserDocumentColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.user.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  };

  await maybeAddColumn("idCard");
  await maybeAddColumn("cv");
  await maybeAddColumn("guardianPhoto");
  await maybeAddColumn("guardianIdCard");
};

const ensureDamageStockPriceColumns = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.date) {
    await queryInterface.addColumn(tableName, "date", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.purchase_price) {
    await queryInterface.addColumn(tableName, "purchase_price", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.sale_price) {
    await queryInterface.addColumn(tableName, "sale_price", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
      defaultValue: 0,
    });
  }
};

const syncAssetsStockSeedData = async () => {
  const {
    ensureSeedAssetsStocks,
    rebuildAssetsStockBalances,
  } = require("../app/modules/assetsStock/assetsStockSync");

  await db.sequelize.transaction(async (transaction) => {
    await ensureSeedAssetsStocks(transaction);
    await rebuildAssetsStockBalances(transaction);
  });
};

const syncDamageStockPriceData = async () => {
  const DamageStock = db.damageStock;
  const DamageReparingStock = db.damageReparingStock;
  const DamageProduct = db.damageProduct;
  const DamageRepair = db.damageRepair;
  const InventoryMaster = db.inventoryMaster;

  const [damageStocks, repairingStocks] = await Promise.all([
    DamageStock.findAll(),
    DamageReparingStock.findAll(),
  ]);

  for (const stock of damageStocks) {
    const qty = Number(stock.quantity || 0);
    if (qty <= 0) {
      await stock.update({ purchase_price: 0, sale_price: 0 });
      continue;
    }

    if (
      Number(stock.purchase_price || 0) > 0 ||
      Number(stock.sale_price || 0) > 0
    ) {
      continue;
    }

    const inventoryRows = await InventoryMaster.findAll({
      attributes: ["Id"],
      where: { productId: stock.productId },
      raw: true,
    });

    const inventoryIds = inventoryRows.map((row) => row.Id).filter(Boolean);
    if (!inventoryIds.length) continue;

    const latestMovement = await DamageProduct.findOne({
      where: { productId: { [Op.in]: inventoryIds } },
      order: [
        ["createdAt", "DESC"],
        ["Id", "DESC"],
      ],
      raw: true,
    });

    if (!latestMovement) continue;

    const sourceQty = Number(latestMovement.quantity || 0);
    if (sourceQty <= 0) continue;

    const unitPurchase = Number(latestMovement.purchase_price || 0) / sourceQty;
    const unitSale = Number(latestMovement.sale_price || 0) / sourceQty;

    await stock.update({
      purchase_price: unitPurchase * qty,
      sale_price: unitSale * qty,
    });
  }

  for (const stock of repairingStocks) {
    const qty = Number(stock.quantity || 0);
    if (qty <= 0) {
      await stock.update({ purchase_price: 0, sale_price: 0 });
      continue;
    }

    if (
      Number(stock.purchase_price || 0) > 0 ||
      Number(stock.sale_price || 0) > 0
    ) {
      continue;
    }

    const damageStockRows = await DamageStock.findAll({
      attributes: ["Id"],
      where: { productId: stock.productId },
      raw: true,
    });

    const damageStockIds = damageStockRows.map((row) => row.Id).filter(Boolean);
    if (!damageStockIds.length) continue;

    const latestMovement = await DamageRepair.findOne({
      where: { productId: { [Op.in]: damageStockIds } },
      order: [
        ["createdAt", "DESC"],
        ["Id", "DESC"],
      ],
      raw: true,
    });

    if (!latestMovement) continue;

    const sourceQty = Number(latestMovement.quantity || 0);
    if (sourceQty <= 0) continue;

    const unitPurchase = Number(latestMovement.purchase_price || 0) / sourceQty;
    const unitSale = Number(latestMovement.sale_price || 0) / sourceQty;

    await stock.update({
      purchase_price: unitPurchase * qty,
      sale_price: unitSale * qty,
    });
  }
};

const ensureAdsCampaignKPIColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.adsCampaignKPI.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.date) {
    await queryInterface.addColumn(tableName, "date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  let refreshedTableDefinition = await queryInterface.describeTable(tableName);

  if (!refreshedTableDefinition.result) {
    await queryInterface.addColumn(tableName, "result", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }

  refreshedTableDefinition = await queryInterface.describeTable(tableName);

  if (!refreshedTableDefinition.confirm) {
    await queryInterface.addColumn(tableName, "confirm", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }

  refreshedTableDefinition = await queryInterface.describeTable(tableName);

  if (!refreshedTableDefinition.adsAccountId) {
    await queryInterface.addColumn(tableName, "adsAccountId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  refreshedTableDefinition = await queryInterface.describeTable(tableName);

  if (!refreshedTableDefinition.adsAccountName) {
    await queryInterface.addColumn(tableName, "adsAccountName", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  refreshedTableDefinition = await queryInterface.describeTable(tableName);

  if (refreshedTableDefinition.conversions) {
    await db.sequelize.query(
      `UPDATE \`${tableName}\` SET \`result\` = \`conversions\` WHERE (\`result\` IS NULL OR \`result\` = 0) AND \`conversions\` IS NOT NULL`,
    );
  }

  if (refreshedTableDefinition.startDate) {
    await db.sequelize.query(
      `UPDATE \`${tableName}\` SET \`date\` = \`startDate\` WHERE \`date\` IS NULL AND \`startDate\` IS NOT NULL`,
    );
    await queryInterface.removeColumn(tableName, "startDate");
  }

  if (refreshedTableDefinition.endDate) {
    await queryInterface.removeColumn(tableName, "endDate");
  }

  const finalTableDefinition = await queryInterface.describeTable(tableName);
  const unusedColumns = [
    "employeeId",
    "budget",
    "impressions",
    "reach",
    "clicks",
    "leads",
    "conversions",
  ];

  await Promise.all(
    unusedColumns.map(async (columnName) => {
      if (finalTableDefinition[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
      }
    }),
  );
};

db.sequelize
  .sync({ force: false })
  .then(async () => {
    await ensureHolidayRangeColumns();
    await ensureAttendanceDeviceApiKeyColumn();
    await ensureEmployeeListColumns();
    await ensureEmployeeColumns();
    await ensureEmployeeWorkReportColumns();
    await ensureDailyWorkReportColumns();
    await ensureDailyWorkReportTaskColumns();
    await ensureKPIColumns();
    await ensureAdsCampaignKPIColumns();
    await ensureUserRoleColumn();
    await ensureUserStatusColumn();
    await ensureUserDocumentColumns();
    await ensureApprovalColumns("department");
    await ensureApprovalColumns("designation");
    await ensureApprovalColumns("team");
    await ensureKPIDesignations();
    await ensureApprovalColumns("shift");
    await ensureApprovalColumns("holiday");
    await Promise.all(
      [
        "item",
        "product",
        "supplier",
        "loan",
        "warehouse",
        "profitLoss",
        "salary",
      ].map((modelKey) => ensureStatusAndNoteColumns(modelKey)),
    );
    await Promise.all(
      [
        "receivedProduct",
        "inTransitProduct",
        "returnProduct",
        "damageProduct",
        "damageRepair",
        "damageRepaired",
      ].map((modelKey) => ensureBatchIdColumn(modelKey)),
    );
    await ensureReceivedProductItemsColumn();
    await Promise.all(
      [
        "inTransitProduct",
        "returnProduct",
        "damageProduct",
        "damageRepair",
        "damageRepaired",
      ].map((modelKey) => ensureInventoryMovementItemsColumn(modelKey)),
    );
    await ensureProfitLossModeColumn();
    await Promise.all(
      ["assetsPurchase", "assetsSale", "assetsDamage"].map((modelKey) =>
        ensureAssetMovementColumns(modelKey),
      ),
    );
    await ensureAssetIdColumn("assetsRequisition");
    await ensurePurchaseRequisitionAssetColumns();
    await ensurePurchaseRequisitionItemsColumn();
    await ensurePurchaseReturnProductItemsColumn();
    await Promise.all(
      ["pettyCash", "pettyCashRequisition"].map((modelKey) =>
        ensurePettyCashColumns(modelKey),
      ),
    );
    await ensureCreditLedgerColumns();
    await ensureCashInOutLoanColumns();
    await syncLoanRowsFromCashInOut();
    await ensureInventoryMinimumStockColumn();
    await ensureAssetsStockColumns();
    await Promise.all(
      ["damageStock", "damageReparingStock"].map((modelKey) =>
        ensureDamageStockPriceColumns(modelKey),
      ),
    );
    await syncAssetsStockSeedData();
    await syncDamageStockPriceData();
    await require("../app/modules/kpi/kpi.service").ensureDefaultSettings();

    const {
      DEFAULT_ROLE_MENU_PERMISSIONS,
    } = require("../app/config/roleMenuPermissions");
    const { MENU_PERMISSIONS } = require("../app/enums/menuPermissions");
    const { ENUM_USER_ROLE } = require("../app/enums/user");

    const rolesWithLegacyDailyWorkReportDefault = new Set([
      ENUM_USER_ROLE.SUPER_ADMIN,
      ENUM_USER_ROLE.ADMIN,
      ENUM_USER_ROLE.MARKETER,
      ENUM_USER_ROLE.LEADER,
      ENUM_USER_ROLE.INVENTOR,
      ENUM_USER_ROLE.ACCOUNTANT,
      ENUM_USER_ROLE.UP,
      ENUM_USER_ROLE.STAFF,
      ENUM_USER_ROLE.USER,
    ]);

    const normalizePermissionList = (permissions) => {
      if (Array.isArray(permissions)) return permissions;
      if (!permissions) return [];

      if (typeof permissions === "string") {
        try {
          const parsed = JSON.parse(permissions);
          return normalizePermissionList(parsed);
        } catch (error) {
          return [];
        }
      }

      if (typeof permissions === "object") {
        return normalizePermissionList(permissions.menuPermissions);
      }

      return [];
    };

    const areSamePermissions = (left = [], right = []) => {
      const leftSet = new Set(left);
      const rightSet = new Set(right);

      if (leftSet.size !== rightSet.size) return false;

      return Array.from(leftSet).every((permission) =>
        rightSet.has(permission),
      );
    };

    const removeLegacyDailyWorkReportDefault = async (
      role,
      defaultMenuPermissions,
    ) => {
      if (!rolesWithLegacyDailyWorkReportDefault.has(role)) return;

      const record = await db.rolePermission.findOne({ where: { role } });
      if (!record) return;

      const currentPermissions = normalizePermissionList(
        record.menuPermissions,
      );
      if (!currentPermissions.includes(MENU_PERMISSIONS.DAILY_WORK_REPORTS)) {
        return;
      }

      const permissionsWithoutDailyWorkReports = currentPermissions.filter(
        (permission) => permission !== MENU_PERMISSIONS.DAILY_WORK_REPORTS,
      );

      if (
        areSamePermissions(
          permissionsWithoutDailyWorkReports,
          defaultMenuPermissions,
        )
      ) {
        await record.update({
          menuPermissions: permissionsWithoutDailyWorkReports,
        });
      }
    };

    await Promise.all(
      Object.entries(DEFAULT_ROLE_MENU_PERMISSIONS).map(
        async ([role, menuPermissions]) => {
          await db.rolePermission.findOrCreate({
            where: { role },
            defaults: {
              role,
              menuPermissions,
            },
          });
          await removeLegacyDailyWorkReportDefault(role, menuPermissions);
        },
      ),
    );

    console.log("Connection re-synced successfully");
  })
  .catch((err) => console.error("Error on re-sync:", err));

module.exports = db;
