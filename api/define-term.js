export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const term = String(req.body?.term || "").trim();

    if (!term) {
      return res.status(400).json({ error: "Missing term" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a modern English-to-Chinese dictionary for a Chinese speaker learning English. Return only valid JSON with these exact fields: term, pronunciation, phonetic, chinese, explanation, examples.",
          },
          {
            role: "user",
            content: `Explain this English term: ${term}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "dictionary_entry",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                term: { type: "string" },
                pronunciation: { type: "string" },
                phonetic: { type: "string" },
                chinese: { type: "string" },
                explanation: { type: "string" },
                examples: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "term",
                "pronunciation",
                "phonetic",
                "chinese",
                "explanation",
                "examples",
              ],
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(500).json({ error: "OpenAI API failed" });
    }

    const result = JSON.parse(data.choices[0].message.content);

    return res.status(200).json(result);
  } catch (error) {
    console.error("define-term error:", error);

    return res.status(500).json({
      error: "Failed to define term",
    });
  }
}