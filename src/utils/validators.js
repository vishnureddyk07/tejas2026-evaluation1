export const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

export const isValidScore = (value) => {
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 10;
};

export const sanitizeString = (value) => String(value || "").trim();
