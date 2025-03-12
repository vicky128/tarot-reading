/**
 * Cloudflare Worker for tarot card interpretation
 * Handles API requests and forwards them to the AI service
 * Now includes D1 database logging for token usage
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
      return handleInterpretation(request, env, ctx);
    }
    
    // Add an endpoint for viewing token usage stats
    if (url.pathname === '/token-stats' && request.method === 'GET') {
      return handleTokenStats(request, env);
    }

    // Handle unknown endpoints
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders
    });
  }
};

// Handle tarot card interpretation requests
async function handleInterpretation(request, env, ctx) {
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
            ...corsHeaders
          }
        }
      );
    }

    // Record request timestamp
    const requestTime = new Date().toISOString();
    
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
    
    if (aiData.usage) {
      console.log(`Token使用: ${JSON.stringify(aiData.usage)}`);
      console.log('=== Token 使用详情 ===');
      console.log(`模型: ${aiData.model}`);
      console.log(`总 Token 数: ${aiData.usage.total_tokens}`);
      console.log(`请求 Token: ${aiData.usage.prompt_tokens}`);
      console.log(`响应 Token: ${aiData.usage.completion_tokens}`);
      console.log('======================');
      
      // Store token usage data in D1 database
      // This uses ctx.waitUntil to ensure the database operation completes
      // even if the response is already sent back to the client
      ctx.waitUntil(logTokenUsageToD1(env, {
        timestamp: requestTime,
        model: aiData.model || "Qwen/QwQ-32B",
        question_type: question ? "specific" : "general",
        cards_count: cards.length,
        prompt_tokens: aiData.usage.prompt_tokens,
        completion_tokens: aiData.usage.completion_tokens,
        total_tokens: aiData.usage.total_tokens
      }));
    } else {
      console.log("⚠️ AI API 没有返回 usage 字段");
    }

    // Return the interpretation result
    return new Response(
      JSON.stringify({
        result: interpretationResult,
        usage: aiData.usage
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
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
          ...corsHeaders
        }
      }
    );
  }
}

// Function to log token usage to D1 database
async function logTokenUsageToD1(env, usageData) {
  try {
    // Insert token usage data into the D1 database
    await env.DB.prepare(
      `INSERT INTO token_usage (
        timestamp, model, question_type, cards_count, 
        prompt_tokens, completion_tokens, total_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      usageData.timestamp,
      usageData.model,
      usageData.question_type,
      usageData.cards_count,
      usageData.prompt_tokens,
      usageData.completion_tokens,
      usageData.total_tokens
    ).run();
    
    console.log("Token usage data successfully logged to D1 database");
  } catch (error) {
    console.error("Error logging to D1 database:", error);
  }
}

// Handle token stats requests
async function handleTokenStats(request, env) {
  try {
    // Query parameters
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'day'; // day, week, month
    
    let timeFilter;
    const now = new Date();
    
    // Set time filter based on period
    if (period === 'day') {
      // Last 24 hours
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      timeFilter = `timestamp >= '${oneDayAgo}'`;
    } else if (period === 'week') {
      // Last 7 days
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      timeFilter = `timestamp >= '${oneWeekAgo}'`;
    } else if (period === 'month') {
      // Last 30 days
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      timeFilter = `timestamp >= '${oneMonthAgo}'`;
    } else {
      // All time
      timeFilter = "1=1";
    }
    
    // Get total usage stats
    const totalStats = await env.DB.prepare(
      `SELECT 
        COUNT(*) as request_count,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(total_tokens) as total_tokens
      FROM token_usage
      WHERE ${timeFilter}`
    ).all();
    
    // Get daily usage stats
    const dailyStats = await env.DB.prepare(
      `SELECT 
        date(timestamp) as date,
        COUNT(*) as request_count,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        SUM(total_tokens) as total_tokens
      FROM token_usage
      WHERE ${timeFilter}
      GROUP BY date(timestamp)
      ORDER BY date(timestamp) DESC`
    ).all();
    
    return new Response(
      JSON.stringify({
        period: period,
        total: totalStats.results[0],
        daily: dailyStats.results
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('Error fetching token stats:', error);
    return new Response(
      JSON.stringify({
        error: '无法获取统计数据',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}