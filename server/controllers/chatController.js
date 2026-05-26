import { GoogleGenerativeAI } from '@google/generative-ai';
import asyncHandler from 'express-async-handler';
import Article from '../models/Article.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateChatResponse = asyncHandler(async (req, res) => {
  const { question } = req.body;
  const companyId = req.user.companyId;

  if (!question) {
    res.status(400);
    throw new Error('Question is required.');
  }

  // 1. Keyword Extraction for Simple Retrieval
  const words = question.split(' ').filter(w => w.length > 3);
  const regex = new RegExp(words.join('|'), 'i');

  // 2. Fetch Company-Specific Context
  const relevantArticles = await Article.find({
    companyId: companyId,
    status: 'Approved',
    $or: [{ title: regex }, { tags: regex }, { content: regex }]
  }).limit(3).select('title content');

  const contextData = relevantArticles.length > 0
    ? relevantArticles.map(a => `Title: ${a.title}\nContent: ${a.content}`).join('\n\n')
    : "No highly relevant policies found. General company knowledge applies.";

  // 3. System Prompt Execution
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    You are an internal knowledge base assistant for the company.
    Answer the employee's question using ONLY the provided context below.
    If the answer cannot be determined from the context, state that you cannot find the specific policy and advise them to consult their manager. Do not invent procedures. Do not use markdown backticks for the final output, keep it readable text.

    Context:
    ${contextData}

    Employee Question: ${question}
  `;

  try {
    const result = await model.generateContent(prompt);
    const answer = result.response.text();
    res.json({ answer });
  } catch (error) {
    if (error.status === 503) {
      res.status(503);
      throw new Error("The AI network is currently experiencing high traffic. Please wait a moment and ask your question again.");
    }

    res.status(500);
    throw new Error("Knowledge base AI is temporarily disconnected. Try again later.");
  }
});
