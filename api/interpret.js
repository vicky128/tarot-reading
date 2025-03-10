import axios from 'axios';

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { question, cards } = req.body;
    if (!question || !Array.isArray(cards)) {
        return res.status(400).json({ error: "请求参数错误" });
    }

    try {
        console.log("🔄 请求 SiliconFlow API...");

        const response = await axios.post(
            'https://api.siliconflow.cn/v1/chat/completions',
            {
                model: "Qwen/QwQ-32B",
                messages: [
                    { role: "system", content: "你是一位专业的塔罗牌占卜师..." },
                    { role: "user", content: `问题：${question}\n牌面：${cards.map(c => `${c.name}（${c.reversed ? '逆位' : '正位'}）`).join(', ')}` }
                ],
                stream: false,
                max_tokens: 20000,
                temperature: 0.7
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.API_KEY}`
                },
                timeout: 60000
            }
        );

        if (!response.data.choices || !response.data.choices[0].message.content) {
            throw new Error("API 返回的内容为空");
        }

        const result = response.data.choices[0].message.content.trim();
        console.log("✅ SiliconFlow API 返回:", result);

        return res.status(200).json({ result });
    } catch (error) {
        console.error("❌ 调用 SiliconFlow API 失败:", error.message);
        return res.status(500).json({ error: error.message || "服务器错误" });
    }
}
