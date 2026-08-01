// // models/notification.js
// module.exports = (sequelize, DataTypes) => {
//   const Notification = sequelize.define(
//     "Notification",
//     {
//       userId: {
//         type: DataTypes.STRING,
//         allowNull: false,
//       },
//       url: {
//         type: DataTypes.STRING,
//         allowNull: false, // Enquiries, Tasks, Payments etc.
//       },
//       message: {
//         type: DataTypes.STRING,
//         allowNull: false,
//       },
//       isRead: {
//         type: DataTypes.BOOLEAN,
//         defaultValue: false,
//       },
//     },
//     {
//       tableName: "notifications", // চাইলে custom নাম
//       timestamps: true, // createdAt & updatedAt আসবে
//     },
//   );

//   return Notification;
// };

const sendEmail = require("../../middlewares/sendEmail");
const sendSms = require("../../middlewares/sendSms");
const notificationEmailTemplate = require("../../utils/emailTemplates/notificationEmail");

const EMAIL_NOTIFICATION_PERMISSION_PREFIX = "email_notify:";
const SMS_NOTIFICATION_PERMISSION_PREFIX = "sms_notify:";

const NOTIFICATION_URL_PERMISSION_MAP = [
  ["/petty-cash-requisition", "petty_cash_requisition"],
  ["/assets-requisition", "requisition"],
  ["/item-requisition", "item_requisition"],
  ["/purchase-requisition", "purchase_requisition"],
  ["/purchase-product", "received_product"],
  ["/purchase-return", "received_return"],
  ["/intransit-product", "intransit_product"],
  ["/courier-no-entry", "courier_no_entry"],
  ["/sales-return", "sales_return"],
  ["/stock-adjustment", "stock_adjustment"],
  ["/stock-movement", "stock_movement"],
  ["/manufacture", "manufacture_menu"],
  ["/damage-repairing-stock", "damage_repairing_stock"],
  ["/damage-repaired", "damage_repaired"],
  ["/damage-repair", "damage_repairing"],
  ["/damage-product", "damage_product"],
  ["/damage-stock", "damage_stock"],
  ["/confirm-order", "pos_report"],
  ["/pos-report", "pos_report"],
  ["/marketing-book", "dm_expense"],
  ["/ads-campaign-kpi", "ads_campaign_kpi"],
  ["/auto-profit-loss", "auto_profit_loss"],
  ["/profit-loss-user", "profit_loss_user"],
  ["/profit-loss", "profit_loss"],
  ["/supplier-history", "accounting_supplier"],
  ["/credit-ledger", "credit_ledger"],
  ["/petty-cash", "petty_cash"],
  ["/payable", "payable"],
  ["/receiveable", "receiveable"],
  ["/receivable", "receiveable"],
  ["/expense", "expense"],
  ["/book", "book"],
  ["/cash", "book"],
  ["/loan", "loan"],
  ["/owner-transaction", "owner_transaction"],
  ["/owner", "owner"],
  ["/tasks", "tasks"],
  ["/notifications", "notifications"],
];

const isNotificationEmailEnabled = () =>
  String(process.env.NOTIFICATION_EMAIL_ENABLED || "true").toLowerCase() ===
  "true";

const isNotificationSmsEnabled = () =>
  String(process.env.NOTIFICATION_SMS_ENABLED || "true").toLowerCase() ===
  "true";

const normalizePermissionList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim());
  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizePermissionList(parsed);
    } catch (error) {
      return [];
    }
  }

  return [];
};

const resolveNotificationMenuPermission = (notification) => {
  const url = String(notification?.url || "").toLowerCase();

  if (!url || url.includes("/chat")) return null;

  const match = NOTIFICATION_URL_PERMISSION_MAP.find(([path]) =>
    url.includes(path),
  );

  return match?.[1] || null;
};

const hasNotificationPermission = async (
  notification,
  user,
  sequelize,
  permissionPrefix,
) => {
  const menuPermission = resolveNotificationMenuPermission(notification);
  if (!menuPermission || !user?.role) return false;

  const RolePermission = sequelize.models.RolePermission;
  const rolePermission = await RolePermission.findOne({
    where: { role: user.role },
  });

  const permissions = normalizePermissionList(rolePermission?.menuPermissions);
  return permissions.includes(`${permissionPrefix}${menuPermission}`);
};

const shouldEmailNotification = async (notification, user, sequelize) => {
  if (!isNotificationEmailEnabled()) return false;

  return hasNotificationPermission(
    notification,
    user,
    sequelize,
    EMAIL_NOTIFICATION_PERMISSION_PREFIX,
  );
};

const shouldSmsNotification = async (notification, user, sequelize) => {
  if (!isNotificationSmsEnabled()) return false;

  return hasNotificationPermission(
    notification,
    user,
    sequelize,
    SMS_NOTIFICATION_PERMISSION_PREFIX,
  );
};

const dispatchNotificationChannels = async (notification, sequelize) => {
  try {
    const User = sequelize.models.User;
    const user = await User.findByPk(notification.userId);

    if (user?.Email && (await shouldEmailNotification(notification, user, sequelize))) {
      const name =
        [user.FirstName, user.LastName].filter(Boolean).join(" ") || "User";

      await sendEmail({
        to: user.Email,
        subject: `New notification - ${process.env.MAIL_BRAND_NAME || "Business Solution"}`,
        htmlContent: notificationEmailTemplate({
          name,
          message: notification.message,
          url: notification.url,
        }),
      });
    }

    if (user?.Phone && (await shouldSmsNotification(notification, user, sequelize))) {
      await sendSms({
        to: user.Phone,
        message: notification.message,
      });
    }
  } catch (error) {
    console.error("Notification dispatch error:", error?.message || error);
  }
};

// models/notification.js
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
      tableName: "Notifications",
      hooks: {
        afterCreate: (notification) => {
          setImmediate(() => {
            dispatchNotificationChannels(notification, sequelize);
          });
        },
      },
    },
  );

  return Notification;
};
