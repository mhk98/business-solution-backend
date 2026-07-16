const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const normalizeUnitLabel = (unit) => {
  const normalizedUnit = String(unit || "Pcs").trim();
  return normalizedUnit || "Pcs";
};

const buildConvertedPayload = ({
  unit,
  unitValue,
  inputUnit,
  inputUnitValue,
  isWeightUnit = false,
  isVolumeUnit = false,
}) => ({
  unit,
  unitValue,
  inputUnit,
  inputUnitValue,
  isWeightUnit,
  isVolumeUnit,
  isConvertedUnit: true,
});

const toBaseStockPayload = (unit, unitValue) => {
  const normalizedUnit = normalizeUnitLabel(unit);
  const normalizedUnitKey = normalizedUnit.toLowerCase();
  const numericValue = toNumber(unitValue);

  if (normalizedUnitKey === "kg") {
    return buildConvertedPayload({
      unit: "Gram",
      unitValue: numericValue * 1000,
      inputUnit: "Kg",
      inputUnitValue: numericValue,
      isWeightUnit: true,
    });
  }

  if (normalizedUnitKey === "gram") {
    return buildConvertedPayload({
      unit: "Gram",
      unitValue: numericValue,
      inputUnit: "Gram",
      inputUnitValue: numericValue,
      isWeightUnit: true,
    });
  }

  if (["liter", "litre", "litter", "ltr", "l"].includes(normalizedUnitKey)) {
    return buildConvertedPayload({
      unit: "Ml",
      unitValue: numericValue * 1000,
      inputUnit: "Liter",
      inputUnitValue: numericValue,
      isVolumeUnit: true,
    });
  }

  if (["ml", "milliliter", "millilitre"].includes(normalizedUnitKey)) {
    return buildConvertedPayload({
      unit: "Ml",
      unitValue: numericValue,
      inputUnit: "Ml",
      inputUnitValue: numericValue,
      isVolumeUnit: true,
    });
  }

  return {
    unit: normalizedUnit,
    unitValue: numericValue,
    inputUnit: normalizedUnit,
    inputUnitValue: numericValue,
    isWeightUnit: false,
    isVolumeUnit: false,
    isConvertedUnit: false,
  };
};

const formatUnitValue = (value) => Number(toNumber(value).toFixed(2));

const formatStockForDisplay = (record) => {
  const plainRecord = record?.toJSON ? record.toJSON() : { ...record };
  const basePayload = toBaseStockPayload(plainRecord.unit, plainRecord.unitValue);

  if (!basePayload.isConvertedUnit) {
    return plainRecord;
  }

  if (basePayload.unitValue >= 1000) {
    return {
      ...plainRecord,
      unit: basePayload.isWeightUnit ? "Kg" : "Liter",
      unitValue: formatUnitValue(basePayload.unitValue / 1000),
      baseUnit: basePayload.unit,
      baseUnitValue: formatUnitValue(basePayload.unitValue),
    };
  }

  return {
    ...plainRecord,
    unit: basePayload.unit,
    unitValue: formatUnitValue(basePayload.unitValue),
    baseUnit: basePayload.unit,
    baseUnitValue: formatUnitValue(basePayload.unitValue),
  };
};

module.exports = {
  toNumber,
  toBaseStockPayload,
  formatStockForDisplay,
  formatUnitValue,
};
