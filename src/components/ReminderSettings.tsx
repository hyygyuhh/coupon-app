import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Webhook, Key, Clock, FlaskConical, Lightbulb, Settings, AlertCircle, Download, FileJson, FileText, Calendar, Repeat, Cloud, CloudOff, RefreshCw, Upload, Check } from "lucide-react";
import ToggleSwitch from "./ToggleSwitch";
import {
  getReminderConfig,
  saveReminderConfig,
  testReminder,
  sendTestReminder,
  type ReminderConfig,
  type ReminderType,
  type ReminderTimeSlot,
} from "../utils/reminder";
import {
  getSyncConfig,
  saveSyncConfig,
  syncToCloud,
  restoreFromCloud,
  getSyncStatusText,
  type CloudSyncConfig,
} from "../utils/cloudSync";
import { useCouponStore } from "../store/couponStore";
import { exportAndDownload, importFromFile, type ImportResult } from "../utils/export";

function DingTalkIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="18" fill="#0089FF"/>
      <path d="M20 20 L16 30 L20 38 L24 30 L20 20" fill="white"/>
      <path d="M28 20 L24 30 L28 38 L32 30 L28 20" fill="white"/>
      <path d="M22 28 L24 32 L26 28" fill="#0089FF"/>
    </svg>
  );
}

function FeishuIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="feishu-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D6D9"/>
          <stop offset="100%" stopColor="#478DE0"/>
        </linearGradient>
        <linearGradient id="feishu-g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#478DE0"/>
          <stop offset="100%" stopColor="#6F8FF7"/>
        </linearGradient>
      </defs>
      <path d="M16 24 Q24 12 32 24" stroke="url(#feishu-g1)" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <path d="M12 30 Q24 18 36 30" stroke="url(#feishu-g2)" strokeWidth="7" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export default function ReminderSettings() {
  const [config, setConfig] = useState<ReminderConfig>(() => getReminderConfig());
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testReminderResult, setTestReminderResult] = useState<"success" | "error" | "no_coupons" | null>(null);
  const [testing, setTesting] = useState(false);
  const [testingReminder, setTestingReminder] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  
  // 数据导入状态
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<"success" | "error" | null>(null);
  const [importError, setImportError] = useState("");
  
  // 云同步状态
  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>(() => getSyncConfig());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<"success" | "error" | null>(null);
  
  const coupons = useCouponStore((state) => state.coupons);
  const setCoupons = useCouponStore((state) => state.setCoupons);

  const persist = useCallback((next: ReminderConfig) => {
    saveReminderConfig(next);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }, []);

  const handleEnabled = useCallback(() => {
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    persist(next);
  }, [config, persist]);

  const handleTypeChange = useCallback((type: ReminderType) => {
    const next = { ...config, type };
    setConfig(next);
    persist(next);
    setTestResult(null);
  }, [config, persist]);

  const handleTextChange = useCallback((key: "webhook" | "secret", value: string) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    persist(next);
  }, [config, persist]);

  const [reminderDaysInput, setReminderDaysInput] = useState(String(config.reminderDays));

  useEffect(() => {
    setReminderDaysInput(String(config.reminderDays));
  }, [config.reminderDays]);

  const handleDaysChange = useCallback((daysStr: string) => {
    setReminderDaysInput(daysStr);
    const parsed = parseInt(daysStr, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
      const next = { ...config, reminderDays: parsed };
      setConfig(next);
      persist(next);
    }
  }, [config, persist]);

  const handleDaysBlur = useCallback(() => {
    const parsed = parseInt(reminderDaysInput, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 30) {
      setReminderDaysInput(String(config.reminderDays));
    }
  }, [reminderDaysInput, config.reminderDays]);

  const handleTimeSlotChange = useCallback((timeSlot: ReminderTimeSlot) => {
    const next = { ...config, timeSlot };
    setConfig(next);
    persist(next);
  }, [config, persist]);

  const handleDailyReminderChange = useCallback(() => {
    const next = { ...config, dailyReminder: !config.dailyReminder };
    setConfig(next);
    persist(next);
  }, [config, persist]);

  const handleDailyReminderHourChange = useCallback((hourStr: string) => {
    const parsed = parseInt(hourStr, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
      const next = { ...config, dailyReminderHour: parsed };
      setConfig(next);
      persist(next);
    }
  }, [config, persist]);

  // 云同步处理函数
  const handleSyncEnabled = useCallback(() => {
    const next = { ...syncConfig, enabled: !syncConfig.enabled };
    setSyncConfig(next);
    saveSyncConfig(next);
  }, [syncConfig]);

  const handleSyncTokenChange = useCallback((value: string) => {
    const next = { ...syncConfig, token: value };
    setSyncConfig(next);
    saveSyncConfig(next);
  }, [syncConfig]);

  const handleSyncGistIdChange = useCallback((value: string) => {
    const next = { ...syncConfig, gistId: value };
    setSyncConfig(next);
    saveSyncConfig(next);
  }, [syncConfig]);

  const handleSyncToCloud = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    const success = await syncToCloud(coupons);
    setSyncResult(success ? "success" : "error");
    if (success) {
      setSyncConfig(getSyncConfig());
    }
    setSyncing(false);
  }, [coupons]);

  const handleRestoreFromCloud = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    const cloudCoupons = await restoreFromCloud();
    if (cloudCoupons) {
      setCoupons(cloudCoupons);
      setSyncResult("success");
      setSyncConfig(getSyncConfig());
    } else {
      setSyncResult("error");
    }
    setSyncing(false);
  }, [setCoupons]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportResult(null);
    setImportError("");
    
    const result = await importFromFile(file);
    
    if (result.success && result.coupons) {
      const existingIds = new Set(coupons.map(c => c.id));
      const newCoupons = result.coupons.filter(c => !existingIds.has(c.id));
      const updatedCoupons = [...coupons, ...newCoupons];
      setCoupons(updatedCoupons);
      setImportResult("success");
      if (newCoupons.length !== result.coupons.length) {
        setImportError(`跳过 ${result.coupons.length - newCoupons.length} 条重复数据`);
      }
    } else {
      setImportResult("error");
      setImportError(result.error || "导入失败");
    }
    
    setImporting(false);
    event.target.value = "";
  };

  const handleTest = async () => {
    if (!config.webhook) {
      setTestResult("error");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testReminder(config);
    setTestResult(result ? "success" : "error");
    setTesting(false);
  };

  const handleTestReminder = async () => {
    if (!config.webhook) {
      setTestReminderResult("error");
      return;
    }
    setTestingReminder(true);
    setTestReminderResult(null);
    
    const expiringCoupons = coupons.filter(c => {
      if (c.status !== "unused") return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(c.expiryDate);
      target.setHours(0, 0, 0, 0);
      const d = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return d >= 0 && d <= config.reminderDays;
    });
    
    if (expiringCoupons.length === 0) {
      setTestReminderResult("no_coupons");
      setTestingReminder(false);
      return;
    }
    
    const result = await sendTestReminder(coupons, config);
    setTestReminderResult(result ? "success" : "error");
    setTestingReminder(false);
  };

  const isDingTalk = config.type === "dingtalk";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-12">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-accent-ink flex items-center gap-3">
            <Settings className="w-7 h-7 text-accent-orange" />
            设置
          </h1>
          <p className="text-sm text-accent-inkMute mt-1">配置提醒方式和时间</p>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
            showSaved
              ? "bg-accent-green/20 text-accent-green scale-100 opacity-100"
              : "scale-90 opacity-0"
          }`}
        >
          ✓ 已保存
        </div>
      </div>

      {/* 主开关卡片 */}
      <div className="bg-white rounded-3xl p-5 shadow-card mb-4 border border-accent-grayLight/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                config.enabled ? "bg-accent-orange/20" : "bg-accent-grayLight"
              }`}
            >
              {config.enabled ? (
                <Bell className="w-6 h-6 text-accent-orange" />
              ) : (
                <BellOff className="w-6 h-6 text-accent-inkMute" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-accent-ink text-lg">过期提醒</h2>
              <p className="text-sm text-accent-inkMute">
                {config.enabled ? "已开启 · 每天自动提醒" : "已关闭"}
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={config.enabled}
            onChange={handleEnabled}
            size="lg"
            aria-label="过期提醒开关"
          />
        </div>
      </div>

      {/* 配置区域 - 仅在开启时显示 */}
      <div
        className={`transition-all duration-500 overflow-hidden ${
          config.enabled ? "opacity-100 max-h-[2000px]" : "opacity-0 max-h-0"
        }`}
      >
        {/* 提醒渠道 */}
        <div className="bg-white rounded-3xl p-5 shadow-card mb-4 border border-accent-grayLight/50">
          <h3 className="font-bold text-accent-ink mb-4 flex items-center gap-2">
            <Webhook className="w-5 h-5 text-accent-orange" />
            提醒渠道
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleTypeChange("dingtalk")}
              className={`relative p-4 rounded-2xl border-2 transition-all duration-200 ${
                isDingTalk
                  ? "border-[#0089FF] bg-[#0089FF]/5"
                  : "border-accent-grayLight hover:border-[#0089FF]/30 bg-paper"
              }`}
            >
              <div className="mb-2 flex justify-center">
                <DingTalkIcon className="w-10 h-10" />
              </div>
              <div className="font-bold text-accent-ink">钉钉</div>
              <div className="text-xs text-accent-inkMute mt-1">企业办公首选</div>
              {isDingTalk && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#0089FF] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
            <button
              onClick={() => handleTypeChange("feishu")}
              className={`relative p-4 rounded-2xl border-2 transition-all duration-200 ${
                !isDingTalk
                  ? "border-[#00D6D9] bg-[#00D6D9]/5"
                  : "border-accent-grayLight hover:border-[#00D6D9]/30 bg-paper"
              }`}
            >
              <div className="mb-2 flex justify-center">
                <FeishuIcon className="w-10 h-10" />
              </div>
              <div className="font-bold text-accent-ink">飞书</div>
              <div className="text-xs text-accent-inkMute mt-1">字节跳动出品</div>
              {!isDingTalk && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#00D6D9] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Webhook 配置 */}
        <div className="bg-white rounded-3xl p-5 shadow-card mb-4 border border-accent-grayLight/50">
          <h3 className="font-bold text-accent-ink mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-accent-orange" />
            机器人配置
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-accent-ink mb-2">
                Webhook 地址
              </label>
              <input
                type="text"
                value={config.webhook}
                onChange={(e) => handleTextChange("webhook", e.target.value)}
                placeholder={isDingTalk
                  ? "https://oapi.dingtalk.com/robot/send?access_token=..."
                  : "https://open.feishu.cn/open-apis/bot/v2/hook/..."
                }
                className="w-full px-4 py-3.5 bg-paper border border-accent-grayLight rounded-2xl text-accent-ink text-sm placeholder:text-accent-inkMute/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/30 focus:border-accent-orange transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent-ink mb-2">
                加签密钥
                <span className="text-accent-inkMute font-normal ml-1">（可选）</span>
              </label>
              <input
                type="password"
                value={config.secret}
                onChange={(e) => handleTextChange("secret", e.target.value)}
                placeholder="如启用签名验证，请填写密钥"
                className="w-full px-4 py-3.5 bg-paper border border-accent-grayLight rounded-2xl text-accent-ink text-sm placeholder:text-accent-inkMute/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/30 focus:border-accent-orange transition"
              />
            </div>
          </div>
        </div>

        {/* 提醒时间 */}
        <div className="bg-white rounded-3xl p-5 shadow-card mb-4 border border-accent-grayLight/50">
          <h3 className="font-bold text-accent-ink mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-orange" />
            提前提醒
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-accent-inkMute mb-2">优惠券到期前几天提醒</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={reminderDaysInput}
                  onChange={(e) => handleDaysChange(e.target.value)}
                  onBlur={handleDaysBlur}
                  className="w-20 px-3 py-2.5 bg-paper border border-accent-grayLight rounded-xl text-accent-ink text-center font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange/30 focus:border-accent-orange transition"
                />
                <span className="text-accent-inkMute">天</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 5, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDaysChange(String(d))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    config.reminderDays === d
                      ? "bg-accent-orange text-white shadow-md shadow-accent-orange/30 scale-105"
                      : "bg-paper text-accent-ink hover:bg-accent-orange/10 border border-accent-grayLight"
                  }`}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 提醒时段 */}
        <div className="bg-white rounded-3xl p-5 shadow-card mb-4 border border-accent-grayLight/50">
          <h3 className="font-bold text-accent-ink mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent-orange" />
            提醒时段
          </h3>
          <p className="text-sm text-accent-inkMute mb-4">选择接收提醒的时间段</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: "morning" as ReminderTimeSlot, label: "上午", desc: "7:00-12:00" },
              { value: "afternoon" as ReminderTimeSlot, label: "下午", desc: "12:00-18:00" },
              { value: "evening" as ReminderTimeSlot, label: "晚上", desc: "18:00-23:00" },
              { value: "any" as ReminderTimeSlot, label: "随时", desc: "任意时间" },
            ].map((slot) => (
              <button
                key={slot.value}
                onClick={() => handleTimeSlotChange(slot.value)}
                className={`p-3 rounded-xl text-center transition-all duration-200 ${
                  config.timeSlot === slot.value
                    ? "bg-accent-orange text-white shadow-md shadow-accent-orange/30"
                    : "bg-paper text-accent-ink hover:bg-accent-orange/10 border border-accent-grayLight"
                }`}
              >
                <div className="font-bold text-sm">{slot.label}</div>
                <div className={`text-xs mt-0.5 ${
                  config.timeSlot === slot.value ? "text-white/80" : "text-accent-inkMute"
                }`}>
                  {slot.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 每日提醒设置 */}
        <div className="bg-white rounded-3xl p-5 shadow-card mb-4 border border-accent-grayLight/50">
          <h3 className="font-bold text-accent-ink mb-4 flex items-center gap-2">
            <Repeat className="w-5 h-5 text-accent-orange" />
            每日提醒
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-ink">开启每日定时提醒</div>
                <div className="text-sm text-accent-inkMute mt-0.5">
                  {config.dailyReminder ? "每天在指定时间发送提醒" : "仅在优惠券添加/更新时提醒"}
                </div>
              </div>
              <ToggleSwitch
                checked={config.dailyReminder}
                onChange={handleDailyReminderChange}
                size="sm"
                aria-label="每日定时提醒开关"
              />
            </div>
            {config.dailyReminder && (
              <div className="flex items-center gap-3 pt-4 border-t border-accent-grayLight/50">
                <div className="text-sm text-accent-inkMute">提醒时间</div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={config.dailyReminderHour}
                    onChange={(e) => handleDailyReminderHourChange(e.target.value)}
                    className="w-16 px-3 py-2 bg-paper border border-accent-grayLight rounded-xl text-accent-ink text-center font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange/30 focus:border-accent-orange transition"
                  />
                  <span className="text-accent-ink">:00</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-2">
                  {[9, 12, 18, 21].map((h) => (
                    <button
                      key={h}
                      onClick={() => handleDailyReminderHourChange(String(h))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        config.dailyReminderHour === h
                          ? "bg-accent-orange text-white"
                          : "bg-paper text-accent-ink hover:bg-accent-orange/10"
                      }`}
                    >
                      {h}:00
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 测试连接 */}
        <div className="bg-white rounded-3xl p-5 shadow-card border border-accent-grayLight/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-accent-ink flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-accent-orange" />
                测试连接
              </h3>
              <p className="text-sm text-accent-inkMute mt-1">发送测试消息验证配置是否正确</p>
            </div>
            <button
              onClick={handleTest}
              disabled={!config.webhook || testing}
              className={`px-6 py-3 rounded-2xl font-bold transition-all duration-200 flex items-center gap-2 ${
                config.webhook && !testing
                  ? "bg-accent-orange hover:bg-accent-orange/90 text-white shadow-lg shadow-accent-orange/30 hover:scale-105"
                  : "bg-accent-grayLight text-accent-inkMute cursor-not-allowed"
              }`}
            >
              {testing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  发送中...
                </>
              ) : (
                <>发送测试</>
              )}
            </button>
          </div>
          {testResult && (
            <div
              className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${
                testResult === "success"
                  ? "bg-accent-green/10 text-accent-green"
                  : "bg-red-50 text-red-500"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                testResult === "success" ? "bg-accent-green" : "bg-red-500"
              }`}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {testResult === "success" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
              <span className="text-sm font-medium">
                {testResult === "success"
                  ? "测试成功！请检查群消息"
                  : "测试失败，请检查 Webhook 地址是否正确"
                }
              </span>
            </div>
          )}
        </div>

        {/* 测试过期提醒 */}
        <div className="bg-white rounded-3xl p-5 shadow-card border border-accent-grayLight/50 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-accent-ink flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-accent-orange" />
                测试过期提醒
              </h3>
              <p className="text-sm text-accent-inkMute mt-1">模拟发送即将过期优惠券的提醒消息</p>
            </div>
            <button
              onClick={handleTestReminder}
              disabled={!config.webhook || testingReminder}
              className={`px-6 py-3 rounded-2xl font-bold transition-all duration-200 flex items-center gap-2 ${
                config.webhook && !testingReminder
                  ? "bg-accent-orange hover:bg-accent-orange/90 text-white shadow-lg shadow-accent-orange/30 hover:scale-105"
                  : "bg-accent-grayLight text-accent-inkMute cursor-not-allowed"
              }`}
            >
              {testingReminder ? (
                <>
                  <span className="animate-spin">⏳</span>
                  发送中...
                </>
              ) : (
                <>发送提醒</>
              )}
            </button>
          </div>
          {testReminderResult && (
            <div
              className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${
                testReminderResult === "success"
                  ? "bg-accent-green/10 text-accent-green"
                  : testReminderResult === "no_coupons"
                  ? "bg-yellow-50 text-yellow-600"
                  : "bg-red-50 text-red-500"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                testReminderResult === "success" ? "bg-accent-green" : testReminderResult === "no_coupons" ? "bg-yellow-500" : "bg-red-500"
              }`}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {testReminderResult === "success" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  ) : testReminderResult === "no_coupons" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
              <span className="text-sm font-medium">
                {testReminderResult === "success"
                  ? "提醒测试成功！请检查群消息"
                  : testReminderResult === "no_coupons"
                  ? "没有即将过期的优惠券，无法测试提醒"
                  : "发送失败，请检查配置"
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 云同步设置 */}
      <div className="bg-white rounded-3xl p-5 shadow-card border border-accent-grayLight/50 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-accent-ink flex items-center gap-2">
            {syncConfig.enabled ? (
              <Cloud className="w-5 h-5 text-accent-blue" />
            ) : (
              <CloudOff className="w-5 h-5 text-accent-inkMute" />
            )}
            云同步
          </h3>
          <ToggleSwitch
            checked={syncConfig.enabled}
            onChange={handleSyncEnabled}
            size="sm"
            aria-label="云同步开关"
          />
        </div>
        <p className="text-sm text-accent-inkMute mb-4">
          开启后可将数据同步到 GitHub Gist，配合 GitHub Actions 实现每日定时提醒
        </p>
        
        <div
          className={`space-y-4 transition-all duration-300 ${
            syncConfig.enabled ? "opacity-100 max-h-[500px]" : "opacity-50 max-h-0 overflow-hidden"
          }`}
        >
          <div>
            <label className="block text-sm font-medium text-accent-ink mb-2">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={syncConfig.token}
              onChange={(e) => handleSyncTokenChange(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3.5 bg-paper border border-accent-grayLight rounded-2xl text-accent-ink text-sm placeholder:text-accent-inkMute/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/30 focus:border-accent-orange transition"
            />
            <p className="text-xs text-accent-inkMute mt-1">
              需要 Gist 权限，可在 GitHub Settings → Developer settings → Personal access tokens 生成
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-accent-ink mb-2">
              Gist ID
            </label>
            <input
              type="text"
              value={syncConfig.gistId}
              onChange={(e) => handleSyncGistIdChange(e.target.value)}
              placeholder="8a1b2c3d4e5f6g7h8i9j0k..."
              className="w-full px-4 py-3.5 bg-paper border border-accent-grayLight rounded-2xl text-accent-ink text-sm placeholder:text-accent-inkMute/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/30 focus:border-accent-orange transition"
            />
            <p className="text-xs text-accent-inkMute mt-1">
              Gist 创建后，URL 中的 ID 部分。例如 https://gist.github.com/user/<span className="font-mono bg-gray-100 px-1 rounded">这里就是Gist ID</span>
            </p>
          </div>
          
          {/* 同步状态和操作 */}
          <div className="flex items-center justify-between pt-4 border-t border-accent-grayLight/50">
            <div className="text-sm text-accent-inkMute flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              {getSyncStatusText(syncConfig)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSyncToCloud}
                disabled={!syncConfig.token || !syncConfig.gistId || syncing}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                  syncConfig.token && syncConfig.gistId && !syncing
                    ? "bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {syncing ? (
                  <><span className="animate-spin"><RefreshCw className="w-4 h-4" /></span> 同步中...</>
                ) : (
                  <><Upload className="w-4 h-4" /> 上传数据</>
                )}
              </button>
              <button
                onClick={handleRestoreFromCloud}
                disabled={!syncConfig.token || !syncConfig.gistId || syncing}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                  syncConfig.token && syncConfig.gistId && !syncing
                    ? "bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Download className="w-4 h-4" />
                恢复数据
              </button>
            </div>
          </div>
          
          {syncResult && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2 ${
                syncResult === "success"
                  ? "bg-accent-green/10 text-accent-green"
                  : "bg-red-50 text-red-500"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                syncResult === "success" ? "bg-accent-green" : "bg-red-500"
              }`}>
                {syncResult === "success" ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">
                {syncResult === "success" ? "同步成功！" : "同步失败，请检查配置"}
              </span>
            </div>
          )}
        </div>
        
        {/* 使用说明 */}
        <div className="mt-4 p-4 bg-blue-50 rounded-xl">
          <h4 className="font-medium text-accent-blue mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            如何启用每日自动提醒？
          </h4>
          <ol className="text-sm text-accent-blue/80 space-y-1 list-decimal list-inside">
            <li>在 GitHub 创建 Personal Access Token（需要 Gist 权限）</li>
            <li>创建一个新的 GitHub Gist，上传空的 coupons.json 和 reminder-status.json</li>
            <li>将 Token 和 Gist ID 填入上方配置</li>
            <li>点击「上传数据」测试同步是否成功</li>
            <li>在仓库设置中添加 secrets（GH_TOKEN, GIST_ID, FEISHU_WEBHOOK 等）</li>
          </ol>
        </div>
      </div>

      {/* 数据备份与导入 */}
      <div className="bg-white rounded-3xl p-5 shadow-card border border-accent-grayLight/50 mt-4">
        <h3 className="font-bold text-accent-ink mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-accent-orange" />
          数据备份与导入
        </h3>
        <p className="text-sm text-accent-inkMute mb-4">导出或导入优惠券数据，便于备份、迁移或恢复</p>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => exportAndDownload(coupons, { format: "json" })}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-blue/10 text-accent-blue rounded-xl font-medium hover:bg-accent-blue/20 transition-all duration-200"
          >
            <FileJson className="w-4 h-4" />
            导出 JSON
          </button>
          <button
            onClick={() => exportAndDownload(coupons, { format: "csv" })}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-green/10 text-accent-green rounded-xl font-medium hover:bg-accent-green/20 transition-all duration-200"
          >
            <FileText className="w-4 h-4" />
            导出 CSV
          </button>
        </div>
        
        <div className="border-t border-accent-grayLight/50 pt-4">
          <p className="text-sm text-accent-inkMute mb-3">从文件导入数据（支持 JSON 和 CSV 格式）</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-accent-orange/10 text-accent-orange rounded-xl font-medium hover:bg-accent-orange/20 transition-all duration-200 cursor-pointer">
              <Upload className="w-4 h-4" />
              选择文件导入
              <input
                type="file"
                accept=".json,.csv"
                onChange={handleImport}
                disabled={importing}
                className="hidden"
              />
            </label>
            {importing && (
              <span className="flex items-center gap-2 text-sm text-accent-inkMute">
                <span className="animate-spin">⏳</span> 导入中...
              </span>
            )}
          </div>
          
          {importResult && (
            <div
              className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${
                importResult === "success"
                  ? "bg-accent-green/10 text-accent-green"
                  : "bg-red-50 text-red-500"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                importResult === "success" ? "bg-accent-green" : "bg-red-500"
              }`}>
                {importResult === "success" ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="text-sm font-medium">
                {importResult === "success"
                  ? "导入成功！"
                  : importError}
                {importResult === "success" && importError && (
                  <span className="block text-xs opacity-80 mt-1">{importError}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="mt-6 p-5 bg-white/60 rounded-2xl border border-accent-grayLight/30">
        <h3 className="font-medium text-accent-ink mb-3 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-accent-orange" />
          如何获取机器人 Webhook
        </h3>
        <div className="text-sm text-accent-inkMute space-y-3">
          {isDingTalk ? (
            <ol className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-accent-blue/20 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>打开钉钉群 → 群设置 → 智能群助手 → 添加机器人</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-accent-blue/20 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>选择「自定义」机器人，安全设置勾选「加签」</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-accent-blue/20 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>复制 Webhook 地址和加签密钥到上方</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-accent-green/20 text-accent-green rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>打开飞书群 → 设置 → 群机器人 → 添加机器人</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-accent-green/20 text-accent-green rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>选择「自定义机器人」，可设置签名校验</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-accent-green/20 text-accent-green rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>复制 Webhook 地址到上方</span>
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
