const { reconcileInventoryForProducts } = require("./inventoryMovementReconciler");

const parseItems = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toNumberList = (values) => [
  ...new Set((values || []).map(Number).filter(Boolean)),
];

const addRefsFromRow = (refs, row, idFields, itemIdFields = idFields) => {
  if (!row) return;

  idFields.forEach((field) => {
    const value = row[field];
    if (value) refs.push(value);
  });

  parseItems(row.items).forEach((item) => {
    itemIdFields.forEach((field) => {
      const value = item[field];
      if (value) refs.push(value);
    });
  });
};

const addInventoryRefsFromRow = (refs, row) => {
  if (!row) return;

  ["productId", "receivedId", "inventoryId"].forEach((field) => {
    const value = row[field];
    if (value) refs.push(value);
  });

  parseItems(row.items).forEach((item) => {
    const value =
      item.inventoryId || item.Id || item.receivedId || item.productId;
    if (value) refs.push(value);
  });
};

const resolveInventoryRefProductIds = async (db, refs, transaction) => {
  const ids = toNumberList(refs);
  if (!ids.length) return [];

  const rows = await db.inventoryMaster.findAll({
    where: { Id: ids },
    attributes: ["productId"],
    transaction,
    paranoid: false,
    raw: true,
  });

  return rows.map((row) => Number(row.productId)).filter(Boolean);
};

const resolveRepairingRefProductIds = async (db, refs, transaction) => {
  const ids = toNumberList(refs);
  if (!ids.length) return [];

  const rows = await db.damageReparingStock.findAll({
    where: { Id: ids },
    attributes: ["productId"],
    transaction,
    paranoid: false,
    raw: true,
  });

  return rows.map((row) => Number(row.productId)).filter(Boolean);
};

const resolveCatalogProductIds = async (db, type, rows, transaction) => {
  const catalogIds = [];
  const refs = [];

  rows.forEach((row) => {
    const previous = row?._previousDataValues || {};

    if (type === "catalog") {
      addRefsFromRow(catalogIds, row, ["productId"]);
      addRefsFromRow(catalogIds, previous, ["productId"]);
      return;
    }

    if (type === "inventory") {
      addInventoryRefsFromRow(refs, row);
      addInventoryRefsFromRow(refs, previous);
      return;
    }

    addRefsFromRow(refs, row, ["productId", "receivedId"]);
    addRefsFromRow(refs, previous, ["productId", "receivedId"]);
  });

  if (type === "inventory") {
    catalogIds.push(
      ...(await resolveInventoryRefProductIds(db, refs, transaction)),
    );
  }

  if (type === "repairing") {
    catalogIds.push(
      ...(await resolveRepairingRefProductIds(db, refs, transaction)),
    );
  }

  return toNumberList(catalogIds);
};

const enqueueReconcile = async (db, type, rows, transaction) => {
  const productIds = await resolveCatalogProductIds(db, type, rows, transaction);
  if (!productIds.length) return;

  if (!transaction) {
    await reconcileInventoryForProducts(db, productIds);
    return;
  }

  if (!transaction.inventoryReconcileProductIds) {
    transaction.inventoryReconcileProductIds = new Set();
  }
  productIds.forEach((productId) =>
    transaction.inventoryReconcileProductIds.add(productId),
  );

  if (transaction.inventoryReconcileAfterCommitRegistered) return;
  transaction.inventoryReconcileAfterCommitRegistered = true;

  transaction.afterCommit(async () => {
    try {
      await reconcileInventoryForProducts(
        db,
        Array.from(transaction.inventoryReconcileProductIds || []),
      );
    } catch (error) {
      console.error("Inventory movement reconciliation failed:", error);
    }
  });
};

const registerMovementHooks = (db, modelKey, type) => {
  const model = db[modelKey];
  if (!model || model.inventoryReconcileHooksRegistered) return;

  const hookName = `${modelKey}InventoryReconcile`;
  const enqueueRow = (instance, options = {}) =>
    enqueueReconcile(db, type, [instance], options.transaction);
  const enqueueRowsByWhere = async (options = {}) => {
    const rows = await model.findAll({
      where: options.where,
      transaction: options.transaction,
      paranoid: false,
    });
    const updatedValues = options.attributes ? [options.attributes] : [];
    await enqueueReconcile(db, type, [...rows, ...updatedValues], options.transaction);
  };

  model.addHook("afterCreate", hookName, enqueueRow);
  model.addHook("afterUpdate", hookName, enqueueRow);
  model.addHook("beforeBulkUpdate", hookName, enqueueRowsByWhere);
  model.addHook("beforeBulkDestroy", hookName, enqueueRowsByWhere);

  model.inventoryReconcileHooksRegistered = true;
};

const registerInventoryReconcileHooks = (db) => {
  registerMovementHooks(db, "receivedProduct", "catalog");
  registerMovementHooks(db, "returnProduct", "inventory");
  registerMovementHooks(db, "inTransitProduct", "inventory");
  registerMovementHooks(db, "purchaseReturnProduct", "inventory");
  registerMovementHooks(db, "damageProduct", "inventory");
  registerMovementHooks(db, "posReport", "inventory");
  registerMovementHooks(db, "damageRepaired", "repairing");
};

module.exports = registerInventoryReconcileHooks;
