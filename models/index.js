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
db.masterPermission =
  require("../app/modules/masterPermission/masterPermission.model")(
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
db.packagingItem = require("../app/modules/packagingItem/packagingItem.model")(
  db.sequelize,
  DataTypes,
);
db.packagingItemPurchase =
  require("../app/modules/packagingItemPurchase/packagingItemPurchase.model")(
    db.sequelize,
    DataTypes,
  );
db.packagingItemStock =
  require("../app/modules/packagingItemStock/packagingItemStock.model")(
    db.sequelize,
    DataTypes,
  );
db.packagingManufacturer =
  require("../app/modules/packagingManufacturer/packagingManufacturer.model")(
    db.sequelize,
    DataTypes,
  );
db.packagingFactory =
  require("../app/modules/packagingFactory/packagingFactory.model")(
    db.sequelize,
    DataTypes,
  );
db.packagingFactoryStock =
  require("../app/modules/packagingFactoryStock/packagingFactoryStock.model")(
    db.sequelize,
    DataTypes,
  );
db.packagingManufacturerTransaction =
  require("../app/modules/packagingManufacturerTransaction/packagingManufacturerTransaction.model")(
    db.sequelize,
    DataTypes,
  );
db.packagingMixer =
  require("../app/modules/packagingMixer/packagingMixer.model")(
    db.sequelize,
    DataTypes,
  );
db.itemMaster = require("../app/modules/itemMaster/itemMaster.model")(
  db.sequelize,
  DataTypes,
);
db.manufacture = require("../app/modules/manufacture/manufacture.model")(
  db.sequelize,
  DataTypes,
);
db.manufactureStock =
  require("../app/modules/manufactureStock/manufactureStock.model")(
    db.sequelize,
    DataTypes,
  );
db.manufactureProduction =
  require("../app/modules/manufactureProduction/manufactureProduction.model")(
    db.sequelize,
    DataTypes,
  );
db.manufacturer = require("../app/modules/manufacturer/manufacturer.model")(
  db.sequelize,
  DataTypes,
);
db.manufacturerTransaction =
  require("../app/modules/manufacturerTransaction/manufacturerTransaction.model")(
    db.sequelize,
    DataTypes,
  );
db.stockAdjustment =
  require("../app/modules/stockAdjustment/stockAdjustment.model")(
    db.sequelize,
    DataTypes,
  );
db.stockMovement = require("../app/modules/stockMovement/stockMovement.model")(
  db.sequelize,
  DataTypes,
);
db.inventoryCostLayer =
  require("../app/modules/inventoryCostLayer/inventoryCostLayer.model")(
    db.sequelize,
    DataTypes,
  );
db.packagingCostLayer =
  require("../app/modules/packagingCostLayer/packagingCostLayer.model")(
    db.sequelize,
    DataTypes,
  );
db.itemCostLayer = require("../app/modules/itemCostLayer/itemCostLayer.model")(
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
db.courierNoEntry =
  require("../app/modules/courierNoEntry/courierNoEntry.model")(
    db.sequelize,
    DataTypes,
  );
db.courierProductStock =
  require("../app/modules/courierProductStock/courierProductStock.model")(
    db.sequelize,
    DataTypes,
  );
db.salesDue = require("../app/modules/salesDue/salesDue.model")(
  db.sequelize,
  DataTypes,
);
db.salaryAdvance = require("../app/modules/salaryAdvance/salaryAdvance.model")(
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
db.autoProfitLoss = require("../app/modules/profitLoss/autoProfitLoss.model")(
  db.sequelize,
  DataTypes,
);
db.userProfitLoss = require("../app/modules/profitLoss/userProfitLoss.model")(
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
db.performanceTrackerChannel =
  require("../app/modules/performanceTracker/performanceTrackerChannel.model")(
    db.sequelize,
    DataTypes,
  );
db.performanceTrackerAdsAccount =
  require("../app/modules/performanceTracker/performanceTrackerAdsAccount.model")(
    db.sequelize,
    DataTypes,
  );
db.performanceTrackerProduct =
  require("../app/modules/performanceTracker/performanceTrackerProduct.model")(
    db.sequelize,
    DataTypes,
  );
db.marketingPerformanceEntry =
  require("../app/modules/performanceTracker/marketingPerformanceEntry.model")(
    db.sequelize,
    DataTypes,
  );
db.channelPerformanceTarget =
  require("../app/modules/performanceTracker/channelPerformanceTarget.model")(
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

db.fundTransfer = require("../app/modules/fundTransfer/fundTransfer.model")(
  db.sequelize,
  DataTypes,
);

db.supplier = require("../app/modules/supplier/supplier.model")(
  db.sequelize,
  DataTypes,
);

db.loan = require("../app/modules/loan/loan.model")(db.sequelize, DataTypes);
db.owner = require("../app/modules/owner/owner.model")(db.sequelize, DataTypes);
db.ownerTransaction =
  require("../app/modules/ownerTransaction/ownerTransaction.model")(
    db.sequelize,
    DataTypes,
  );
db.director = require("../app/modules/director/director.model")(
  db.sequelize,
  DataTypes,
);
db.directorProfitShare =
  require("../app/modules/directorProfitShare/directorProfitShare.model")(
    db.sequelize,
    DataTypes,
  );

db.supplierHistory =
  require("../app/modules/supplierHistory/supplierHistory.model")(
    db.sequelize,
    DataTypes,
  );

db.dollarSupplier = require("../app/modules/dollarSupplier/dollarSupplier.model")(
  db.sequelize,
  DataTypes,
);
db.dollarSupplierHistory =
  require("../app/modules/dollarSupplierHistory/dollarSupplierHistory.model")(
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
db.logisticUpdate =
  require("../app/modules/logisticUpdate/logisticUpdate.model")(
    db.sequelize,
    DataTypes,
  );
db.shifaReport = require("../app/modules/shifaReport/shifaReport.model")(
  db.sequelize,
  DataTypes,
);
db.shifaAppointmentSerial =
  require("../app/modules/shifaAppointmentSerial/shifaAppointmentSerial.model")(
    db.sequelize,
    DataTypes,
  );
db.shifaIncentive =
  require("../app/modules/shifaIncentive/shifaIncentive.model")(
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

db.stellarAttendanceLog =
  require("../app/modules/stellarAttendance/stellarAttendanceLog.model")(
    db.sequelize,
    DataTypes,
  );

db.stellarAttendanceSyncState =
  require("../app/modules/stellarAttendance/stellarAttendanceSyncState.model")(
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
db.shippingCharge =
  require("../app/modules/chargeSetting/shippingCharge.model")(
    db.sequelize,
    DataTypes,
  );
db.apiGatewaySetting =
  require("../app/modules/apiGatewaySetting/apiGatewaySetting.model")(
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

db.companyInfo = require("../app/modules/companyInfo/companyInfo.model")(
  db.sequelize,
  DataTypes,
);

db.purchaseRequisition =
  require("../app/modules/purchaseRequision/purchaseRequisition.model")(
    db.sequelize,
    DataTypes,
  );
db.itemRequisition =
  require("../app/modules/itemRequision/itemRequision.model")(
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

db.dollarSupplier.hasMany(db.dollarSupplierHistory, {
  foreignKey: "dollarSupplierId",
});
db.dollarSupplierHistory.belongsTo(db.dollarSupplier, {
  foreignKey: "dollarSupplierId",
  as: "dollarSupplier",
});
db.book.hasMany(db.dollarSupplierHistory, { foreignKey: "bookId" });
db.dollarSupplierHistory.belongsTo(db.book, {
  foreignKey: "bookId",
  as: "book",
});
db.dollarSupplier.hasMany(db.cashInOut, { foreignKey: "dollarSupplierId" });
db.cashInOut.belongsTo(db.dollarSupplier, { foreignKey: "dollarSupplierId" });

db.item.hasMany(db.manufacture, { foreignKey: "itemId" });
db.manufacture.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.manufacture, { foreignKey: "productId" });
db.manufacture.belongsTo(db.product, { foreignKey: "productId" });

db.item.hasMany(db.manufactureStock, { foreignKey: "itemId" });
db.manufactureStock.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.manufactureStock, { foreignKey: "productId" });
db.manufactureStock.belongsTo(db.product, { foreignKey: "productId" });

db.item.hasMany(db.manufactureProduction, { foreignKey: "itemId" });
db.manufactureProduction.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.manufactureProduction, { foreignKey: "productId" });
db.manufactureProduction.belongsTo(db.product, { foreignKey: "productId" });

db.manufacturer.hasMany(db.manufactureProduction, {
  foreignKey: "manufacturerId",
});
db.manufactureProduction.belongsTo(db.manufacturer, {
  foreignKey: "manufacturerId",
});
db.manufacturer.hasMany(db.manufacturerTransaction, {
  foreignKey: "manufacturerId",
});
db.manufacturerTransaction.belongsTo(db.manufacturer, {
  foreignKey: "manufacturerId",
});

db.manufacturer.hasMany(db.manufactureStock, {
  foreignKey: "manufacturerId",
});
db.manufactureStock.belongsTo(db.manufacturer, {
  foreignKey: "manufacturerId",
});

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
db.item.hasMany(db.stockAdjustment, { foreignKey: "itemId" });
db.stockAdjustment.belongsTo(db.item, { foreignKey: "itemId" });
db.product.hasMany(db.stockAdjustment, { foreignKey: "productId" });
db.stockAdjustment.belongsTo(db.product, { foreignKey: "productId" });

// db.item.hasMany(db.mixer, { foreignKey: "itemId" });
// db.mixer.belongsTo(db.item, { foreignKey: "itemId", as: "item" });

db.product.hasMany(db.mixer, { foreignKey: "productId" });
db.mixer.belongsTo(db.product, { foreignKey: "productId", as: "product" });

db.item.hasMany(db.itemMaster, { foreignKey: "itemId" });
db.itemMaster.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.itemMaster, { foreignKey: "productId" });
db.itemMaster.belongsTo(db.product, { foreignKey: "productId" });

db.packagingItem.hasMany(db.packagingItemPurchase, {
  foreignKey: "packagingItemId",
});
db.packagingItemPurchase.belongsTo(db.packagingItem, {
  foreignKey: "packagingItemId",
  as: "packagingItem",
});
db.packagingItem.hasOne(db.packagingItemStock, {
  foreignKey: "packagingItemId",
});
db.packagingItemStock.belongsTo(db.packagingItem, {
  foreignKey: "packagingItemId",
  as: "packagingItem",
});
db.packagingItem.hasMany(db.packagingFactory, {
  foreignKey: "packagingItemId",
});
db.packagingFactory.belongsTo(db.packagingItem, {
  foreignKey: "packagingItemId",
  as: "packagingItem",
});
db.packagingItem.hasMany(db.packagingFactoryStock, {
  foreignKey: "packagingItemId",
});
db.packagingFactoryStock.belongsTo(db.packagingItem, {
  foreignKey: "packagingItemId",
  as: "packagingItem",
});
db.packagingManufacturer.hasMany(db.packagingFactory, {
  foreignKey: "manufacturerId",
});
db.packagingFactory.belongsTo(db.packagingManufacturer, {
  foreignKey: "manufacturerId",
  as: "packagingManufacturer",
});
db.packagingManufacturer.hasMany(db.packagingFactoryStock, {
  foreignKey: "manufacturerId",
});
db.packagingFactoryStock.belongsTo(db.packagingManufacturer, {
  foreignKey: "manufacturerId",
  as: "packagingManufacturer",
});
db.packagingManufacturer.hasMany(db.packagingManufacturerTransaction, {
  foreignKey: "manufacturerId",
});
db.packagingManufacturerTransaction.belongsTo(db.packagingManufacturer, {
  foreignKey: "manufacturerId",
  as: "packagingManufacturer",
});
db.packagingManufacturer.hasMany(db.packagingMixer, {
  foreignKey: "manufacturerId",
});
db.packagingMixer.belongsTo(db.packagingManufacturer, {
  foreignKey: "manufacturerId",
  as: "packagingManufacturer",
});
db.item.hasMany(db.packagingMixer, { foreignKey: "itemId" });
db.packagingMixer.belongsTo(db.item, { foreignKey: "itemId", as: "item" });
db.supplier.hasMany(db.packagingItemPurchase, { foreignKey: "supplierId" });
db.packagingItemPurchase.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

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

db.inventoryMaster.hasMany(db.courierNoEntry, { foreignKey: "productId" });
db.courierNoEntry.belongsTo(db.inventoryMaster, { foreignKey: "productId" });

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

db.book.hasMany(db.fundTransfer, { foreignKey: "bookId" });
db.fundTransfer.belongsTo(db.book, { foreignKey: "bookId", as: "book" });
db.bankAccount.hasMany(db.fundTransfer, {
  foreignKey: "fromBankAccount",
  as: "fundTransfersFrom",
});
db.fundTransfer.belongsTo(db.bankAccount, {
  foreignKey: "fromBankAccount",
  as: "fromBank",
});
db.bankAccount.hasMany(db.fundTransfer, {
  foreignKey: "toBankAccount",
  as: "fundTransfersTo",
});
db.fundTransfer.belongsTo(db.bankAccount, {
  foreignKey: "toBankAccount",
  as: "toBank",
});
db.category.hasMany(db.cashInOut, {
  foreignKey: "categoryId",
  as: "cashInOuts",
});
db.cashInOut.belongsTo(db.category, {
  foreignKey: "categoryId",
  as: "categoryInfo",
});

db.performanceTrackerChannel.hasMany(db.marketingPerformanceEntry, {
  foreignKey: "channel_id",
  as: "entries",
});
db.marketingPerformanceEntry.belongsTo(db.performanceTrackerChannel, {
  foreignKey: "channel_id",
  as: "channel",
});
db.performanceTrackerChannel.hasMany(db.performanceTrackerAdsAccount, {
  foreignKey: "channel_id",
  as: "adsAccounts",
});
db.performanceTrackerAdsAccount.belongsTo(db.performanceTrackerChannel, {
  foreignKey: "channel_id",
  as: "channel",
});
db.performanceTrackerChannel.hasMany(db.performanceTrackerProduct, {
  foreignKey: "channel_id",
  as: "products",
});
db.performanceTrackerProduct.belongsTo(db.performanceTrackerChannel, {
  foreignKey: "channel_id",
  as: "channel",
});
db.performanceTrackerAdsAccount.hasMany(db.marketingPerformanceEntry, {
  foreignKey: "ads_account_id",
  as: "entries",
});
db.marketingPerformanceEntry.belongsTo(db.performanceTrackerAdsAccount, {
  foreignKey: "ads_account_id",
  as: "adsAccount",
});
db.performanceTrackerProduct.hasMany(db.marketingPerformanceEntry, {
  foreignKey: "product_id",
  as: "entries",
});
db.marketingPerformanceEntry.belongsTo(db.performanceTrackerProduct, {
  foreignKey: "product_id",
  as: "product",
});
db.performanceTrackerChannel.hasOne(db.channelPerformanceTarget, {
  foreignKey: "channel_id",
  as: "target",
});
db.channelPerformanceTarget.belongsTo(db.performanceTrackerChannel, {
  foreignKey: "channel_id",
  as: "channel",
});

db.owner.hasMany(db.ownerTransaction, { foreignKey: "ownerId" });
db.ownerTransaction.belongsTo(db.owner, {
  foreignKey: "ownerId",
  as: "owner",
});

db.book.hasMany(db.ownerTransaction, { foreignKey: "bookId" });
db.ownerTransaction.belongsTo(db.book, {
  foreignKey: "bookId",
  as: "book",
});

db.cashInOut.hasOne(db.ownerTransaction, { foreignKey: "cashInOutId" });
db.ownerTransaction.belongsTo(db.cashInOut, {
  foreignKey: "cashInOutId",
  as: "cashInOut",
});

db.director.hasMany(db.directorProfitShare, { foreignKey: "directorId" });
db.directorProfitShare.belongsTo(db.director, {
  foreignKey: "directorId",
  as: "director",
});

db.book.hasMany(db.directorProfitShare, { foreignKey: "bookId" });
db.directorProfitShare.belongsTo(db.book, {
  foreignKey: "bookId",
  as: "book",
});

db.cashInOut.hasOne(db.directorProfitShare, { foreignKey: "cashInOutId" });
db.directorProfitShare.belongsTo(db.cashInOut, {
  foreignKey: "cashInOutId",
  as: "cashInOut",
});

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

// Charge rows synced from CS Work Reports carry the submitting employee so the
// settings screens can show a name alongside the amount.
[db.codChange, db.shippingCharge, db.deliveryAdvance].forEach((ChargeModel) => {
  db.employeeList.hasMany(ChargeModel, {
    foreignKey: "employeeId",
    as: `${ChargeModel.name.toLowerCase()}Charges`,
  });
  ChargeModel.belongsTo(db.employeeList, {
    foreignKey: "employeeId",
    as: "employee",
  });
  ChargeModel.belongsTo(db.employeeWorkReport, {
    foreignKey: "employeeWorkReportId",
    as: "workReport",
  });
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

db.user.hasMany(db.logisticUpdate, {
  foreignKey: "userId",
  as: "logisticUpdates",
});
db.logisticUpdate.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.user.hasMany(db.shifaReport, {
  foreignKey: "userId",
  as: "shifaReports",
});
db.shifaReport.belongsTo(db.user, {
  foreignKey: "userId",
  as: "user",
});

db.employeeList.hasMany(db.shifaReport, {
  foreignKey: "employeeId",
  as: "shifaReports",
});
db.shifaReport.belongsTo(db.employeeList, {
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

db.team.hasMany(db.employeeList, {
  foreignKey: "teamId",
  as: "employees",
});
db.employeeList.belongsTo(db.team, {
  foreignKey: "teamId",
  as: "team",
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

db.owner.hasMany(db.cashInOut, { foreignKey: "ownerId" });
db.cashInOut.belongsTo(db.owner, { foreignKey: "ownerId", as: "owner" });

db.director.hasMany(db.cashInOut, { foreignKey: "directorId" });
db.cashInOut.belongsTo(db.director, {
  foreignKey: "directorId",
  as: "director",
});

db.loan.hasMany(db.cashInOut, { foreignKey: "loanId" });
db.cashInOut.belongsTo(db.loan, { foreignKey: "loanId", as: "loan" });

db.marketingBook.hasMany(db.marketingExpense, { foreignKey: "bookId" });
db.marketingExpense.belongsTo(db.marketingBook, { foreignKey: "bookId" });

db.dollarSupplier.hasMany(db.marketingExpense, {
  foreignKey: "dollarSupplierId",
});
db.marketingExpense.belongsTo(db.dollarSupplier, {
  foreignKey: "dollarSupplierId",
  as: "dollarSupplier",
});

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

// ---- ItemRequisition
db.item.hasMany(db.itemRequisition, { foreignKey: "itemId" });
db.itemRequisition.belongsTo(db.item, {
  foreignKey: "itemId",
  as: "item",
});

db.supplier.hasMany(db.itemRequisition, { foreignKey: "supplierId" });
db.itemRequisition.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
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

// ---- CourierNoEntry
db.warehouse.hasMany(db.courierNoEntry, { foreignKey: "warehouseId" });
db.courierNoEntry.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.courierNoEntry, { foreignKey: "supplierId" });
db.courierNoEntry.belongsTo(db.supplier, {
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

require("../shared/registerInventoryReconcileHooks")(db);

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

const ensurePerformanceTrackerEntryColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.marketingPerformanceEntry.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.ads_account_id) {
    await queryInterface.addColumn(tableName, "ads_account_id", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.product_id) {
    await queryInterface.addColumn(tableName, "product_id", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
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
  await maybeAddColumn("teamId", {
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
  await maybeAddColumn("joining_date", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
  await maybeAddColumn("pre_joining_days", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("payable_days", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 30,
  });
  await maybeAddColumn("departmentId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("designationId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("festival_bonus", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("half_day_absent", {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
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
  await maybeAddColumn("notResponseGiven", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("notResponseReceived", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("products", {
    type: DataTypes.JSON,
    allowNull: true,
  });

  const decimalColumn = () => ({
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  });

  await maybeAddColumn("codChangeDiscount", decimalColumn());
  await maybeAddColumn("shippingCharge", decimalColumn());
  await maybeAddColumn("advancePayment", decimalColumn());
};

// codChange / shippingCharge / deliveryAdvance gained employee + work-report
// linkage columns so CS Work Report amounts can flow into the charge screens.
const ensureChargeEmployeeColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const models = [db.codChange, db.shippingCharge, db.deliveryAdvance];

  for (const Model of models) {
    const tableName = Model.getTableName();
    const tableDefinition = await queryInterface.describeTable(tableName);

    const maybeAddColumn = async (columnName, definition) => {
      if (!tableDefinition[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition);
      }
    };

    await maybeAddColumn("source", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "manual",
    });
    await maybeAddColumn("employeeId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
    await maybeAddColumn("employeeWorkReportId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });

    // Existing rows predate the column — mark them manual so the overview
    // exclusion (source != 'cs_work_report') keeps counting them.
    await db.sequelize.query(
      `UPDATE \`${tableName}\` SET \`source\` = 'manual' WHERE \`source\` IS NULL`,
    );
  }
};

const ensureLogisticWorkReportColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.logisticWorkReport.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  const numericColumn = () => ({
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });

  await maybeAddColumn("entryUpdate", numericColumn());
  await maybeAddColumn("returnSheetReceived", numericColumn());
  await maybeAddColumn("exchangePrint", numericColumn());
  await maybeAddColumn("missingProblemParcelFollowup", numericColumn());
  await maybeAddColumn("holdParcelReceived", numericColumn());
  await maybeAddColumn("csProblemSolve", numericColumn());
  await maybeAddColumn("pendingAssign", numericColumn());
  await maybeAddColumn("completedPendingAssign", numericColumn());
};

const ensureShifaReportColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.shifaReport.getTableName();
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
  await maybeAddColumn("reportType", {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: "call_history",
  });
  await maybeAddColumn("phone", {
    type: DataTypes.STRING(50),
    allowNull: true,
  });
  await maybeAddColumn("age", {
    type: DataTypes.STRING(30),
    allowNull: true,
  });
  await maybeAddColumn("gender", {
    type: DataTypes.STRING(40),
    allowNull: true,
  });
  await maybeAddColumn("address", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await maybeAddColumn("callerName", {
    type: DataTypes.STRING(180),
    allowNull: true,
  });
  await maybeAddColumn("relation", {
    type: DataTypes.STRING(120),
    allowNull: true,
  });
  await maybeAddColumn("callHistory", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await maybeAddColumn("phoneCalled", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("phoneNotReceived", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("phoneOff", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("numberBusy", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("refusedCall", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("callCut", {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  const numericColumn = () => ({
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("started", numericColumn());
  await maybeAddColumn("notStarted", numericColumn());
  await maybeAddColumn("startingOther", numericColumn());
  await maybeAddColumn("spousePractice", numericColumn());
  await maybeAddColumn("evilEye", numericColumn());
  await maybeAddColumn("marriageObstacle", numericColumn());
  await maybeAddColumn("livelihoodObstacle", numericColumn());
  await maybeAddColumn("jinnAndMagic", numericColumn());
  await maybeAddColumn("separation", numericColumn());
  await maybeAddColumn("noChild", numericColumn());
  await maybeAddColumn("problemOther", numericColumn());
  await maybeAddColumn("improving", numericColumn());
  await maybeAddColumn("notImproving", numericColumn());
  await maybeAddColumn("startingSituation", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await maybeAddColumn("problemHistory", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await maybeAddColumn("patientUpdate", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await maybeAddColumn("notes", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await maybeAddColumn("nextFollowUpDate", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
  await maybeAddColumn("details", {
    type: DataTypes.JSON,
    allowNull: true,
  });
};

const ensureShifaIncentiveColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.shifaIncentive.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.thousandPlusAmount) {
    await queryInterface.addColumn(tableName, "thousandPlusAmount", {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }
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
  await maybeAddColumn("departmentId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("designationId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("teamId", {
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

const ensureCourierNoEntryColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.courierNoEntry.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.courierStatus) {
    await queryInterface.addColumn(tableName, "courierStatus", {
      type: DataTypes.STRING(32),
      allowNull: true,
      defaultValue: "On the way",
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

const ensureItemRequisitionUnitColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.itemRequisition.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.unit) {
    await queryInterface.addColumn(tableName, "unit", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "Pcs",
    });
  }
};

const ensurePackagingItemPurchaseColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.packagingItemPurchase.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("unitCost", {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("allPackagingItemCost", {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("othersCost", {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  });
  await maybeAddColumn("batchId", {
    type: DataTypes.STRING,
    allowNull: true,
  });
  await maybeAddColumn("supplierHistoryId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
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

const ensureProfitLossColumns = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.mode) {
    const defaultMode =
      modelKey === "autoProfitLoss"
        ? "auto"
        : modelKey === "userProfitLoss"
          ? "user"
          : "product";
    await queryInterface.addColumn(tableName, "mode", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: defaultMode,
    });
  }

  if (!tableDefinition.date) {
    await queryInterface.addColumn(tableName, "date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  if (!tableDefinition.marketingSpends) {
    await queryInterface.addColumn(tableName, "marketingSpends", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.otherExpenses) {
    await queryInterface.addColumn(tableName, "otherExpenses", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.incentiveType) {
    await queryInterface.addColumn(tableName, "incentiveType", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "flat",
    });
  }

  if (!tableDefinition.incentiveValue) {
    await queryInterface.addColumn(tableName, "incentiveValue", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.incentiveAmount) {
    await queryInterface.addColumn(tableName, "incentiveAmount", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.returnPercentage) {
    await queryInterface.addColumn(tableName, "returnPercentage", {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.emailSent) {
    await queryInterface.addColumn(tableName, "emailSent", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }
};

const syncProfitLossRowsToModeTables = async () => {
  const modeTargets = [
    { mode: "auto", Model: db.autoProfitLoss },
    { mode: "user", Model: db.userProfitLoss },
  ];

  for (const { mode, Model } of modeTargets) {
    const rows = await db.profitLoss.findAll({
      where: { mode },
      paranoid: false,
    });

    for (const row of rows) {
      const plain = row.get({ plain: true });
      const existing = await Model.findOne({
        where: { Id: plain.Id },
        paranoid: false,
      });
      if (existing) continue;

      await Model.create(
        {
          ...plain,
          mode,
          marketingSpends: plain.marketingSpends || 0,
          otherExpenses: plain.otherExpenses || 0,
          incentiveType: plain.incentiveType || "flat",
          incentiveValue: plain.incentiveValue || 0,
          incentiveAmount: plain.incentiveAmount || 0,
          returnPercentage: plain.returnPercentage || 0,
        },
        { silent: true },
      );
    }
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

const ensureManufactureVariantColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const modelKeys = [
    "manufacture",
    "stockAdjustment",
    "itemMaster",
    "manufactureStock",
  ];

  for (const modelKey of modelKeys) {
    const tableName = db[modelKey].getTableName();
    const tableDefinition = await queryInterface.describeTable(tableName);

    if (
      modelKey === "stockAdjustment" ||
      modelKey === "itemMaster" ||
      modelKey === "manufactureStock"
    ) {
      if (!tableDefinition.itemId) {
        await queryInterface.addColumn(tableName, "itemId", {
          type: DataTypes.INTEGER(10),
          allowNull: true,
        });
      }

      if (!tableDefinition.productId) {
        await queryInterface.addColumn(tableName, "productId", {
          type: DataTypes.INTEGER(10),
          allowNull: true,
        });
      }
    }

    if (!tableDefinition.variant) {
      await queryInterface.addColumn(tableName, "variant", {
        type: DataTypes.JSON,
        allowNull: true,
      });
    }

    if (!tableDefinition.variantKey) {
      await queryInterface.addColumn(tableName, "variantKey", {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  }
};

const ensureMixerManufacturerColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.mixer.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.manufacturerId) {
    await queryInterface.addColumn(tableName, "manufacturerId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.manufacturerName) {
    await queryInterface.addColumn(tableName, "manufacturerName", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.unitWage) {
    await queryInterface.addColumn(tableName, "unitWage", {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.wageAmount) {
    await queryInterface.addColumn(tableName, "wageAmount", {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!tableDefinition.othersCost) {
    await queryInterface.addColumn(tableName, "othersCost", {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }
};

const ensureLedgerHistoryManufacturerColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.ledgerHistory.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.manufacturerId) {
    await queryInterface.addColumn(tableName, "manufacturerId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.manufacturerTransactionId) {
    await queryInterface.addColumn(tableName, "manufacturerTransactionId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const ensureStockMovementDateColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.stockMovement.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.date) {
    await queryInterface.addColumn(tableName, "date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  // Rows written before the logger started stamping `date` (and any flow that
  // still omits it) keep a NULL date, which is silently skipped by the
  // `WHERE date <= ...` range filter in the stock ledger reports — so their
  // opening/closing stock comes out wrong. Backfill from each row's own
  // createdAt calendar date (stored in +06:00, so DATE() is the local day).
  await db.sequelize.query(
    `UPDATE \`${tableName}\` SET \`date\` = DATE(\`createdAt\`) WHERE \`date\` IS NULL`,
  );
};

// Movement-based costing (Phase 0). Nullable, additive — no report reads these
// yet. IN rows carry unitCost; OUT rows carry unitSalePrice + unitCostConsumed
// (+ costBreakdown once Phase 1 wires the FIFO cost layers).
const ensureStockMovementCostingColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.stockMovement.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const decimalColumns = ["unitCost", "unitSalePrice", "unitCostConsumed"];
  for (const column of decimalColumns) {
    if (!tableDefinition[column]) {
      await queryInterface.addColumn(tableName, column, {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
      });
    }
  }

  if (!tableDefinition.costBreakdown) {
    await queryInterface.addColumn(tableName, "costBreakdown", {
      type: DataTypes.JSON,
      allowNull: true,
    });
  }
};

// FIFO cost column on the sale/return source tables (Phase 3). Reports read
// this instead of catalog price. Nullable + additive.
const ensureFifoCostColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  for (const model of [db.inTransitProduct, db.returnProduct]) {
    if (!model) continue;
    const tableName = model.getTableName();
    const def = await queryInterface.describeTable(tableName);
    if (!def.fifo_cost) {
      await queryInterface.addColumn(tableName, "fifo_cost", {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
      });
    }
  }
};

// One-time FIFO seed (Phase 1). When the cost-layer table is still empty, open
// one "opening balance" layer per in-stock product, valued at its current
// catalog purchase price (per the agreed policy). Runs before any real receipt,
// so its early receivedDate makes FIFO consume opening stock first.
const parseVariantsForSeed = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Opening layers for a product. A variant product gets one layer per variant at
// that variant's own purchase_price (0 if the user hasn't set it — no
// fallback). A flat product gets one null-key layer at its purchase_price.
const buildOpeningLayers = (inv) => {
  const productId = Number(inv.productId);
  if (!productId) return [];

  const variantRows = parseVariantsForSeed(inv.variants).filter(
    (v) => v && (v.size || v.color) && Number(v.quantity) > 0,
  );

  if (variantRows.length) {
    return variantRows.map((v) => ({
      productId,
      variantKey: `${String(v.size || "").trim()}__${String(v.color || "").trim()}`,
      sourceType: "OpeningBalance",
      sourceMovementId: null,
      receivedDate: "2000-01-01",
      originalQty: Number(v.quantity),
      remainingQty: Number(v.quantity),
      unitCost: Number(v.purchase_price) || 0,
      note: "opening balance (variant)",
    }));
  }

  if (Number(inv.quantity) > 0) {
    return [
      {
        productId,
        variantKey: null,
        sourceType: "OpeningBalance",
        sourceMovementId: null,
        receivedDate: "2000-01-01",
        originalQty: Number(inv.quantity),
        remainingQty: Number(inv.quantity),
        unitCost: Number(inv.purchase_price) || 0,
        note: "opening balance",
      },
    ];
  }
  return [];
};

const seedOpeningCostLayers = async () => {
  if (!db.inventoryCostLayer || !db.inventoryMaster) return;

  const inventories = await db.inventoryMaster.findAll({
    where: { deletedAt: { [Op.is]: null } },
    attributes: ["productId", "quantity", "purchase_price", "variants"],
    raw: true,
  });

  // Fresh install — seed everything.
  const totalLayers = await db.inventoryCostLayer.count();
  if (totalLayers === 0) {
    const rows = inventories.flatMap(buildOpeningLayers);
    if (rows.length) {
      await db.inventoryCostLayer.bulkCreate(rows);
      console.log(`Seeded ${rows.length} opening cost layers`);
    }
    return;
  }

  // Migrate variant products whose layers are still the flat (null-key)
  // Phase-1 seed — replace them with per-variant opening layers. Only touch
  // products that have ONLY OpeningBalance layers (no real movement yet).
  for (const inv of inventories) {
    const productId = Number(inv.productId);
    if (!productId) continue;
    const variantRows = parseVariantsForSeed(inv.variants).filter(
      (v) => v && (v.size || v.color) && Number(v.quantity) > 0,
    );
    if (!variantRows.length) continue;

    const layers = await db.inventoryCostLayer.findAll({
      where: { productId },
      attributes: ["Id", "sourceType", "variantKey"],
      raw: true,
    });
    if (!layers.length) continue;
    const allOpening = layers.every((l) => l.sourceType === "OpeningBalance");
    const alreadyVariant = layers.some((l) => l.variantKey);
    if (!allOpening || alreadyVariant) continue;

    await db.inventoryCostLayer.destroy({ where: { productId } });
    await db.inventoryCostLayer.bulkCreate(buildOpeningLayers(inv));
    console.log(
      `Re-seeded product ${productId} with per-variant opening layers`,
    );
  }
};

const ensurePackagingFactoryCostBreakdownColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  for (const model of [db.packagingFactory, db.manufactureProduction]) {
    if (!model) continue;
    const tableName = model.getTableName();
    const tableDefinition = await queryInterface.describeTable(tableName);
    if (!tableDefinition.costBreakdown) {
      await queryInterface.addColumn(tableName, "costBreakdown", {
        type: DataTypes.JSON,
        allowNull: true,
      });
    }
  }
};

// One-time: seed FIFO cost layers for packaging items (opening balance =
// weighted-average unit cost from that item's purchases) and backfill the
// historical 0-cost factory moves / factory stock so the chain shows real cost.
const seedPackagingOpeningLayers = async () => {
  if (!db.packagingCostLayer || !db.packagingItemStock) return;
  if ((await db.packagingCostLayer.count()) > 0) return; // already seeded

  const {
    toBaseStockPayload: toBase,
  } = require("../helpers/unitConversionHelper");
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const round4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
  const baseOf = (unit, value) => toBase(unit, value).unitValue;

  // Weighted-average unit cost per packaging item, from all its purchases.
  const purchases = await db.packagingItemPurchase.findAll({
    attributes: ["packagingItemId", "unit", "unitValue", "cost"],
    paranoid: false,
    raw: true,
  });
  const agg = {};
  for (const p of purchases) {
    const base = baseOf(p.unit, p.unitValue);
    if (base <= 0) continue;
    agg[p.packagingItemId] ||= { qty: 0, value: 0 };
    agg[p.packagingItemId].qty += base;
    agg[p.packagingItemId].value += Number(p.cost) || 0;
  }
  const unitCostOf = (itemId, fallback = 0) => {
    const a = agg[itemId];
    return a && a.qty > 0 ? round4(a.value / a.qty) : round4(fallback);
  };

  // 1) Opening layers for whatever is currently in Packaging Item Stock.
  const stocks = await db.packagingItemStock.findAll({
    where: { deletedAt: { [Op.is]: null } },
    raw: true,
  });
  const layerRows = [];
  for (const s of stocks) {
    const base = baseOf(s.unit, s.unitValue);
    if (base <= 0) continue;
    const fallbackUc = base > 0 ? (Number(s.cost) || 0) / base : 0;
    const uc = unitCostOf(s.packagingItemId, fallbackUc);
    layerRows.push({
      packagingItemId: s.packagingItemId,
      sourceType: "OpeningBalance",
      sourceMovementId: null,
      receivedDate: "2000-01-01",
      originalQty: round2(base),
      remainingQty: round2(base),
      unitCost: uc,
      note: "opening balance",
    });
    await db.packagingItemStock.update(
      { cost: round2(base * uc) },
      { where: { Id: s.Id } },
    );
  }
  if (layerRows.length) {
    await db.packagingCostLayer.bulkCreate(layerRows);
    console.log(`Seeded ${layerRows.length} packaging opening cost layers`);
  }

  // 2) Backfill historical 0-cost factory moves + factory stock.
  const fixCost = async (Model, valueCol = "cost") => {
    const rows = await Model.findAll({
      where: { [valueCol]: 0 },
      paranoid: false,
      raw: true,
    });
    let fixed = 0;
    for (const r of rows) {
      const base = baseOf(r.unit, r.unitValue);
      const uc = unitCostOf(r.packagingItemId);
      if (base <= 0 || uc <= 0) continue;
      await Model.update(
        { [valueCol]: round2(base * uc) },
        { where: { Id: r.Id } },
      );
      fixed += 1;
    }
    if (fixed) {
      console.log(`Backfilled ${fixed} ${Model.getTableName()} cost rows`);
    }
  };
  await fixCost(db.packagingFactory);
  await fixCost(db.packagingFactoryStock);
};

// Per-item base-unit cost: weighted-average of that item's purchases, falling
// back to the flat Item Stock row's current unit cost.
const buildItemUnitCostResolver = async (baseOf, round4) => {
  const purchases = await db.manufacture.findAll({
    attributes: ["itemId", "unit", "unitValue", "cost"],
    paranoid: false,
    raw: true,
  });
  const agg = {};
  for (const p of purchases) {
    const base = baseOf(p.unit, p.unitValue);
    if (base <= 0) continue;
    agg[p.itemId] ||= { qty: 0, value: 0 };
    agg[p.itemId].qty += base;
    agg[p.itemId].value += Number(p.cost) || 0;
  }

  const flatStocks = await db.itemMaster.findAll({
    where: {
      itemId: { [Op.ne]: null },
      [Op.or]: [{ productId: null }, { productId: 0 }],
    },
    raw: true,
  });
  const flatUc = {};
  for (const s of flatStocks) {
    const base = baseOf(s.unit, s.unitValue);
    if (base > 0 && Number(s.cost) > 0) flatUc[s.itemId] = Number(s.cost) / base;
  }

  return (itemId, fallback = 0) => {
    const a = agg[itemId];
    if (a && a.qty > 0) return round4(a.value / a.qty);
    if (flatUc[itemId] > 0) return round4(flatUc[itemId]);
    return round4(fallback);
  };
};

// One-time: seed FIFO cost layers for manufacture raw-material items (opening
// balance = weighted-average unit cost from that item's purchases).
const seedItemOpeningLayers = async () => {
  if (!db.itemCostLayer || !db.itemMaster) return;
  if ((await db.itemCostLayer.count()) > 0) return; // already seeded

  const {
    toBaseStockPayload: toBase,
  } = require("../helpers/unitConversionHelper");
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const round4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
  const baseOf = (unit, value) => toBase(unit, value).unitValue;
  const unitCostOf = await buildItemUnitCostResolver(baseOf, round4);

  const stocks = await db.itemMaster.findAll({
    where: {
      itemId: { [Op.ne]: null },
      [Op.or]: [{ productId: null }, { productId: 0 }],
    },
    raw: true,
  });
  const layerRows = [];
  for (const s of stocks) {
    const base = baseOf(s.unit, s.unitValue);
    if (base <= 0) continue;
    const fallbackUc = base > 0 ? (Number(s.cost) || 0) / base : 0;
    const uc = unitCostOf(s.itemId, fallbackUc);
    layerRows.push({
      itemId: s.itemId,
      sourceType: "OpeningBalance",
      sourceMovementId: null,
      receivedDate: "2000-01-01",
      originalQty: round2(base),
      remainingQty: round2(base),
      unitCost: uc,
      note: "opening balance",
    });
    await db.itemMaster.update(
      { cost: round2(base * uc) },
      { where: { Id: s.Id } },
    );
  }
  if (layerRows.length) {
    await db.itemCostLayer.bulkCreate(layerRows);
    console.log(`Seeded ${layerRows.length} item opening cost layers`);
  }
};

// Idempotent: any Factory Stock row still showing ৳0 gets
// `baseQty × that item's unit cost`. Runs every boot; only touches cost=0 rows.
const backfillFactoryStockCost = async () => {
  if (!db.manufactureStock || !db.itemMaster) return;
  const {
    toBaseStockPayload: toBase,
  } = require("../helpers/unitConversionHelper");
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const round4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
  const baseOf = (unit, value) => toBase(unit, value).unitValue;
  const unitCostOf = await buildItemUnitCostResolver(baseOf, round4);

  const rows = await db.manufactureStock.findAll({
    where: { cost: 0, itemId: { [Op.ne]: null } },
    paranoid: false,
    raw: true,
  });
  let fixed = 0;
  for (const r of rows) {
    const base = baseOf(r.unit, r.unitValue);
    const uc = unitCostOf(r.itemId);
    if (base <= 0 || uc <= 0) continue;
    await db.manufactureStock.update(
      { cost: round2(base * uc) },
      { where: { Id: r.Id } },
    );
    fixed += 1;
  }
  if (fixed) console.log(`Backfilled ${fixed} factory stock cost rows`);
};

const ensureLedgerManufacturerColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.ledger.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.manufacturerId) {
    await queryInterface.addColumn(tableName, "manufacturerId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  await queryInterface.changeColumn(tableName, "role", {
    type: DataTypes.ENUM("Customer", "Supplier", "Employee", "Manufacturer"),
    allowNull: false,
  });
};

const ensureCashInOutManufacturerColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.cashInOut.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.manufacturerId) {
    await queryInterface.addColumn(tableName, "manufacturerId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

const ensureCashInOutPackagingManufacturerColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.cashInOut.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.packagingManufacturerId) {
    await queryInterface.addColumn(tableName, "packagingManufacturerId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

// Superseded by paidAmount below — a running paid total (like Supplier's
// SupplierHistory / Manufacturer's ManufacturerTransaction) makes more sense
// here than a single Paid/Unpaid flag, since partial payments need to reduce
// Due and any overpayment needs to show up as Advance.
const ensureSalesLedgerPaidAmountColumn = async (modelKey) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db[modelKey].getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.paidAmount) {
    await queryInterface.addColumn(tableName, "paidAmount", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (tableDefinition.status) {
    await queryInterface.removeColumn(tableName, "status");
  }
};

const ensurePackagingMixerColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.packagingMixer.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.othersCost) {
    await queryInterface.addColumn(tableName, "othersCost", {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
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

  if (!tableDefinition.bookId) {
    await queryInterface.addColumn(tableName, "bookId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.supplierId) {
    await queryInterface.addColumn(tableName, "supplierId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.ownerId) {
    await queryInterface.addColumn(tableName, "ownerId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.directorId) {
    await queryInterface.addColumn(tableName, "directorId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  if (!tableDefinition.voucherNo) {
    await queryInterface.addColumn(tableName, "voucherNo", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }
};

const normalizeLookupText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const ensureCategoryStatusColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.category.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.status) {
    await queryInterface.addColumn(tableName, "status", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "Expense",
    });
  }

  await db.category.update(
    { status: "Expense" },
    {
      where: {
        [Op.or]: [{ status: null }, { status: "" }, { status: "Active" }],
      },
      paranoid: false,
    },
  );
};

const ensureCashInOutCategoryRelation = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.cashInOut.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.categoryId) {
    await queryInterface.addColumn(tableName, "categoryId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }

  const [categories, rows] = await Promise.all([
    db.category.findAll({ paranoid: false }),
    db.cashInOut.findAll({
      attributes: ["Id", "category", "categoryId"],
      where: {
        category: { [Op.ne]: null },
      },
      paranoid: false,
    }),
  ]);

  const categoryByName = new Map();
  categories.forEach((category) => {
    const key = normalizeLookupText(category.name);
    if (key) categoryByName.set(key, category);
  });

  for (const row of rows) {
    const categoryName = String(row.category || "").trim();
    const key = normalizeLookupText(categoryName);
    if (!key) continue;

    let category = categoryByName.get(key);
    if (!category) {
      category = await db.category.create({ name: categoryName });
      categoryByName.set(key, category);
    } else if (typeof category.restore === "function" && category.deletedAt) {
      await category.restore();
    }

    if (Number(row.categoryId) !== Number(category.Id)) {
      await db.cashInOut.update(
        { categoryId: category.Id, category: category.name },
        { where: { Id: row.Id }, paranoid: false },
      );
    }
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
    "leaderCs",
    "leaderLogistics",
    "inventor",
    "accountant",
    "hr",
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

const ensureCashInOutRefNoColumn = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.cashInOut.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.refNo) {
    await queryInterface.addColumn(tableName, "refNo", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.fromParty) {
    await queryInterface.addColumn(tableName, "fromParty", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!tableDefinition.dollarSupplierId) {
    await queryInterface.addColumn(tableName, "dollarSupplierId", {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    });
  }
};

// DollarSupplierHistory gained USD breakdown columns (purchases entered in USD).
const ensureDollarSupplierHistoryColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.dollarSupplierHistory.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  if (!tableDefinition.usdAmount) {
    await queryInterface.addColumn(tableName, "usdAmount", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    });
  }
  if (!tableDefinition.usdRate) {
    await queryInterface.addColumn(tableName, "usdRate", {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
    });
  }
};

// MarketingExpense gained dollar-supplier / USD purchase columns.
const ensureMarketingExpenseColumns = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const tableName = db.marketingExpense.getTableName();
  const tableDefinition = await queryInterface.describeTable(tableName);

  const maybeAddColumn = async (columnName, definition) => {
    if (!tableDefinition[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  };

  await maybeAddColumn("dollarSupplierId", {
    type: DataTypes.INTEGER(10),
    allowNull: true,
  });
  await maybeAddColumn("usdAmount", {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  });
  await maybeAddColumn("usdRate", {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: true,
  });
};

db.sequelize
  .sync({ force: false })
  .then(async () => {
    await ensureCashInOutRefNoColumn();
    await ensureDollarSupplierHistoryColumns();
    await ensureMarketingExpenseColumns();
    await ensureHolidayRangeColumns();
    await ensurePerformanceTrackerEntryColumns();
    await ensureAttendanceDeviceApiKeyColumn();
    await ensureEmployeeListColumns();
    await ensureEmployeeColumns();
    await ensureEmployeeWorkReportColumns();
    await ensureChargeEmployeeColumns();
    await ensureLogisticWorkReportColumns();
    await ensureShifaReportColumns();
    await ensureShifaIncentiveColumns();
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
        "packagingItem",
        "packagingItemPurchase",
        "packagingFactory",
        "packagingManufacturer",
        "packagingMixer",
        "product",
        "supplier",
        "loan",
        "warehouse",
        "profitLoss",
        "autoProfitLoss",
        "userProfitLoss",
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
    await ensureCourierNoEntryColumns();
    await Promise.all(
      [
        "inTransitProduct",
        "courierNoEntry",
        "returnProduct",
        "damageProduct",
        "damageRepair",
        "damageRepaired",
      ].map((modelKey) => ensureInventoryMovementItemsColumn(modelKey)),
    );
    await Promise.all(
      ["profitLoss", "autoProfitLoss", "userProfitLoss"].map((modelKey) =>
        ensureProfitLossColumns(modelKey),
      ),
    );
    await syncProfitLossRowsToModeTables();
    await Promise.all(
      ["assetsPurchase", "assetsSale", "assetsDamage"].map((modelKey) =>
        ensureAssetMovementColumns(modelKey),
      ),
    );
    await ensureAssetIdColumn("assetsRequisition");
    await ensurePurchaseRequisitionAssetColumns();
    await ensurePurchaseRequisitionItemsColumn();
    await ensureItemRequisitionUnitColumn();
    await ensurePackagingItemPurchaseColumns();
    await ensurePurchaseReturnProductItemsColumn();
    await ensureManufactureVariantColumns();
    await ensureMixerManufacturerColumns();
    await ensureLedgerHistoryManufacturerColumns();
    await ensureCashInOutManufacturerColumn();
    await ensureCashInOutPackagingManufacturerColumn();
    await Promise.all(
      ["salesDue", "salaryAdvance"].map((modelKey) =>
        ensureSalesLedgerPaidAmountColumn(modelKey),
      ),
    );
    await ensureLedgerManufacturerColumns();
    await ensureStockMovementDateColumn();
    await ensureStockMovementCostingColumns();
    await ensureFifoCostColumns();
    await seedOpeningCostLayers();
    await ensurePackagingFactoryCostBreakdownColumn();
    await seedPackagingOpeningLayers();
    await seedItemOpeningLayers();
    await backfillFactoryStockCost();
    await ensurePackagingMixerColumns();
    await Promise.all(
      ["pettyCash", "pettyCashRequisition"].map((modelKey) =>
        ensurePettyCashColumns(modelKey),
      ),
    );
    await ensureCreditLedgerColumns();
    await ensureCashInOutLoanColumns();
    await ensureCategoryStatusColumn();
    await ensureCashInOutCategoryRelation();
    await syncLoanRowsFromCashInOut();
    await ensureInventoryMinimumStockColumn();
    await ensureAssetsStockColumns();
    await Promise.all(
      ["damageStock", "damageReparingStock"].map((modelKey) =>
        ensureDamageStockPriceColumns(modelKey),
      ),
    );
    await require("../app/modules/masterPermission/masterPermission.service").ensureDefaultMasterPermission();
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
    const rolesWithLegacyShifaDefault = new Set([
      ENUM_USER_ROLE.SUPER_ADMIN,
      ENUM_USER_ROLE.ADMIN,
    ]);
    const legacyShifaPermissionSet = new Set([
      MENU_PERMISSIONS.SHIFA,
      MENU_PERMISSIONS.SHIFA_OVERVIEW,
      MENU_PERMISSIONS.SHIFA_CALL_HISTORY,
      MENU_PERMISSIONS.SHIFA_STARTING_SITUATION,
      MENU_PERMISSIONS.SHIFA_PROBLEM_HISTORY,
      MENU_PERMISSIONS.SHIFA_PATIENT_UPDATE,
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

    const removeLegacyShifaDefault = async (role, defaultMenuPermissions) => {
      if (!rolesWithLegacyShifaDefault.has(role)) return;

      const record = await db.rolePermission.findOne({ where: { role } });
      if (!record) return;

      const currentPermissions = normalizePermissionList(
        record.menuPermissions,
      );
      if (
        !currentPermissions.some((permission) =>
          legacyShifaPermissionSet.has(permission),
        )
      ) {
        return;
      }

      const permissionsWithoutShifa = currentPermissions.filter(
        (permission) => !legacyShifaPermissionSet.has(permission),
      );

      if (areSamePermissions(permissionsWithoutShifa, defaultMenuPermissions)) {
        await record.update({
          menuPermissions: permissionsWithoutShifa,
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
          await removeLegacyShifaDefault(role, menuPermissions);
        },
      ),
    );

    console.log("Connection re-synced successfully");
  })
  .catch((err) => console.error("Error on re-sync:", err));

module.exports = db;
