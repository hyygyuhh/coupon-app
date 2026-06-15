import type { Coupon } from "../types/coupon";

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