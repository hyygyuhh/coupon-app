/**
 * 优惠券文本解析工具 v2
 * 支持: 霸王茶姬风格券卡片 + 支付宝/天猫红包风格卡片
 * 核心思路: 先定位"券卡锚点行"（含有"X元 + 名称 + 去使用"信号）→ 提取附近平台、日期
 */

import type { CouponInput } from "../types/coupon";

interface ParseResult {
  name?: string;
  platform?: string;
  amount?: string;
  expiryDate?: string; // YYYY-MM-DD
  note?: string;
}

// 平台/商家关键字（按匹配优先级排序）
const PLATFORM_KEYWORDS: [string, string][] = [
  // [识别词, 规范化展示名]
  ["霸王茶姬", "霸王茶姬"],
  ["霸王周边", "霸王周边"],
  ["茶姬", "霸王茶姬"],
  ["瑞幸咖啡", "瑞幸"],
  ["luckin", "瑞幸"],
  ["瑞幸", "瑞幸"],
  ["星巴克", "星巴克"],
  ["starbucks", "星巴克"],
  ["喜茶", "喜茶"],
  ["HEYTEA", "喜茶"],
  ["奈雪的茶", "奈雪"],
  ["奈雪", "奈雪"],
  ["蜜雪冰城", "蜜雪冰城"],
  ["蜜雪", "蜜雪冰城"],
  ["古茗", "古茗"],
  ["一点点", "一点点"],
  ["CoCo", "CoCo"],
  ["都可", "CoCo"],
  ["沪上阿姨", "沪上阿姨"],
  ["麦当劳", "麦当劳"],
  ["金拱门", "麦当劳"],
  ["mcdonald", "麦当劳"],
  ["肯德基", "肯德基"],
  ["KFC", "肯德基"],
  ["kfc", "肯德基"],
  ["全家", "全家"],
  ["family mart", "全家"],
  ["飞猪旅行", "飞猪"],
  ["飞猪", "飞猪"],
  ["天天秒杀", "天天秒杀"],
  ["京东", "京东"],
  ["JD", "京东"],
  ["淘宝", "淘宝"],
  ["天猫", "天猫"],
  ["拼多多", "拼多多"],
  ["pdd", "拼多多"],
  ["美团", "美团"],
  ["饿了么", "饿了么"],
  ["支付宝", "支付宝"],
  ["alipay", "支付宝"],
  ["微信", "微信"],
  ["weixin", "微信"],
  ["微信小程序", "微信"],
  ["抖音", "抖音"],
  ["抖音小程序", "抖音"],
];

// ============ 日期工具 ============

function normalizeDate(y: string, m: string, d: string): string {
  let year = parseInt(y, 10);
  if (year < 100) year += 2000;
  const month = parseInt(m, 10).toString().padStart(2, "0");
  const day = parseInt(d, 10).toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayYMD(): string {
  const t = new Date();
  return normalizeDate(String(t.getFullYear()), String(t.getMonth() + 1), String(t.getDate()));
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + days);
  return normalizeDate(String(t.getFullYear()), String(t.getMonth() + 1), String(t.getDate()));
}

/**
 * 从一段文本中识别到期日期。
 * 支持格式: 2026-06-15, 2026年06月15日, 06月15日(补当前年), 06-15, 今天/明天/后天+过期, X月X日23:59过期
 * 返回 YYYY-MM-DD
 */
function extractExpiryDate(text: string): string | undefined {
  if (!text) return undefined;

  const thisYear = new Date().getFullYear();
  const candidates: string[] = [];

  // 1) 相对日期: 今天/明天/后天 + 过期
  const relativeMatch = text.match(/(今天|明天|明日|后天|昨日|昨天)\s*(?:\d{1,2}[:：]\d{1,2})?\s*(?:过期|到期|使用)/);
  if (relativeMatch) {
    const keyword = relativeMatch[1];
    const base = todayYMD();
    let rel = base;
    if (/明天|明日/.test(keyword)) rel = addDays(base, 1);
    else if (/后天/.test(keyword)) rel = addDays(base, 2);
    else if (/昨天|昨日/.test(keyword)) rel = addDays(base, -1);
    candidates.push(rel);
  }

  // 2) 全文中明确带年的日期: 2026-06-15 / 2026年06月15日
  const fullPattern = /(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = fullPattern.exec(text)) !== null) {
    const around = text.slice(Math.max(0, m.index - 3), m.index + m[0].length + 3);
    // 排除 "2026-06-15 00:00:00~2026-06-15 23:59:59" 中的时间段数字 —— 都收，取最大
    if (/[:：](\d{1,2})/.test(around)) {
      // 带时间的日期，也收下
    }
    candidates.push(normalizeDate(m[1], m[2], m[3]));
  }

  // 3) 短日期: 06月15日 / 06-15 / 06/15 —— 必须靠近"过期/到期/有效期"
  const anchorPattern = /(?:有效期|到期|过期|截止)[^0-9\n]{0,10}(\d{1,2})[-\/.月](\d{1,2})(?!\s*(?:分|秒|:))/;
  const am = text.match(anchorPattern);
  if (am) {
    candidates.push(normalizeDate(String(thisYear), am[1], am[2]));
  }

  // 4) 另一类: "06月21日23:59过期" 这种日期+时间+过期连在一起
  const compact = text.match(/(\d{1,2})月(\d{1,2})(?:日|\s)?(?:\s*\d{1,2}[:：]\d{1,2})?\s*(过期|到期|有效)/);
  if (compact) {
    candidates.push(normalizeDate(String(thisYear), compact[1], compact[2]));
  }

  // 5) 兜底: 全文找 "X月X日" 格式 —— 不再匹配 "X-X"（避免 "满30-5元券" 这种金额被误当日期）
  if (candidates.length === 0) {
    const short = text.match(/(\d{1,2})月(\d{1,2})/);
    if (short) candidates.push(normalizeDate(String(thisYear), short[1], short[2]));
  }

  if (candidates.length === 0) return undefined;

  // 取最晚的日期（通常是到期日）
  candidates.sort((a, b) => b.localeCompare(a));
  return candidates[0];
}

// ============ 金额提取 ============

/**
 * 提取券的面额。对"38元"这种金额优先于"满39元可用"。
 * 策略: 先找最显眼的"大金额"（数字>=5或跟"红包"相关），避免把满减门槛误识别为面额。
 */
function extractAmount(text: string): string | undefined {
  if (!text) return undefined;

  // 优先: 独立的"X元"（不在"满X元"语境中）
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // 找 "X元 名称" 或 "名称 X元 去使用" 结构 —— 大金额放在券卡左侧
    // 例如: "38元 惊喜市集红包 去使用"
    const titlePattern = /^(\d+(?:\.\d+)?)\s*元\s*([\u4e00-\u9fa5A-Za-z][^去\n满]{2,})/;
    const m = line.match(titlePattern);
    if (m) return `¥${m[1]}`;

    // 另一方向: 名称在前，金额在末尾
    const rev = line.match(/([\u4e00-\u9fa5]{2,}(?:红)?包?)\s*(\d+(?:\.\d+)?)\s*元/);
    if (rev) return `¥${rev[2]}`;
  }

  // 然后尝试通用正则
  const patterns: RegExp[] = [
    /¥\s*(\d+(?:\.\d+)?)/,
    /￥\s*(\d+(?:\.\d+)?)/,
    /^(\d+(?:\.\d+)?)\s*元/m,
    /(\d+(?:\.\d+)?)\s*元\s*(?:[^满\n]{0,30}|红包|券|补贴|购物)/,
    /减至\s*(\d+(?:\.\d+)?)\s*元?/,
    /([1-9]\s*折)/,
    /(\d+(?:\.\d+)?)\s*折/,
    /满\s*(\d+)\s*减\s*(\d+)/,
    /立?减\s*(\d+(?:\.\d+)?)/,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (p.source.includes("满") && m[1] && m[2]) return `满${m[1]}减${m[2]}`;
      if (m[1]?.includes("折")) return m[1];
      return `¥${m[1]}`;
    }
  }
  return undefined;
}

// ============ 平台识别 ============

function extractPlatform(text: string): string | undefined {
  if (!text) return undefined;
  for (const [kw, name] of PLATFORM_KEYWORDS) {
    if (new RegExp(kw, "i").test(text)) return name;
  }
  // 小程序兜底
  const miniAppMatch = text.match(/([\u4e00-\u9fa5A-Za-z]+)\s*(?:小程序)/);
  if (miniAppMatch && miniAppMatch[1]) return miniAppMatch[1].trim();
  return undefined;
}

// ============ 名称提取 ============

function cleanName(raw: string): string {
  let n = raw
    .replace(/^[•\-\*★☆■□\s\.\,。]+/, "")
    // 常见的金额/OCR 前缀清洗
    // 正常写法: 减至/立减/立省/优惠至/超值至 / OCR误读: 央至
    .replace(/^(减至|央至|立减|立省|优惠至|超值至|特惠|限时|新人专享|新客专享)?\s*\d+(?:\.\d+)?\s*元?\s*/, "")
    .replace(/[•\-\*★☆■□\s\.\,。]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  // 去掉尾部 "去使用"、"立即领取" 等按钮文案
  n = n.replace(/\s*(去使用|立即领取|立即使用|领取|使用|查看|规则)$/, "");
  // 去掉开头的引号噪声
  n = n.replace(/^[\"''"`'"]+/, "").trim();
  if (n.length > 30) n = n.slice(0, 30);
  return n;
}

/**
 * 识别券/红包名称。策略顺序:
 * 1. "X元 YYYY 去使用" 风格（这张截图的主风格）
 * 2. 包含"券/红包/补贴"的行
 * 3. 含金额 + 汉字名行（例如"38元 惊喜市集红包"）
 * 4. 兜底: 平台+"红包/券"
 */
function extractName(text: string, platformHint?: string): string | undefined {
  if (!text) return undefined;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // 关键：OCR 经常在汉字之间加空格（如 "历史 优惠券 交换 优惠券 更多"）
  // 所以做黑名单判断时要先去空格
  const blacklist = /(商家券|膨胀券|历史优惠券|兑换优惠券|交换优惠券|全部优惠券|我的券|即将过期|最近领取|购买|去使用|立即领取|立即使用|规则|适用|门店|场景|渠道|商品|明细|满\d元|过期|到期|有效期|全场|可用|推荐好券|券后更划算|更多|返回|首页)/i;
  const linePassBlacklist = (line: string) => blacklist.test(line.replace(/\s+/g, ""));

  // 1. "X元 YYYYY..." 或 "减至X元 YYYYY..." 开头的行（主流格式）
  for (const line of lines) {
    const m1 = line.match(/^\d+(?:\.\d+)?\s*元\s+(.+)/);
    const m2 = line.match(/^减至\s*\d+(?:\.\d+)?\s*元?\s*(.+)/);
    const m = m1 || m2;
    if (m) {
      const candidate = cleanName(m[1]);
      if (candidate && !linePassBlacklist(candidate) && candidate.length >= 2) {
        return candidate;
      }
    }
    // 反向: YYYYY X元
    const m3 = line.match(/^(.+?)\s+\d+(?:\.\d+)?\s*元$/);
    if (m3) {
      const candidate = cleanName(m3[1]);
      if (candidate && !linePassBlacklist(candidate) && candidate.length >= 2 && candidate.length <= 20) {
        return candidate;
      }
    }
  }

  // 2. 含"券/红包/补贴"字
  for (const line of lines) {
    if (/(券|红包|补贴|购物红)/.test(line) && !linePassBlacklist(line)) {
      // 去掉可能尾随的 "去使用 / 规则"
      const cleaned = cleanName(line.replace(/\s+去使用.*$/, "").replace(/规则[>》]?\s*$/, ""));
      if (cleaned && cleaned.length >= 2) return cleaned;
    }
  }

  // 3. 含金额字且非纯时间金额行
  for (const line of lines) {
    if (/(元|¥|￥|折)/.test(line) && !linePassBlacklist(line)) {
      const cleaned = cleanName(line.replace(/^(减至|立减|立省|可抵用|央至)?[\d¥￥元\s\.％折]+/, ""));
      if (cleaned && cleaned.length >= 2) return cleaned;
    }
  }

  // 4. 兜底
  if (platformHint) return `${platformHint}红包`;
  const top = lines.slice(0, 3).sort((a, b) => b.length - a.length)[0];
  return top ? cleanName(top) : undefined;
}

// ============ 备注 ============

function extractNote(text: string): string | undefined {
  if (!text) return undefined;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const noteLines: string[] = [];
  for (const line of lines) {
    if (/(满\d+元可用|全场可用|使用规则|适用门店|适用商品|使用渠道|使用时段|适用场景|券有效期|使用门槛|使用说明|限制支付)/.test(line)) {
      noteLines.push(line);
    }
  }
  if (noteLines.length === 0) return undefined;
  return noteLines.slice(0, 6).join("；");
}

// ============ 主入口：单券解析 ============

export function parseCouponText(rawText: string): ParseResult {
  // 先对整段文本做 OCR 噪声清洗（每行单独清洗）
  const cleanedText = rawText
    .split(/\r?\n/)
    .map(stripOcrNoise)
    .filter((l) => l && l.length > 1)
    .join("\n");
  const text = cleanedText || rawText;

  const platform = extractPlatform(text);
  const expiryDate = extractExpiryDate(text);
  const amount = extractAmount(text);
  const name = extractName(text, platform);
  const note = extractNote(text);

  const result: ParseResult = {};
  if (name) result.name = name;
  if (platform) result.platform = platform;
  if (amount) result.amount = amount;
  if (expiryDate) result.expiryDate = expiryDate;
  if (note) result.note = note;
  return result;
}

// ============ 表单合并 ============

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

// ============ 多券分割 ============

export interface CouponCandidate {
  blockIndex: number;
  raw: string;
  parsed: ParseResult;
  summary: string;
}

/**
 * 券卡分割器 v2：
 * 1. 先清洗 OCR 行（去掉图标噪声字符，如 ARAHEFv/EHR/Vv/AD 等英文碎片）
 * 2. 找"平台标题行"（如"支付宝"、"天猫"）
 * 3. 找真正像券的标题行（必须有金额+名称，或明确的券/红包格式）
 * 4. 每张券紧取 ±1 行上下文，绝不跨相邻券
 */

// 常见 OCR 噪声 —— 图标、按钮被识别成的英文字母碎片
// 特征：2-5 个全大写字母；或 1-2 个随机小写字母
function stripOcrNoise(line: string): string {
  if (!line) return line;
  return line
    // 常见具体噪声（从截图反复出现的）
    .replace(/\b(ARAHEFv|EHR|Vv|co|c[oö]|AD|a|«[»]?|»|<|>)\b/gi, " ")
    // 孤立的 1-2 个字符（中英文混合的碎片）
    .replace(/\s[a-zA-Z]\s/g, " ")
    .replace(/\s[a-zA-Z]{2}\s/g, " ")
    // 引号等残余符号
    .replace(/[""''`"""]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 判断一行是否像"券卡标题行"。
 * 规则：必须包含金额信号 (¥/元/折/满X减Y) + 券/红包关键词 或 + 中文名称
 * 光有"券"字绝对不够（否则 UI 文案"优惠券列表"、"全部优惠券"都会被当成券）
 */
function lineLooksLikeTitle(line: string): boolean {
  if (!line) return false;

  // 先清洗 OCR 噪声再判断 —— 去掉 ARAHEFv/Vv/EHR/AD/co/a 等图标碎片
  const cleaned = stripOcrNoise(line);
  if (!cleaned || cleaned.length < 3) return false;

  // ======== 黑名单：这些是 APP UI 文案，绝不可能是券标题 ========
  const blacklistKeywords = [
    "我的券", "优惠券列表", "全部优惠券", "神券团购", "商家券", "膨胀券",
    "历史优惠券", "兑换优惠券", "交换优惠券", "最近领取", "即将过期", "购买",
    "推荐好券", "券后更划算", "去使用", "立即领取", "立即使用", "领取", "使用", "查看",
    "开启.*提醒", "开启.*优惠", "优惠券.*过期", "优惠券.*到账", "到账提醒",
    "适用门店", "适用商品", "使用渠道", "使用场景", "使用规则", "使用时段",
    "券有效期", "限制支付", "明细", "规则", "更多", "返回", "首页", "我的",
    "新客专享专享", "设置", "开启", "订阅", "切换", "列表",
    "会员卡", "票", "证件", "全部\\(\\d+\\)",
  ];
  const blacklist = new RegExp(blacklistKeywords.join("|"), "i");
  // 关键：OCR 经常在汉字之间加空格（如 "历史 优惠券 交换 优惠券 更多"）
  // 所以用去空格后的字符串做黑名单判断
  if (blacklist.test(cleaned.replace(/\s+/g, ""))) return false;

  // 含"满X元可用"这种满减门槛行，不是标题
  if (/^满\d+(?:\.\d+)?元?可?用/.test(cleaned)) return false;

  // ======== 正面信号：必须满足以下至少一项 ========

  // ① "38元 惊喜市集红包" / "0.01元饮品兑换券"（最常见格式）
  if (/^\d+(?:\.\d+)?\s*元\s*[\u4e00-\u9fa5A-Za-z]/.test(cleaned)) return true;

  // ② "减至0.01元 0.01元饮品兑换券" / "立减20元 XXX"
  if (/(减至|立减|立省)\s*\d+(?:\.\d+)?\s*元?/.test(cleaned)) return true;

  // ③ "飞猪2元通用券" / "XX专用券" / "XX限时券"  —— 有金额 + 券
  if (/\d+(?:\.\d+)?\s*元?\s*(通用|专用|限时|新人|专享|饮品|外卖|超市)?\s*券/.test(cleaned)) return true;

  // ④ 含 "红包" 且有金额数字（如：外卖红包、5元红包）
  if (/\d/.test(cleaned) && /红包|补贴/.test(cleaned)) return true;

  // ⑤ "满30减5元券" / "满50减20" 风格
  if (/满\s*\d+\s*(?:元)?\s*[-减]\s*\d+\s*(?:元)?\s*券?/.test(cleaned)) return true;

  // ⑥ 含 ¥/￥/折 数字 + 中文
  if (/[¥￥]\s*\d+/.test(cleaned) && /[\u4e00-\u9fa5]{2,}/.test(cleaned)) return true;
  if (/\d+\s*折/.test(cleaned) && /[\u4e00-\u9fa5]{2,}/.test(cleaned)) return true;

  // ⑦ 兜底：既有金额数字（元）又有券/红包 + 中文名称
  const hasAmount = /\d+\s*元|¥\s*\d+/.test(cleaned);
  const hasKeyword = /券|红包|补贴/.test(cleaned);
  const hasChinese = /[\u4e00-\u9fa5]{3,}/.test(cleaned);
  if (hasAmount && hasKeyword && hasChinese) return true;

  return false;
}

/**
 * 券卡分割器 v2：
 * 1. 先找所有"平台标题行"（如"支付宝"、"天猫"、"飞猪旅行"、"天天秒杀"）
 *    → 这种行通常出现在一个券组的最上方，作为分割参考
 * 2. 再在每个平台组内找"卡标题行"（X元 YYYYYY 或 XXX券 / XXX红包）
 * 3. 每张券取 3-4 行左右上下文（平台 + 标题 + 规则/过期）
 */
export function splitCouponBlocks(rawText: string): string[] {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l);

  // Step 0: 生成每行的"清洗版" —— 去掉 OCR 图标碎片后再做模式匹配
  // 原始 lines 保留用于最终切割（避免破坏日期等有价值信息）
  const cleanedLines = lines.map(stripOcrNoise);

  // Step 1: 找"平台标题行"（在 PLATFORM_KEYWORDS 中且该行短/像小标题）
  const platformIdx: { idx: number; name: string }[] = [];
  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];
    if (line.length > 15 || line.length < 2) continue;
    for (const [kw, name] of PLATFORM_KEYWORDS) {
      if (new RegExp(`^${kw}$`, "i").test(line) ||
          (new RegExp(kw, "i").test(line) && /^(支付宝|天猫|飞猪|飞猪旅行|天天秒杀|瑞幸|霸王茶姬|肯德基|麦当劳|喜茶|奈雪|奈雪的茶|蜜雪冰城|星巴克|全家|拼多多|京东|淘宝|美团|饿了么|微信|抖音)$/.test(line))) {
        platformIdx.push({ idx: i, name });
        break;
      }
    }
  }

  // Step 2: 找券标题行（每张卡的核心行）—— 用清洗后的行判断
  const titleIdx: number[] = [];
  for (let i = 0; i < cleanedLines.length; i++) {
    if (lineLooksLikeTitle(cleanedLines[i])) {
      if (titleIdx.length === 0 || i - titleIdx[titleIdx.length - 1] >= 1) {
        titleIdx.push(i);
      }
    }
  }

  // Step 3: 选"卡锚点"——优先用标题行；若标题行太少则补平台行 + 距离最近标题行
  const anchors: number[] = [];
  const used = new Set<number>();

  // 每个平台标题 + 下方最近的一个标题 = 一个券组
  if (titleIdx.length > 0) {
    for (const t of titleIdx) {
      if (used.has(t)) continue;
      used.add(t);
      anchors.push(t);
    }
  }

  // Step 4: 如果还是没锚点，找"满X元可用"的行作为线索（每张券卡都有这个）
  // 或 找平台行作为最后兜底
  if (anchors.length === 0) {
    const manuLines: number[] = [];
    for (let i = 0; i < cleanedLines.length; i++) {
      if (/满\d+(?:\.\d+)?元?可?用/.test(cleanedLines[i])) manuLines.push(i);
    }
    if (manuLines.length > 0) {
      for (const ml of manuLines) {
        // 往上找最近的标题候选或包含大金额的行
        for (let j = Math.max(0, ml - 2); j <= ml; j++) {
          if (lineLooksLikeTitle(cleanedLines[j]) || /\d+\s*元\s+[\u4e00-\u9fa5]{2,}/.test(cleanedLines[j])) {
            if (!used.has(j)) {
              used.add(j);
              anchors.push(j);
              break;
            }
          }
        }
      }
    }
    // 再兜底: 用平台行
    if (anchors.length === 0 && platformIdx.length > 0) {
      for (const p of platformIdx) anchors.push(p.idx);
    }
    anchors.sort((a, b) => a - b);
  }

  // Step 5: 根据锚点切分文本块
  if (anchors.length === 0) {
    return [rawText];
  }

  anchors.sort((a, b) => a - b);
  const blocks: string[] = [];

  // 只有1张券时：直接取整段文本（避免丢信息）
  if (anchors.length === 1) {
    return [rawText];
  }

  // 多张券：每个卡的典型结构是 "平台行 + 标题行 + 规则行"
  // 关键：范围不能太宽，否则会把相邻券的信息污染
  for (let k = 0; k < anchors.length; k++) {
    const anchor = anchors[k];
    const prevAnchor = k > 0 ? anchors[k - 1] : -1;
    const nextAnchor = k + 1 < anchors.length ? anchors[k + 1] : lines.length;

    // 往前：最多 1 行（找平台名），但不能跨过前一个锚点
    const platformLookBack = Math.max(prevAnchor + 1, anchor - 1);
    const start = platformLookBack;

    // 往后：最多 1 行规则行（如 "满39元可用 XX过期"），不能侵入下一张券
    const ruleLookForward = Math.min(nextAnchor - 1, anchor + 1);
    const end = ruleLookForward;

    const block = lines.slice(start, end + 1).join("\n").trim();
    if (block.length >= 15) blocks.push(block);
  }

  return blocks.length > 0 ? blocks : [rawText];
}

export function parseMultipleCoupons(rawText: string): CouponCandidate[] {
  const blocks = splitCouponBlocks(rawText);

  // 给每张券加质量门槛：解析结果必须有「金额 或 日期 或 名称」才保留
  const candidates: CouponCandidate[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const rawBlock = blocks[i];
    // 用清洗过的块解析字段信息（保留原始块用于查看/调试）
    const cleanedBlock = rawBlock
      .split(/\r?\n/)
      .map(stripOcrNoise)
      .filter((l) => l && l.length > 1)
      .join("\n");

    const parsed = parseCouponText(cleanedBlock || rawBlock);

    // 质量门槛：至少要有金额 或 过期日期；或者有名称且名称不空洞
    const hasAmount = !!parsed.amount;
    const hasDate = !!parsed.expiryDate;
    const hasGoodName =
      !!parsed.name &&
      parsed.name.length >= 3 &&
      !/^(优惠券|券列表|全部券|历史券|我的券|领取|使用|更多)$/.test(parsed.name);

    if (!(hasAmount || hasDate || hasGoodName)) continue;

    const title =
      parsed.name || (parsed.amount ? `${parsed.amount}红包` : `第 ${i + 1} 张券`);
    const parts: string[] = [];
    if (parsed.platform) parts.push(parsed.platform);
    if (parsed.amount) parts.push(parsed.amount);
    if (parsed.expiryDate) parts.push(`到期 ${parsed.expiryDate}`);
    const summary = `${title}${parts.length ? " · " + parts.join(" · ") : ""}`;
    candidates.push({ blockIndex: i, raw: rawBlock, parsed, summary });
  }
  return candidates;
}
