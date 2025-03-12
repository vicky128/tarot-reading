/**
 * Cloudflare Worker for tarot card interpretation
 * Handles API requests and forwards them to the AI service
 * Now includes KV logging for token usage
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
      
      // Store token usage data in KV
      // This uses ctx.waitUntil to ensure the KV operation completes
      // even if the response is already sent back to the client
      ctx.waitUntil(logTokenUsageToKV(env, {
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

// Function to log token usage to KV
async function logTokenUsageToKV(env, usageData) {
  try {
    // Create a unique key for this log entry
    const logKey = `log_${usageData.timestamp}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Store the usage data in KV
    await env.TOKEN_LOGS.put(logKey, JSON.stringify(usageData));
    
    // Also update aggregated stats
    await updateAggregatedStats(env, usageData);
    
    console.log("Token usage data successfully logged to KV");
  } catch (error) {
    console.error("Error logging to KV:", error);
  }
}

// Function to update aggregated statistics
async function updateAggregatedStats(env, usageData) {
  try {
    // Get the current date in YYYY-MM-DD format for daily stats
    const today = new Date().toISOString().split('T')[0];
    
    // Keys for different time periods
    const dailyKey = `daily_${today}`;
    const allTimeKey = 'all_time_stats';
    
    // Update daily stats
    const dailyStatsJSON = await env.TOKEN_LOGS.get(dailyKey);
    let dailyStats = dailyStatsJSON ? JSON.parse(dailyStatsJSON) : {
      date: today,
      request_count: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };
    
    dailyStats.request_count++;
    dailyStats.prompt_tokens += usageData.prompt_tokens;
    dailyStats.completion_tokens += usageData.completion_tokens;
    dailyStats.total_tokens += usageData.total_tokens;
    
    await env.TOKEN_LOGS.put(dailyKey, JSON.stringify(dailyStats));
    
    // Update all-time stats
    const allTimeStatsJSON = await env.TOKEN_LOGS.get(allTimeKey);
    let allTimeStats = allTimeStatsJSON ? JSON.parse(allTimeStatsJSON) : {
      request_count: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      first_request: usageData.timestamp
    };
    
    allTimeStats.request_count++;
    allTimeStats.prompt_tokens += usageData.prompt_tokens;
    allTimeStats.completion_tokens += usageData.completion_tokens;
    allTimeStats.total_tokens += usageData.total_tokens;
    allTimeStats.last_request = usageData.timestamp;
    
    await env.TOKEN_LOGS.put(allTimeKey, JSON.stringify(allTimeStats));
    
  } catch (error) {
    console.error("Error updating aggregated stats:", error);
  }
}

// Handle token stats requests
async function handleTokenStats(request, env) {
  try {
    // Query parameters
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'day'; // day, week, month, all
    
    if (period === 'all') {
      // Return all-time stats
      const allTimeStatsJSON = await env.TOKEN_LOGS.get('all_time_stats');
      const allTimeStats = allTimeStatsJSON ? JSON.parse(allTimeStatsJSON) : {
        request_count: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
      
      return new Response(
        JSON.stringify({
          period: 'all',
          total: allTimeStats,
          daily: []
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    // For specific time periods, we need to get the daily stats
    const now = new Date();
    const dailyStats = [];
    
    // Calculate the number of days to fetch based on period
    let daysToFetch = 1;
    if (period === 'week') daysToFetch = 7;
    if (period === 'month') daysToFetch = 30;
    
    // Fetch daily stats for the specified period
    for (let i = 0; i < daysToFetch; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dailyKey = `daily_${dateStr}`;
      
      const dailyStatsJSON = await env.TOKEN_LOGS.get(dailyKey);
      if (dailyStatsJSON) {
        dailyStats.push(JSON.parse(dailyStatsJSON));
      }
    }
    
    // Calculate totals for the period
    const totalStats = dailyStats.reduce((acc, day) => {
      acc.request_count += day.request_count;
      acc.prompt_tokens += day.prompt_tokens;
      acc.completion_tokens += day.completion_tokens;
      acc.total_tokens += day.total_tokens;
      return acc;
    }, {
      request_count: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    });
    
    return new Response(
      JSON.stringify({
        period: period,
        total: totalStats,
        daily: dailyStats
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