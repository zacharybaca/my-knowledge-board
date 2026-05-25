import { GoogleGenerativeAI } from "@google/generative-ai";
import asyncHandler from "express-async-handler";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateArticleMetadata = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    res.status(400);
    throw new Error("Content is required for analysis.");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Analyze the following technical article content.
    Provide a concise 2-sentence summary.
    Provide an array of 3 to 5 highly relevant categorization tags (single words or short phrases).

    You must respond ONLY with a valid, raw JSON object. Do not include markdown formatting, backticks, or introductory text.
    Schema: {"summary": "string", "tags": ["string"]}

    Article Content:
    ${content}
  `;

  try {
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // Aggressive sanitization: locate first '{' and last '}' to strip outside text
    const jsonStartIndex = responseText.indexOf("{");
    const jsonEndIndex = responseText.lastIndexOf("}");

    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error("Model did not return a JSON object.");
    }

    const cleanedJson = responseText.substring(
      jsonStartIndex,
      jsonEndIndex + 1,
    );
    const parsedData = JSON.parse(cleanedJson);

    res.json(parsedData);
  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500);
    throw new Error(
      "Failed to generate or parse AI metadata. Check server terminal for raw output.",
    );
  }
});
