import { GoogleGenerativeAI } from "@google/generative-ai";
import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import ContentGapLog from "../models/ContentGapLog.js";
import mongoose from "mongoose";
import { generateEmbedding } from "./aiController.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const FALLBACK_ANSWER =
  "I couldn't find any specific information regarding that in our active policies. Please try rephrasing your question or consult your manager.";

const normalizeCompanyId = (company) => {
  if (!company) return null;
  if (typeof company === "object" && company._id) return company._id;
  return company;
};

const logContentGap = async ({ companyId, question, userId, type }) => {
  try {
    await ContentGapLog.create({
      companyId,
      question,
      type,
      userId,
    });
  } catch (logError) {
    console.error("Failed to log content gap:", logError);
  }
};

export const generateChatResponse = asyncHandler(async (req, res) => {
  const { question } = req.body;
  const accessibleCompanyIds = (Array.isArray(req.user.companyId)
    ? req.user.companyId
    : [req.user.companyId]
  )
    .map(normalizeCompanyId)
    .filter(Boolean);
  const selectedCompanyId = normalizeCompanyId(req.body.companyId);

  if (!question) {
    res.status(400);
    throw new Error("Question is required.");
  }

  if (accessibleCompanyIds.length === 0) {
    res.status(400);
    throw new Error("No company access found for this user.");
  }

  if (
    selectedCompanyId &&
    !accessibleCompanyIds.some(
      (companyId) => companyId.toString() === selectedCompanyId.toString(),
    )
  ) {
    res.status(403);
    throw new Error("Not authorized for the selected company.");
  }

  // --- 1. Generate Embedding for the User's Query ---
  let queryEmbedding;
  try {
    queryEmbedding = await generateEmbedding(question);
  } catch (error) {
    await logContentGap({
      companyId: selectedCompanyId || accessibleCompanyIds[0],
      question,
      type: "failed_search",
      userId: req.user._id,
    });

    return res.json({
      answer: FALLBACK_ANSWER,
      sources: [],
    });
  }

  // --- 2. Perform Vector Search (Retrieval) ---
  const companyFilter = selectedCompanyId
    ? { $eq: new mongoose.Types.ObjectId(selectedCompanyId) }
    : {
        $in: accessibleCompanyIds.map(
          (companyId) => new mongoose.Types.ObjectId(companyId),
        ),
      };

  // --- Role-Based Access Control (RBAC) Logic ---
  // If the user is an Employee, they can ONLY see articles mapped to their specific department(s)
  const isElevated =
    req.user.role.includes("Admin") || req.user.role.includes("Manager");

  // Post-vector-search filter: status and department are not indexed as Atlas
  // Vector Search filter fields, so they must be applied in a $match stage.
  const postMatchFilter = { status: "Approved" };
  if (!isElevated) {
    postMatchFilter.department = { $in: [req.user.department] };
  }

  // Execute the vector search — filter only by companyId (the indexed filter
  // field). Use a larger limit/numCandidates to ensure enough candidates
  // survive the subsequent $match on status and department.
  const relevantArticles = await Article.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "contentEmbedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 20,
        filter: { companyId: companyFilter },
      },
    },
    { $match: postMatchFilter },
    { $limit: 4 },
    {
      $project: {
        _id: 1,
        title: 1,
        content: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  // If no articles are found or relevance is too low, log the content gap and fallback
  if (relevantArticles.length === 0 || relevantArticles[0].score < 0.6) {
    await logContentGap({
      companyId: selectedCompanyId || accessibleCompanyIds[0],
      question,
      type: "unanswered_chat",
      userId: req.user._id,
    });

    return res.json({
      answer: FALLBACK_ANSWER,
      sources: [],
    });
  }

  // --- 3. Format Context for the LLM ---
  let contextData = "COMPANY KNOWLEDGE BASE CONTEXT:\n\n";
  const sources = [];

  relevantArticles.forEach((article, index) => {
    // Strip HTML tags from the content so the LLM processes raw text cleanly
    const cleanContent = article.content.replace(/<[^>]*>?/gm, "").trim();

    contextData += `[Source ${index + 1}] Title: ${article.title}\nContent: ${cleanContent}\n\n`;

    // Save metadata for the frontend to render clickable links
    sources.push({
      id: article._id,
      title: article.title,
      citationNumber: index + 1,
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
      sources, // Pass the sources array back to the client
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
