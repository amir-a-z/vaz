import express from "express";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { repairFormula } from "./src/utils/formulaRepair";

const PORT = 3000;
const FLASK_PORT = 5001;

let pythonProcess: ChildProcess | null = null;
let aiClient: GoogleGenAI | null = null;
let isShuttingDown = false;

function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI();
  }
  return aiClient;
}

function startPythonBackend() {
  if (pythonProcess && !pythonProcess.killed && pythonProcess.exitCode === null) {
    return;
  }
  console.log(`Starting Python Flask backend on port ${FLASK_PORT}...`);
  pythonProcess = spawn("python3", ["-u", "app.py"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, FLASK_PORT: String(FLASK_PORT) },
  });

  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python backend:", err);
  });

  pythonProcess.on("exit", (code, signal) => {
    console.log(`Python process exited with code ${code} and signal ${signal}`);
    pythonProcess = null;
    if (!isShuttingDown) {
      console.log("Auto-restarting Python backend in 1.5 seconds...");
      setTimeout(() => {
        if (!isShuttingDown) {
          startPythonBackend();
        }
      }, 1500);
    }
  });
}

function cleanup() {
  isShuttingDown = true;
  if (pythonProcess && !pythonProcess.killed) {
    console.log("Terminating Python backend process...");
    pythonProcess.kill("SIGTERM");
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

async function startServer() {
  startPythonBackend();

  const app = express();

  // AI-powered deep formula repair using Gemini 3.8 Flash
  app.post("/api/ai_repair_formula", express.json(), async (req, res) => {
    try {
      const { formula } = req.body || {};
      if (!formula || typeof formula !== "string" || !formula.trim()) {
        return res.status(400).json({
          success: false,
          error: "فرمول ورودی برای اصلاح ارائه نشده است.",
        });
      }

      try {
        const ai = getGenAI();
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert in LaTeX mathematics and Word OMML formula conversion.
A user provided the following broken, unreadable, or malformed mathematical formula:
"""
${formula}
"""

Task:
1. Fix all typos (e.g. \\fac -> \\frac, \\sqr -> \\sqrt, \\aplha -> \\alpha), unclosed braces/brackets, computational expressions (e.g. sqrt(x**2) -> \\sqrt{x^2}), and LaTeX syntax errors.
2. Return ONLY a pure JSON object matching this schema without markdown fences:
{
  "fixedFormula": "the complete repaired valid LaTeX formula without enclosing $ or $$",
  "explanationFa": "توضیح بسیار کوتاه و شفاف فارسی درباره اصلاحاتی که انجام شد"
}`
                }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
          }
        });

        const rawJson = response.text || "{}";
        const parsed = JSON.parse(rawJson);

        return res.json({
          success: true,
          fixedFormula: parsed.fixedFormula || formula,
          explanationFa: parsed.explanationFa || "فرمول با موفقیت با هوش مصنوعی اصلاح شد.",
        });
      } catch (aiErr: any) {
        console.warn("AI repair unavailable, using high-speed local repair engine:", aiErr.message);
        const local = repairFormula(formula);
        return res.json({
          success: true,
          fixedFormula: local.fixed,
          explanationFa: local.changes.join("، ") || "فرمول با الگوریتم هوشمند اصلاح شد.",
          isFallback: true,
        });
      }
    } catch (err: any) {
      console.error("Formula Repair Route Error:", err);
      const local = repairFormula(req.body?.formula || "");
      return res.json({
        success: true,
        fixedFormula: local.fixed,
        explanationFa: local.changes.join("، "),
        isFallback: true,
      });
    }
  });

  // Proxy /api requests to Python Flask backend
  app.use(
    createProxyMiddleware({
      target: `http://127.0.0.1:${FLASK_PORT}`,
      changeOrigin: true,
      pathFilter: "/api",
      ws: true,
    })
  );

  // Health check for Node server
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", node: true, pythonPort: FLASK_PORT });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Main Web Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  cleanup();
  process.exit(1);
});
