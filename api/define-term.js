export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { term } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Define the English word "${term}".

Return JSON with:
- englishMeaning
- chineseMeaning
- examples (array)
- pronunciation
- phonetic
`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log(data);

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({
      raw: text,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Gemini API failed",
    });
  }
}