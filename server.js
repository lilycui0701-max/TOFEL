import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { evaluateSpeakingResponse } from "./lib/gemini-evaluator.js";

const app = express();
const preferredPort = Number(process.env.PORT) || 3000;
const fallbackPort = 3001;
let activePort = preferredPort;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.json({ limit: "200kb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
  console.log("[health_check]", { ip: req.ip, status: "ok" });
  res.json({ status: "ok" });
});

app.post("/api/analyze-speaking", async (req, res) => {
  console.log("[analyze_speaking_request]", {
    ip: req.ip,
    contentType: req.headers["content-type"] || "unknown"
  });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it to your .env file and restart the server."
    });
  }

  const question = req.body?.question?.trim();
  const transcript = req.body?.transcript?.trim();

  if (!transcript) {
    return res.status(400).json({
      error: "Transcript is required before analysis."
    });
  }

  try {
    const evaluation = await evaluateSpeakingResponse({
      question: question || "No question provided.",
      transcript
    });

    return res.json({
      transcript,
      ...evaluation
    });
  } catch (error) {
    console.error("[gemini_evaluation_failure]", {
      name: error?.name || "UnknownError",
      message: error?.message || String(error),
      stack: error?.stack || null
    });

    return res.status(500).json({
      error: "Evaluation failed. Please try again."
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

function startServer(portToTry) {
  app
    .listen(portToTry, () => {
      activePort = portToTry;
      console.log(`Server running on http://localhost:${activePort}`);
    })
    .on("error", (error) => {
      if (error.code === "EADDRINUSE" && portToTry === preferredPort) {
        console.warn(`Port ${preferredPort} is in use. Switching to http://localhost:${fallbackPort}`);
        startServer(fallbackPort);
        return;
      }

      console.error("[startup_failure]", {
        port: portToTry,
        message: error.message
      });
      process.exit(1);
    });
}

startServer(preferredPort);
