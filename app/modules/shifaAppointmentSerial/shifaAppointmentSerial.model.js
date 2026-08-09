module.exports = (sequelize, DataTypes) => {
  const ShifaAppointmentSerial = sequelize.define(
    "ShifaAppointmentSerial",
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
      serial: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      mobileNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      appointmentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      smsStatus: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "Pending",
      },
      smsResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "ShifaAppointmentSerials",
      indexes: [
        {
          unique: true,
          fields: ["appointmentDate", "serial"],
        },
        { fields: ["appointmentDate"] },
        { fields: ["mobileNumber"] },
      ],
    },
  );

  return ShifaAppointmentSerial;
};
