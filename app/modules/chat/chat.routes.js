const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ChatController = require("./chat.controller");

const router = require("express").Router();

const chatRoles = [
  ENUM_USER_ROLE.EMPLOYEE,
  ENUM_USER_ROLE.SUPER_ADMIN,
  ENUM_USER_ROLE.ADMIN,
  ENUM_USER_ROLE.LEADER,
];

router.get("/users", auth(...chatRoles), ChatController.getChatUsers);
router.get(
  "/users/:userId/conversation",
  auth(...chatRoles),
  ChatController.getConversationByUser,
);
router.post("/messages", auth(...chatRoles), ChatController.sendMessage);
router.delete(
  "/messages/:messageId",
  auth(...chatRoles),
  ChatController.deleteMessage,
);
router.get("/conversations", auth(...chatRoles), ChatController.getConversations);
router.get(
  "/conversations/:conversationId/messages",
  auth(...chatRoles),
  ChatController.getMessages,
);
router.put(
  "/conversations/:conversationId/read",
  auth(...chatRoles),
  ChatController.markConversationRead,
);

module.exports = router;
