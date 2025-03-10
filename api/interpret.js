// api/interpret.js
const axios = require('axios');

// In-memory storage (will reset on deployment/restarts)
// For production, use a database like MongoDB, Redis, etc.
const jobStore = new Map();

module.exports = async function handler(req, res) {
    // Allow CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Connection", "keep-alive");

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // GET: Check job status
    if (req.method === "GET") {
        const jobId = req.query.jobId;
        
        if (!jobId) {
            return res.status(400).json({ error: "Missing jobId parameter" });
        }

        if (!jobStore.has(jobId)) {
            return res.status(404).json({ error: "Job not found" });
        }

        const job = jobStore.get(jobId);
        return res.status(200).json(job);
    }

    // POST: Create new job
    if (req.method === "POST") {
        const { question, cards } = req.body;

        if (!question || !Array.isArray(cards) || cards.length === 0) {
            return res.status(400).json({ error: "需要问题和至少一张塔罗牌" });
        }

        // Generate a random job ID
        const jobId = Math.random().toString(36).substring(2, 15);
        
        // Create job entry
        jobStore.set(jobId, {
            status: "pending",
            created: new Date().toISOString(),
            question,
            cards
        });

        // Start processing the job in the background (don't await)
        processJob(jobId, question, cards);

        // Return the job ID immediately
        return res.status(202).json({ 
            jobId,
            message: "Job created successfully. Poll for results."
        });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
};

async function processJob(jobId, question, cards) {
    try {
        jobStore.set(jobId, { 
            ...jobStore.get(jobId), 
            status: "processing" 
        });

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
                },
                timeout: 25000
            }
        );

        if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message.content) {
            throw new Error("API 返回的内容为空");
        }

        const resultText = response.data.choices[0].message.content.trim();
        console.log(`任务 ${jobId} 成功完成，返回结果:`, resultText);

        jobStore.set(jobId, {
            ...jobStore.get(jobId),
            status: "completed",
            result: resultText,  // 确保这里存储的是字符串
            completed: new Date().toISOString()
        });

    } catch (error) {
        console.error(`任务 ${jobId} 失败:`, error.message);
        
        jobStore.set(jobId, {
            ...jobStore.get(jobId),
            status: "failed",
            error: error.message || "未知错误",
            completed: new Date().toISOString()
        });
    }
}

