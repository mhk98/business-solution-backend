module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define(
    "ChatMessage",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      conversationId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      senderUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      receiverUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      messageType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "text",
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "ChatMessages",
    },
  );

  return ChatMessage;
};
