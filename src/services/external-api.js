const axios = require("axios");

// บริการภายนอก: TheMealDB (public API, ใช้ test key "1", ไม่ส่งข้อมูลผู้ใช้ไปด้วย)
// ใช้ค้นหาไอเดียเมนูจากวัตถุดิบ เพื่อแนะนำเสริมให้สูตรอาหารในระบบ
const DEFAULTS = {
  baseUrl: "https://www.themealdb.com/api/json/v1/1",
  timeoutMs: 3000, // รอแต่ละครั้งได้ไม่เกิน 3 วินาที
  maxRetries: 2, // ลองใหม่ 2 ครั้ง รวมครั้งแรกเป็น 3 ครั้ง
  backoffMs: 300, // exponential backoff: 300ms, 600ms, ...
  maxIdeas: 5,
};

// ค่า default เมื่อบริการภายนอกใช้ไม่ได้ ดึงจากสูตรตัวอย่างของระบบเอง
const FALLBACK_IDEAS = [
  { id: "local-1", name: "ผัดกะเพราหมูสับไข่ดาว", thumbnail: null },
  { id: "local-2", name: "ข้าวเหนียวมะม่วงกะทิสด", thumbnail: null },
  { id: "local-3", name: "อกไก่ผัดพริกไทยดำคลีน", thumbnail: null },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function boundedInteger(value, fallback, min, max) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

// อ่านค่าตอนเรียกใช้ทุกครั้ง เพื่อให้เปลี่ยนค่าด้วย environment variable ตอนทดสอบได้
function readConfig(overrides = {}) {
  const config = {
    baseUrl: process.env.EXTERNAL_API_BASE_URL || DEFAULTS.baseUrl,
    timeoutMs: process.env.EXTERNAL_API_TIMEOUT_MS,
    maxRetries: process.env.EXTERNAL_API_MAX_RETRIES,
    backoffMs: process.env.EXTERNAL_API_BACKOFF_MS,
    maxIdeas: DEFAULTS.maxIdeas,
    sleep,
    logger: console,
    ...overrides,
  };
  // Axios treats timeout=0 as unlimited. Invalid environment values must not
  // disable deadlines or accidentally produce millions of retries.
  config.timeoutMs = boundedInteger(config.timeoutMs, DEFAULTS.timeoutMs, 1, 10000);
  config.maxRetries = boundedInteger(config.maxRetries, DEFAULTS.maxRetries, 0, 3);
  config.backoffMs = boundedInteger(config.backoffMs, DEFAULTS.backoffMs, 0, 1000);
  return config;
}

// แยกประเภทความล้มเหลว และบอกว่าควรลองใหม่หรือไม่
// ลองใหม่เฉพาะ network error, timeout และ 5xx (4xx แปลว่าคำขอผิด ลองซ้ำก็ผิดเหมือนเดิม)
function classify(error) {
  if (error.response) {
    const status = error.response.status;
    if (status >= 500) return { reason: "UPSTREAM_5XX", status, retryable: true };
    return { reason: "UPSTREAM_4XX", status, retryable: false };
  }
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || error.code === "ERR_CANCELED") {
    return { reason: "TIMEOUT", status: null, retryable: true };
  }
  return { reason: "NETWORK_ERROR", status: null, retryable: true, code: error.code || null };
}

class ExternalApiError extends Error {
  constructor(reason, attempts) {
    super(`External API failed: ${reason}`);
    this.reason = reason;
    this.attempts = attempts;
  }
}

async function getWithRetry(url, params, cfg) {
  const attempts = [];
  const totalTries = cfg.maxRetries + 1;

  for (let attempt = 1; attempt <= totalTries; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await axios.get(url, {
        params, timeout: cfg.timeoutMs,
        // Socket inactivity timeout alone does not bound DNS/connect/trickled bodies.
        signal: AbortSignal.timeout(cfg.timeoutMs),
        maxContentLength: 1024 * 1024,
      });
      attempts.push({ attempt, outcome: "success", status: response.status, ms: Date.now() - startedAt });
      return { data: response.data, attempts };
    } catch (error) {
      const info = classify(error);
      attempts.push({ attempt, outcome: info.reason, status: info.status, code: info.code || null, ms: Date.now() - startedAt });
      cfg.logger.warn(`[external-api] attempt ${attempt}/${totalTries} failed: ${info.reason}${info.status ? ` (${info.status})` : ""}${info.code ? ` ${info.code}` : ""}`);

      if (!info.retryable || attempt === totalTries) throw new ExternalApiError(info.reason, attempts);
      await cfg.sleep(cfg.backoffMs * 2 ** (attempt - 1));
    }
  }
  throw new ExternalApiError("NETWORK_ERROR", attempts); // ไม่ควรมาถึงบรรทัดนี้
}

function fallback(reason, attempts) {
  return {
    source: "fallback",
    degraded: true,
    message: "ไม่สามารถเชื่อมต่อบริการแนะนำเมนูภายนอกได้ในขณะนี้ จึงแสดงรายการสำรองของระบบแทน",
    reason,
    attempts,
    ideas: FALLBACK_IDEAS,
  };
}

// ไม่ throw ออกไปนอกฟังก์ชัน: ไม่ว่าบริการภายนอกจะล้มแบบไหน ผู้เรียกได้ผลลัพธ์ที่ใช้ต่อได้เสมอ
async function getMealIdeas(ingredient, overrides = {}) {
  const cfg = readConfig(overrides);
  try {
    const { data, attempts } = await getWithRetry(`${cfg.baseUrl}/filter.php`, { i: ingredient }, cfg);
    if (!data || typeof data !== "object" || !(Array.isArray(data.meals) || data.meals === null) ||
        (Array.isArray(data.meals) && !data.meals.every((meal) => meal &&
          typeof meal.idMeal === "string" && meal.idMeal.trim().length > 0 &&
          typeof meal.strMeal === "string" && meal.strMeal.trim().length > 0 &&
          (meal.strMealThumb == null || typeof meal.strMealThumb === "string")))) {
      cfg.logger.warn("[external-api] unexpected response shape, using fallback");
      return fallback("INVALID_RESPONSE", attempts.length);
    }
    const ideas = (data.meals || []).slice(0, cfg.maxIdeas).map((meal) => ({
      id: String(meal.idMeal),
      name: meal.strMeal,
      thumbnail: meal.strMealThumb || null,
    }));
    return { source: "themealdb", degraded: false, attempts: attempts.length, ideas };
  } catch (error) {
    if (error instanceof ExternalApiError) return fallback(error.reason, error.attempts.length);
    cfg.logger.error("[external-api] unexpected error:", error.message);
    return fallback("UNEXPECTED_ERROR", 0);
  }
}

module.exports = { getMealIdeas, getWithRetry, readConfig, classify, ExternalApiError, FALLBACK_IDEAS, DEFAULTS };
