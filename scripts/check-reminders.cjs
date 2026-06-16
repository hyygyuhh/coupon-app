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

function httpRequest(options, postData = null, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      // 处理重定向
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && maxRedirects > 0) {
        console.log(`🔄 重定向到: ${res.headers.location} (剩余次数: ${maxRedirects - 1})`);
        const redirectUrl = new URL(res.headers.location);
        httpRequest({
          protocol: redirectUrl.protocol,
          hostname: redirectUrl.hostname,
          path: redirectUrl.pathname + redirectUrl.search,
          method: options.method,
          headers: options.headers
        }, postData, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: jsonData });
        } catch {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', (error) => {
      console.log('❌ HTTP请求错误:', error.message);
      reject(error);
    });
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

  const result = await httpRequest({
    protocol: new URL(url).protocol,
    hostname: new URL(url).hostname,
    path: new URL(url).pathname + new URL(url).search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify(message));

  if (result.statusCode === 200 && result.data && result.data.errcode === 0) {
    return true;
  } else {
    console.log('❌ 钉钉返回错误:', JSON.stringify(result));
    return false;
  }
}

/**
 * 生成飞书签名
 */
function generateFeishuSign(secret) {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).slice(2, 15);
  const stringToSign = `${timestamp}\n${nonce}\n${secret}`;
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', stringToSign);
  hmac.update(stringToSign);
  const sign = hmac.digest().toString('base64');
  return { timestamp, nonce, sign };
}

/**
 * 发送飞书消息
 */
async function sendFeishuMessage(webhook, secret, message) {
  let url = webhook;
  if (secret) {
    const { timestamp, nonce, sign } = generateFeishuSign(secret);
    url += `&timestamp=${timestamp}&nonce=${nonce}&sign=${encodeURIComponent(sign)}`;
  }

  const result = await httpRequest({
    protocol: new URL(url).protocol,
    hostname: new URL(url).hostname,
    path: new URL(url).pathname + new URL(url).search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify(message));

  if (result.statusCode === 200 && result.data && result.data.code === 0) {
    return true;
  } else {
    console.log('❌ 飞书返回错误:', JSON.stringify(result));
    return false;
  }
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
  console.log(`📡 正在请求 Gist API: /gists/${GIST_ID}`);
  
  const response = await httpRequest({
    protocol: 'https:',
    hostname: 'api.github.com',
    path: `/gists/${GIST_ID}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'coupon-reminder-script',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  // response 格式: { statusCode, data: {...} }
  console.log('📦 Gist 响应状态:', response.statusCode);
  console.log('📦 原始响应数据:', JSON.stringify(response.data).substring(0, 500));
  
  // 处理 301/302 重定向
  if (response.statusCode === 301 || response.statusCode === 302) {
    console.log('❌ Gist API 返回重定向，请检查 Gist ID 是否正确');
    console.log('💡 Gist ID 应该是类似 "8a1b2c3d4e5f6g7h8i9j0k" 的格式，不包含用户名');
    return { coupons: [], status: { remindedToday: {} } };
  }
  
  // 处理 404 错误
  if (response.statusCode === 404) {
    console.log('❌ Gist 未找到，请检查 Gist ID 是否正确');
    console.log('💡 确保 Gist 存在且 Token 有权限访问');
    return { coupons: [], status: { remindedToday: {} } };
  }
  
  // 处理 401/403 错误
  if (response.statusCode === 401 || response.statusCode === 403) {
    console.log('❌ Token 权限不足，请确保 Token 有 gist 权限');
    return { coupons: [], status: { remindedToday: {} } };
  }
  
  const data = response.data || {};
  const files = data.files || {};
  
  console.log('📁 Gist 文件列表:', Object.keys(files));
  
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
  console.log('📡 正在更新 Gist...');
  
  const response = await httpRequest({
    protocol: 'https:',
    hostname: 'api.github.com',
    path: `/gists/${GIST_ID}`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'coupon-reminder-script',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }, JSON.stringify({
    description: 'Coupon App Data - Auto updated by GitHub Actions',
    files: {
      'coupons.json': { content: JSON.stringify(coupons, null, 2) },
      'reminder-status.json': { content: JSON.stringify(status, null, 2) }
    }
  }));

  console.log('📦 Gist 更新响应状态:', response.statusCode);
  
  if (response.statusCode === 200 || response.statusCode === 201) {
    console.log('✅ Gist 更新成功');
    return true;
  } else {
    console.log('❌ Gist 更新失败:', JSON.stringify(response.data));
    return false;
  }
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
  console.log(`🔔 提醒类型：${REMINDER_TYPE}`);
  console.log(`📋 GitHub Token: ${GH_TOKEN ? '已设置' : '未设置'}`);
  console.log(`📋 Gist ID: ${GIST_ID || '未设置'}`);

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
  
  console.log(`📅 今日日期：${todayKey}`);
  console.log(`🔍 开始筛选即将过期（${REMINDER_DAYS}天内）的优惠券...`);
  console.log(`📊 总优惠券数：${data.coupons.length}`);
  
  // 打印每张券的详情用于调试
  data.coupons.forEach(c => {
    const daysLeft = daysUntil(c.expiryDate);
    console.log(`  - ${c.name || 'unnamed'}: status=${c.status}, expiryDate=${c.expiryDate}, daysLeft=${daysLeft}`);
  });
  
  const expiringCoupons = data.coupons
    .filter(c => {
      if (!c.id || !c.expiryDate) {
        console.log(`⚠️ 跳过无效优惠券数据: ${JSON.stringify(c)}`);
        return false;
      }
      
      if (c.status !== 'unused') {
        console.log(`⏭️ ${c.name}: status=${c.status}，跳过`);
        return false;
      }
      
      const daysLeft = daysUntil(c.expiryDate);
      if (daysLeft < 0 || daysLeft > REMINDER_DAYS) {
        console.log(`⏭️ ${c.name}: daysLeft=${daysLeft}，超出范围[0, ${REMINDER_DAYS}]，跳过`);
        return false;
      }
      
      // 使用小写 ID 进行大小写不敏感的去重检查
      const normalizedId = c.id.toLowerCase();
      const isReminded = Object.keys(todayStatus).some(
        key => key.toLowerCase() === normalizedId && todayStatus[key] === todayKey
      );
      
      if (isReminded) {
        console.log(`⏭️ ${c.name} (id=${c.id}) 今天已提醒，跳过`);
        return false;
      }
      
      console.log(`✅ ${c.name}: daysLeft=${daysLeft}，符合条件！`);
      return true;
    })
    .map(c => ({
      ...c,
      daysLeft: daysUntil(c.expiryDate),
      normalizedId: c.id.toLowerCase()
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  console.log(`📊 筛选结果：${expiringCoupons.length} 张优惠券需要提醒`);
  
  expiringCoupons.forEach(c => {
    console.log(`  - ${c.name}: ${c.expiryDate} (剩${c.daysLeft}天)`);
  });

  if (expiringCoupons.length === 0) {
    console.log('✅ 没有需要提醒的优惠券');
    return;
  }

  console.log(`📢 发现 ${expiringCoupons.length} 张优惠券需要提醒`);

  // 5. 发送提醒
  let success = false;
  
  console.log(`📤 开始发送 ${REMINDER_TYPE} 提醒...`);
  
  if (REMINDER_TYPE === 'dingtalk' && hasDingTalk) {
    const markdown = buildDingTalkMarkdown(expiringCoupons);
    console.log('📝 消息内容:', markdown.substring(0, 100) + '...');
    try {
      success = await sendDingTalkMessage(DINGTALK_WEBHOOK, DINGTALK_SECRET, {
        msgtype: 'markdown',
        markdown: {
          title: '优惠券即将过期提醒',
          text: markdown
        }
      });
      if (success) {
        console.log('✅ 钉钉提醒发送成功');
      }
    } catch (error) {
      console.log('❌ 钉钉提醒发送失败:', error.message);
    }
  } else if (REMINDER_TYPE === 'feishu' && hasFeishu) {
    const text = buildFeishuText(expiringCoupons);
    console.log('📝 消息内容:', text.substring(0, 100) + '...');
    try {
      success = await sendFeishuMessage(FEISHU_WEBHOOK, FEISHU_SECRET, {
        msg_type: 'text',
        content: { text }
      });
      if (success) {
        console.log('✅ 飞书提醒发送成功');
      }
    } catch (error) {
      console.log('❌ 飞书提醒发送失败:', error.message);
    }
  }
  
  if (!success) {
    console.log('❌ 所有提醒渠道发送失败');
  }

  // 6. 更新提醒状态
  if (success) {
    console.log('💾 更新提醒状态...');
    expiringCoupons.forEach(c => {
      const normalizedId = (c.normalizedId || c.id.toLowerCase());
      data.status.remindedToday[normalizedId] = todayKey;
    });
    
    // 清理已删除优惠券的提醒记录
    const validIds = new Set(data.coupons.map(c => c.id.toLowerCase()));
    for (const id of Object.keys(data.status.remindedToday)) {
      if (!validIds.has(id.toLowerCase())) {
        console.log(`🗑️ 清理已删除优惠券的提醒记录: ${id}`);
        delete data.status.remindedToday[id];
      }
    }
    
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
