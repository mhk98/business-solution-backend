const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { KPISearchableFields } = require("./kpi.constants");
const { ENUM_USER_ROLE } = require("../../enums/user");

const KPI = db.kpi;
const KPISetting = db.kpiSetting;
const EmployeeList = db.employeeList;
const User = db.user;

const MARK_FIELDS = [
  "confirm",
  "delivered",
  "returnParcent",
  "late",
  "absent",
  "leave",
  "workingTime",
  "qc",
  "overallBaviour",
  "totalSaleAmount",
];

const RAW_FIELD_TO_MARK_FIELD = {
  confirmRaw: "confirm",
  deliveredRaw: "delivered",
  returnParcentRaw: "returnParcent",
  lateRaw: "late",
  absentRaw: "absent",
  leaveRaw: "leave",
  workingTimeRaw: "workingTime",
  qcRaw: "qc",
  overallBaviourRaw: "overallBaviour",
  totalSaleAmountRaw: "totalSaleAmount",
};

const FIELD_MAX_MARKS = {
  confirm: 10,
  delivered: 10,
  returnParcent: 10,
  late: 10,
  absent: 10,
  leave: 10,
  workingTime: 10,
  qc: 10,
  overallBaviour: 10,
  totalSaleAmount: 10,
};

const kpiIncludes = [
  {
    model: EmployeeList,
    as: "employee",
    attributes: ["Id", "name", "employee_id", "employeeCode", "userId"],
    required: false,
  },
  {
    model: User,
    as: "user",
    attributes: ["Id", "FirstName", "LastName", "Email", "role"],
    required: false,
  },
];

const employeeOptionIncludes = [
  {
    model: EmployeeList,
    as: "employeeProfile",
    attributes: ["Id", "name", "employee_id", "employeeCode", "userId"],
    required: false,
  },
];

const KPI_SETTING_ORDER = [
  "order_cs",
  "order_up",
  "delivered",
  "return",
  "late",
  "absent",
  "leave",
  "working_time",
  "qc",
  "overall_behaviour",
  "total_sale_amount",
];

const DEFAULT_KPI_SETTINGS = {
  order_cs: {
    label: "For Order - CS",
    rules: [
      { label: "30+", min: 30, max: null, mark: 10 },
      { label: "29 - 25", min: 25, max: 29, mark: 9 },
      { label: "24 - 20", min: 20, max: 24, mark: 8 },
      { label: "19 - 15", min: 15, max: 19, mark: 7 },
      { label: "14 - 10", min: 10, max: 14, mark: 6 },
    ],
  },
  order_up: {
    label: "For Order - UP",
    rules: [
      { label: "18 - 15", min: 15, max: 18, mark: 10 },
      { label: "14 - 11", min: 11, max: 14, mark: 9 },
      { label: "10 - 7", min: 7, max: 10, mark: 8 },
      { label: "6 - 3", min: 3, max: 6, mark: 7 },
    ],
  },
  delivered: {
    label: "For Delivered",
    rules: [
      { label: "90 - 85", min: 85, max: 90, mark: 10 },
      { label: "84 - 80", min: 80, max: 84, mark: 9 },
      { label: "79 - 75", min: 75, max: 79, mark: 8 },
      { label: "74 - 70", min: 70, max: 74, mark: 7 },
      { label: "69 - 65", min: 65, max: 69, mark: 6 },
      { label: "64 - 60", min: 60, max: 64, mark: 5 },
    ],
  },
  return: {
    label: "For Return",
    rules: [
      { label: "10 - 0", min: 0, max: 10, mark: 10 },
      { label: "11 - 15", min: 11, max: 15, mark: 9 },
      { label: "16 - 20", min: 16, max: 20, mark: 8 },
      { label: "21 - 25", min: 21, max: 25, mark: 7 },
      { label: "26 - 30", min: 26, max: 30, mark: 6 },
    ],
  },
  absent: {
    label: "For Absent",
    rules: [
      { label: "0", min: 0, max: 0, mark: 10 },
      { label: "1", min: 1, max: 1, mark: 9 },
      { label: "2", min: 2, max: 2, mark: 8 },
      { label: "3", min: 3, max: 3, mark: 7 },
      { label: "4", min: 4, max: 4, mark: 6 },
      { label: "5", min: 5, max: 5, mark: 5 },
      { label: "6", min: 6, max: 6, mark: 4 },
      { label: "7", min: 7, max: 7, mark: 3 },
    ],
  },
  leave: {
    label: "For Leave",
    rules: [
      { label: "0", min: 0, max: 0, mark: 10 },
      { label: "1", min: 1, max: 1, mark: 7 },
      { label: "2", min: 2, max: 2, mark: 5 },
      { label: "3", min: 3, max: 3, mark: 0 },
    ],
  },
  late: {
    label: "For Late",
    rules: [
      { label: "0", min: 0, max: 0, mark: 10 },
      { label: "1", min: 1, max: 1, mark: 9 },
      { label: "2", min: 2, max: 2, mark: 8 },
      { label: "3", min: 3, max: 3, mark: 7.5 },
      { label: "4", min: 4, max: 4, mark: 7 },
      { label: "5", min: 5, max: 5, mark: 6.5 },
      { label: "6", min: 6, max: 6, mark: 6 },
      { label: "7", min: 7, max: 7, mark: 5.5 },
      { label: "8", min: 8, max: 8, mark: 5 },
      { label: "9", min: 9, max: 9, mark: 4.5 },
      { label: "10", min: 10, max: 10, mark: 4 },
      { label: "11", min: 11, max: 11, mark: 3.5 },
      { label: "12", min: 12, max: 12, mark: 3 },
      { label: "13", min: 13, max: 13, mark: 2.5 },
      { label: "14", min: 14, max: 14, mark: 2 },
    ],
  },
  working_time: {
    label: "For Working Time",
    rules: [
      { label: "9h+", min: 9, max: null, mark: 10 },
      { label: "8.5h - 9h", min: 8.5, max: 8.99, mark: 9 },
      { label: "8h - 8.5h", min: 8, max: 8.49, mark: 8 },
      { label: "7.5h - 8h", min: 7.5, max: 7.99, mark: 7 },
      { label: "7h - 7.5h", min: 7, max: 7.49, mark: 6 },
      { label: "6.5h - 7h", min: 6.5, max: 6.99, mark: 5 },
    ],
  },
  qc: {
    label: "For QC",
    rules: [
      { label: "90+", min: 90, max: null, mark: 10 },
      { label: "80 - 89", min: 80, max: 89, mark: 9 },
      { label: "70 - 79", min: 70, max: 79, mark: 8 },
      { label: "60 - 69", min: 60, max: 69, mark: 7 },
      { label: "50 - 59", min: 50, max: 59, mark: 6 },
    ],
  },
  overall_behaviour: {
    label: "For Overall Behaviour",
    rules: [
      { label: "90+", min: 90, max: null, mark: 10 },
      { label: "80 - 89", min: 80, max: 89, mark: 9 },
      { label: "70 - 79", min: 70, max: 79, mark: 8 },
      { label: "60 - 69", min: 60, max: 69, mark: 7 },
      { label: "50 - 59", min: 50, max: 59, mark: 6 },
    ],
  },
  total_sale_amount: {
    label: "For Total Sale Amount",
    rules: [
      { label: "100000+", min: 100000, max: null, mark: 10 },
      { label: "80000 - 99999", min: 80000, max: 99999, mark: 9 },
      { label: "60000 - 79999", min: 60000, max: 79999, mark: 8 },
      { label: "40000 - 59999", min: 40000, max: 59999, mark: 7 },
      { label: "20000 - 39999", min: 20000, max: 39999, mark: 6 },
    ],
  },
};

const RAW_FIELD_SETTING_KEYS = {
  deliveredRaw: "delivered",
  returnParcentRaw: "return",
  lateRaw: "late",
  absentRaw: "absent",
  leaveRaw: "leave",
  workingTimeRaw: "working_time",
  qcRaw: "qc",
  overallBaviourRaw: "overall_behaviour",
  totalSaleAmountRaw: "total_sale_amount",
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Number(n.toFixed(2));
};

const normalizeMark = (value, fieldName) => {
  const n = toNumber(value);
  const maxMark = FIELD_MAX_MARKS[fieldName] || 10;
  if (Number.isNaN(n)) {
    throw new ApiError(
      400,
      `${fieldName} must be a number between 0 and ${maxMark}`,
    );
  }
  if (n < 0 || n > maxMark) {
    throw new ApiError(400, `${fieldName} must be between 0 and ${maxMark}`);
  }
  return n;
};

const normalizeRule = (rule = {}) => {
  const min = rule.min === null || rule.min === "" ? null : Number(rule.min);
  const max = rule.max === null || rule.max === "" ? null : Number(rule.max);
  const mark = Number(rule.mark);

  if (
    (min !== null && !Number.isFinite(min)) ||
    (max !== null && !Number.isFinite(max))
  ) {
    throw new ApiError(400, "KPI setting rule min/max must be valid numbers");
  }
  if (!Number.isFinite(mark) || mark < 0) {
    throw new ApiError(400, "KPI setting rule mark must be a positive number");
  }
  if (mark > 10) {
    throw new ApiError(400, "KPI setting rule mark cannot be greater than 10");
  }

  return {
    label: String(rule.label || "").trim() || `${min ?? ""} - ${max ?? ""}`,
    min,
    max,
    mark: Number(mark.toFixed(2)),
  };
};

const parseRules = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const getAllSettingsMap = async () => {
  await ensureDefaultSettings();
  const rows = await KPISetting.findAll({ where: { status: "Active" } });
  const map = { ...DEFAULT_KPI_SETTINGS };

  rows.forEach((row) => {
    const plain = row.get({ plain: true });
    map[plain.key] = {
      label: plain.label,
      rules: parseRules(plain.rules),
    };
  });

  return map;
};

const scoreByRules = (value, rules = []) => {
  const n = toNumber(value);
  if (Number.isNaN(n)) return 0;

  const matched = rules.find((rule) => {
    const min =
      rule.min === null || rule.min === undefined
        ? -Infinity
        : Number(rule.min);
    const max =
      rule.max === null || rule.max === undefined ? Infinity : Number(rule.max);
    return n >= min && n <= max;
  });

  return matched ? Number(Number(matched.mark || 0).toFixed(2)) : 0;
};

const getOrderSettingKey = (designationType) =>
  String(designationType || "")
    .trim()
    .toUpperCase() === "UP"
    ? "order_up"
    : "order_cs";

const applyRawScores = async (normalized) => {
  const rawFields = Object.keys(RAW_FIELD_TO_MARK_FIELD);
  const hasRaw = rawFields.some((field) => normalized[field] !== undefined);
  if (!hasRaw) return normalized;

  const settings = await getAllSettingsMap();

  if (normalized.confirmRaw !== undefined) {
    normalized.confirm = scoreByRules(
      normalized.confirmRaw,
      settings[getOrderSettingKey(normalized.designationType)]?.rules,
    );
  }

  Object.entries(RAW_FIELD_SETTING_KEYS).forEach(([rawField, settingKey]) => {
    if (normalized[rawField] !== undefined) {
      normalized[RAW_FIELD_TO_MARK_FIELD[rawField]] = scoreByRules(
        normalized[rawField],
        settings[settingKey]?.rules,
      );
    }
  });

  return normalized;
};

const normalizeKpiPayload = async (payload = {}) => {
  const normalized = { ...payload };

  // Frontend compatibility: old UI sends overallBehind but model stores overallBaviour.
  if (
    normalized.overallBaviour === undefined &&
    normalized.overallBehind !== undefined
  ) {
    normalized.overallBaviour = normalized.overallBehind;
  }
  if (
    normalized.overallBaviourRaw === undefined &&
    normalized.overallBehindRaw !== undefined
  ) {
    normalized.overallBaviourRaw = normalized.overallBehindRaw;
  }
  delete normalized.overallBehind;
  delete normalized.overallBehindRaw;

  Object.keys(RAW_FIELD_TO_MARK_FIELD).forEach((field) => {
    if (normalized[field] !== undefined) {
      const n = toNumber(normalized[field]);
      if (Number.isNaN(n)) {
        throw new ApiError(400, `${field} must be a valid number`);
      }
      normalized[field] = n;
    }
  });

  ["date", "periodStartDate", "periodEndDate"].forEach((field) => {
    if (normalized[field] !== undefined) {
      const ymd = String(normalized[field] || "").slice(0, 10);
      normalized[field] = ymd || null;
    }
  });

  if (normalized.note !== undefined) {
    const note = String(normalized.note || "").trim();
    normalized.note = note || null;
  }

  if (normalized.status !== undefined) {
    normalized.status = String(normalized.status || "").trim() || "Active";
  }

  if (normalized.userId !== undefined && normalized.userId !== null) {
    const uid = Number(normalized.userId);
    normalized.userId = Number.isFinite(uid) ? uid : null;
  }

  if (normalized.employeeId !== undefined && normalized.employeeId !== null) {
    const employeeId = Number(normalized.employeeId);
    normalized.employeeId = Number.isFinite(employeeId) ? employeeId : null;
  }

  ["departmentId", "designationId", "teamId"].forEach((field) => {
    if (normalized[field] !== undefined && normalized[field] !== null) {
      if (String(normalized[field]).trim() === "") {
        normalized[field] = null;
        return;
      }
      const id = Number(normalized[field]);
      normalized[field] = Number.isFinite(id) ? id : null;
    }
  });

  if (normalized.designationType !== undefined) {
    const designation = String(normalized.designationType || "")
      .trim()
      .toUpperCase();
    normalized.designationType = ["CS", "UP"].includes(designation)
      ? designation
      : null;
  }

  if (normalized.periodType !== undefined) {
    normalized.periodType = String(normalized.periodType || "").trim() || null;
  }

  await applyRawScores(normalized);

  MARK_FIELDS.forEach((field) => {
    if (normalized[field] !== undefined) {
      normalized[field] = normalizeMark(normalized[field], field);
    }
  });

  return normalized;
};

const computeEvaluation = (row) => {
  const plain = typeof row?.get === "function" ? row.get({ plain: true }) : row;
  const marks = MARK_FIELDS.reduce((acc, field) => {
    acc[field] = normalizeMark(plain?.[field], field);
    return acc;
  }, {});

  const totalMarks = Object.values(marks).reduce((sum, n) => sum + n, 0);
  const maxMarks = MARK_FIELDS.reduce(
    (sum, field) => sum + (FIELD_MAX_MARKS[field] || 10),
    0,
  );
  const performancePercentage = maxMarks ? (totalMarks / maxMarks) * 100 : 0;

  return {
    marks,
    totalMarks,
    maxMarks,
    performancePercentage: Number(performancePercentage.toFixed(2)),
  };
};

const getTrendDirection = (change) => {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "same";
};

const attachEvaluation = (row) => {
  if (!row) return row;
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  const evaluation = computeEvaluation(plain);
  const employeeName =
    plain.employee?.name ||
    [plain.user?.FirstName, plain.user?.LastName].filter(Boolean).join(" ") ||
    null;

  return {
    ...plain,
    employeeName,
    totalMarks: evaluation.totalMarks,
    maxMarks: evaluation.maxMarks,
    performancePercentage: evaluation.performancePercentage,
    marksOutOf: `${evaluation.totalMarks}/${evaluation.maxMarks}`,
    evaluation,
  };
};

const getEmployeeProfileByUserId = async (userId) => {
  if (!userId) return null;
  return EmployeeList.findOne({
    where: { userId },
    attributes: ["Id", "name", "employee_id", "employeeCode", "userId"],
  });
};

const resolveEmployeeProfile = async (employeeId) => {
  if (!employeeId) return null;

  const employee = await EmployeeList.findOne({
    where: { Id: employeeId },
    attributes: ["Id", "name", "employee_id", "employeeCode", "userId"],
  });

  if (!employee) {
    throw new ApiError(400, "Selected employee was not found");
  }

  return employee;
};

const applyEmployeeSelection = async (normalized, actor = {}) => {
  if (actor?.role === ENUM_USER_ROLE.EMPLOYEE) {
    const employee = await getEmployeeProfileByUserId(actor.Id);
    normalized.userId = actor.Id || null;
    normalized.employeeId = employee?.Id || null;
    return normalized;
  }

  if (normalized.employeeId) {
    const employee = await resolveEmployeeProfile(normalized.employeeId);
    normalized.userId = employee?.userId || null;
    return normalized;
  }

  if (normalized.userId) {
    const employee = await getEmployeeProfileByUserId(normalized.userId);
    normalized.employeeId = employee?.Id || normalized.employeeId || null;
    return normalized;
  }

  normalized.userId = actor?.Id || null;
  return normalized;
};

const assertKpiOwnership = async (kpi, actor = {}) => {
  if (!kpi) return;
  if (actor?.role !== ENUM_USER_ROLE.EMPLOYEE) return;
  if (kpi.userId && Number(kpi.userId) === Number(actor.Id)) return;
  if (kpi.employeeId) {
    const employee = await getEmployeeProfileByUserId(actor.Id);
    if (employee && Number(employee.Id) === Number(kpi.employeeId)) return;
    throw new ApiError(403, "You can only access your own KPI data");
  }
  throw new ApiError(403, "You can only access your own KPI data");
};

const insertIntoDB = async (payload, actor = {}) => {
  const normalized = await normalizeKpiPayload(payload);
  await applyEmployeeSelection(normalized, actor);

  // Fill missing marks to 0 so evaluation is always complete.
  MARK_FIELDS.forEach((field) => {
    if (normalized[field] === undefined) normalized[field] = 0;
  });

  const result = await KPI.create(normalized);
  const created = await KPI.findOne({
    where: { Id: result.Id },
    include: kpiIncludes,
  });
  return attachEvaluation(created);
};

const getAllFromDB = async (filters, options, actor = {}) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const {
    searchTerm,
    startDate,
    endDate,
    status,
    userId,
    employeeId,
    departmentId,
    designationId,
    teamId,
    periodType,
  } = filters;

  const andConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    andConditions.push({
      [Op.or]: KPISearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  if (status) {
    andConditions.push({ status: { [Op.eq]: status } });
  }

  if (periodType) {
    andConditions.push({ periodType: { [Op.eq]: periodType } });
  }

  if (departmentId) {
    andConditions.push({ departmentId: { [Op.eq]: Number(departmentId) } });
  }

  if (designationId) {
    andConditions.push({ designationId: { [Op.eq]: Number(designationId) } });
  }

  if (teamId) {
    andConditions.push({ teamId: { [Op.eq]: Number(teamId) } });
  }

  // Employee: only see own KPI rows.
  if (actor?.role === ENUM_USER_ROLE.EMPLOYEE) {
    const employee = await getEmployeeProfileByUserId(actor.Id);
    andConditions.push({
      [Op.or]: [
        { userId: { [Op.eq]: actor.Id } },
        ...(employee ? [{ employeeId: { [Op.eq]: employee.Id } }] : []),
      ],
    });
  } else if (employeeId) {
    andConditions.push({ employeeId: { [Op.eq]: Number(employeeId) } });
  } else if (userId) {
    andConditions.push({ userId: { [Op.eq]: Number(userId) } });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const data = await KPI.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: kpiIncludes,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["date", "DESC"]],
  });

  const count = await KPI.count({
    where: whereConditions,
    include: searchTerm ? kpiIncludes : undefined,
    distinct: true,
  });

  return {
    meta: { count, page, limit },
    data: data.map(attachEvaluation),
  };
};

const getDataById = async (id, actor = {}) => {
  const result = await KPI.findOne({ where: { Id: id }, include: kpiIncludes });
  if (!result) return null;
  await assertKpiOwnership(result.get({ plain: true }), actor);
  return attachEvaluation(result);
};

const updateOneFromDB = async (id, payload, actor = {}) => {
  const existing = await KPI.findOne({ where: { Id: id } });
  if (!existing) throw new ApiError(404, "KPI not found");

  const plainExisting = existing.get({ plain: true });
  await assertKpiOwnership(plainExisting, actor);

  const normalized = await normalizeKpiPayload(payload);

  // Employee cannot re-assign ownership.
  if (actor?.role === ENUM_USER_ROLE.EMPLOYEE) {
    delete normalized.userId;
    delete normalized.employeeId;
  } else {
    await applyEmployeeSelection(normalized, actor);
  }

  await KPI.update(normalized, { where: { Id: id } });
  const updated = await KPI.findOne({
    where: { Id: id },
    include: kpiIncludes,
  });
  return attachEvaluation(updated);
};

const deleteIdFromDB = async (id, actor = {}) => {
  const existing = await KPI.findOne({ where: { Id: id } });
  if (!existing) throw new ApiError(404, "KPI not found");
  await assertKpiOwnership(existing.get({ plain: true }), actor);

  return KPI.destroy({ where: { Id: id } });
};

const getAllFromDBWithoutQuery = async (actor = {}) => {
  let whereConditions = {};

  if (actor?.role === ENUM_USER_ROLE.EMPLOYEE) {
    const employee = await getEmployeeProfileByUserId(actor.Id);
    whereConditions = {
      [Op.or]: [
        { userId: { [Op.eq]: actor.Id } },
        ...(employee ? [{ employeeId: { [Op.eq]: employee.Id } }] : []),
      ],
    };
  }

  const result = await KPI.findAll({
    where: whereConditions,
    include: kpiIncludes,
    paranoid: true,
    order: [["date", "DESC"]],
  });

  return result.map(attachEvaluation);
};

const formatEmployeeOption = (row) => {
  const user = typeof row.get === "function" ? row.get({ plain: true }) : row;
  const userName = [user.FirstName, user.LastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const profile = user.employeeProfile || null;
  const label = profile?.name || userName || user.Email;

  return {
    label,
    value: user.Id,
    userId: user.Id,
    employeeId: profile?.Id || null,
    employeeCode: profile?.employeeCode || null,
    employeeNo: profile?.employee_id || null,
    email: user.Email,
    phone: user.Phone || null,
    status: user.status,
  };
};

const getEmployeeOptions = async (filters = {}, options = {}, actor = {}) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination({
    page: options.page,
    limit: options.limit || 50,
  });
  const { searchTerm, status } = filters;

  const andConditions = [
    { role: { [Op.eq]: ENUM_USER_ROLE.EMPLOYEE } },
    { deletedAt: { [Op.is]: null } },
  ];

  if (actor?.role === ENUM_USER_ROLE.EMPLOYEE) {
    andConditions.push({ Id: { [Op.eq]: actor.Id } });
  }

  if (status) {
    andConditions.push({ status: { [Op.eq]: status } });
  }

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    andConditions.push({
      [Op.or]: [
        { FirstName: { [Op.like]: `%${term}%` } },
        { LastName: { [Op.like]: `%${term}%` } },
        { Email: { [Op.like]: `%${term}%` } },
        { Phone: { [Op.like]: `%${term}%` } },
        { "$employeeProfile.name$": { [Op.like]: `%${term}%` } },
        { "$employeeProfile.employeeCode$": { [Op.like]: `%${term}%` } },
      ],
    });
  }

  const whereConditions = { [Op.and]: andConditions };

  const rows = await User.findAll({
    where: whereConditions,
    include: employeeOptionIncludes,
    attributes: [
      "Id",
      "FirstName",
      "LastName",
      "Email",
      "Phone",
      "status",
      "role",
    ],
    offset: skip,
    limit,
    paranoid: true,
    order: [
      ["FirstName", "ASC"],
      ["LastName", "ASC"],
    ],
  });

  const count = await User.count({
    where: whereConditions,
    include: employeeOptionIncludes,
    distinct: true,
  });

  return {
    meta: { count, page, limit },
    data: rows.map(formatEmployeeOption),
  };
};

const getPerformanceGraph = async (filters = {}, actor = {}) => {
  const {
    startDate,
    endDate,
    userId,
    employeeId,
    departmentId,
    designationId,
    teamId,
    periodType,
  } = filters;
  const andConditions = [];

  if (startDate && endDate) {
    andConditions.push({
      date: {
        [Op.between]: [
          String(startDate).slice(0, 10),
          String(endDate).slice(0, 10),
        ],
      },
    });
  }

  if (periodType) {
    andConditions.push({ periodType: { [Op.eq]: periodType } });
  }

  if (departmentId) {
    andConditions.push({ departmentId: { [Op.eq]: Number(departmentId) } });
  }

  if (designationId) {
    andConditions.push({ designationId: { [Op.eq]: Number(designationId) } });
  }

  if (teamId) {
    andConditions.push({ teamId: { [Op.eq]: Number(teamId) } });
  }

  if (actor?.role === ENUM_USER_ROLE.EMPLOYEE) {
    const employee = await getEmployeeProfileByUserId(actor.Id);
    andConditions.push({
      [Op.or]: [
        { userId: { [Op.eq]: actor.Id } },
        ...(employee ? [{ employeeId: { [Op.eq]: employee.Id } }] : []),
      ],
    });
  } else if (employeeId) {
    andConditions.push({ employeeId: { [Op.eq]: Number(employeeId) } });
  } else if (userId) {
    andConditions.push({ userId: { [Op.eq]: Number(userId) } });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const rows = await KPI.findAll({
    where: andConditions.length ? { [Op.and]: andConditions } : {},
    include: kpiIncludes,
    paranoid: true,
    order: [
      ["date", "ASC"],
      ["Id", "ASC"],
    ],
  });

  const previousByEmployee = new Map();

  const points = rows.map((row) => {
    const item = attachEvaluation(row);
    const employeeKey = item.employeeId || item.userId || item.Id;
    const previous = previousByEmployee.get(employeeKey) || null;
    const change = previous
      ? Number((item.totalMarks - previous.totalMarks).toFixed(2))
      : 0;
    previousByEmployee.set(employeeKey, item);

    return {
      Id: item.Id,
      date: item.date,
      periodType: item.periodType,
      periodStartDate: item.periodStartDate,
      periodEndDate: item.periodEndDate,
      employeeId: item.employeeId,
      userId: item.userId,
      employeeName: item.employeeName,
      totalMarks: item.totalMarks,
      maxMarks: item.maxMarks,
      performancePercentage: item.performancePercentage,
      change,
      trend: getTrendDirection(change),
    };
  });

  const latest = points[points.length - 1] || null;
  const latestKey = latest
    ? latest.employeeId || latest.userId || latest.Id
    : null;
  const previous = latestKey
    ? points
        .slice(0, -1)
        .reverse()
        .find(
          (point) =>
            (point.employeeId || point.userId || point.Id) === latestKey,
        )
    : null;
  const latestChange =
    latest && previous
      ? Number((latest.totalMarks - previous.totalMarks).toFixed(2))
      : 0;

  return {
    summary: {
      totalRecords: points.length,
      latestScore: latest?.totalMarks || 0,
      maxMarks: latest?.maxMarks || MARK_FIELDS.length * 10,
      previousScore: previous?.totalMarks || 0,
      change: latestChange,
      trend: getTrendDirection(latestChange),
      message:
        getTrendDirection(latestChange) === "up"
          ? "Performance is going up"
          : getTrendDirection(latestChange) === "down"
            ? "Performance is going down"
            : "Performance is unchanged",
    },
    points,
  };
};

const ensureDefaultSettings = async () => {
  await Promise.all(
    Object.entries(DEFAULT_KPI_SETTINGS).map(async ([key, value]) => {
      const [row, created] = await KPISetting.findOrCreate({
        where: { key },
        defaults: {
          key,
          label: value.label,
          rules: value.rules,
          status: "Active",
        },
      });

      if (created) return row;

      const parsedRules = parseRules(row.rules);
      const hasOutOfScaleMark = parsedRules.some(
        (rule) => Number(rule?.mark || 0) > 10,
      );
      const hasLegacyLeaveScale =
        key === "leave" &&
        parsedRules.some(
          (rule) =>
            String(rule?.label || "") === "0" && Number(rule?.mark || 0) === 5,
        );

      if (hasOutOfScaleMark || hasLegacyLeaveScale) {
        await row.update({
          label: value.label,
          rules: value.rules,
          status: row.status || "Active",
        });
      }

      return row;
    }),
  );
};

const getKPISettings = async () => {
  await ensureDefaultSettings();
  const rows = await KPISetting.findAll({ order: [["Id", "ASC"]] });
  return rows.sort((a, b) => {
    const aIndex = KPI_SETTING_ORDER.indexOf(a.key);
    const bIndex = KPI_SETTING_ORDER.indexOf(b.key);
    const safeAIndex = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeBIndex = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return safeAIndex - safeBIndex;
  });
};

const updateKPISettings = async (payload = {}) => {
  const inputSettings = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.settings)
      ? payload.settings
      : Object.entries(payload.settings || payload).map(([key, value]) => ({
          key,
          ...(value || {}),
        }));

  if (!inputSettings.length) {
    throw new ApiError(400, "KPI settings payload is required");
  }

  const updated = [];

  for (const item of inputSettings) {
    const key = String(item.key || "").trim();
    if (!key) throw new ApiError(400, "KPI setting key is required");

    const defaultSetting = DEFAULT_KPI_SETTINGS[key];
    const label = String(item.label || defaultSetting?.label || key).trim();
    const rules = (Array.isArray(item.rules) ? item.rules : []).map(
      normalizeRule,
    );

    const [row] = await KPISetting.findOrCreate({
      where: { key },
      defaults: {
        key,
        label,
        rules,
        status: item.status || "Active",
      },
    });

    await row.update({
      label,
      rules,
      status: item.status || "Active",
    });
    updated.push(row);
  }

  return updated;
};

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getEmployeeOptions,
  getPerformanceGraph,
  getKPISettings,
  updateKPISettings,
  ensureDefaultSettings,
  MARK_FIELDS,
  FIELD_MAX_MARKS,
  DEFAULT_KPI_SETTINGS,
};
