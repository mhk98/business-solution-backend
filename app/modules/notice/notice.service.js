const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const Notice = db.notice;

const ACTIVE_STATUS = "Active";

const normalizeStatus = (status) => {
  if (!status) return ACTIVE_STATUS;
  return String(status).trim() === "Inactive" ? "Inactive" : ACTIVE_STATUS;
};

const createNotice = async (payload, user) => {
  const message = String(payload?.message || "").trim();
  const title = String(payload?.title || "").trim();

  if (!message) {
    throw new ApiError(400, "Notice message is required");
  }

  return Notice.create({
    title: title || null,
    message,
    status: normalizeStatus(payload?.status),
    createdByUserId: user?.Id || user?.id || null,
    createdByRole: user?.role || null,
  });
};

const getLatestNotice = async () => {
  return Notice.findOne({
    where: {
      status: ACTIVE_STATUS,
      deletedAt: { [Op.is]: null },
    },
    order: [["createdAt", "DESC"]],
    paranoid: true,
  });
};

const getAllNotices = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { status, searchTerm } = filters || {};
  const andConditions = [{ deletedAt: { [Op.is]: null } }];

  if (status) {
    andConditions.push({ status });
  }

  if (searchTerm && searchTerm.trim()) {
    const value = `%${searchTerm.trim()}%`;
    andConditions.push({
      [Op.or]: [{ title: { [Op.like]: value } }, { message: { [Op.like]: value } }],
    });
  }

  const where = { [Op.and]: andConditions };
  const data = await Notice.findAll({
    where,
    offset: skip,
    limit,
    order: [["createdAt", "DESC"]],
    paranoid: true,
  });
  const count = await Notice.count({ where });

  return { meta: { count, page, limit }, data };
};

const updateNotice = async (id, payload) => {
  const existing = await Notice.findOne({ where: { Id: id } });
  if (!existing) {
    throw new ApiError(404, "Notice not found");
  }

  const next = {};
  if (payload.title !== undefined) {
    const title = String(payload.title || "").trim();
    next.title = title || null;
  }
  if (payload.message !== undefined) {
    const message = String(payload.message || "").trim();
    if (!message) throw new ApiError(400, "Notice message is required");
    next.message = message;
  }
  if (payload.status !== undefined) {
    next.status = normalizeStatus(payload.status);
  }

  await Notice.update(next, { where: { Id: id } });
  return Notice.findOne({ where: { Id: id } });
};

const deleteNotice = async (id) => {
  const existing = await Notice.findOne({ where: { Id: id } });
  if (!existing) {
    throw new ApiError(404, "Notice not found");
  }

  await Notice.destroy({ where: { Id: id } });
  return { deleted: true };
};

module.exports = {
  createNotice,
  getLatestNotice,
  getAllNotices,
  updateNotice,
  deleteNotice,
};
