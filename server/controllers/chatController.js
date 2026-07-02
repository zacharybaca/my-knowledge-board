import { GoogleGenerativeAI } from "@google/generative-ai";
import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import ContentGapLog from "../models/ContentGapLog.js";
import mongoose from "mongoose";
import { generateEmbedding } from "./aiController.js";
import { stripHtml } from "../utils/sanitizeHtml.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const FALLBACK_ANSWER =
  "I couldn't find any specific information regarding that in our active policies. Please try rephrasing your question or consult your manager.";

const normalizeCompanyId = (company) => {
  if (!company) return null;
  if (typeof company === "object" && company._id) return company._id;
  return company;
};

const logContentGap = async ({
  companyId,
  question,
  userId,
  type,
  embedding,
}) => {
  try {
    await ContentGapLog.create({
      companyId,
      question,
      type,
      userId,
      ...(Array.isArray(embedding) && embedding.length > 0
        ? { questionEmbedding: embedding }
        : {}),
    });
  } catch (logError) {
    console.error("Failed to log content gap:", logError);
  }
};

export const generateChatResponse = asyncHandler(async (req, res) => {
  const { question } = req.body;
  const accessibleCompanyIds = (
    Array.isArray(req.user.companyId)
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
  // A failure here is non-fatal: the text search fallback below does not need
  // an embedding, so we log and continue rather than returning early.
  let queryEmbedding = null;
  try {
    queryEmbedding = await generateEmbedding(question);
  } catch (error) {
    console.error(
      "Embedding generation failed, skipping vector search:",
      error,
    );
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
  const userDepartments = Array.isArray(req.user.department)
    ? req.user.department
    : [req.user.department].filter(Boolean);

  // Post-vector-search filter: status and department are not indexed as Atlas
  // Vector Search filter fields, so they must be applied in a $match stage.
  const postMatchFilter = { status: "Approved" };
  if (!isElevated && userDepartments.length > 0) {
    postMatchFilter.department = { $in: userDepartments };
  }

  // Execute the vector search only when we have a valid embedding.
  // Use a larger limit/numCandidates so enough candidates survive the
  // subsequent $match on status and department.
  let relevantArticles = [];
  if (queryEmbedding) {
    try {
      const vectorResults = await Article.aggregate([
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

      if (vectorResults.length > 0 && vectorResults[0].score >= 0.6) {
        relevantArticles = vectorResults;
      }
    } catch (vectorError) {
      console.error(
        "Vector search failed, falling back to text search:",
        vectorError,
      );
    }
  }

  // --- 2b. Text Search Fallback ---
  // Used when vector search yields no results, low scores, or fails entirely
  // (e.g., articles have no embeddings or the vector index is not available).
  if (relevantArticles.length === 0) {
    const textSearchFilter = {
      companyId: selectedCompanyId
        ? selectedCompanyId
        : { $in: accessibleCompanyIds },
      status: "Approved",
      $text: { $search: question },
    };
    if (!isElevated && userDepartments.length > 0) {
      textSearchFilter.department = { $in: userDepartments };
    }

    relevantArticles = await Article.find(textSearchFilter, {
      score: { $meta: "textScore" },
    })
      .sort({ score: { $meta: "textScore" } })
      .limit(4)
      .select("title content");
  }

  // If both searches returned nothing, log the content gap and fallback
  if (relevantArticles.length === 0) {
    console.error(
      `Chat fallback triggered — no articles found for question: "${question}" ` +
        `(companyIds: ${accessibleCompanyIds}, embeddingAvailable: ${!!queryEmbedding})`,
    );

    await logContentGap({
      companyId: selectedCompanyId || accessibleCompanyIds[0],
      question,
      type: "unanswered_chat",
      userId: req.user._id,
      embedding: queryEmbedding,
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
    const cleanContent = stripHtml(article.content);

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
