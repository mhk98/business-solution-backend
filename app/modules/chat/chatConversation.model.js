module.exports = (sequelize, DataTypes) => {
  const ChatConversation = sequelize.define(
    "ChatConversation",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userOneId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      userTwoId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      lastMessageId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      lastMessageAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "ChatConversations",
      indexes: [
        {
          unique: true,
          fields: ["userOneId", "userTwoId"],
        },
      ],
    },
  );

  return ChatConversation;
};
