// The AI API URL
const AI_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://tarot-reading.pages.dev',  // Updated to match your exact origin
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1️⃣ 处理根路径 `/`
    if (url.pathname === "/") {
      return new Response("Hello! Your Worker is running 🚀", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 2️⃣ 处理 `/interpret` API 请求
    if (url.pathname === "/interpret" && request.method === "POST") {
      return handleInterpretation(request, env);
    }

    // 3️⃣ 处理 `/logs` API 请求（查看 KV 存储的 Token 记录）
    if (url.pathname === "/logs") {
      return handleLogs(request, env);
    }

    // 4️⃣ 处理其他未匹配的路径，返回 404
    return new Response("Not Found", { status: 404 });
  },
};

// Save token usage to KV
async function saveTokenUsage(env, data) {
  try {
    // Create a unique key using timestamp
    const timestamp = new Date().toISOString();
    const key = `token_usage_${timestamp}`;
    
    // Save the data to KV
    await env.TOKEN_USAGE.put(key, JSON.stringify(data));
    
    console.log(`Token usage saved to KV with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error saving to KV:', error);
    return false;
  }
}

// Handle tarot card interpretation requests
async function handleInterpretation(request, env) {
  try {
    // Parse request body
    const requestData = await request.json();
    const { question = "", cards = [] } = requestData;

    // Validate request data
    if (!Array.isArray(cards) || cards.length === 0) {
      return new Response(
        JSON.stringify({ error: '需要至少一张塔罗牌' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders  // Include CORS headers
          }
        }
      );
    }

    // Prepare the API request
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

    // Make request to AI API
    const aiResponse = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.API_KEY}`
      },
      body: JSON.stringify(aiRequest)
    });

    // Check if API response is ok
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('API Error:', aiResponse.status, errorText);
      throw new Error(`API Error: ${aiResponse.status} ${errorText}`);
    }

    // Parse AI response
    const aiData = await aiResponse.json();
    const interpretationResult = aiData.choices[0].message.content;
    
    // Log token usage to console
    console.log("AI API 响应:", JSON.stringify(aiData, null, 2));
    
    // Save token usage data to KV
    if (aiData.usage) {
      const usageData = {
        timestamp: new Date().toISOString(),
        model: aiData.model || "Qwen/QwQ-32B",
        question: question || "无特定问题",
        cards_count: cards.length,
        total_tokens: aiData.usage.total_tokens,
        prompt_tokens: aiData.usage.prompt_tokens,
        completion_tokens: aiData.usage.completion_tokens
      };
      
      // Save to KV in the background
      ctx.waitUntil(saveTokenUsage(env, usageData));
      
      console.log(`Token使用: ${JSON.stringify(aiData.usage)}`);
      console.log('=== Token 使用详情 ===');
      console.log(`模型: ${aiData.model}`);
      console.log(`总 Token 数: ${aiData.usage.total_tokens}`);
      console.log(`请求 Token: ${aiData.usage.prompt_tokens}`);
      console.log(`响应 Token: ${aiData.usage.completion_tokens}`);
      console.log('======================');
    } else {
      console.log("⚠️ AI API 没有返回 usage 字段");
    }

    // Return the interpretation result with CORS headers
    return new Response(
      JSON.stringify({
        result: interpretationResult,
        usage: aiData.usage
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders  // Include CORS headers
        }
      }
    );
  } catch (error) {
    // Handle errors
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({
        error: '解读服务暂时不可用',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders  // Include CORS headers
        }
      }
    );
  }
}