import { GoogleGenerativeAI } from "@google/generative-ai";
import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import mongoose from "mongoose";
import { generateEmbedding } from "./aiController.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateChatResponse = asyncHandler(async (req, res) => {
  const { question } = req.body;
  // Ensure we get the active company ID correctly from the array structure
  const activeCompanyId = req.body.companyId || req.user.companyId[0];

  if (!question) {
    res.status(400);
    throw new Error("Question is required.");
  }

  // --- 1. Generate Embedding for the User's Query ---
  let queryEmbedding;
  try {
    queryEmbedding = await generateEmbedding(question);
  } catch (error) {
    res.status(500);
    throw new Error("Failed to process query embedding");
  }

  // --- 2. Perform Vector Search (Retrieval) ---
  const companyObjectId = new mongoose.Types.ObjectId(activeCompanyId);

  // Base filter: Must belong to their company and be Approved
  const searchFilter = {
    companyId: { $eq: companyObjectId },
    status: "Approved"
  };

  // --- Role-Based Access Control (RBAC) Logic ---
  // If the user is an Employee, they can ONLY see articles mapped to their specific department(s) or "Public"/"Other"
  const isElevated = req.user.role.includes("Admin") || req.user.role.includes("Manager");
  if (!isElevated) {
    searchFilter.department = { $in: req.user.department };
  }

  // Execute the vector search
  const relevantArticles = await Article.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "contentEmbedding",
        queryVector: queryEmbedding,
        numCandidates: 20,
        limit: 4, // Retrieve the top 4 most relevant articles
        filter: searchFilter
      }
    },
    {
      $project: {
        _id: 1,
        title: 1,
        content: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ]);

  // If no articles are found or relevance is too low, fallback
  if (relevantArticles.length === 0 || relevantArticles[0].score < 0.6) {
    return res.json({
      answer: "I couldn't find any specific information regarding that in our active policies. Please try rephrasing your question or consult your manager.",
      sources: []
    });
  }

  // --- 3. Format Context for the LLM ---
  let contextData = "COMPANY KNOWLEDGE BASE CONTEXT:\n\n";
  const sources = [];

  relevantArticles.forEach((article, index) => {
    // Strip HTML tags from the content so the LLM processes raw text cleanly
    const cleanContent = article.content.replace(/<[^>]*>?/gm, '').trim();

    contextData += `[Source ${index + 1}] Title: ${article.title}\nContent: ${cleanContent}\n\n`;

    // Save metadata for the frontend to render clickable links
    sources.push({
      id: article._id,
      title: article.title,
      citationNumber: index + 1
    });
  });

  // --- 4. Generation ---
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an internal knowledge base assistant for the company.
    Answer the employee's question using ONLY the provided context below.
    If the answer cannot be determined from the context, state that you cannot find the specific policy and advise them to consult their manager. Do not invent procedures. Do not use markdown backticks for the final output, keep it readable text.
    When you state a fact, you MUST cite the source using the bracket notation (e.g., "According to the policy [Source 1]...").

    Context:
    ${contextData}

    Employee Question: ${question}
  `;

  try {
    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    res.json({
      answer,
      sources // Pass the sources array back to the client
    });
  } catch (error) {
    if (error.status === 503) {
      res.status(503);
      throw new Error(
        "The AI network is currently experiencing high traffic. Please wait a moment and ask your question again.",
      );
    }

    res.status(500);
    throw new Error(
      "Knowledge base AI is temporarily disconnected. Try again later.",
    );
  }
});
