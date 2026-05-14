const express = require("express");
const UserRoutes = require("../modules/user/user.routes");
const ProductRoutes = require("../modules/product/product.routes");
const AssetRoutes = require("../modules/asset/asset.routes");
const AssetsPurchaseRoutes = require("../modules/assetsPurchase/assetsPurchase.routes");
const AssetsStockRoutes = require("../modules/assetsStock/assetsStock.routes");
const ReceivedProductRoutes = require("../modules/receivedProduct/receivedProduct.routes");
const ReturnProductRoutes = require("../modules/returnProduct/returnProduct.routes");
const InTransitProductRoutes = require("../modules/inTransitProduct/inTransitProduct.routes");
const MetaRoutes = require("../modules/meta/meta.routes");
const AssetsSaleRoutes = require("../modules/assetsSale/assetsSale.routes");
const ConfirmOrderRoutes = require("../modules/confirmOrder/confirmOrder.routes");
const CashInRoutes = require("../modules/cashIn/cashIn.routes");
const PettyCashRoutes = require("../modules/pettyCash/pettyCash.routes");
const ExpenseRoutes = require("../modules/expense/expense.routes");
const BookRoutes = require("../modules/book/book.routes");
const CashInOutRoutes = require("../modules/cashInOut/cashInOut.routes");
const PurchaseReturnProductRoutes = require("../modules/purchaseReturnProduct/purchaseReturnProduct.routes");
const ReceiveableRoutes = require("../modules/receiveable/receiveable.routes");
const PayableRoutes = require("../modules/payable/payable.routes");
const OverviewRoutes = require("../modules/overview/overview.routes");
const AssetsDamageRoutes = require("../modules/assetsDamage/assetsDamage.routes");
const SupplierRoutes = require("../modules/supplier/supplier.routes");
const CategoryRoutes = require("../modules/category/category.routes");
const BankAccountRoutes = require("../modules/bankAccount/bankAccount.routes");
const DamageProductRoutes = require("../modules/damageProduct/damageProduct.routes");
const EmployeeRoutes = require("../modules/employee/employee.routes");
const NotificationRoutes = require("../modules/notification/notification.routes");
const NoticeRoutes = require("../modules/notice/notice.routes");
const ChargeSettingRoutes = require("../modules/chargeSetting/chargeSetting.routes");
const TaskRoutes = require("../modules/task/task.routes");
const WarehouseRoutes = require("../modules/warehouse/warehouse.routes");
const LogoRoutes = require("../modules/logo/logo.routes");
const SalaryRoutes = require("../modules/salary/salary.routes");
const DamageRepairRoutes = require("../modules/damageRepair/damageRepair.routes");
const DamageRepairedRoutes = require("../modules/damageRepaired/damageRepaired.routes");
const PurchaseRequisitionRoutes = require("../modules/purchaseRequision/purchaseRequisition.routes");
const AssetsRequisitionRoutes = require("../modules/assetsRequisition/assetsRequisition.routes");
const PosReportRoutes = require("../modules/posReport/posReport.routes");
const WarrantyProductRoutes = require("../modules/warrantyProduct/warrantyProduct.routes");
const MarketingBookRoutes = require("../modules/marketingBook/marketingBook.routes");
const MarketingExpenseRoutes = require("../modules/marketingExpense/marketingExpense.routes");
const AdsCampaignKPIRoutes = require("../modules/adsCampaignKPI/adsCampaignKPI.routes");
const InventoryMasterRoutes = require("../modules/inventoryMaster/inventoryMaster.routes");
const InventoryOverviewRoutes = require("../modules/inventoryOverview/inventoryOverview.routes");
const DamageStockRoutes = require("../modules/damageStock/damageStock.routes");
const SupplierHistoryRoutes = require("../modules/supplierHistory/supplierHistory.routes");
const ManufactureRoutes = require("../modules/manufacture/manufacture.routes");
const MixerRoutes = require("../modules/mixer/mixer.routes");
const ItemRoutes = require("../modules/item/item.routes");
const ItemMasterRoutes = require("../modules/itemMaster/itemMaster.routes");
const LedgerRoutes = require("../modules/ledger/ledger.routes");
const LedgerHistoryRoutes = require("../modules/ledgerHistory/ledgerHistory.routes");
const StockAdjustmentRoutes = require("../modules/stockAdjustment/stockAdjustment.routes");
const VariationRoutes = require("../modules/variation/variation.routes");
const DamageReparingStockRoutes = require("../modules/damageReparingStock/damageReparingStock.routes");
const EmployeeListRoutes = require("../modules/employeeList/employeeList.routes");
const DailyWorkReportRoutes = require("../modules/dailyWorkReport/dailyWorkReport.routes");
const EmployeeWorkReportRoutes = require("../modules/employeeWorkReport/employeeWorkReport.routes");
const LogisticWorkReportRoutes = require("../modules/logisticWorkReport/logisticWorkReport.routes");
const DepartmentRoutes = require("../modules/department/department.routes");
const DesignationRoutes = require("../modules/designation/designation.routes");
const TeamRoutes = require("../modules/team/team.routes");
const ShiftRoutes = require("../modules/shift/shift.routes");
const HolidayRoutes = require("../modules/holiday/holiday.routes");
const AttendanceDeviceRoutes = require("../modules/attendanceDevice/attendanceDevice.routes");
const AttendanceEnrollmentRoutes = require("../modules/attendanceEnrollment/attendanceEnrollment.routes");
const AttendanceLogRoutes = require("../modules/attendanceLog/attendanceLog.routes");
const AttendanceSummaryRoutes = require("../modules/attendanceSummary/attendanceSummary.routes");
const AttendanceRegularizationRoutes = require("../modules/attendanceRegularization/attendanceRegularization.routes");
const LeaveTypeRoutes = require("../modules/leaveType/leaveType.routes");
const LeaveRequestRoutes = require("../modules/leaveRequest/leaveRequest.routes");
const PayrollRunRoutes = require("../modules/payrollRun/payrollRun.routes");
const PayrollItemRoutes = require("../modules/payrollItem/payrollItem.routes");
const ProfileLossRoutes = require("../modules/profitLoss/profitLoss.routes");
const RolePermissionRoutes = require("../modules/rolePermission/rolePermission.routes");
const UserLogHistoryRoutes = require("../modules/userLogHistory/userLogHistory.routes");
const KPIRoutes = require("../modules/kpi/kpi.routes");
const ChatRoutes = require("../modules/chat/chat.routes");

const router = express.Router();

const moduleRoutes = [
  {
    path: "/user",
    route: UserRoutes,
  },
  {
    path: "/daily-work-reports",
    route: DailyWorkReportRoutes,
  },
  {
    path: "/employee-work-reports",
    route: EmployeeWorkReportRoutes,
  },
  {
    path: "/logistic-work-reports",
    route: LogisticWorkReportRoutes,
  },
  {
    path: "/role-permissions",
    route: RolePermissionRoutes,
  },
  {
    path: "/user-log-history",
    route: UserLogHistoryRoutes,
  },

  {
    path: "/product",
    route: ProductRoutes,
  },
  {
    path: "/variation",
    route: VariationRoutes,
  },
  {
    path: "/product",
    route: ProductRoutes,
  },
  {
    path: "/item",
    route: ItemRoutes,
  },
  {
    path: "/item-master",
    route: ItemMasterRoutes,
  },
  {
    path: "/inventory-master",
    route: InventoryMasterRoutes,
  },
  {
    path: "/purchase-requisition",
    route: PurchaseRequisitionRoutes,
  },
  {
    path: "/received-product",
    route: ReceivedProductRoutes,
  },
  {
    path: "/manufacture",
    route: ManufactureRoutes,
  },
  {
    path: "/stock-adjustment",
    route: StockAdjustmentRoutes,
  },
  {
    path: "/mixer",
    route: MixerRoutes,
  },
  {
    path: "/intransit-product",
    route: InTransitProductRoutes,
  },
  {
    path: "/damage-product",
    route: DamageProductRoutes,
  },
  {
    path: "/damage-stock",
    route: DamageStockRoutes,
  },
  {
    path: "/damage-repairing-stock",
    route: DamageReparingStockRoutes,
  },
  {
    path: "/damage-repair",
    route: DamageRepairRoutes,
  },
  {
    path: "/damage-repaired",
    route: DamageRepairedRoutes,
  },
  {
    path: "/return-product",
    route: ReturnProductRoutes,
  },
  {
    path: "/purchase-return-product",
    route: PurchaseReturnProductRoutes,
  },
  {
    path: "/confirm-order",
    route: ConfirmOrderRoutes,
  },
  {
    path: "/meta",
    route: MetaRoutes,
  },
  {
    path: "/assets-requisition",
    route: AssetsRequisitionRoutes,
  },
  {
    path: "/asset",
    route: AssetRoutes,
  },
  {
    path: "/assets-purchase",
    route: AssetsPurchaseRoutes,
  },
  {
    path: "/assets-stock",
    route: AssetsStockRoutes,
  },
  {
    path: "/assets-sale",
    route: AssetsSaleRoutes,
  },
  {
    path: "/assets-damage",
    route: AssetsDamageRoutes,
  },
  {
    path: "/cash-in",
    route: CashInRoutes,
  },
  {
    path: "/petty-cash",
    route: PettyCashRoutes,
  },
  {
    path: "/ledger",
    route: LedgerRoutes,
  },
  {
    path: "/ledger-history",
    route: LedgerHistoryRoutes,
  },
  {
    path: "/expense",
    route: ExpenseRoutes,
  },
  {
    path: "/book",
    route: BookRoutes,
  },
  {
    path: "/marketing-book",
    route: MarketingBookRoutes,
  },
  {
    path: "/marketing-expense",
    route: MarketingExpenseRoutes,
  },
  {
    path: "/ads-campaign-kpi",
    route: AdsCampaignKPIRoutes,
  },
  {
    path: "/profit-loss",
    route: ProfileLossRoutes,
  },
  {
    path: "/category",
    route: CategoryRoutes,
  },
  {
    path: "/bank-account",
    route: BankAccountRoutes,
  },
  {
    path: "/supplier",
    route: SupplierRoutes,
  },
  {
    path: "/supplier-history",
    route: SupplierHistoryRoutes,
  },
  {
    path: "/warehouse",
    route: WarehouseRoutes,
  },
  {
    path: "/cash-in",
    route: CashInRoutes,
  },
  {
    path: "/cash-in-out",
    route: CashInOutRoutes,
  },
  {
    path: "/receiveable",
    route: ReceiveableRoutes,
  },
  {
    path: "/payable",
    route: PayableRoutes,
  },
  {
    path: "/kpi",
    route: KPIRoutes,
  },
  {
    path: "/chat",
    route: ChatRoutes,
  },
  {
    path: "/employee",
    route: EmployeeRoutes,
  },
  {
    path: "/employee-list",
    route: EmployeeListRoutes,
  },
  {
    path: "/department",
    route: DepartmentRoutes,
  },
  {
    path: "/designation",
    route: DesignationRoutes,
  },
  {
    path: "/team",
    route: TeamRoutes,
  },
  {
    path: "/shift",
    route: ShiftRoutes,
  },
  {
    path: "/holiday",
    route: HolidayRoutes,
  },
  {
    path: "/attendance-device",
    route: AttendanceDeviceRoutes,
  },
  {
    path: "/attendance-enrollment",
    route: AttendanceEnrollmentRoutes,
  },
  {
    path: "/attendance-log",
    route: AttendanceLogRoutes,
  },
  {
    path: "/attendance-summary",
    route: AttendanceSummaryRoutes,
  },
  {
    path: "/attendance-regularization",
    route: AttendanceRegularizationRoutes,
  },
  {
    path: "/leave-type",
    route: LeaveTypeRoutes,
  },
  {
    path: "/leave-request",
    route: LeaveRequestRoutes,
  },
  {
    path: "/payroll-run",
    route: PayrollRunRoutes,
  },
  {
    path: "/payroll-item",
    route: PayrollItemRoutes,
  },
  {
    path: "/salary",
    route: SalaryRoutes,
  },
  {
    path: "/logo",
    route: LogoRoutes,
  },
  {
    path: "/pos-report",
    route: PosReportRoutes,
  },
  {
    path: "/warranty-product",
    route: WarrantyProductRoutes,
  },
  {
    path: "/notification",
    route: NotificationRoutes,
  },
  {
    path: "/notice",
    route: NoticeRoutes,
  },
  {
    path: "/charge-settings",
    route: ChargeSettingRoutes,
  },
  {
    path: "/task",
    route: TaskRoutes,
  },
  {
    path: "/overview",
    route: OverviewRoutes,
  },
  {
    path: "/inventory",
    route: InventoryOverviewRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));
module.exports = router;
