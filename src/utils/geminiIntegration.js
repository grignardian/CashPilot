export const VALID_CATEGORIES = [
  "Food",
  "Transport",
  "Groceries",
  "Shopping",
  "Bills & Rent",
  "Subscriptions",
  "Academics",
  "Health",
  "Gifts",
  "Hangout",
  "Other"
];

/**
 * Normalize AI or user category string to valid CashPilot category.
 */
function normalizeCategory(catStr) {
  if (!catStr) return "Other";
  const clean = catStr.trim();
  if (VALID_CATEGORIES.includes(clean)) return clean;

  const lower = clean.toLowerCase();
  if (lower.includes("food") || lower.includes("eat") || lower.includes("din") || lower.includes("meal") || lower.includes("snack") || lower.includes("canteen")) return "Food";
  if (lower.includes("trans") || lower.includes("travel") || lower.includes("commute") || lower.includes("cab") || lower.includes("ride")) return "Transport";
  if (lower.includes("groc") || lower.includes("supermarket") || lower.includes("market") || lower.includes("store")) return "Groceries";
  if (lower.includes("shop") || lower.includes("cloth") || lower.includes("wear") || lower.includes("buy")) return "Shopping";
  if (lower.includes("bill") || lower.includes("rent") || lower.includes("electric") || lower.includes("utility") || lower.includes("power")) return "Bills & Rent";
  if (lower.includes("subscr") || lower.includes("ott") || lower.includes("stream") || lower.includes("membership")) return "Subscriptions";
  if (lower.includes("academic") || lower.includes("book") || lower.includes("study") || lower.includes("school") || lower.includes("college") || lower.includes("exam") || lower.includes("tuition")) return "Academics";
  if (lower.includes("health") || lower.includes("med") || lower.includes("pharm") || lower.includes("doc") || lower.includes("gym") || lower.includes("fit")) return "Health";
  if (lower.includes("gift") || lower.includes("present") || lower.includes("donat") || lower.includes("treat")) return "Gifts";
  if (lower.includes("hangout") || lower.includes("fun") || lower.includes("movie") || lower.includes("party") || lower.includes("game") || lower.includes("trip") || lower.includes("leisure")) return "Hangout";

  return "Other";
}

/**
 * Suggest category and refined name for an expense.
 * @param {string} userInput - Raw expense name (e.g. "maggi at canteen")
 * @returns {object} { suggestedName, suggestedCategory, confidence }
 */
export async function suggestCategoryAndName(userInput) {
  if (!userInput || userInput.trim().length < 2) return null;
  const cleanInput = userInput.trim();

  const cacheKey = `cat_${cleanInput.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!isGeminiConfigured()) return fallbackCategorySuggestion(cleanInput);

  try {
    const prompt = `Categorize this Indian college student expense and refine the name. Input: "${cleanInput}". 
Return ONLY valid JSON (no markdown, no code blocks): {"suggestedName": "string", "suggestedCategory": "Food|Transport|Groceries|Shopping|Bills & Rent|Subscriptions|Academics|Health|Gifts|Hangout|Other", "confidence": 0.0-1.0}

Category definitions:
- Food: Canteen, Swiggy, Zomato, meals, snacks, tea, chai, coffee, drinks, restaurants.
- Transport: Auto, Uber, Ola, Rapido, bus, metro, train, cab, petrol, fuel, parking, ticket.
- Groceries: Blinkit, Zepto, Instamart, supermarket, milk, veggies, fruits, eggs, bread, daily essentials.
- Shopping: Amazon, Flipkart, Myntra, Meesho, clothes, shoes, electronics, accessories, gadget.
- Bills & Rent: Room/flat rent, electricity, Wi-Fi/broadband, water, gas cylinder, maintenance bill.
- Subscriptions: Netflix, Spotify, Hotstar, Prime, YouTube Premium, Apple, ChatGPT, software sub.
- Academics: Xerox, printing, notebooks, pens, textbooks, study materials, exam fees, tuition, courses.
- Health: Medicines, pharmacy, doctor fee, hospital, lab tests, gym, protein, healthcare.
- Gifts: Birthday gift, treat for friends, presents, festival gifts, flowers.
- Hangout: Movies, cinema, gaming, bowling, arcade, outings, trips, party, clubs, events.
- Other: Misc expense not fitting above.`;

    const result = await callGemini(prompt);
    const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());

    const suggestion = {
      suggestedName: parsed.suggestedName || cleanInput,
      suggestedCategory: normalizeCategory(parsed.suggestedCategory),
      confidence: Number(parsed.confidence) || 0.85
    };

    setCache(cacheKey, suggestion, 7 * 24 * 60 * 60 * 1000); // 7 day cache
    return suggestion;
  } catch {
    return fallbackCategorySuggestion(cleanInput);
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

export function fallbackCategorySuggestion(input) {
  if (!input) return { suggestedName: "", suggestedCategory: "Other", confidence: 0.5 };
  const lower = input.toLowerCase().trim();

  const groceryWords = ["blinkit", "zepto", "instamart", "grocery", "groceries", "supermarket", "dmart", "d-mart", "bigbasket", "vegetables", "veggies", "fruits", "curd", "paneer", "ration"];
  const billsWords = ["house rent", "room rent", "flat rent", "pg rent", "rent ", "electricity", "power bill", "wifi", "broadband", "recharge", "airtel bill", "jio bill", "vi bill", "water bill", "gas cylinder", "maintenance bill"];
  const subWords = ["netflix", "spotify", "hotstar", "prime video", "youtube premium", "apple music", "icloud", "chatgpt", "github sub", "subscription"];
  const academicWords = ["xerox", "photocopy", "notebook", "stationery", "textbook", "study material", "course", "udemy", "coursera", "exam fee", "college fee", "tuition", "lab fee", "assignment", "project printout", "pen ", "pens", "pencil"];
  const healthWords = ["doctor", "pharmacy", "medicine", "meds", "hospital", "clinic", "syrup", "tablets", "pills", "lab test", "gym fee", "protein", "whey", "dentist", "medical", "bandage", "crocin", "paracetamol"];
  const giftWords = ["gift", "birthday gift", "treat for friends", "present", "flowers", "rakhi", "anniversary gift", "farewell gift"];
  const hangoutWords = ["movie", "film", "cinema", "imax", "pvr", "inox", "gaming", "ps5", "bowling", "arcade", "outing", "trip", "party", "club", "concert", "event", "standup", "pub", "bar"];
  const transportWords = ["auto", "uber", "ola", "rapido", "bus", "metro", "train", "cab", "petrol", "diesel", "fuel", "rickshaw", "bus ticket", "metro pass", "train ticket", "parking", "toll", "fastag", "scooty", "bike refill"];
  const shoppingWords = ["amazon", "flipkart", "myntra", "meesho", "ajio", "zara", "h&m", "clothes", "shirt", "tshirt", "t-shirt", "jeans", "pants", "shoes", "sneakers", "jacket", "hoodie", "electronics", "headphones", "earbuds", "earphones", "charger", "cable", "case", "cover"];
  const foodWords = ["swiggy", "zomato", "maggi", "dosa", "chai", "tea", "coffee", "lunch", "dinner", "breakfast", "snack", "biryani", "pizza", "burger", "thali", "mess", "canteen", "juice", "water", "milkshake", "egg", "bread", "rice", "noodles", "momos", "samosa", "pani puri", "food", "cafe", "restaurant", "dhaba", "shawarma", "kathi roll", "pastry", "cake", "ice cream", "subway", "dominos", "kfc", "mcdonalds"];

  let category = "Other";
  let confidence = 0.85;

  if (groceryWords.some((w) => lower.includes(w))) { category = "Groceries"; }
  else if (billsWords.some((w) => lower.includes(w))) { category = "Bills & Rent"; }
  else if (subWords.some((w) => lower.includes(w))) { category = "Subscriptions"; }
  else if (academicWords.some((w) => lower.includes(w))) { category = "Academics"; }
  else if (healthWords.some((w) => lower.includes(w))) { category = "Health"; }
  else if (giftWords.some((w) => lower.includes(w))) { category = "Gifts"; }
  else if (hangoutWords.some((w) => lower.includes(w))) { category = "Hangout"; }
  else if (transportWords.some((w) => lower.includes(w))) { category = "Transport"; }
  else if (shoppingWords.some((w) => lower.includes(w))) { category = "Shopping"; }
  else if (foodWords.some((w) => lower.includes(w))) { category = "Food"; }
  else { confidence = 0.7; }

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

