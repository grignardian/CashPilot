/**
 * Calendar Heatmap Utility
 * Defines spending intensity tiers and color mapping for calendar cells.
 */

/**
 * Spending intensity tiers configuration.
 */
export const SPENDING_TIERS = {
  tier0: { min: 0, max: 0, alpha: 0, label: "No spend" },
  tier1: { min: 1, max: 300, alpha: 0.2, label: "Light" },
  tier2: { min: 301, max: 800, alpha: 0.4, label: "Moderate" },
  tier3: { min: 801, max: 1500, alpha: 0.6, label: "Heavy" },
  tier4: { min: 1501, max: Infinity, alpha: 0.85, label: "Intense" }
};

/**
 * Get the appropriate tier for a spending amount.
 * @param {number} amount - Daily spend amount
 * @returns {object} Tier configuration { min, max, alpha, label }
 */
export function getTierForAmount(amount) {
  const value = Number(amount || 0);
  if (value <= 0) return SPENDING_TIERS.tier0;
  if (value <= 300) return SPENDING_TIERS.tier1;
  if (value <= 800) return SPENDING_TIERS.tier2;
  if (value <= 1500) return SPENDING_TIERS.tier3;
  return SPENDING_TIERS.tier4;
}

/**
 * Compute dynamic tiers based on user's actual spending patterns.
 * Divides the user's spending range into quartiles.
 * @param {object} byDate - Map of dateKey → totalSpent
 * @returns {function} Custom tier function for the user's range
 */
export function createDynamicTiers(byDate) {
  const values = Object.values(byDate).filter((v) => v > 0).sort((a, b) => a - b);

  if (values.length === 0) return getTierForAmount;

  const q1 = values[Math.floor(values.length * 0.25)] || values[0];
  const q2 = values[Math.floor(values.length * 0.5)] || q1;
  const q3 = values[Math.floor(values.length * 0.75)] || q2;

  return function getDynamicTier(amount) {
    const value = Number(amount || 0);
    if (value <= 0) return { alpha: 0, label: "No spend" };
    if (value <= q1) return { alpha: 0.2, label: "Light" };
    if (value <= q2) return { alpha: 0.4, label: "Moderate" };
    if (value <= q3) return { alpha: 0.65, label: "Heavy" };
    return { alpha: 0.9, label: "Intense" };
  };
}

/**
 * Get the alpha (opacity) value for a spending amount.
 * Shorthand for use in inline styles.
 * @param {number} amount
 * @returns {number} Alpha value 0-1
 */
export function getSpendAlpha(amount) {
  return getTierForAmount(amount).alpha;
}
