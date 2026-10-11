// An edit or delete that a non-approver asked for on a workflow record
// (Purchase, Cash In/Out, Damage, …). The record itself is only flagged
// (status Pending / Pending Delete); the requested edit waits here and is
// replayed through the module's own update route on approval, so reject leaves
// the record exactly as it was.
module.exports = (sequelize, DataTypes) => {
  const ApprovalRequest = sequelize.define(
    "ApprovalRequest",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      modelKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      entityLabel: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      recordId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      // "Update" | "Delete"
      action: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      // Update: { body, file } exactly as the form sent it.
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      // Where the edit is replayed on approval (e.g. PUT /api/v1/assets-purchase/12).
      method: {
        type: DataTypes.STRING(8),
        allowNull: true,
      },
      url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      previousStatus: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      previousNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      requestedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      // "Pending" | "Approved" | "Rejected"
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "Pending",
      },
      resolvedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resolutionNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Notifications sent to the approvers; marked read once anyone decides.
      notificationIds: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [{ fields: ["modelKey", "recordId", "status"] }, { fields: ["status"] }],
    },
  );

  return ApprovalRequest;
};
