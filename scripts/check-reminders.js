/**
 * GitHub Actions 定时提醒检查脚本
 * 
 * 功能：
 * 1. 从 GitHub Gist 获取优惠券数据
 * 2. 检查是否有即将过期的优惠券
 * 3. 发送飞书/钉钉提醒
 * 4. 更新 Gist 中的提醒状态
 */

const https = require('https');
const http = require('http');

// ============ 配置区域 ============
// 这些值会从环境变量中读取
const GH_TOKEN = process.env.GH_TOKEN;
const GIST_ID = process.env.GIST_ID;
const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
const DINGTALK_SECRET = process.env.DINGTALK_SECRET;
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK;
const FEISHU_SECRET = process.env.FEISHU_SECRET;
const REMINDER_DAYS = parseInt(process.env.REMINDER_DAYS || '3', 10);
const REMINDER_TYPE = process.env.REMINDER_TYPE || 'feishu'; // dingtalk 或 feishu

// ============ 工具函数 ============

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * 生成钉钉签名
 */
function generateDingTalkSign(secret) {
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  const sign = hmac.digest().toString('base64');
  return { timestamp, sign };
}

/**
 * 发送钉钉消息
 */
async function sendDingTalkMessage(webhook, secret, message) {
  let url = webhook;
  if (secret) {
    const { timestamp, sign } = generateDingTalkSign(secret);
    url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
  }

  return httpRequest({
    hostname: new URL(url).hostname,
    path: new URL(url).pathname + new URL(url).search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify(message));
}

/**
 * 生成飞书签名
 */
function generateFeishuSign(secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `${timestamp}\n${secret}`;
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  const sign = Buffer.from(hmac.digest()).toString('base64');
  return { timestamp, sign };
}

/**
 * 发送飞书消息
 */
async function sendFeishuMessage(webhook, secret, message) {
  let body = message;
  if (secret) {
    const { timestamp, sign } = generateFeishuSign(secret);
    body = { ...message, timestamp, sign };
  }

  return httpRequest({
    hostname: new URL(webhook).hostname,
    path: new URL(webhook).pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify(body));
}

/**
 * 计算距离过期还有多少天
 */
function daysUntil(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 获取今天的日期键
 */
function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * 从 GitHub Gist 获取数据
 */
async function fetchFromGist() {
  const response = await httpRequest({
    hostname: 'api.github.com',
    path: `/gists/${GIST_ID}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'coupon-reminder-script'
    }
  });

  const files = response.files || {};
  const couponFile = files['coupons.json'];
  const statusFile = files['reminder-status.json'];

  return {
    coupons: couponFile ? JSON.parse(couponFile.content) : [],
    status: statusFile ? JSON.parse(statusFile.content) : { remindedToday: {} }
  };
}

/**
 * 更新 GitHub Gist 数据
 */
async function updateGist(coupons, status) {
  const response = await httpRequest({
    hostname: 'api.github.com',
    path: `/gists/${GIST_ID}`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'coupon-reminder-script'
    }
  }, JSON.stringify({
    description: 'Coupon App Data - Auto updated by GitHub Actions',
    files: {
      'coupons.json': { content: JSON.stringify(coupons, null, 2) },
      'reminder-status.json': { content: JSON.stringify(status, null, 2) }
    }
  }));

  return response;
}

/**
 * 构建钉钉 Markdown 消息
 */
function buildDingTalkMarkdown(coupons) {
  let text = `### 🐑 羊毛管家提醒\n\n`;
  text += `检测到 **${coupons.length}** 张优惠券即将过期！\n\n`;
  
  coupons.forEach((c, i) => {
    const daysText = c.daysLeft === 0 ? '今天过期' : 
                     c.daysLeft === 1 ? '明天过期' : 
                     `剩 ${c.daysLeft} 天`;
    text += `${i + 1}. **${c.name}**\n`;
    text += `   - 平台：${c.platform || '未知'}\n`;
    text += `   - 到期：${c.expiryDate} (${daysText})\n\n`;
  });
  
  text += `---\n\n💰 请尽快使用，避免浪费！`;
  
  return text;
}

/**
 * 构建飞书文本消息
 */
function buildFeishuText(coupons) {
  let text = `🐑 羊毛管家提醒：检测到 ${coupons.length} 张优惠券即将过期！\n\n`;
  
  coupons.forEach((c) => {
    const daysText = c.daysLeft === 0 ? '今天过期' : 
                     c.daysLeft === 1 ? '明天过期' : 
                     `剩 ${c.daysLeft} 天`;
    text += `• ${c.name} (${c.platform || '未知'}) - ${c.expiryDate} (${daysText})\n`;
  });
  
  text += `\n请尽快使用，避免浪费！💰`;
  
  return text;
}

// ============ 主流程 ============

async function main() {
  console.log('🔔 开始检查优惠券提醒...');
  console.log(`📅 提醒阈值：提前 ${REMINDER_DAYS} 天`);

  // 1. 检查必要配置
  if (!GH_TOKEN || !GIST_ID) {
    console.log('⚠️ 未配置 GitHub Token 或 Gist ID，跳过检查');
    console.log('请在 GitHub仓库设置中添加以下 secrets：');
    console.log('- GH_TOKEN: 您的 Personal Access Token');
    console.log('- GIST_ID: 您的 Gist ID');
    return;
  }

  // 2. 检查提醒渠道配置
  const hasDingTalk = DINGTALK_WEBHOOK;
  const hasFeishu = FEISHU_WEBHOOK;
  
  if (!hasDingTalk && !hasFeishu) {
    console.log('⚠️ 未配置任何提醒渠道，跳过检查');
    return;
  }

  // 3. 获取 Gist 数据
  console.log('📥 从 Gist 获取优惠券数据...');
  let data;
  try {
    data = await fetchFromGist();
    console.log(`✅ 获取到 ${data.coupons.length} 张优惠券`);
  } catch (error) {
    console.log('❌ 无法获取 Gist 数据:', error.message);
    return;
  }

  // 4. 筛选即将过期的优惠券
  const todayKey = getTodayKey();
  const todayStatus = data.status.remindedToday || {};
  
  const expiringCoupons = data.coupons
    .filter(c => {
      // 只检查未使用的券
      if (c.status !== 'unused') return false;
      
      // 计算剩余天数
      const daysLeft = daysUntil(c.expiryDate);
      if (daysLeft < 0 || daysLeft > REMINDER_DAYS) return false;
      
      // 检查今天是否已提醒
      if (todayStatus[c.id] === todayKey) {
        console.log(`⏭️ ${c.name} 今天已提醒，跳过`);
        return false;
      }
      
      return true;
    })
    .map(c => ({
      ...c,
      daysLeft: daysUntil(c.expiryDate)
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (expiringCoupons.length === 0) {
    console.log('✅ 没有需要提醒的优惠券');
    return;
  }

  console.log(`📢 发现 ${expiringCoupons.length} 张优惠券需要提醒`);

  // 5. 发送提醒
  let success = false;
  
  if (REMINDER_TYPE === 'dingtalk' && hasDingTalk) {
    console.log('📤 发送钉钉提醒...');
    const markdown = buildDingTalkMarkdown(expiringCoupons);
    try {
      await sendDingTalkMessage(DINGTALK_WEBHOOK, DINGTALK_SECRET, {
        msgtype: 'markdown',
        markdown: {
          title: '优惠券即将过期提醒',
          text: markdown
        }
      });
      success = true;
      console.log('✅ 钉钉提醒发送成功');
    } catch (error) {
      console.log('❌ 钉钉提醒发送失败:', error.message);
    }
  } else if (REMINDER_TYPE === 'feishu' && hasFeishu) {
    console.log('📤 发送飞书提醒...');
    const text = buildFeishuText(expiringCoupons);
    try {
      await sendFeishuMessage(FEISHU_WEBHOOK, FEISHU_SECRET, {
        msg_type: 'text',
        content: JSON.stringify({ text })
      });
      success = true;
      console.log('✅ 飞书提醒发送成功');
    } catch (error) {
      console.log('❌ 飞书提醒发送失败:', error.message);
    }
  }

  // 6. 更新提醒状态
  if (success) {
    console.log('💾 更新提醒状态...');
    expiringCoupons.forEach(c => {
      data.status.remindedToday[c.id] = todayKey;
    });
    
    try {
      await updateGist(data.coupons, data.status);
      console.log('✅ 提醒状态已保存');
    } catch (error) {
      console.log('⚠️ 无法保存提醒状态:', error.message);
    }
  }

  console.log('🎉 检查完成！');
}

// 运行主流程
main().catch(console.error);
