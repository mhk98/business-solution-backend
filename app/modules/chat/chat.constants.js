const { ENUM_USER_ROLE } = require("../../enums/user");

const CHAT_ALLOWED_ROLES = [
  ENUM_USER_ROLE.EMPLOYEE,
  ENUM_USER_ROLE.SUPER_ADMIN,
  ENUM_USER_ROLE.ADMIN,
  ENUM_USER_ROLE.LEADER,
];

const CHAT_USER_SEARCHABLE_FIELDS = ["FirstName", "LastName", "Email", "Phone"];

module.exports = {
  CHAT_ALLOWED_ROLES,
  CHAT_USER_SEARCHABLE_FIELDS,
};
