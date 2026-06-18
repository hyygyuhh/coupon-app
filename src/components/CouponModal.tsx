import { useEffect, useState, useCallback } from "react";
import { Camera, Check, Copy, X, AlertCircle, Loader2 } from "lucide-react";
import type { Coupon, CouponInput } from "../types/coupon";
import { recognizeImage, subscribeOCRStatus, getOCRStatus, type OCREngineStatus } from "../utils/ocrService";
import {
  mergeToInput,
  parseMultipleCoupons,
  type CouponCandidate,
} from "../utils/ocrParser";
import { VALIDATION_MESSAGES } from "../utils/constants";

interface Props {
  open: boolean;
  coupon?: Coupon | null;
  onClose: () => void;
  onSave: (input: CouponInput, id?: string) => void;
}

const empty: CouponInput = {
  name: "",
  platform: "",
  code: "",
  url: "",
  amount: "",
  expiryDate: "",
  tags: [],
  note: "",
};

const STATUS_ZH: Record<string, string> = {
  "loading tesseract core": "加载识别引擎",
  "initializing tesseract": "初始化中",
  "loading language traineddata": "下载语言包",
  "initializing api": "加载字库",
  "recognizing text": "正在识别文字",
};

export default function CouponModal({ open, coupon, onClose, onSave }: Props) {
  const [form, setForm] = useState<CouponInput>(empty);
  const [tagsInput, setTagsInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof CouponInput, string>>>({});

  // OCR 相关状态
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("准备中");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  // 多券候选
  const [candidates, setCandidates] = useState<CouponCandidate[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  // OCR 引擎预加载状态
  const [engineStatus, setEngineStatus] = useState<OCREngineStatus>(() => getOCRStatus().status);
  const [engineProgress, setEngineProgress] = useState(() => getOCRStatus().progress);
  const [engineStatusText, setEngineStatusText] = useState(() => getOCRStatus().statusText);

  useEffect(() => {
    const unsub = subscribeOCRStatus(() => {
      const s = getOCRStatus();
      setEngineStatus(s.status);
      setEngineProgress(s.progress);
      setEngineStatusText(s.statusText);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (open) {
      if (coupon) {
        setForm({
          name: coupon.name,
          platform: coupon.platform,
          code: coupon.code || "",
          url: coupon.url || "",
          amount: coupon.amount || "",
          expiryDate: coupon.expiryDate,
          tags: [...(coupon.tags || [])],
          note: coupon.note || "",
        });
        setTagsInput((coupon.tags || []).join(", "));
      } else {
        setForm(empty);
        setTagsInput("");
      }
      // 每次打开重置 OCR 状态
      setOcrLoading(false);
      setOcrProgress(0);
      setOcrStatus("准备中");
      setPreviewUrl(null);
      setOcrText("");
      setShowRaw(false);
      setOcrError(null);
      setCandidates([]);
      setActiveIdx(-1);
    }
  }, [open, coupon]);

  if (!open) return null;

  const update = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CouponInput, string>> = {};
    if (!form.name.trim()) newErrors.name = VALIDATION_MESSAGES.REQUIRED;
    if (!form.platform.trim()) newErrors.platform = VALIDATION_MESSAGES.REQUIRED;
    if (!form.expiryDate) newErrors.expiryDate = VALIDATION_MESSAGES.REQUIRED;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = () => {
    if (!validateForm()) return;
    const tags = tagsInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({ ...form, tags }, coupon?.id);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 重置，便于同一文件再次选择
    if (!file) return;
    runOCR(file);
  };

  const runOCR = async (file: File) => {
    setOcrError(null);
    setOcrLoading(true);
    setOcrProgress(0.02);
    setOcrStatus("读取图片");
    setShowRaw(false);
    setCandidates([]);
    setActiveIdx(-1);

    // 预览
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch {
      setPreviewUrl(null);
    }

    try {
      const result = await recognizeImage(file, (p, status) => {
        setOcrProgress(p);
        setOcrStatus(STATUS_ZH[status] || status);
      });
      setOcrText(result.text);

      const list = parseMultipleCoupons(result.text);
      setCandidates(list);

      if (list.length === 0) {
        setOcrError("未识别到有效的券信息，可手动填写");
      } else if (list.length === 1) {
        // 单张券：自动填表单
        const merged = mergeToInput(form, list[0].parsed);
        setForm(merged);
        if (list[0].parsed.platform && !tagsInput) {
          setTagsInput(list[0].parsed.platform);
        }
        setActiveIdx(0);
      } else {
        // 多张券：选第一张预填，但展示所有候选让用户切换
        const merged = mergeToInput(form, list[0].parsed);
        setForm(merged);
        if (list[0].parsed.platform && !tagsInput) {
          setTagsInput(list[0].parsed.platform);
        }
        setActiveIdx(0);
      }
    } catch (err: any) {
      console.error("OCR 识别失败:", err);
      setOcrError(err?.message || "识别失败，请手动填写");
    } finally {
      setOcrLoading(false);
    }
  };

  const copyRaw = async () => {
    if (!ocrText) return;
    try {
      await navigator.clipboard.writeText(ocrText);
      alert("已复制识别文本");
    } catch {
      alert("复制失败");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-accent-ink/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-cream dark:bg-[#2d2d44] rounded-3xl shadow-cardHover w-full max-w-lg max-h-[90vh] overflow-y-auto animate-floatUp transition-colors duration-300">
        <div className="sticky top-0 z-10 bg-cream dark:bg-[#2d2d44] border-b border-accent-orangeLight/40 dark:border-white/10 px-6 py-4 flex items-center justify-between transition-colors">
          <h3 className="font-display text-2xl font-bold text-accent-ink dark:text-white transition-colors">
            {coupon ? "编辑券" : "添加新券"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-paper dark:hover:bg-white/10 flex items-center justify-center text-accent-ink dark:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* —— 图片识别区 —— */}
        {!coupon && (
          <div className="mx-6 mt-5 rounded-2xl border-2 border-dashed border-accent-orangeLight dark:border-accent-orange/40 bg-white dark:bg-[#252538] p-4 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-bold text-accent-ink dark:text-white text-sm transition-colors">
                  📷 上传截图自动识别
                </div>
                <div className="text-xs text-accent-inkMute dark:text-gray-400 mt-0.5 transition-colors">
                  {engineStatus === "ready"
                    ? "识别引擎已就绪，选择图片即可识别"
                    : engineStatus === "loading"
                      ? "首次使用需下载语言包，请稍候…"
                      : "支持手机截图，首次使用需下载中文语言包"}
                </div>
              </div>
              <label
                htmlFor="coupon-image-input"
                className={`flex items-center gap-1.5 bg-accent-orange text-white px-4 py-2 rounded-full text-sm font-bold shadow-card hover:bg-accent-orange/90 transition active:scale-95 select-none ${
                  ocrLoading || engineStatus === "loading" ? "opacity-60 pointer-events-none" : "cursor-pointer"
                }`}
              >
                {ocrLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : engineStatus === "loading" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
                {ocrLoading ? "识别中…" : engineStatus === "loading" ? "引擎加载中…" : "选择图片"}
              </label>
              <input
                id="coupon-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
            </div>

            {/* 引擎加载进度条 */}
            {engineStatus === "loading" && !ocrLoading && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-accent-inkMute dark:text-gray-400 mb-1 transition-colors">
                  <span>{engineStatusText}</span>
                  <span>{Math.round(engineProgress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-paper dark:bg-[#1a1a2e] rounded-full overflow-hidden transition-colors">
                  <div
                    className="h-full bg-accent-orange/70 transition-all duration-300"
                    style={{ width: `${Math.round(engineProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* 识别进度条 */}
            {ocrLoading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-accent-inkMute dark:text-gray-400 mb-1 transition-colors">
                  <span>{ocrStatus}</span>
                  <span>{Math.round(ocrProgress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-paper dark:bg-[#1a1a2e] rounded-full overflow-hidden transition-colors">
                  <div
                    className="h-full bg-accent-orange transition-all"
                    style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* 识别结果 / 错误 */}
            {ocrError && (
              <div className="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-500/20 rounded-lg p-2 transition-colors">
                {ocrError}
              </div>
            )}

            {previewUrl && !ocrError && candidates.length > 0 && (
              <div className="mt-4">
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={previewUrl}
                    alt="预览"
                    className="w-16 h-16 object-cover rounded-xl border border-accent-orangeLight/60 dark:border-white/10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-accent-inkMute dark:text-gray-400 transition-colors">
                      共识别到 <b className="text-accent-orange">{candidates.length}</b> 张券
                      {candidates.length > 1 ? "，点击卡片切换" : "，请核对下方字段"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRaw((s) => !s)}
                      className="text-xs font-bold text-accent-orange hover:underline mt-1"
                    >
                      {showRaw ? "隐藏" : "查看"}原始识别文本
                    </button>
                  </div>
                </div>

                {candidates.length > 1 && (
                  <div className="space-y-2">
                    {candidates.map((c, i) => {
                      const active = i === activeIdx;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setActiveIdx(i);
                            // 切换候选券时：先重置表单，再用新券的数据填充
                            const merged = mergeToInput(empty, c.parsed);
                            setForm(merged);
                            setTagsInput(c.parsed.platform || "");
                          }}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                            active
                              ? "border-accent-orange bg-accent-orange/10 dark:bg-accent-orange/20 shadow-card"
                              : "border-accent-orangeLight/60 dark:border-white/10 bg-white dark:bg-[#252538] hover:border-accent-orange hover:bg-paper dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                                active
                                  ? "bg-accent-orange text-white"
                                  : "bg-paper dark:bg-[#1a1a2e] text-accent-ink dark:text-white"
                              }`}
                            >
                              {active ? <Check size={12} strokeWidth={3} /> : i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-accent-ink dark:text-white truncate transition-colors">
                                {c.parsed.name || `第 ${i + 1} 张券`}
                              </div>
                              <div className="text-xs text-accent-inkMute dark:text-gray-400 mt-0.5 truncate transition-colors">
                                {[
                                  c.parsed.platform,
                                  c.parsed.amount,
                                  c.parsed.expiryDate && `到期 ${c.parsed.expiryDate}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {showRaw && (
                  <div className="mt-3 bg-paper dark:bg-[#1a1a2e] rounded-xl p-2 text-[11px] text-accent-ink dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto border border-accent-orangeLight/40 dark:border-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-accent-inkMute dark:text-gray-400">原始文本</span>
                      <button
                        type="button"
                        onClick={copyRaw}
                        className="text-accent-orange hover:underline flex items-center gap-1"
                      >
                        <Copy size={12} /> 复制
                      </button>
                    </div>
                    {ocrText}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* —— 表单字段 —— */}
        <div className="px-6 py-5 space-y-4">
          <Field label="券名称 *" error={errors.name}>
            <input
              className={`input ${errors.name ? "input-error" : ""}`}
              placeholder="例如：瑞幸咖啡免单券"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="平台 / 商家 *" error={errors.platform}>
              <input
                className={`input ${errors.platform ? "input-error" : ""}`}
                placeholder="例如：瑞幸 / 淘宝"
                value={form.platform}
                onChange={(e) => update("platform", e.target.value)}
              />
            </Field>
            <Field label="面额 / 描述">
              <input
                className="input"
                placeholder="例如：¥20 或 5折"
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
              />
            </Field>
          </div>

          <Field label="过期日期 *" error={errors.expiryDate}>
            <input
              type="date"
              className={`input ${errors.expiryDate ? "input-error" : ""}`}
              value={form.expiryDate}
              onChange={(e) => update("expiryDate", e.target.value)}
            />
          </Field>

          <Field label="券码 / 兑换码（可选）">
            <input
              className="input tracking-wider"
              placeholder="例如：WOOL-2025"
              value={form.code}
              onChange={(e) => update("code", e.target.value)}
            />
          </Field>

          <Field label="使用链接（可选）">
            <input
              className="input"
              placeholder="https://..."
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
            />
          </Field>

          <Field label="标签（可选，逗号分隔）">
            <input
              className="input"
              placeholder="餐饮, 免单, 生活用品"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </Field>

          <Field label="备注（可选）">
            <textarea
              className="input min-h-[72px] resize-none"
              placeholder="例如：满30可用，仅限堂食"
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
            />
          </Field>
        </div>

        <div className="sticky bottom-0 bg-cream dark:bg-[#2d2d44] border-t border-accent-orangeLight/40 dark:border-white/10 px-6 py-4 flex justify-end gap-3 transition-colors">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 sm:px-5 sm:py-2 rounded-full font-bold text-accent-ink dark:text-white bg-paper dark:bg-[#252538] hover:bg-accent-orangeLight/40 dark:hover:bg-white/10 transition min-h-[48px] sm:min-h-auto"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            className="px-6 py-3 sm:px-5 sm:py-2 rounded-full font-bold text-white bg-accent-orange hover:bg-accent-orange/90 shadow-card transition active:scale-95 min-h-[48px] sm:min-h-auto"
          >
            {coupon ? "保存修改" : "添加券"}
          </button>
        </div>
      </div>


    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-accent-inkMute dark:text-gray-400 mb-1.5 transition-colors">
        {label}
      </span>
      {children}
      {error && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-500/20 rounded-lg px-2 py-1.5 transition-colors">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </label>
  );
}
