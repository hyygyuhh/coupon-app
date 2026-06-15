import { useState, useEffect } from "react";
import {
  getReminderConfig,
  saveReminderConfig,
  type ReminderConfig,
} from "../utils/reminder";

export default function DingTalkSettings() {
  const [config, setConfig] = useState<ReminderConfig>(getReminderConfig());
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    setConfig(getReminderConfig());
  }, []);

  const handleChange = (key: keyof ReminderConfig, value: string | number | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    saveReminderConfig(newConfig);
  };

  const handleTest = async () => {
    if (!config.webhook) {
      setTestResult("error");
      return;
    }

    try {
      const result = await fetch(config.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgtype: "text",
          text: { content: "🐑 羊毛管家测试消息：钉钉提醒功能配置成功！" },
        }),
      });
      const data = await result.json();
      setTestResult(data.errcode === 0 ? "success" : "error");
    } catch {
      setTestResult("error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-accent-ink mb-6">钉钉提醒设置</h1>

      <div className="bg-cream rounded-2xl p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-accent-ink">启用钉钉提醒</h2>
            <p className="text-sm text-accent-inkMute">开启后，优惠券即将过期时会自动发送提醒到钉钉</p>
          </div>
          <button
            onClick={() => handleChange("enabled", !config.enabled)}
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
              钉钉机器人 Webhook
            </label>
            <input
              type="text"
              value={config.webhook}
              onChange={(e) => handleChange("webhook", e.target.value)}
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
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
              onChange={(e) => handleChange("secret", e.target.value)}
              placeholder="如果机器人启用了签名验证，请输入密钥"
              className="w-full px-4 py-3 bg-paper border border-accent-grayLight rounded-xl text-accent-ink placeholder:text-accent-inkMute focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-accent-ink mb-2">
              提前提醒天数
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={config.reminderDays}
              onChange={(e) => handleChange("reminderDays", parseInt(e.target.value) || 3)}
              className="w-32 px-4 py-3 bg-paper border border-accent-grayLight rounded-xl text-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange transition"
            />
            <span className="ml-2 text-sm text-accent-inkMute">天</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleTest}
            className="px-6 py-2.5 bg-accent-orange hover:bg-accent-orange/90 text-white font-bold rounded-full transition shadow-card"
          >
            测试连接
          </button>
          {testResult && (
            <span className={`ml-2 flex items-center ${
              testResult === "success" ? "text-green-600" : "text-red-600"
            }`}>
              {testResult === "success" ? "✓ 测试成功" : "✗ 测试失败"}
            </span>
          )}
        </div>

        <div className="mt-6 p-4 bg-paper/50 rounded-xl">
          <h3 className="font-medium text-accent-ink mb-2">使用说明</h3>
          <ul className="text-sm text-accent-inkMute space-y-1">
            <li>1. 在钉钉群中添加「自定义机器人」</li>
            <li>2. 复制机器人的 Webhook 地址粘贴到上方</li>
            <li>3. 如果启用了「加签」，请同时填写密钥</li>
            <li>4. 每天只会发送一次提醒，避免打扰</li>
          </ul>
        </div>
      </div>
    </div>
  );
}