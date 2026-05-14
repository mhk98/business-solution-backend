const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const {
  CHAT_ALLOWED_ROLES,
  CHAT_USER_SEARCHABLE_FIELDS,
} = require("./chat.constants");
const { emitToUser } = require("../../realtime/socket");

const ChatConversation = db.chatConversation;
const ChatMessage = db.chatMessage;
const Notification = db.notification;
const User = db.user;

const USER_PUBLIC_ATTRIBUTES = [
  "Id",
  "FirstName",
  "LastName",
  "Email",
  "Phone",
  "image",
  "role",
  "status",
];

const assertChatUser = (actor = {}) => {
  if (!actor?.Id) throw new ApiError(401, "You are not authorized");
  if (!CHAT_ALLOWED_ROLES.includes(actor.role)) {
    throw new ApiError(403, "Chat is not allowed for this role");
  }
};

const getPairIds = (senderId, receiverId) => {
  const first = Number(senderId);
  const second = Number(receiverId);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    throw new ApiError(400, "Invalid user id");
  }
  if (first === second) {
    throw new ApiError(400, "You cannot send a message to yourself");
  }
  return {
    userOneId: Math.min(first, second),
    userTwoId: Math.max(first, second),
  };
};

const getParticipantWhere = (userId) => ({
  [Op.or]: [{ userOneId: userId }, { userTwoId: userId }],
});

const sanitizeMessage = (value) => {
  const message = String(value || "").trim();
  if (!message) throw new ApiError(400, "Message is required");
  if (message.length > 5000) {
    throw new ApiError(400, "Message cannot be longer than 5000 characters");
  }
  return message;
};

const getUserDisplayName = (user = {}) => {
  const plain =
    typeof user?.get === "function" ? user.get({ plain: true }) : user;
  const name = `${plain?.FirstName || ""} ${plain?.LastName || ""}`.trim();
  return name || plain?.Email || "Someone";
};

const ensureConversationAccess = async (conversationId, actor = {}) => {
  assertChatUser(actor);

  const id = Number(conversationId);
  if (!Number.isFinite(id)) throw new ApiError(400, "Invalid conversation id");

  const conversation = await ChatConversation.findOne({
    where: {
      Id: id,
      ...getParticipantWhere(actor.Id),
    },
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  return conversation;
};

const getChatUsers = async (filters = {}, options = {}, actor = {}) => {
  assertChatUser(actor);
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm } = filters;

  const andConditions = [
    { Id: { [Op.ne]: actor.Id } },
    { role: { [Op.in]: CHAT_ALLOWED_ROLES } },
    { status: { [Op.eq]: "Active" } },
  ];

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    andConditions.push({
      [Op.or]: CHAT_USER_SEARCHABLE_FIELDS.map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  const whereConditions = { [Op.and]: andConditions };

  const data = await User.findAll({
    where: whereConditions,
    attributes: USER_PUBLIC_ATTRIBUTES,
    offset: skip,
    limit,
    order: [
      ["FirstName", "ASC"],
      ["LastName", "ASC"],
    ],
  });
  const count = await User.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const findOrCreateDirectConversation = async (senderId, receiverId) => {
  const pair = getPairIds(senderId, receiverId);
  const [conversation] = await ChatConversation.findOrCreate({
    where: pair,
    defaults: pair,
  });

  return conversation;
};

const findConversationParticipant = async (conversation, actorId) => {
  const plain =
    typeof conversation.get === "function"
      ? conversation.get({ plain: true })
      : conversation;
  const otherUserId =
    Number(plain.userOneId) === Number(actorId)
      ? plain.userTwoId
      : plain.userOneId;

  return User.findOne({
    where: { Id: otherUserId },
    attributes: USER_PUBLIC_ATTRIBUTES,
  });
};

const getConversationByUser = async (otherUserId, actor = {}) => {
  assertChatUser(actor);
  const pair = getPairIds(actor.Id, otherUserId);

  const conversation = await ChatConversation.findOne({
    where: pair,
    include: [
      { model: ChatMessage, as: "lastMessage" },
      { model: User, as: "userOne", attributes: USER_PUBLIC_ATTRIBUTES },
      { model: User, as: "userTwo", attributes: USER_PUBLIC_ATTRIBUTES },
    ],
  });

  return conversation;
};

const sendMessage = async (payload = {}, actor = {}) => {
  assertChatUser(actor);

  const receiverUserId = Number(payload.receiverUserId);
  const message = sanitizeMessage(payload.message);
  const messageType = String(payload.messageType || "text").trim() || "text";

  const receiver = await User.findOne({
    where: {
      Id: receiverUserId,
      role: { [Op.in]: CHAT_ALLOWED_ROLES },
      status: "Active",
    },
    attributes: USER_PUBLIC_ATTRIBUTES,
  });

  if (!receiver) {
    throw new ApiError(404, "Receiver not found or chat is not allowed");
  }

  const conversation = await findOrCreateDirectConversation(
    actor.Id,
    receiverUserId,
  );

  const chatMessage = await ChatMessage.create({
    conversationId: conversation.Id,
    senderUserId: actor.Id,
    receiverUserId,
    message,
    messageType,
  });

  await ChatConversation.update(
    {
      lastMessageId: chatMessage.Id,
      lastMessageAt: chatMessage.createdAt,
    },
    { where: { Id: conversation.Id } },
  );

  const result = await ChatMessage.findOne({
    where: { Id: chatMessage.Id },
    include: [
      { model: User, as: "sender", attributes: USER_PUBLIC_ATTRIBUTES },
      { model: User, as: "receiver", attributes: USER_PUBLIC_ATTRIBUTES },
    ],
  });

  const eventPayload = {
    conversationId: conversation.Id,
    message: result,
  };

  emitToUser(actor.Id, "chat:message:new", eventPayload);
  emitToUser(receiverUserId, "chat:message:new", eventPayload);

  await Notification.create({
    userId: receiverUserId,
    message: `New message from ${getUserDisplayName(result?.sender)}`,
    url: `/${process.env.APP_BASE_URL}/chat/${conversation.Id}`,
  });

  return eventPayload;
};

const getConversations = async (options = {}, actor = {}) => {
  assertChatUser(actor);
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const whereConditions = getParticipantWhere(actor.Id);

  const rows = await ChatConversation.findAll({
    where: whereConditions,
    include: [
      { model: ChatMessage, as: "lastMessage" },
      { model: User, as: "userOne", attributes: USER_PUBLIC_ATTRIBUTES },
      { model: User, as: "userTwo", attributes: USER_PUBLIC_ATTRIBUTES },
    ],
    offset: skip,
    limit,
    order: [
      ["lastMessageAt", "DESC"],
      ["updatedAt", "DESC"],
    ],
  });

  const count = await ChatConversation.count({ where: whereConditions });

  const data = await Promise.all(
    rows.map(async (row) => {
      const plain = row.get({ plain: true });
      const otherUser =
        Number(plain.userOneId) === Number(actor.Id)
          ? plain.userTwo
          : plain.userOne;

      const unreadCount = await ChatMessage.count({
        where: {
          conversationId: plain.Id,
          receiverUserId: actor.Id,
          isRead: false,
        },
      });

      return {
        ...plain,
        otherUser,
        unreadCount,
      };
    }),
  );

  return {
    meta: { count, page, limit },
    data,
  };
};

const getMessages = async (conversationId, options = {}, actor = {}) => {
  const conversation = await ensureConversationAccess(conversationId, actor);
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const whereConditions = { conversationId: conversation.Id };

  const rows = await ChatMessage.findAll({
    where: whereConditions,
    include: [
      { model: User, as: "sender", attributes: USER_PUBLIC_ATTRIBUTES },
      { model: User, as: "receiver", attributes: USER_PUBLIC_ATTRIBUTES },
    ],
    offset: skip,
    limit,
    order: [["createdAt", "DESC"]],
  });

  const count = await ChatMessage.count({ where: whereConditions });
  const otherUser = await findConversationParticipant(conversation, actor.Id);

  return {
    meta: { count, page, limit },
    data: rows.reverse(),
    conversation,
    otherUser,
  };
};

const markConversationRead = async (conversationId, actor = {}) => {
  const conversation = await ensureConversationAccess(conversationId, actor);
  const readAt = new Date();

  const [updatedCount] = await ChatMessage.update(
    {
      isRead: true,
      readAt,
    },
    {
      where: {
        conversationId: conversation.Id,
        receiverUserId: actor.Id,
        isRead: false,
      },
    },
  );

  const otherUserId =
    Number(conversation.userOneId) === Number(actor.Id)
      ? conversation.userTwoId
      : conversation.userOneId;

  const eventPayload = {
    conversationId: conversation.Id,
    readerUserId: actor.Id,
    readAt,
    updatedCount,
  };

  emitToUser(otherUserId, "chat:messages:read", eventPayload);
  emitToUser(actor.Id, "chat:messages:read", eventPayload);

  return eventPayload;
};

const deleteMessage = async (messageId, actor = {}) => {
  assertChatUser(actor);
  const id = Number(messageId);
  if (!Number.isFinite(id)) throw new ApiError(400, "Invalid message id");

  const message = await ChatMessage.findOne({
    where: {
      Id: id,
      senderUserId: actor.Id,
    },
  });

  if (!message) throw new ApiError(404, "Message not found");

  await message.destroy();

  emitToUser(message.receiverUserId, "chat:message:deleted", {
    conversationId: message.conversationId,
    messageId: message.Id,
  });
  emitToUser(actor.Id, "chat:message:deleted", {
    conversationId: message.conversationId,
    messageId: message.Id,
  });

  return { deleted: true, messageId: message.Id };
};

module.exports = {
  ensureConversationAccess,
  getChatUsers,
  getConversationByUser,
  sendMessage,
  getConversations,
  getMessages,
  markConversationRead,
  deleteMessage,
};
