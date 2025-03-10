export default async function handler(req, res) {
    console.log("收到请求: ", req.method, req.body);

    // 允许跨域
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // 处理 CORS 预检请求
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // 只允许 POST 请求
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ error: "缺少 question 参数" });
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
                max_tokens: 20000,
                temperature: 0.7,
                top_p: 0.7,
                top_k: 50,
                frequency_penalty: 0.5
            },)

        // 解析 API 响应
        const data = await response.json();
        console.log("真实 API 返回:", data);

        // 把真实 API 的返回结果转发给前端
        return res.status(200).json(data);
    } catch (error) {
        console.error("调用真实 API 失败:", error);
        return res.status(500).json({ error: "服务器错误，无法访问真实 API" });
    }
}
