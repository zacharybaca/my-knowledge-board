import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Use vi.hoisted so mock fns are available when the factory runs ──────────
const { mockGenerateContent, mockEmbedContent, mockGetGenerativeModel } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockEmbedContent: vi.fn(),
  mockGetGenerativeModel: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel(...args) {
      return mockGetGenerativeModel(...args);
    }
  },
}));

import { enhanceArticleText, generateEmbedding } from "../../controllers/aiController.js";

const makeRes = () => {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// ── enhanceArticleText ─────────────────────────────────────────────────────
describe("enhanceArticleText", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  it("forwards 400 via next when no text is provided", async () => {
    const next = vi.fn();
    const res = makeRes();

    await enhanceArticleText({ body: {} }, res, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toMatch(/no text provided/i);
    expect(res.statusCode).toBe(400);
  });

  it("uses 'professional' prompt when promptType is 'professional'", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "Professional text" },
    });
    const res = makeRes();

    await enhanceArticleText({ body: { text: "hello world", promptType: "professional" } }, res, vi.fn());

    const [fullPrompt] = mockGenerateContent.mock.calls[0];
    expect(fullPrompt).toMatch(/corporate policy or procedure manual/i);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, enhancedText: "Professional text" }),
    );
  });

  it("uses 'simplify' prompt when promptType is 'simplify'", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "Simple text" },
    });

    await enhanceArticleText({ body: { text: "complex jargon", promptType: "simplify" } }, makeRes(), vi.fn());

    const [fullPrompt] = mockGenerateContent.mock.calls[0];
    expect(fullPrompt).toMatch(/jargon/i);
  });

  it("uses step-by-step prompt when promptType is 'step-by-step'", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "1. Step one" },
    });

    await enhanceArticleText({ body: { text: "do the thing", promptType: "step-by-step" } }, makeRes(), vi.fn());

    const [fullPrompt] = mockGenerateContent.mock.calls[0];
    expect(fullPrompt).toMatch(/numbered step-by-step/i);
  });

  it("falls back to grammar improvement for an unknown promptType", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "Improved text" },
    });

    await enhanceArticleText({ body: { text: "some text", promptType: "unknown" } }, makeRes(), vi.fn());

    const [fullPrompt] = mockGenerateContent.mock.calls[0];
    expect(fullPrompt).toMatch(/proofread/i);
  });

  it("falls back to grammar improvement when promptType is absent", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "Better text" },
    });

    await enhanceArticleText({ body: { text: "raw text" } }, makeRes(), vi.fn());

    const [fullPrompt] = mockGenerateContent.mock.calls[0];
    expect(fullPrompt).toMatch(/proofread/i);
  });

  it("forwards 500 via next when the AI call fails", async () => {
    mockGenerateContent.mockRejectedValue(new Error("AI down"));
    const next = vi.fn();
    const res = makeRes();

    await enhanceArticleText({ body: { text: "some text", promptType: "professional" } }, res, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toMatch(/failed to generate/i);
    expect(res.statusCode).toBe(500);
  });
});

// ── generateEmbedding ──────────────────────────────────────────────────────
describe("generateEmbedding", () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
    mockGetGenerativeModel.mockReturnValue({ embedContent: mockEmbedContent });
  });

  it("returns the embedding values array", async () => {
    const fakeValues = [0.1, 0.2, 0.3];
    mockEmbedContent.mockResolvedValue({ embedding: { values: fakeValues } });

    const result = await generateEmbedding("hello");

    expect(result).toEqual(fakeValues);
  });

  it("passes the text to the embedding model", async () => {
    mockEmbedContent.mockResolvedValue({ embedding: { values: [] } });

    await generateEmbedding("article about security");

    expect(mockEmbedContent).toHaveBeenCalledWith("article about security");
  });
});
