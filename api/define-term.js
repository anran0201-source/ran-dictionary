export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const term = String(req.body?.term || "").trim();

    if (!term) {
      return res.status(400).json({ error: "Missing term" });
    }

    const dictionaryResult = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`
    );

    let dictionaryData = null;

    if (dictionaryResult.ok) {
      dictionaryData = await dictionaryResult.json();
    }

    const firstEntry = Array.isArray(dictionaryData) ? dictionaryData[0] : null;
    const phoneticObj =
      firstEntry?.phonetics?.find((item) => item.text) ||
      firstEntry?.phonetics?.[0];

    const baseDefinition =
      firstEntry?.meanings?.[0]?.definitions?.[0]?.definition ||
      "";

    const phonetic = phoneticObj?.text || "IPA unavailable";
    const pronunciation = phonetic || "Pronunciation unavailable";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
You are a modern English-to-Chinese dictionary for a Chinese speaker learning English.

Term: ${term}
Free Dictionary definition: ${baseDefinition || "No dictionary definition found"}
IPA: ${phonetic}

Return ONLY valid JSON with this exact shape:
{
  "term": "...",
  "pronunciation": "...",
  "phonetic": "...",
  "chinese": "...",
  "explanation": "...",
  "examples": ["...", "...", "..."]
}

Rules:
- Use current, natural English.
- Include modern usage if relevant.
- Chinese should be Simplified Chinese.
- Examples should be practical and natural.
`
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

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", geminiData);
      return res.status(500).json({ error: "Gemini API failed" });
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const aiResult = JSON.parse(text);

    return res.status(200).json({
      term: aiResult.term || term,
      pronunciation: aiResult.pronunciation || pronunciation,
      phonetic: aiResult.phonetic || phonetic,
      chinese: aiResult.chinese,
      explanation: aiResult.explanation || baseDefinition,
      examples: aiResult.examples || []
    });
  } catch (error) {
    console.error("define-term error:", error);
    return res.status(500).json({ error: "Failed to define term" });
  }
}