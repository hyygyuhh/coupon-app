import { useState, useEffect, useCallback } from "react";
import {
  getReminderConfig,
  saveReminderConfig,
  testReminder,
  type ReminderConfig,
  type ReminderType,
} from "../utils/reminder";

export default function ReminderSettings() {
  const [config, setConfig] = useState<ReminderConfig>(() => getReminderConfig());
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  // 写回本地存储
  const persist = useCallback((next: ReminderConfig) => {
    saveReminderConfig(next);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1200);
  }, []);

  const handleEnabled = useCallback(
    () => {
      const next = { ...config, enabled: !config.enabled };
      setConfig(next);
      persist(next);
    },
    [config, persist]
  );

  const handleTypeChange = useCallback(
    (type: ReminderType) => {
      const next = { ...config, type };
      setConfig(next);
      persist(next);
      setTestResult(null);
    },
    [config, persist]
  );

  const handleTextChange = useCallback(
    (key: "webhook" | "secret", value: string) => {
      const next = { ...config, [key]: value };
      setConfig(next);
      persist(next);
    },
    [config, persist]
  );

  const [reminderDaysInput, setReminderDaysInput] = useState<string>(String(config.reminderDays));

  // 同步外部配置变化到输入框
  useEffect(() => {
    setReminderDaysInput(String(config.reminderDays));
  }, [config.reminderDays]);

  const handleDaysChange = useCallback(
    (daysStr: string) => {
      // 允许输入框显示空值或正在输入的值
      setReminderDaysInput(daysStr);
      
      // 只有在有效数字时才保存
      const parsed = parseInt(daysStr, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
        const next = { ...config, reminderDays: parsed };
        setConfig(next);
        persist(next);
      }
    },
    [config, persist]
  );

  const handleDaysBlur = useCallback(
    () => {
      // 失去焦点时，如果输入无效则恢复为当前配置值
      const parsed = parseInt(reminderDaysInput, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 30) {
        setReminderDaysInput(String(config.reminderDays));
      }
    },
    [reminderDaysInput, config.reminderDays]
  );

  const handleTest = async () => {
    if (!config.webhook) {
      setTestResult("error");
      return;
    }
    const result = await testReminder(config);
    setTestResult(result ? "success" : "error");
  };

  const isDingTalk = config.type === "dingtalk";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-accent-ink">提醒设置</h1>
        {showSaved && (
          <span className="text-sm text-accent-green font-medium">✓ 已保存</span>
        )}
      </div>

      <div className="bg-cream rounded-2xl p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-accent-ink">启用过期提醒</h2>
            <p className="text-sm text-accent-inkMute">开启后，优惠券即将过期时会自动发送提醒</p>
          </div>
          <button
            onClick={handleEnabled}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              config.enabled ? "bg-accent-orange" : "bg-accent-grayLight"
            }`}
          >
            <span
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                config.enabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-accent-ink mb-2">
              提醒渠道
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => handleTypeChange("dingtalk")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition ${
                  isDingTalk
                    ? "bg-accent-blue text-white shadow-card"
                    : "bg-paper text-accent-ink hover:bg-accent-blue/10"
                }`}
              >
                💬 钉钉
              </button>
              <button
                onClick={() => handleTypeChange("feishu")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition ${
                  !isDingTalk
                    ? "bg-accent-green text-white shadow-card"
                    : "bg-paper text-accent-ink hover:bg-accent-green/10"
                }`}
              >
                🦅 飞书
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-accent-ink mb-2">
              {isDingTalk ? "钉钉" : "飞书"}机器人 Webhook
            </label>
            <input
              type="text"
              value={config.webhook}
              onChange={(e) => handleTextChange("webhook", e.target.value)}
              placeholder={isDingTalk
                ? "https://oapi.dingtalk.com/robot/send?access_token=xxx"
                : "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
              }
              className="w-full px-4 py-3 bg-paper border border-accent-grayLight rounded-xl text-accent-ink placeholder:text-accent-inkMute focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-accent-ink mb-2">
              加签密钥（可选）
            </label>
            <input
              type="password"
              value={config.secret}
              onChange={(e) => handleTextChange("secret", e.target.value)}
              placeholder="如果机器人启用了签名验证，请输入密钥"
              className="w-full px-4 py-3 bg-paper border border-accent-grayLight rounded-xl text-accent-ink placeholder:text-accent-inkMute focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-accent-ink mb-2">
              提前提醒天数
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={reminderDaysInput}
                onChange={(e) => handleDaysChange(e.target.value)}
                onBlur={handleDaysBlur}
                className="w-32 px-4 py-3 bg-paper border border-accent-grayLight rounded-xl text-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange transition"
              />
              <span className="text-sm text-accent-inkMute">天</span>
              <div className="flex gap-2 ml-2">
                {[3, 5, 7, 10].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDaysChange(String(d))}
                    className={`px-3 py-1.5 text-sm rounded-full transition ${
                      config.reminderDays === d
                        ? "bg-accent-orange text-white font-medium"
                        : "bg-paper text-accent-ink hover:bg-accent-orange/10"
                    }`}
                  >
                    {d}天
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={!config.webhook}
            className="px-6 py-2.5 bg-accent-orange hover:bg-accent-orange/90 disabled:bg-accent-grayLight disabled:cursor-not-allowed text-white font-bold rounded-full transition shadow-card"
          >
            测试连接
          </button>
          {testResult && (
            <span className={`text-sm ${testResult === "success" ? "text-accent-green" : "text-red-500"}`}>
              {testResult === "success" ? "✓ 测试成功" : "✗ 测试失败，请检查 Webhook 配置"}
            </span>
          )}
        </div>

        <div className="mt-6 p-4 bg-paper/50 rounded-xl">
          <h3 className="font-medium text-accent-ink mb-2">使用说明</h3>
          <ul className="text-sm text-accent-inkMute space-y-1">
            {isDingTalk ? (
              <>
                <li>1. 在钉钉群中添加「自定义机器人」</li>
                <li>2. 复制机器人的 Webhook 地址粘贴到上方</li>
                <li>3. 如果启用了「加签」，请同时填写密钥</li>
              </>
            ) : (
              <>
                <li>1. 在飞书群中添加「自定义机器人」</li>
                <li>2. 复制机器人的 Webhook 地址粘贴到上方</li>
                <li>3. 如果启用了「安全设置」中的签名校验，请填写密钥</li>
              </>
            )}
            <li>4. 每天只会发送一次提醒，避免打扰</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
