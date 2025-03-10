export default async function handler(req, res) {
    try {
        console.log("🔄 保持 Vercel Serverless 活跃中...");

        // 这里用一个简单的 POST 请求，确保 API 活跃
        await fetch("https://your-vercel-app.vercel.app/api/interpret", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: "健康检查", cards: [] })
        });

        res.status(200).json({ message: "Server is kept alive" });
    } catch (error) {
        console.error("❌ 预防休眠请求失败:", error);
        res.status(500).json({ error: "Failed to keep server alive" });
    }
}
