const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const db = require("../../models");
const { CHAT_ALLOWED_ROLES } = require("../modules/chat/chat.constants");

let ioInstance = null;

const userRoom = (userId) => `user:${userId}`;
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return String(authToken).replace(/^Bearer\s+/i, "");

  const header = socket.handshake.headers?.authorization;
  if (header) return String(header).replace(/^Bearer\s+/i, "");

  return null;
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = getTokenFromSocket(socket);
    if (!token) return next(new Error("Unauthorized"));

    const verifiedUser = jwt.verify(token, process.env.TOKEN_SECRET);
    const currentUser = await db.user.findOne({
      where: { Id: verifiedUser.Id },
      attributes: { exclude: ["Password"] },
    });

    if (!currentUser) return next(new Error("User account was not found"));

    const plainUser = currentUser.get({ plain: true });
    if (!CHAT_ALLOWED_ROLES.includes(plainUser.role)) {
      return next(new Error("Chat is not allowed for this role"));
    }
    if (plainUser.status === "Inactive") {
      return next(new Error("This account is deactivated"));
    }

    socket.user = {
      ...verifiedUser,
      ...plainUser,
    };

    return next();
  } catch (error) {
    return next(new Error("Invalid token"));
  }
};

const initializeChatSocket = (server) => {
  const ChatService = require("../modules/chat/chat.service");

  ioInstance = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  ioInstance.use(authenticateSocket);

  ioInstance.on("connection", (socket) => {
    socket.join(userRoom(socket.user.Id));

    socket.on("chat:conversation:join", async (payload = {}, ack) => {
      try {
        await ChatService.ensureConversationAccess(
          payload.conversationId,
          socket.user,
        );
        socket.join(conversationRoom(payload.conversationId));
        if (typeof ack === "function") {
          ack({ success: true, conversationId: Number(payload.conversationId) });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("chat:message:send", async (payload = {}, ack) => {
      try {
        const result = await ChatService.sendMessage(payload, socket.user);
        if (typeof ack === "function") {
          ack({ success: true, data: result, clientTempId: payload.clientTempId });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({
            success: false,
            message: error.message,
            clientTempId: payload.clientTempId,
          });
        }
      }
    });

    socket.on("chat:messages:read", async (payload = {}, ack) => {
      try {
        const result = await ChatService.markConversationRead(
          payload.conversationId,
          socket.user,
        );
        if (typeof ack === "function") ack({ success: true, data: result });
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(userRoom(userId)).emit(eventName, payload);
};

const emitToConversation = (conversationId, eventName, payload) => {
  if (!ioInstance || !conversationId) return;
  ioInstance.to(conversationRoom(conversationId)).emit(eventName, payload);
};

module.exports = {
  initializeChatSocket,
  getIO,
  emitToUser,
  emitToConversation,
  userRoom,
  conversationRoom,
};
