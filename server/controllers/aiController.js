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

// @desc    Enhance drafted article text
// @route   POST /api/ai/enhance-text
// @access  Private
export const enhanceArticleText = asyncHandler(async (req, res) => {
  const { text, promptType } = req.body;

  if (!text) {
    res.status(400);
    throw new Error("No text provided for enhancement");
  }

  // Define how the AI should rewrite the text based on the user's request
  let systemPrompt = "";
  switch (promptType) {
    case "professional":
      systemPrompt = "Rewrite the following text to sound highly professional, objective, and suitable for a corporate policy or procedure manual. Fix any grammatical errors.";
      break;
    case "simplify":
      systemPrompt = "Rewrite the following text to be as simple and clear as possible. Remove jargon and make it easy for a beginner to understand.";
      break;
    case "step-by-step":
      systemPrompt = "Format the following text into a clear, numbered step-by-step guide. Ensure the flow is logical.";
      break;
    default:
      systemPrompt = "Proofread and improve the clarity and grammar of the following text.";
  }

  const fullPrompt = `${systemPrompt}\n\nHere is the text:\n"""\n${text}\n"""`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    res.json({ success: true, enhancedText: responseText });
  } catch (error) {
    console.error("AI Enhancement Error:", error);
    res.status(500);
    throw new Error("Failed to generate AI enhancement");
  }
});

export const generateEmbedding = async (text) => {
  // Use Gemini's embedding model
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
};
