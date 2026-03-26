import { evaluateSpeakingResponse } from "../lib/gemini-evaluator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  console.log("[vercel_analyze_speaking_request]", {
    contentType: req.headers["content-type"] || "unknown"
  });

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it in Vercel project environment variables."
    });
    return;
  }

  const question = req.body?.question?.trim();
  const transcript = req.body?.transcript?.trim();

  if (!transcript) {
    res.status(400).json({ error: "Transcript is required before analysis." });
    return;
  }

  try {
    const evaluation = await evaluateSpeakingResponse({
      question: question || "No question provided.",
      transcript
    });

    res.status(200).json({
      transcript,
      ...evaluation
    });
  } catch (error) {
    console.error("[vercel_gemini_evaluation_failure]", {
      name: error?.name || "UnknownError",
      message: error?.message || String(error),
      stack: error?.stack || null
    });

    res.status(500).json({
      error: "Evaluation failed. Please try again."
    });
  }
}
