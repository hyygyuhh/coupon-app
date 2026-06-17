import type { Coupon, CouponStatus } from "../types/coupon";

export interface ExportOptions {
  format: "json" | "csv";
  includeUsed?: boolean;
  includeExpired?: boolean;
}

export function exportCoupons(
  coupons: Coupon[],
  options: ExportOptions = { format: "json", includeUsed: true, includeExpired: true }
): string {
  let filtered = coupons;
  
  if (!options.includeUsed) {
    filtered = filtered.filter(c => c.status !== "used");
  }
  if (!options.includeExpired) {
    filtered = filtered.filter(c => c.status !== "expired");
  }

  if (options.format === "csv") {
    return toCSV(filtered);
  }
  
  return toJSON(filtered);
}

function toJSON(coupons: Coupon[]): string {
  return JSON.stringify(coupons, null, 2);
}

function toCSV(coupons: Coupon[]): string {
  const headers = ["名称", "平台", "面额", "过期日期", "状态", "券码", "链接", "标签", "备注", "创建时间"];
  
  const rows = coupons.map(c => [
    escapeCSV(c.name),
    escapeCSV(c.platform),
    escapeCSV(c.amount || ""),
    c.expiryDate,
    statusToText(c.status),
    escapeCSV(c.code || ""),
    escapeCSV(c.url || ""),
    escapeCSV((c.tags || []).join(",")),
    escapeCSV(c.note || ""),
    c.createdAt,
  ]);
  
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function statusToText(status: string): string {
  const map: Record<string, string> = {
    unused: "未使用",
    used: "已使用",
    expired: "已过期",
  };
  return map[status] || status;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAndDownload(
  coupons: Coupon[],
  options: ExportOptions = { format: "json", includeUsed: true, includeExpired: true }
): void {
  const content = exportCoupons(coupons, options);
  const ext = options.format === "csv" ? "csv" : "json";
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `coupons-${timestamp}.${ext}`;
  const mimeType = options.format === "csv" 
    ? "text/csv;charset=utf-8" 
    : "application/json;charset=utf-8";
  downloadFile(content, filename, mimeType);
}

export interface ImportResult {
  success: boolean;
  coupons?: Coupon[];
  error?: string;
  count?: number;
}

export function importCoupons(content: string, format: "json" | "csv"): ImportResult {
  try {
    if (format === "json") {
      return importFromJSON(content);
    } else {
      return importFromCSV(content);
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "导入失败" };
  }
}

function importFromJSON(content: string): ImportResult {
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    return { success: false, error: "JSON 格式错误，应为数组" };
  }
  
  const coupons: Coupon[] = [];
  for (const item of parsed) {
    const coupon = parseCoupon(item);
    if (coupon) {
      coupons.push(coupon);
    }
  }
  
  if (coupons.length === 0) {
    return { success: false, error: "未找到有效的优惠券数据" };
  }
  
  return { success: true, coupons, count: coupons.length };
}

function importFromCSV(content: string): ImportResult {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return { success: false, error: "CSV 格式错误，至少需要标题行和数据行" };
  }
  
  const headers = lines[0].split(",").map((h) => h.trim());
  const nameIndex = headers.findIndex((h) => h.includes("名称") || h.includes("name"));
  const platformIndex = headers.findIndex((h) => h.includes("平台") || h.includes("platform"));
  const expiryIndex = headers.findIndex((h) => h.includes("过期") || h.includes("expiry") || h.includes("date"));
  
  if (nameIndex === -1 || expiryIndex === -1) {
    return { success: false, error: "CSV 缺少必要的列（名称、过期日期）" };
  }
  
  const coupons: Coupon[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const name = values[nameIndex];
    const expiryDate = values[expiryIndex];
    
    if (!name || !expiryDate) continue;
    
    const coupon: Coupon = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + i,
      name,
      platform: platformIndex >= 0 ? values[platformIndex] : "",
      amount: values[headers.findIndex((h) => h.includes("面额") || h.includes("amount"))] || undefined,
      code: values[headers.findIndex((h) => h.includes("券码") || h.includes("code"))] || undefined,
      url: values[headers.findIndex((h) => h.includes("链接") || h.includes("url"))] || undefined,
      tags: parseTags(values[headers.findIndex((h) => h.includes("标签") || h.includes("tags"))]),
      note: values[headers.findIndex((h) => h.includes("备注") || h.includes("note"))] || undefined,
      expiryDate: parseDate(expiryDate),
      status: parseStatus(values[headers.findIndex((h) => h.includes("状态") || h.includes("status"))]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    coupons.push(coupon);
  }
  
  if (coupons.length === 0) {
    return { success: false, error: "未找到有效的优惠券数据" };
  }
  
  return { success: true, coupons, count: coupons.length };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseCoupon(item: unknown): Coupon | null {
  if (typeof item !== "object" || item === null) return null;
  
  const obj = item as Record<string, unknown>;
  
  if (typeof obj.name !== "string" || typeof obj.expiryDate !== "string") {
    return null;
  }
  
  const statusValue = typeof obj.status === "string" ? obj.status : "unused";
  const validStatus: CouponStatus = 
    statusValue === "used" || statusValue === "expired" ? statusValue : "unused";
  
  return {
    id: typeof obj.id === "string" ? obj.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: obj.name as string,
    platform: typeof obj.platform === "string" ? obj.platform : "",
    amount: typeof obj.amount === "string" ? obj.amount : undefined,
    code: typeof obj.code === "string" ? obj.code : undefined,
    url: typeof obj.url === "string" ? obj.url : undefined,
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t) => typeof t === "string") : undefined,
    note: typeof obj.note === "string" ? obj.note : undefined,
    expiryDate: obj.expiryDate as string,
    status: validStatus,
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString(),
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString(),
  };
}

function parseTags(tagStr?: string): string[] | undefined {
  if (!tagStr) return undefined;
  return tagStr.split(",").map((t) => t.trim()).filter(Boolean);
}

function parseDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString().split("T")[0];
  }
  return parsed.toISOString().split("T")[0];
}

function parseStatus(statusStr?: string): CouponStatus {
  if (!statusStr) return "unused";
  const lower = statusStr.toLowerCase();
  if (lower.includes("已使用") || lower.includes("used") || lower.includes("used")) return "used";
  if (lower.includes("已过期") || lower.includes("expired")) return "expired";
  return "unused";
}

export async function importFromFile(file: File): Promise<ImportResult> {
  const content = await file.text();
  const ext = file.name.split(".").pop()?.toLowerCase();
  
  if (ext === "json") {
    return importCoupons(content, "json");
  } else if (ext === "csv") {
    return importCoupons(content, "csv");
  } else {
    return { success: false, error: "不支持的文件格式，仅支持 JSON 和 CSV" };
  }
}