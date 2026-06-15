/**
 * 优惠券文本解析工具（v2，增强版）
 * ------------------------------------------------------------
 * 核心改进：
 * - 日期识别：支持 2026-06-15 / 2026.06.15 / 2026/6/15 / 2026年6月15日 /
 *            6月15日 / 6-15 / 今天/明天/后天过期 / 有效期至XXXX 等所有变体
 * - 金额识别：¥20 / ￥20 / 20元 / 满30减20 / 立减20 / 5折 / 9.5折
 * - 名称识别：更多启发式规则 + 更严格的 UI 黑名单
 * - 多券分割：每张券独立解析，避免信息交叉污染
 */

import type { CouponInput } from "../types/coupon";

interface ParseResult {
  name?: string;
  platform?: string;
  amount?: string;
  expiryDate?: string; // YYYY-MM-DD
  note?: string;
}

// ==================== 平台/商家关键字 ====================

interface PlatformKeyword {
  pattern: RegExp; // 匹配规则（大小写不敏感）
  name: string;    // 规范化名称
  priority: number; // 优先级（数字越小越高）
}

const PLATFORM_KEYWORDS: PlatformKeyword[] = [
  // 餐饮类（最高优先级，最常见）
  { pattern: /霸王茶姬|霸王|茶姬/, name: "霸王茶姬", priority: 1 },
  { pattern: /瑞幸咖啡|luckin|瑞幸/, name: "瑞幸咖啡", priority: 1 },
  { pattern: /星巴克|starbucks|Starbucks/, name: "星巴克", priority: 1 },
  { pattern: /喜茶|HEYTEA|heytea/, name: "喜茶", priority: 1 },
  { pattern: /蜜雪冰城|蜜雪/, name: "蜜雪冰城", priority: 1 },
  { pattern: /奈雪的茶|奈雪|NAYUKI|nayuki/, name: "奈雪的茶", priority: 1 },
  { pattern: /CoCo|都可|COCO/, name: "CoCo 都可", priority: 2 },
  { pattern: /沪上阿姨|沪上|AUNTEA JENNY|auntea jenny/, name: "沪上阿姨", priority: 1 },
  { pattern: /麦当劳|金拱门|MCDONALD|mcdonald|McDonald/, name: "麦当劳", priority: 1 },
  { pattern: /肯德基|KFC|KFC|肯德基/, name: "肯德基", priority: 1 },
  { pattern: /古茗/, name: "古茗", priority: 2 },
  { pattern: /一点点/, name: "一点点", priority: 2 },
  { pattern: /全家|family mart|Family Mart|FamilyMart/, name: "全家", priority: 2 },

  // 电商类
  { pattern: /淘宝|天猫|TMALL|Tmall|tmall/, name: "淘宝/天猫", priority: 2 },
  { pattern: /京东|JD\.COM|JD|jd\.com/, name: "京东", priority: 2 },
  { pattern: /拼多多|PDD|pdd/, name: "拼多多", priority: 2 },
  { pattern: /飞猪旅行|飞猪|Fliggy|fliggy/, name: "飞猪", priority: 3 },
  { pattern: /美团外卖|美团|Meituan|meituan/, name: "美团", priority: 2 },
  { pattern: /饿了么|Ele\.me|ele\.me|饿了/, name: "饿了么", priority: 2 },

  // 支付/其他
  { pattern: /支付宝|Alipay|alipay/, name: "支付宝", priority: 3 },
  { pattern: /微信|weixin|WeChat|Wechat/, name: "微信", priority: 3 },
  { pattern: /抖音|TikTok|tiktok|Douyin|douyin/, name: "抖音", priority: 3 },
  { pattern: /天天秒杀|每日秒杀|限时秒杀/, name: "天天秒杀", priority: 4 },
];

// ==================== 日期工具 ====================

function normalizeDate(y: number, m: number, d: number): string {
  if (y < 100) y += 2000;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function todayYYYYMMDD(): string {
  const t = new Date();
  return normalizeDate(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + days);
  return normalizeDate(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

/**
 * 从一段文本中识别到期日期（增强版）
 *
 * 支持格式：
 * - 2026-06-15 / 2026.06.15 / 2026/06/15
 * - 2026年06月15日 / 2026年6月15日 / 2026年06月15日至
 * - 06月15日 / 06-15 / 6/15（补当年）
 * - 今天过期 / 明天过期 / 后天过期 / 2026年6月15日前使用
 * - 有效期至2026-06-15 / 有效期至2026年6月15日 / 限2026年6月15日使用
 * - 仅限2026年6月15日当天使用
 */
function extractExpiryDate(text: string): string | undefined {
  if (!text) return undefined;

  const thisYear = new Date().getFullYear();
  const candidates: { date: string; score: number }[] = [];
  const today = todayYYYYMMDD();

  // 特殊处理：有效期范围格式 "2026.04.26-2029.04.26有效"
  // 这种格式中，第二个日期是到期日期
  const dateRangePattern = /(20\d{2})[-\/\.年](\d{1,2})[-\/\.月](\d{1,2})(?:日|号)?\s*[-~—–]\s*(20\d{2})[-\/\.年](\d{1,2})[-\/\.月](\d{1,2})(?:日|号)?\s*(有效|到期)/;
  const rangeMatch = text.match(dateRangePattern);
  if (rangeMatch) {
    const y = parseInt(rangeMatch[4], 10);
    const m = parseInt(rangeMatch[5], 10);
    const d = parseInt(rangeMatch[6], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const expiryDate = normalizeDate(y, m, d);
      // 有效期范围的结束日期置信度最高
      candidates.push({ date: expiryDate, score: 1.1 });
      return expiryDate; // 直接返回，优先级最高
    }
  }

  // 1. 相对日期：今天/明天/后天 + 过期
  const relativePattern = /(今天|今日|明天|明日|后天|昨日|昨天)\s*(?:\d{1,2}[:：]\d{1,2})?\s*(?:过期|到期|使用|有效|截止|前使用)/;
  const relativeMatch = text.match(relativePattern);
  if (relativeMatch) {
    const keyword = relativeMatch[1];
    const base = today;
    let rel = base;
    if (/明天|明日/.test(keyword)) rel = addDays(base, 1);
    else if (/后天/.test(keyword)) rel = addDays(base, 2);
    else if (/昨天|昨日/.test(keyword)) rel = addDays(base, -1);
    candidates.push({ date: rel, score: 0.7 });
  }

  // 2. 全文中明确带年的日期（高置信度）
  //    格式：2026-06-15 / 2026.06.15 / 2026/06/15 / 2026年6月15日
  const fullDatePattern = /(20\d{2})[-\/\.年](\d{1,2})[-\/\.月](\d{1,2})(?:日|号)?/g;
  let fm;
  while ((fm = fullDatePattern.exec(text)) !== null) {
    const y = parseInt(fm[1], 10);
    const m = parseInt(fm[2], 10);
    const d = parseInt(fm[3], 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) continue;
    const date = normalizeDate(y, m, d);
    // 检查是否在"有效期/过期/到期"等关键词附近
    const around = text.slice(Math.max(0, fm.index - 15), fm.index + fm[0].length + 15);
    // 关键词附近的日期置信度更高
    const hasKeyword = /(有效期|有效至|使用|到期|过期|截止|止|至|前使用|前有效)/.test(around);
    // 如果日期在今天之后，置信度更高
    const isFuture = date >= today;
    const score = hasKeyword ? (isFuture ? 1.0 : 0.8) : (isFuture ? 0.8 : 0.6);
    candidates.push({ date, score });
  }

  // 3. 短日期（无年）但有"过期/到期/有效期"等关键词
  //    格式：6月15日过期 / 06-15 使用 / 6/15 前使用
  const shortDatePattern = /(?:有效期|有效至|到期|过期|截止|使用|至|前)[^0-9\n]{0,15}(\d{1,2})[-\/\.月](\d{1,2})(?:日|号)?/;
  const sm = text.match(shortDatePattern);
  if (sm) {
    const m = parseInt(sm[1], 10);
    const d = parseInt(sm[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = normalizeDate(thisYear, m, d);
      candidates.push({ date, score: 0.9 });
    }
  }

  // 4. "X月X日 XX:XX 过期" 或 "X月X日 过期"
  const compactPattern = /(\d{1,2})[月\.\/-](\d{1,2})(?:日|号)?\s*(?:\d{1,2}[:：]\d{1,2})?\s*(过期|到期|有效|使用|截止)/;
  const cm = text.match(compactPattern);
  if (cm) {
    const m = parseInt(cm[1], 10);
    const d = parseInt(cm[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = normalizeDate(thisYear, m, d);
      candidates.push({ date, score: 0.85 });
    }
  }

  // 5. 兜底：全文找 "X月X日" 或 "XX-XX"（必须看起来像日期而非金额）
  if (candidates.length === 0) {
    const fallbackPattern = /(\d{1,2})[月\-\/](\d{1,2})(?:日|号)?/;
    const fm2 = text.match(fallbackPattern);
    if (fm2) {
      const m = parseInt(fm2[1], 10);
      const d = parseInt(fm2[2], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const date = normalizeDate(thisYear, m, d);
        candidates.push({ date, score: 0.6 });
      }
    }
  }

  if (candidates.length === 0) return undefined;

  // 排序策略：
  //   1. 先按置信度（score）从高到低
  //   2. 同置信度取"距离今天较远"的日期（通常是到期日，而非今天）
  //   3. 避免取过去的日期（除非别无选择）
  candidates.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.15) return b.score - a.score;
    // 高置信度的日期，取较晚的那个
    if (a.date >= today && b.date < today) return -1;
    if (a.date < today && b.date >= today) return 1;
    return b.date.localeCompare(a.date);
  });

  return candidates[0].date;
}

// ==================== 金额提取 ====================

/**
 * 提取券的面额信息（增强版）
 *
 * 支持：
 * - ¥20 / ￥20 / 20元 / 20.00元 / 20元优惠券
 * - 满30减20 / 满50减25
 * - 立减20 / 立减20元
 * - 5折 / 9.5折 / 85折
 * - 减至9.9元 / 0.01元兑换券
 */
function extractAmount(text: string): string | undefined {
  if (!text) return undefined;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 策略 A：优先找独立的 "X元" 或 "¥X" 或 "X元XXX券"
  //        这是优惠券最典型的呈现方式
  for (const line of lines) {
    // "38元 惊喜市集红包 去使用"
    const titleMoneyMatch = line.match(/^(\d+(?:\.\d+)?)\s*元\s+[\u4e00-\u9fa5]/);
    if (titleMoneyMatch) return `¥${titleMoneyMatch[1]}`;

    // "¥20 XXX" / "￥20 XXX"
    const symbolMatch = line.match(/^[¥￥]\s*(\d+(?:\.\d+)?)\s*/);
    if (symbolMatch) return `¥${symbolMatch[1]}`;

    // "减至9.9元 XXX" / "立减20元 XXX"
    const jianzhiMatch = line.match(/^(?:减至|立减|立省)\s*(\d+(?:\.\d+)?)\s*元?/);
    if (jianzhiMatch) return `¥${jianzhiMatch[1]}`;

    // 反向：名称在前，金额在后 "惊喜红包 38元"
    const reverseMatch = line.match(/[\u4e00-\u9fa5]{2,}\s+(\d+(?:\.\d+)?)\s*元\s*(?!.*\d)/);
    if (reverseMatch) return `¥${reverseMatch[1]}`;

    // 增强：匹配 "¥0.01元面值" 这种格式（京东E卡常见）
    const faceValueMatch = line.match(/[¥￥]\s*(\d+(?:\.\d+)?)\s*元\s*面值/);
    if (faceValueMatch) return `¥${faceValueMatch[1]}`;
  }

  // 策略 B：通用正则扫描全文
  // B1：满X减Y
  const manjian = text.match(/满\s*(\d+)\s*(?:元)?\s*(?:减|立减|减)\s*(\d+(?:\.\d+)?)/);
  if (manjian) return `满${manjian[1]}减${manjian[2]}`;

  // B2：立减X
  const lijian = text.match(/立减\s*(\d+(?:\.\d+)?)\s*元?/);
  if (lijian) return `立减${lijian[1]}元`;

  // B3：折扣（X折 / X.X折）
  const zheMatch = text.match(/(\d(?:\.\d)?)\s*折/);
  if (zheMatch) return `${zheMatch[1]}折`;

  // B4：直接 ¥ / ￥ + 数字（增强：支持小数点）
  const rmbMatch = text.match(/[¥￥]\s*(\d+(?:\.\d{1,2})?)/);
  if (rmbMatch) return `¥${rmbMatch[1]}`;

  // B5：末尾"X元"（非满减语境）
  const yuanMatch = text.match(/(\d+(?:\.\d{1,2})?)\s*元(?!.*可用)/);
  if (yuanMatch) return `¥${yuanMatch[1]}`;

  // B6：减至X元
  const jianzhi = text.match(/减至\s*(\d+(?:\.\d{1,2})?)\s*元?/);
  if (jianzhi) return `¥${jianzhi[1]}`;

  // B7：增强：匹配 "XX.XX元面值" 格式
  const faceValueMatch2 = text.match(/(\d+(?:\.\d{1,2})?)\s*元面值/);
  if (faceValueMatch2) return `¥${faceValueMatch2[1]}`;

  // B8：兜底：匹配任何看起来像金额的数字（带小数点优先）
  const anyMoneyMatch = text.match(/(\d+\.\d{1,2})\s*元/);
  if (anyMoneyMatch) return `¥${anyMoneyMatch[1]}`;

  return undefined;
}

// ==================== 平台识别 ====================

function extractPlatform(text: string): string | undefined {
  if (!text) return undefined;

  // 按优先级排序，优先匹配高优先级的
  const sorted = [...PLATFORM_KEYWORDS].sort((a, b) => a.priority - b.priority);
  for (const kw of sorted) {
    if (kw.pattern.test(text)) return kw.name;
  }

  // 兜底：小程序关键词（"XXX 小程序"）
  const miniAppMatch = text.match(/([\u4e00-\u9fa5A-Za-z]{2,})\s*小程序/);
  if (miniAppMatch) return miniAppMatch[1];

  return undefined;
}

// ==================== 名称提取 ====================

// 扩展 UI 黑名单 —— 这些内容绝不可能是券名
const UI_BLACKLIST: RegExp[] = [
  // 导航/返回
  /^(返回|首页|我的|列表|中心|卡券详情|详情页|返回首页|返回上一页|上一页|下一页|关闭)$/,
  // 会员卡包类
  /(会员卡|电子券|电子卡|卡包|钱包|票夹|会员中心)/,
  // 订单/消息
  /(订单|消息|购物车|账户|个人中心|登录|注册)/,
  // 规则/说明
  /(使用规则|适用门店|适用商品|使用渠道|使用场景|使用时段|券有效期|使用门槛|使用说明|限制支付|明细|详情|规则|更多)/,
  // 领取/使用类
  /(去使用|立即领取|立即使用|领取|使用|查看|详情|立即购买|购买|下单|兑换|预约)/,
  // 提示/通知类
  /(开启.*提醒|开启.*优惠|优惠券.*过期|优惠券.*到账|到账提醒|温馨提示|活动说明)/,
  // APP 常见碎片
  /(加载中|正在加载|暂无数据|暂无|暂无.*信息|全部|全部优惠券|优惠券列表|我的券包)/,
  // 纯英文/数字垃圾
  /^[A-Za-z0-9\s\-_.]{1,6}$/,
];

function looksLikeUI(text: string): boolean {
  const cleaned = text.trim().replace(/\s+/g, "");
  if (!cleaned) return true;
  for (const pattern of UI_BLACKLIST) {
    if (pattern.test(cleaned)) return true;
  }
  return false;
}

function isGoodName(candidate: string): boolean {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (trimmed.length < 2) return false;
  if (trimmed.length > 40) return false;

  // 必须包含至少一个中文字符
  if (!/[\u4e00-\u9fa5]/.test(trimmed)) return false;

  // 不是 UI 文案
  if (looksLikeUI(trimmed)) return false;

  // 英文/数字占比不能超过一半（过滤 OCR 识别出的图标碎片）
  const nonChinese = (trimmed.match(/[A-Za-z0-9]/g) || []).length;
  if (trimmed.length > 0 && nonChinese / trimmed.length > 0.5) return false;

  return true;
}

function cleanName(raw: string): string {
  let n = raw.trim();
  // 去掉前后的符号/空格
  n = n.replace(/^[\s\-\*\~\·\|\!\.\,\，\。\(\)\[\]<>«»]+/, "").replace(/[\s\-\*\~\·\|\!\.\,\，\。\(\)\[\]<>«»]+$/, "");
  // 去掉"去使用 / 立即领取"等按钮文案
  n = n.replace(/\s*(去使用|立即领取|立即使用|领取|使用|查看|规则|详情|兑换)$/, "");
  // 去掉末尾孤立英文碎片（OCR 把图标识别成 1-5 个英文字母）
  n = n.replace(/\s+[A-Za-z]{1,5}$/, "").trim();
  // 去掉前后引号
  n = n.replace(/^[\"''"`'"]+/, "").replace(/[\"''"`'"]+$/, "").trim();
  if (n.length > 40) n = n.slice(0, 40);
  return n;
}

/**
 * 识别券/红包名称（增强版）
 *
 * 策略顺序：
 * 1. "X元 YYYYY..." 开头（霸王茶姬、瑞幸等主流样式）
 * 2. "减至X元 YYYYY..." 或 "立减X元 YYYYY..."
 * 3. "YYYYY X元券" / "YYYYY X元红包" 样式
 * 4. 含 "券/红包/补贴" + 金额信号的行
 * 5. 含 "新人专享/限时特惠" 等关键词的行
 * 6. 兜底：根据平台 + 金额生成
 */
function extractName(text: string, platformHint?: string, amountHint?: string): string | undefined {
  if (!text) return undefined;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 策略 1-3：对每一行分析
  for (const line of lines) {
    // 1. "X元 YYYYY..."
    const m1 = line.match(/^\d+(?:\.\d+)?\s*元\s+(.+)/);
    if (m1) {
      const candidate = cleanName(m1[1]);
      if (isGoodName(candidate)) return candidate;
    }

    // 2. "减至/立减 X元 YYYYY..."
    const m2 = line.match(/^(减至|立减|立省)\s*\d+(?:\.\d+)?\s*元?\s+(.+)/);
    if (m2) {
      const candidate = cleanName(m2[2]);
      if (isGoodName(candidate)) return candidate;
    }

    // 3. "YYYYY X元 券/红包"
    const m3 = line.match(/^(.+?)\s+\d+(?:\.\d+)?\s*元\s*(券|红包|补贴)?$/);
    if (m3) {
      const candidate = cleanName(m3[1] + (m3[2] || ""));
      if (isGoodName(candidate)) return candidate;
    }

    // 4. "飞猪X元通用券" 这种整行格式
    const m4 = line.match(/^[\u4e00-\u9fa5A-Za-z]{2,}\s*\d+(?:\.\d+)?\s*元?\s*(?:通用|专用|限时|新人|专享|饮品|外卖|超市)?\s*券/);
    if (m4) {
      const candidate = cleanName(line);
      if (isGoodName(candidate)) return candidate;
    }
  }

  // 策略 5：含"券/红包/补贴" + 有中文信息的行
  for (const line of lines) {
    if (/(券|红包|补贴)/.test(line)) {
      const cleaned = cleanName(line);
      if (isGoodName(cleaned)) return cleaned;
    }
  }

  // 策略 6：含"新人专享/限时特惠/通用券"等强信号的行
  for (const line of lines) {
    if (/(新人专享|限时特惠|通用券|限时|限时使用|立即兑换|限时领取)/.test(line)) {
      const cleaned = cleanName(line);
      if (isGoodName(cleaned)) return cleaned;
    }
  }

  // 策略 7：兜底 —— 根据平台 + 金额生成合理名称
  if (platformHint || amountHint) {
    const amountNum = amountHint?.match(/\d+(?:\.\d+)?/);
    if (platformHint && amountNum) return `${platformHint} ${amountNum[0]}元券`;
    if (platformHint) return `${platformHint}红包`;
    if (amountNum) return `${amountNum[0]}元优惠券`;
  }

  // 最终兜底：从所有行中挑出"像券名"的最长一行
  const goodCandidates = lines.map(cleanName).filter(isGoodName).sort((a, b) => b.length - a.length);
  return goodCandidates[0];
}

// ==================== 备注提取 ====================

function extractNote(text: string): string | undefined {
  if (!text) return undefined;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const noteLines: string[] = [];
  const noteKeywords = /(满\d+元可用|全场可用|使用规则|适用门店|适用商品|使用渠道|使用时段|适用场景|券有效期|使用门槛|使用说明|限制支付|仅限堂食|仅限外卖|仅限自提|不可退换|每日限领|限领.*张|每人限领|数量有限)/;

  for (const line of lines) {
    if (noteKeywords.test(line)) {
      noteLines.push(line);
    }
  }

  if (noteLines.length === 0) return undefined;
  return noteLines.slice(0, 5).join("；");
}

// ==================== 主入口：单券解析 ====================

export function parseCouponText(rawText: string): ParseResult {
  // 对文本做基本清洗（去掉孤立英文碎片、UI符号）
  const cleanedText = rawText
    .split(/\r?\n/)
    .map(stripOcrNoise)
    .filter((l) => l && l.length > 1)
    .join("\n");

  const text = cleanedText || rawText;

  const platform = extractPlatform(text);
  const expiryDate = extractExpiryDate(text);
  const amount = extractAmount(text);
  const name = extractName(text, platform, amount);
  const note = extractNote(text);

  const result: ParseResult = {};
  if (name) result.name = name;
  if (platform) result.platform = platform;
  if (amount) result.amount = amount;
  if (expiryDate) result.expiryDate = expiryDate;
  if (note) result.note = note;
  return result;
}

// ==================== 表单合并 ====================

export function mergeToInput(
  current: CouponInput,
  parsed: ParseResult
): CouponInput {
  return {
    name: current.name?.trim() || parsed.name || "",
    platform: current.platform?.trim() || parsed.platform || "",
    amount: current.amount?.trim() || parsed.amount || "",
    expiryDate: current.expiryDate?.trim() || parsed.expiryDate || "",
    note: current.note?.trim() || parsed.note || "",
    code: current.code?.trim() || "",
    url: current.url?.trim() || "",
    tags: current.tags?.length ? current.tags : [],
  };
}

// ==================== 多券分割 ====================

export interface CouponCandidate {
  blockIndex: number;
  raw: string;
  parsed: ParseResult;
  summary: string;
}

// 常见 OCR 噪声清洗：图标碎片、孤立字母、导航符号等
function stripOcrNoise(line: string): string {
  if (!line) return line;
  let out = line
    // 导航符号
    .replace(/[<>\[\]()（）«»‹›→←↑↓↵↔■□★☆◆◇\*]+/g, " ")
    // 常见具体噪声
    .replace(/\b(AUH|EHR|Vv|co|c[oö]|AD|LINO|LUCK|LINE|LOGO|LLNO|LNO|ARAH|AHE|AUV|AIA|AVA|HEY|hey|HEYTEA)\b/gi, " ")
    // 孤立 1-2 个字母
    .replace(/\s[A-Za-z]\s/g, " ")
    .replace(/\s[A-Za-z]{2}\s/g, " ")
    // 行首/行尾的 1-5 个英文字母碎片
    .replace(/^[A-Za-z]{1,5}\s+/, " ")
    .replace(/\s+[A-Za-z]{1,5}$/, " ")
    // 引号残余
    .replace(/["''""`''"]/g, " ")
    // 多个空格压缩
    .replace(/\s{2,}/g, " ")
    .trim();

  // 二次清洗：去行首行尾的英文碎片
  out = out.replace(/^[A-Za-z]{1,3}\s*/, "").replace(/\s*[A-Za-z]{1,3}$/, "").trim();
  return out;
}

/**
 * 判断一行是否像"券卡标题行"
 * 规则：必须包含金额信号或券/红包关键字 + 中文名称
 */
function lineLooksLikeTitle(line: string): boolean {
  if (!line || line.length < 3) return false;

  const cleaned = stripOcrNoise(line);
  if (!cleaned || cleaned.length < 3) return false;

  // UI 黑名单先行过滤
  if (looksLikeUI(cleaned)) return false;

  // 正面信号
  // 1. "38元 ..." / "0.01元..."（金额在前）
  if (/^\d+(?:\.\d+)?\s*元\s/.test(cleaned)) return true;
  // 2. "减至/立减 X元..."
  if (/(减至|立减|立省)\s*\d+(?:\.\d+)?\s*元?/.test(cleaned)) return true;
  // 3. "XXX元券 / XXX元红包"
  if (/\d+(?:\.\d+)?\s*元?\s*(券|红包|补贴)/.test(cleaned)) return true;
  // 4. "满X减Y"
  if (/满\s*\d+\s*元?\s*[-减]\s*\d+\s*元?/.test(cleaned)) return true;
  // 5. 含 ¥/￥ 或 折 + 中文
  if (/[¥￥]\s*\d+/.test(cleaned) && /[\u4e00-\u9fa5]{2,}/.test(cleaned)) return true;
  if (/\d+\s*折/.test(cleaned) && /[\u4e00-\u9fa5]{2,}/.test(cleaned)) return true;
  // 6. 含"券/红包/补贴" + 金额数字 + 中文
  if (/(券|红包|补贴)/.test(cleaned) && /\d/.test(cleaned) && /[\u4e00-\u9fa5]{2,}/.test(cleaned)) return true;
  // 7. 京东E卡特殊格式："京东E卡" + 金额
  if (/京东.?[Ee]卡/.test(cleaned) && /[\d.]+/.test(cleaned)) return true;

  return false;
}

/**
 * 券卡分割器：找标题行 → 每个标题 + 周围上下文算一张券
 */
export function splitCouponBlocks(rawText: string): string[] {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l);
  if (lines.length <= 2) return [rawText];

  // 步骤 1：找"像券卡标题"的行
  const anchors: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lineLooksLikeTitle(lines[i])) anchors.push(i);
  }

  // 步骤 2：如果没有标题锚点，找包含日期 + 平台关键词的行作为锚点
  if (anchors.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const hasDate = /\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}|(\d{1,2})[月/](\d{1,2})/.test(lines[i]);
      const hasPlatform = PLATFORM_KEYWORDS.some((kw) => kw.pattern.test(lines[i]));
      if (hasDate || hasPlatform) anchors.push(i);
    }
  }

  // 步骤 3：还是没有 → 当作单张券处理
  if (anchors.length === 0) return [rawText];

  // 步骤 4：根据锚点切分文本块（每个锚点 + 前后 1-2 行上下文）
  anchors.sort((a, b) => a - b);

  const blocks: string[] = [];
  const seenBlocks = new Set<string>(); // 去重

  for (let k = 0; k < anchors.length; k++) {
    const anchor = anchors[k];
    // 范围：从当前锚点前 1 行（不跨过前一个锚点）到后 2 行（不跨过下一个锚点）
    const prevAnchor = k > 0 ? anchors[k - 1] : -1;
    const nextAnchor = k + 1 < anchors.length ? anchors[k + 1] : lines.length;

    const start = Math.max(prevAnchor + 1, anchor - 1, 0);
    const end = Math.min(nextAnchor - 1, anchor + 2, lines.length - 1);

    const block = lines.slice(start, end + 1).join("\n").trim();
    
    // 去重：检查是否已经添加过相似的块
    const blockHash = block.toLowerCase().replace(/\s+/g, "");
    if (block.length >= 10 && !seenBlocks.has(blockHash)) {
      blocks.push(block);
      seenBlocks.add(blockHash);
    }
  }

  return blocks.length > 0 ? blocks : [rawText];
}

export function parseMultipleCoupons(rawText: string): CouponCandidate[] {
  const blocks = splitCouponBlocks(rawText);

  const candidates: CouponCandidate[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const rawBlock = blocks[i];
    // 用清洗过的块解析
    const cleanedBlock = rawBlock
      .split(/\r?\n/)
      .map(stripOcrNoise)
      .filter((l) => l && l.length > 1)
      .join("\n");

    const parsed = parseCouponText(cleanedBlock || rawBlock);

    // 质量门槛：至少要有金额或日期或合理名称
    const hasAmount = !!parsed.amount;
    const hasDate = !!parsed.expiryDate;
    const hasGoodName = !!parsed.name && isGoodName(parsed.name);

    if (!(hasAmount || hasDate || hasGoodName)) continue;

    const title = parsed.name || (parsed.amount ? `${parsed.amount}红包` : `第 ${i + 1} 张券`);
    const parts: string[] = [];
    if (parsed.platform) parts.push(parsed.platform);
    if (parsed.amount) parts.push(parsed.amount);
    if (parsed.expiryDate) parts.push(`到期 ${parsed.expiryDate}`);
    const summary = `${title}${parts.length ? " · " + parts.join(" · ") : ""}`;
    candidates.push({ blockIndex: i, raw: rawBlock, parsed, summary });
  }
  return candidates;
}
