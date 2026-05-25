import { GoogleGenerativeAI } from '@google/generative-ai';
import asyncHandler from 'express-async-handler';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateArticleMetadata = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    res.status(400);
    throw new Error('Content is required for analysis.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
    Analyze the following technical article content.
    Provide a concise 2-sentence summary.
    Provide an array of 3 to 5 highly relevant categorization tags (single words or short phrases).

    Return ONLY a valid JSON object matching this exact schema, with no markdown formatting or backticks:
    {
      "summary": "string",
      "tags": ["string"]
    }

    Article Content:
    ${content}
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  // Clean potential markdown blocks from standard LLM outputs
  const cleanedJson = responseText.replace(/```json\n?|```/g, '').trim();

  res.json(JSON.parse(cleanedJson));
});
