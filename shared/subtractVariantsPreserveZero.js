const parseVariants = require("./parseVariants");

const subtractVariantsPreserveZero = (existingVariants, removingVariants) => {
  const oldVariants = parseVariants(existingVariants);
  const deletedVariants = parseVariants(removingVariants);

  const map = new Map();

  oldVariants.forEach((item) => {
    const key = `${item.size}__${item.color}`;
    map.set(key, {
      ...item,
      size: item.size,
      color: item.color,
      quantity: Number(item.quantity || 0),
      purchase_price: Number(item.purchase_price || 0),
      sale_price: Number(item.sale_price || 0),
    });
  });

  deletedVariants.forEach((item) => {
    const key = `${item.size}__${item.color}`;
    const qty = Number(item.quantity || 0);

    if (!map.has(key)) return;

    const old = map.get(key);
    map.set(key, {
      ...old,
      quantity: Math.max(0, old.quantity - qty),
    });
  });

  return Array.from(map.values());
};

module.exports = subtractVariantsPreserveZero;
