const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const ChatService = require("./chat.service");

const getChatUsers = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["searchTerm"]);
  const options = pick(req.query, ["limit", "page"]);
  const result = await ChatService.getChatUsers(filters, options, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Chat users fetched successfully!!",
    meta: result.meta,
    data: result.data,
  });
});

const getConversationByUser = catchAsync(async (req, res) => {
  const result = await ChatService.getConversationByUser(
    req.params.userId,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation fetched successfully!!",
    data: result,
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const result = await ChatService.sendMessage(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Message sent successfully!!",
    data: result,
  });
});

const getConversations = catchAsync(async (req, res) => {
  const options = pick(req.query, ["limit", "page"]);
  const result = await ChatService.getConversations(options, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversations fetched successfully!!",
    meta: result.meta,
    data: result.data,
  });
});

const getMessages = catchAsync(async (req, res) => {
  const options = pick(req.query, ["limit", "page"]);
  const result = await ChatService.getMessages(
    req.params.conversationId,
    options,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Messages fetched successfully!!",
    meta: result.meta,
    data: {
      messages: result.data,
      conversation: result.conversation,
      otherUser: result.otherUser,
    },
  });
});

const markConversationRead = catchAsync(async (req, res) => {
  const result = await ChatService.markConversationRead(
    req.params.conversationId,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation marked as read successfully!!",
    data: result,
  });
});

const deleteMessage = catchAsync(async (req, res) => {
  const result = await ChatService.deleteMessage(req.params.messageId, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Message deleted successfully!!",
    data: result,
  });
});

module.exports = {
  getChatUsers,
  getConversationByUser,
  sendMessage,
  getConversations,
  getMessages,
  markConversationRead,
  deleteMessage,
};
