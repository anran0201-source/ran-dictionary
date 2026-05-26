export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const term = String(req.body?.term || "").trim();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Define "${term}" as an English-to-Chinese dictionary entry.

Return ONLY valid JSON:
{
  "term": "${term}",
  "pronunciation": "...",
  "phonetic": "...",
  "chinese": "...",
  "explanation": "...",
  "examples": ["...", "...", "..."]
}`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res.status(500).json({ error: "Gemini API failed" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const result = JSON.parse(text);

    return res.status(200).json(result);
  } catch (error) {
    console.error("define-term error:", error);
    return res.status(500).json({ error: "Failed to define term" });
  }
}