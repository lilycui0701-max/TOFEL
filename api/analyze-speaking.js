import { GoogleGenAI } from "@google/genai";

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  return rawBody ? JSON.parse(rawBody) : {};
}

function clampScore(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.round(numeric)));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  console.log("[analyze-speaking] request received", {
    method: req.method,
    contentType: req.headers["content-type"] || "unknown"
  });

  if (req.method === "OPTIONS") {
    console.log("[analyze-speaking] handled preflight");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    console.warn("[analyze-speaking] invalid method", { method: req.method });
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[analyze-speaking] missing GEMINI_API_KEY");
    res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it in Vercel project environment variables."
    });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(req);
    console.log("[analyze-speaking] body parsed", {
      hasBody: Boolean(payload && Object.keys(payload).length),
      hasQuestion: Boolean(payload?.question),
      hasTranscript: Boolean(payload?.transcript)
    });
  } catch (error) {
    console.error("[analyze-speaking] invalid JSON body", {
      message: error?.message || String(error)
    });
    res.status(400).json({
      error: "Request body must be valid JSON."
    });
    return;
  }

  const question = payload?.question?.trim();
  const transcript = payload?.transcript?.trim();

  if (!transcript) {
    console.warn("[analyze-speaking] missing transcript");
    res.status(400).json({
      error: "Transcript is required before analysis."
    });
    return;
  }

  try {
    console.log("[analyze-speaking] Gemini call starting", {
      hasQuestion: Boolean(question),
      transcriptLength: transcript.length
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        "Act like a supportive TOEFL speaking tutor. Score content, organization, and fluency from 1 to 5. Give concise and practical strengths. Give specific improvement suggestions. Provide a clearer improved response structure. Return valid JSON only.\n\n" +
        `Question: ${question || "No question provided."}\n\n` +
        `Transcript: ${transcript}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          required: ["scores", "strengths", "suggestions", "better_structure"],
          properties: {
            scores: {
              type: "OBJECT",
              required: ["content", "organization", "fluency"],
              properties: {
                content: { type: "INTEGER" },
                organization: { type: "INTEGER" },
                fluency: { type: "INTEGER" }
              }
            },
            strengths: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            suggestions: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            better_structure: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          }
        }
      }
    });

    const text = response.text;

    if (!text) {
      console.error("[analyze-speaking] Gemini returned empty response");
      throw new Error("Gemini returned an empty response.");
    }

    const parsed = JSON.parse(text);
    const evaluation = {
      scores: {
        content: clampScore(parsed?.scores?.content),
        organization: clampScore(parsed?.scores?.organization),
        fluency: clampScore(parsed?.scores?.fluency)
      },
      strengths: Array.isArray(parsed?.strengths) ? parsed.strengths : [],
      suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
      better_structure: Array.isArray(parsed?.better_structure)
        ? parsed.better_structure
        : ["My opinion is ...", "First, ...", "Second, ...", "Therefore, ..."]
    };

    console.log("[analyze-speaking] Gemini call succeeded", {
      contentScore: evaluation.scores.content,
      organizationScore: evaluation.scores.organization,
      fluencyScore: evaluation.scores.fluency
    });

    res.status(200).json({
      transcript,
      ...evaluation
    });
  } catch (error) {
    console.error("[analyze-speaking] Gemini call failed", {
      name: error?.name || "UnknownError",
      message: error?.message || String(error),
      stack: error?.stack || null
    });

    res.status(500).json({
      error: "Evaluation failed. Please try again."
    });
  }
}
