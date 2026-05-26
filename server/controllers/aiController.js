import { GoogleGenerativeAI } from "@google/generative-ai";
import asyncHandler from "express-async-handler";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateArticleMetadata = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    res.status(400);
    throw new Error("Content is required for analysis.");
  }

  // Enforce strict JSON output at the model level
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = `
    Analyze the following technical article content.
    Provide a concise 2-sentence summary.
    Provide an array of 3 to 5 highly relevant categorization tags (single words or short phrases).

    Adhere strictly to this JSON schema:
    {
      "summary": "string",
      "tags": ["string"]
    }

    Article Content:
    ${content}
  `;

  try {
    const result = await model.generateContent(prompt);

    // The response is now guaranteed to be a valid JSON string
    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    res.json(parsedData);
  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500);
    throw new Error(
      "Failed to generate or parse AI metadata. The model returned malformed data.",
    );
  }
});
