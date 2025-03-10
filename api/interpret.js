const axios = require('axios');

module.exports = async function handler(req, res) {
    console.log("收到请求: ", req.method, req.body);

    // Rest of your code remains the same
    
    // 允许跨域
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // 处理 CORS 预检请求
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { question, cards = [] } = req.body;
    if (!question || !Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({ error: "需要问题和至少一张塔罗牌" });
    }

    try {
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
                max_tokens: 200,
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

        // Parse API response
        const data = response.data;
        console.log("真实 API 返回:", data);

        // Forward the API response to the frontend
        return res.status(200).json({
            result: data.choices[0].message.content
        });
    } catch (error) {
        console.error("调用真实 API 失败:", error);
        return res.status(500).json({ 
            error: "服务器错误，无法访问真实 API",
            details: error.message 
        });
    }
};