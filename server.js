// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
let port = process.env.PORT || 3000;

// Single CORS configuration
const corsOptions = {
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', req.body);
  next();
});

// API route
app.post('/api/interpret', async (req, res) => {
  try {
    // Get request data with default values
    const { question = "", cards = [] } = req.body || {};
    
    // Add timestamp for tracking processing time
    const startTime = Date.now();

    // Validate request data
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: '需要至少一张塔罗牌' });
    }

    console.log('Sending request to API with data:', {
      question,
      cardsCount: cards.length
    });

    // Make API request
    const response = await axios.post(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
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
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_KEY}`
        }
      }
    );

    console.log('API response received:', response.status);
    // 记录响应信息
    const processingTime = Date.now() - startTime;
    const aiResponse = response.data.choices[0].message.content;

    console.log('\n---------- AI解读结果 ----------');
    console.log(aiResponse);
    console.log(`处理耗时: ${processingTime}ms`);
    console.log(`Token使用: ${JSON.stringify(response.data.usage)}`);
    console.log('------------------------------\n');
    
    // Send response back to client (only ONCE)
    res.json({ result: aiResponse });
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    res.status(500).json({
      error: '解读服务暂时不可用',
      details: error.message
    });
  }
});

// API connection test
const testRequest = async () => {
  try {
    // Check if API key exists
    if (!process.env.API_KEY) {
      console.error('错误: API_KEY 环境变量未设置。请检查您的 .env 文件。');
      return;
    }

    const res = await axios.post('https://api.siliconflow.cn/v1/chat/completions',
      {
        model: "Qwen/QwQ-32B",
        messages: [{ role: "user", content: "测试连接" }],
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_KEY}`
        }
      }
    );
    console.log('连接测试成功:', res.data);
  } catch (error) {
    console.error('连接测试失败:', error.message);
    console.error('错误详情:', error.response?.data || '无详细信息');
    // Don't terminate the server on test failure
    console.error('尽管测试失败，服务器仍将启动。请检查您的 API 凭据。');
  }
};

function startServer() {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`⚠️ 端口 ${port} 已被占用，尝试使用 ${port + 1}`);
      port += 1;
      startServer(); // 使用函数表达式避免重复声明
    } else {
      console.error('服务器启动失败:', error);
    }
  });
}

// 测试连接并启动（使用函数表达式避免冲突）
(async () => {
  try {
    await testRequest();
    startServer();
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
})();