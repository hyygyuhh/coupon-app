import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Webhook, Key, Clock, FlaskConical, Lightbulb, Settings } from "lucide-react";
import {
  getReminderConfig,
  saveReminderConfig,
  testReminder,
  type ReminderConfig,
  type ReminderType,
} from "../utils/reminder";

// 钉钉官方图标
function DingTalkIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="16" fill="#0089FF"/>
      <path d="M18 20h4v8h-4v-8zm6 0h4v8h-4v-8zm6 0h4v8h-4v-8z" fill="white"/>
    </svg>
  );
}

// 飞书官方图标
function FeishuIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="feishu-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D6D9"/>
          <stop offset="100%" stopColor="#6F8FF7"/>
        </linearGradient>
        <linearGradient id="feishu-bottom" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A7AF4"/>
          <stop offset="100%" stopColor="#6F8FF7"/>
        </linearGradient>
      </defs>
      <path d="M16 32 Q24 16 32 32" stroke="url(#feishu-top)" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <path d="M12 36 Q24 20 36 36" stroke="url(#feishu-bottom)" strokeWidth="8" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export default function ReminderSettings() {
  const [config, setConfig] = useState<ReminderConfig>(() => getReminderConfig());
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testing, setTesting] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

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
          <button
            onClick={handleEnabled}
            className={`relative w-16 h-9 rounded-full transition-all duration-300 ${
              config.enabled
                ? "bg-accent-orange shadow-lg shadow-accent-orange/30"
                : "bg-accent-grayLight"
            }`}
          >
            <span
              className={`absolute top-1 w-7 h-7 bg-white rounded-full shadow-md transition-all duration-300 ${
                config.enabled ? "translate-x-8" : "translate-x-1"
              }`}
            />
          </button>
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
