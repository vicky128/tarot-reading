/**
 * Cloudflare Worker for tarot card interpretation
 * Handles API requests and forwards them to the AI service
 */

// Define your API key as a secret in Cloudflare Workers
// You'll need to set this in the Cloudflare Dashboard or with Wrangler CLI
// wrangler secret put API_KEY

// The AI API URL
const AI_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Handle OPTIONS requests (CORS preflight)
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// Main fetch event handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Get request URL
    const url = new URL(request.url);

    // Handle tarot card interpretation endpoint
    if (url.pathname === '/interpret' && request.method === 'POST') {
      return handleInterpretation(request, env);
    }

    // Handle unknown endpoints
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders
    });
  }
};

// Handle tarot card interpretation requests
async function handleInterpretation(request, env) {
  try {
    const requestData = await request.json();
    const { question = "", cards = [] } = requestData;

    const aiRequest = {
      model: "Qwen/QwQ-32B",
      messages: [
        {
          role: "system",
          content: "你是一位专业的塔罗牌占卜师，请根据用户的问题和抽到的牌面进行综合解读。"
        },
        {
          role: "user",
          content: `我的问题：${question || "无特定问题"}\n\n抽到的牌：\n${cards.map(c =>
            `${c.name}（${c.reversed ? '逆位' : '正位'}） - ${c.description}`
          ).join('\n')}`
        }
      ],
      stream: false,
      max_tokens: 20000,
      temperature: 0.7,
      top_p: 0.7,
      top_k: 50,
      frequency_penalty: 0.5
    };

    const aiResponse = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.API_KEY}`
      },
      body: JSON.stringify(aiRequest)
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return new Response(JSON.stringify({ error: `API Error: ${aiResponse.status} ${errorText}` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();

    // 直接返回日志数据到 API 响应
    return new Response(JSON.stringify({
      result: aiData.choices[0].message.content,
      usage: aiData.usage || "未返回 usage",
      debug: {
        rawResponse: aiData,  // 输出完整的 API 响应，方便调试
        requestData: aiRequest // 输出请求的内容
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: '解读服务暂时不可用',
      details: error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
