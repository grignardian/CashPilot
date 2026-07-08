/**
 * Split Tracking Utility
 * Manages expense splits with friends and settlement tracking.
 */

const SPLITS_KEY = "cashpilot-splits";

/**
 * Get all splits from localStorage.
 * @returns {Array} Split objects
 */
export function getSplits() {
  try {
    return JSON.parse(localStorage.getItem(SPLITS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSplits(splits) {
  localStorage.setItem(SPLITS_KEY, JSON.stringify(splits));
}

/**
 * Create a new split for an expense.
 * @param {object} params
 * @param {string} params.expenseId - Reference to original expense
 * @param {number} params.originalAmount - Full expense amount
 * @param {number} params.yourShare - Your portion
 * @param {string} params.friendName - Friend's name
 * @param {string} [params.friendEmail] - Friend's email
 * @param {string} [params.notes] - Optional notes
 * @returns {object} Created split
 */
export function createSplit({ expenseId, originalAmount, yourShare, friendName, friendEmail = "", notes = "" }) {
  const splits = getSplits();
  const newSplit = {
    id: `split_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    expenseId,
    originalAmount: Number(originalAmount),
    yourShare: Number(yourShare),
    friendShare: Number(originalAmount) - Number(yourShare),
    friendName,
    friendEmail,
    status: "pending",
    createdDate: new Date().toISOString().slice(0, 10),
    settledDate: null,
    notes
  };
  splits.push(newSplit);
  saveSplits(splits);
  return newSplit;
}

/**
 * Get splits filtered by friend and/or status.
 * @param {string} [friendName] - Filter by friend name
 * @param {string} [status] - Filter by status: 'pending' | 'settled' | 'declined'
 * @returns {Array} Filtered splits
 */
export function getSplitsWithFriend(friendName = null, status = null) {
  let splits = getSplits();
  if (friendName) {
    splits = splits.filter((s) => s.friendName.toLowerCase() === friendName.toLowerCase());
  }
  if (status) {
    splits = splits.filter((s) => s.status === status);
  }
  return splits;
}

/**
 * Mark a split as settled.
 * @param {string} splitId
 */
export function settleSplit(splitId) {
  const splits = getSplits();
  const index = splits.findIndex((s) => s.id === splitId);
  if (index !== -1) {
    splits[index].status = "settled";
    splits[index].settledDate = new Date().toISOString().slice(0, 10);
    saveSplits(splits);
  }
}

/**
 * Decline a split.
 * @param {string} splitId
 */
export function declineSplit(splitId) {
  const splits = getSplits();
  const index = splits.findIndex((s) => s.id === splitId);
  if (index !== -1) {
    splits[index].status = "declined";
    saveSplits(splits);
  }
}

/**
 * Get all outstanding (pending) splits.
 * @returns {Array} Pending splits
 */
export function getOutstandingSplits() {
  return getSplits().filter((s) => s.status === "pending");
}

/**
 * Generate a net summary per friend.
 * @returns {Array} Summary per friend: [{ friendName, total, direction, splits }]
 */
export function generateSplitSummary() {
  const pending = getOutstandingSplits();
  const byFriend = {};

  pending.forEach((split) => {
    const name = split.friendName;
    if (!byFriend[name]) {
      byFriend[name] = { friendName: name, friendEmail: split.friendEmail, netOwed: 0, splits: [] };
    }
    // friendShare is what the friend owes you
    byFriend[name].netOwed += split.friendShare;
    byFriend[name].splits.push(split);
  });

  return Object.values(byFriend).map((entry) => ({
    friendName: entry.friendName,
    friendEmail: entry.friendEmail,
    total: Math.abs(entry.netOwed),
    direction: entry.netOwed > 0 ? "owed" : "owe",
    splitCount: entry.splits.length,
    splits: entry.splits
  }));
}
