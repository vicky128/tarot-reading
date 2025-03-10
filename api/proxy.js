export default async function handler(req, res) {
    const API_URL = "https://api.siliconflow.cn/v1/chat/completions"; // 你的真实 API

    // 复制请求头，避免 CORS 问题
    const response = await fetch(API_URL, {
        method: req.method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.API_KEY}` // 这里使用 Vercel 环境变量存储 API 密钥
        },
        body: req.method === "GET" ? null : JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(200).json(data);
}
