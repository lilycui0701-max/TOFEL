export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it in Vercel project environment variables."
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const question = (body.question || "No question provided.").trim();
    const transcript = (body.transcript || "").trim();

    if (!transcript) {
      return res.status(400).json({
        error: "Transcript is required before analysis."
      });
    }

    const prompt = `
You are a supportive TOEFL speaking tutor.

Evaluate the following TOEFL-style speaking response and return ONLY valid JSON.

Required JSON format:
{
  "scores": {
    "content": 1,
    "organization": 1,
    "fluency": 1
  },
  "strengths": ["..."],
  "suggestions": ["..."],
  "better_structure": ["...", "...", "...", "..."]
}

Rules:
- scores.content, scores.organization, scores.fluency must each be integers from 1 to 5
- strengths must be an array of short strings
- suggestions must be an array of short strings
- better_structure must be an array of 4 short strings
- Return JSON only, no markdown, no code fences

Question:
${question}

Transcript:
${transcript}
`.trim();

    console.log("[vercel_analyze_speaking_request]", {
      method: req.method,
      hasQuestion: Boolean(question),
      transcriptLength: transcript.length
    });

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const raw = await geminiResponse.text();

    if (!geminiResponse.ok) {
      console.error("[gemini_http_error]", {
        status: geminiResponse.status,
        body: raw
      });
      return res.status(500).json({
        error: "Evaluation failed. Please try again."
      });
    }

    let geminiJson;
    try {
      geminiJson = JSON.parse(raw);
    } catch (e) {
      console.error("[gemini_parse_error]", { raw });
      return res.status(500).json({
        error: "Evaluation failed. Please try again."
      });
    }

    const text =
      geminiJson?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      console.error("[gemini_empty_response]", geminiJson);
      return res.status(500).json({
        error: "Evaluation failed. Please try again."
      });
    }

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("[evaluation_json_parse_error]", {
        text: cleaned
      });
      return res.status(500).json({
        error: "Evaluation failed. Please try again."
      });
    }

    const safeResult = {
      transcript,
      scores: {
        content: Number(parsed?.scores?.content) || 1,
        organization: Number(parsed?.scores?.organization) || 1,
        fluency: Number(parsed?.scores?.fluency) || 1
      },
      strengths: Array.isArray(parsed?.strengths) ? parsed.strengths : [],
      suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
      better_structure: Array.isArray(parsed?.better_structure)
        ? parsed.better_structure
        : []
    };

    return res.status(200).json(safeResult);
  } catch (error) {
    console.error("[vercel_gemini_evaluation_failure]", {
      name: error?.name || "UnknownError",
      message: error?.message || String(error),
      stack: error?.stack || null
    });

    return res.status(500).json({
      error: "Evaluation failed. Please try again."
    });
  }
}
