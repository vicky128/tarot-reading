export default function handler(req, res) {
    console.log("收到请求: ", req.method, req.body); // 打印请求方法和 body 数据
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method === "POST") {
        const { question } = req.body; 
        console.log("解析到的 question:", question); // 打印解析后的数据
        if (!question) {
            return res.status(400).json({ error: "缺少 question 参数" });
        }

        const response = `你的问题是：${question}，这是 AI 的解读...`;
        console.log("返回的结果:", response); // 确保返回正确的数据

        return res.status(200).json({ message: response });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
}
