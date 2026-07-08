/**
 * Gemini AI Integration
 * Category suggestions, spending advice, and monthly forecasts.
 */

const CACHE_KEY = "cashpilot-gemini-cache";
const RATE_LIMIT_KEY = "cashpilot-gemini-rate";
const MAX_CALLS_PER_MINUTE = 5;

/**
 * Get the Gemini API key from environment.
 */
function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
}

/**
 * Check if Gemini is configured.
 */
export function isGeminiConfigured() {
  return Boolean(getApiKey());
}

/**
 * Rate limiter — max 5 calls per minute.
 */
function checkRateLimit() {
  try {
    const data = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || "{}");
    const now = Date.now();
    const calls = (data.calls || []).filter((t) => now - t < 60000);
    if (calls.length >= MAX_CALLS_PER_MINUTE) return false;
    calls.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ calls }));
    return true;
  } catch {
    return true;
  }
}

/**
 * Get/set cache entries.
 */
function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setCache(key, value, ttlMs) {
  const cache = getCache();
  cache[key] = { value, expiresAt: Date.now() + ttlMs };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function getCached(key) {
  const cache = getCache();
  const entry = cache[key];
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  return null;
}

/**
 * Call Gemini API.
 */
async function callGemini(prompt) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Gemini API key not configured");
  if (!checkRateLimit()) throw new Error("Rate limit exceeded");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.trim();
}

/**
 * Suggest category and refined name for an expense.
 * @param {string} userInput - Raw expense name (e.g. "maggi at canteen")
 * @returns {object} { suggestedName, suggestedCategory, confidence }
 */
export async function suggestCategoryAndName(userInput) {
  if (!userInput || userInput.length < 3) return null;
  if (!isGeminiConfigured()) return fallbackCategorySuggestion(userInput);

  const cacheKey = `cat_${userInput.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const prompt = `Categorize this student expense and refine the name. Input: "${userInput}". 
Return ONLY valid JSON (no markdown, no code blocks): {"suggestedName": "string", "suggestedCategory": "Food|Transport|Books|Hangout|Other", "confidence": 0.0-1.0}
Categories: Food (meals, snacks, drinks), Transport (auto, bus, metro, fuel), Books (study materials, stationery, subscriptions), Hangout (movies, games, outings), Other (everything else).`;

    const result = await callGemini(prompt);
    const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());

    const suggestion = {
      suggestedName: parsed.suggestedName || userInput,
      suggestedCategory: parsed.suggestedCategory || "Other",
      confidence: Number(parsed.confidence) || 0.5
    };

    setCache(cacheKey, suggestion, 7 * 24 * 60 * 60 * 1000); // 7 day cache
    return suggestion;
  } catch {
    return fallbackCategorySuggestion(userInput);
  }
}

/**
 * Get spending advice based on current metrics.
 * @param {object} metrics - { budget, savingsGoal, spent, topCategories, daysRemaining }
 * @returns {object} { advice, tone }
 */
export async function getSpendingAdvice(metrics) {
  const cacheKey = `advice_${metrics.spent}_${metrics.daysRemaining}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!isGeminiConfigured()) {
    return fallbackAdvice(metrics);
  }

  try {
    const prompt = `Give 1-2 sentences of budget advice for an Indian college student. Budget: ₹${metrics.budget}, savings goal: ₹${metrics.savingsGoal}, spent so far: ₹${metrics.spent}, days remaining: ${metrics.daysRemaining}, top categories: ${metrics.topCategories}. Keep it concise, actionable, and encouraging. Return ONLY valid JSON: {"advice": "string", "tone": "positive|cautious|warning"}`;

    const result = await callGemini(prompt);
    const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());

    const advice = {
      advice: parsed.advice || "Keep logging your expenses to stay on track.",
      tone: parsed.tone || "positive"
    };

    setCache(cacheKey, advice, 24 * 60 * 60 * 1000); // 24 hour cache
    return advice;
  } catch {
    return fallbackAdvice(metrics);
  }
}

/**
 * Generate a brief monthly forecast.
 * @param {object} data - { spent, budget, savingsGoal, daysPassed, totalDays }
 * @returns {object} { forecast, onTrack }
 */
export async function generateMonthlyForecast(data) {
  const cacheKey = `forecast_${data.spent}_${data.daysPassed}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!isGeminiConfigured()) {
    return fallbackForecast(data);
  }

  try {
    const projectedSpend = Math.round((data.spent / Math.max(data.daysPassed, 1)) * data.totalDays);
    const projectedSavings = data.budget - projectedSpend;

    const prompt = `In one sentence, describe this Indian college student's monthly budget forecast. Budget: ₹${data.budget}, savings goal: ₹${data.savingsGoal}, spent ₹${data.spent} in ${data.daysPassed} days of ${data.totalDays}. Projected total: ₹${projectedSpend}. Projected savings: ₹${projectedSavings}. Be concise and natural. Return ONLY valid JSON: {"forecast": "string", "onTrack": true/false}`;

    const result = await callGemini(prompt);
    const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());

    const forecast = {
      forecast: parsed.forecast || `At current pace, you'll spend ₹${projectedSpend} this month.`,
      onTrack: parsed.onTrack !== undefined ? parsed.onTrack : projectedSpend <= (data.budget - data.savingsGoal)
    };

    setCache(cacheKey, forecast, 7 * 24 * 60 * 60 * 1000); // 7 day cache
    return forecast;
  } catch {
    return fallbackForecast(data);
  }
}

// --- Fallback logic (no API required) ---

function fallbackCategorySuggestion(input) {
  const lower = input.toLowerCase();
  const foodWords = ["maggi", "dosa", "chai", "tea", "coffee", "lunch", "dinner", "breakfast", "snack", "biryani", "pizza", "burger", "thali", "mess", "canteen", "juice", "water", "milk", "egg", "bread", "rice", "noodles", "momos", "samosa", "pani puri"];
  const transportWords = ["auto", "uber", "ola", "bus", "metro", "train", "cab", "petrol", "fuel", "rick", "rickshaw", "ticket"];
  const bookWords = ["book", "notebook", "pen", "stationery", "xerox", "print", "copy", "study", "course", "subscription", "udemy", "coursera"];
  const hangoutWords = ["movie", "film", "game", "outing", "trip", "party", "club", "bowling", "arcade", "concert", "event"];

  let category = "Other";
  let confidence = 0.6;

  if (foodWords.some((w) => lower.includes(w))) { category = "Food"; confidence = 0.85; }
  else if (transportWords.some((w) => lower.includes(w))) { category = "Transport"; confidence = 0.85; }
  else if (bookWords.some((w) => lower.includes(w))) { category = "Books"; confidence = 0.8; }
  else if (hangoutWords.some((w) => lower.includes(w))) { category = "Hangout"; confidence = 0.8; }

  return { suggestedName: input, suggestedCategory: category, confidence };
}

function fallbackAdvice(metrics) {
  const available = metrics.budget - metrics.savingsGoal;
  const ratio = metrics.spent / Math.max(available, 1);

  if (ratio >= 1) {
    return { advice: "You've exceeded your spending limit. Review recent expenses and cut non-essentials.", tone: "warning" };
  }
  if (ratio >= 0.8) {
    return { advice: "You're close to your monthly limit. Stick to essentials for the remaining days.", tone: "cautious" };
  }
  if (ratio <= 0.4) {
    return { advice: "Great control so far! You're well within budget this month.", tone: "positive" };
  }
  return { advice: "You're on track. Keep logging expenses to maintain visibility.", tone: "positive" };
}

function fallbackForecast(data) {
  const projectedSpend = Math.round((data.spent / Math.max(data.daysPassed, 1)) * data.totalDays);
  const available = data.budget - data.savingsGoal;
  const onTrack = projectedSpend <= available;

  return {
    forecast: onTrack
      ? `At current pace, you'll spend ₹${projectedSpend.toLocaleString("en-IN")} and save ₹${(data.budget - projectedSpend).toLocaleString("en-IN")}.`
      : `You're trending toward ₹${projectedSpend.toLocaleString("en-IN")} this month — above your ₹${available.toLocaleString("en-IN")} limit.`,
    onTrack
  };
}
