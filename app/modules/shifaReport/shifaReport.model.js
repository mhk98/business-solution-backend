module.exports = (sequelize, DataTypes) => {
  const ShifaReport = sequelize.define(
    "ShifaReport",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      employeeId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      reportDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      reportType: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      age: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      gender: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      callerName: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      relation: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      callHistory: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      phoneCalled: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      phoneNotReceived: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      phoneOff: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      numberBusy: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      refusedCall: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      callCut: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      started: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      notStarted: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      startingOther: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      spousePractice: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      evilEye: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      marriageObstacle: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      livelihoodObstacle: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      jinnAndMagic: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      separation: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      noChild: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      problemOther: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      improving: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      notImproving: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      startingSituation: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      problemHistory: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      patientUpdate: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      nextFollowUpDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      details: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "ShifaReports",
      indexes: [
        {
          unique: true,
          fields: ["userId", "reportDate", "reportType", "name"],
        },
        { fields: ["reportType"] },
        { fields: ["reportDate"] },
        { fields: ["phone"] },
      ],
    },
  );

  return ShifaReport;
};
