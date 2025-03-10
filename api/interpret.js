export default function handler(req, res) {
    // 允许跨域
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  
    // 处理OPTIONS预检请求
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
  
    // 处理POST请求
    if (req.method === "POST") {
      try {
        // 你的业务逻辑
        res.status(200).json({ message: "Success" });
      } catch (error) {
        res.status(500).json({ error: "Server error" });
      }
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  }