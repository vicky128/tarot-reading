export default function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method === "POST") {
        // 解析请求体
        const { question } = req.body; 
        if (!question) {
            return res.status(400).json({ error: "缺少 question 参数" });
        }
        
        // 假设我们要返回一个 AI 解释
        const response = `你的问题是：${question}，这是 AI 的解读...`;

        return res.status(200).json({ message: response });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
}
