import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted so all mock fns are available when factories run ─────────────
const {
  mockAggregate,
  mockFind,
  mockFindSort,
  mockFindLimit,
  mockFindSelect,
  mockGenerateEmbedding,
  mockGenerateContent,
  mockGetGenerativeModel,
  mockCreateContentGap,
} = vi.hoisted(() => ({
  mockAggregate: vi.fn(),
  mockFind: vi.fn(),
  mockFindSort: vi.fn(),
  mockFindLimit: vi.fn(),
  mockFindSelect: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockGetGenerativeModel: vi.fn(),
  mockCreateContentGap: vi.fn(),
}));

vi.mock("../../models/Article.js", () => ({
  default: { aggregate: mockAggregate, find: mockFind },
}));

vi.mock("../../controllers/aiController.js", () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

vi.mock("../../models/ContentGapLog.js", () => ({
  default: { create: mockCreateContentGap },
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel(...args) {
      return mockGetGenerativeModel(...args);
    }
  },
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  // ObjectId is used as `new mongoose.Types.ObjectId(id)` — must be a constructor
  function FakeObjectId(id) {
    this.id = id;
  }
  return {
    ...actual,
    default: {
      ...actual.default,
      Types: {
        ObjectId: FakeObjectId,
      },
    },
  };
});

import { generateChatResponse } from "../../controllers/chatController.js";

// ── Helpers ────────────────────────────────────────────────────────────────
const companyId = "company-001";

const makeUser = (overrides = {}) => ({
  _id: "user-1",
  role: ["Employee"],
  department: "Tech Support",
  companyId: [companyId],
  ...overrides,
});

const makeReq = (overrides = {}) => ({
  body: { question: "What is the refund policy?" },
  user: makeUser(),
  ...overrides,
});

const makeRes = () => {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const fakeArticle = {
  _id: "article-1",
  title: "Refund Policy",
  content: "<p>Refunds are processed <b>within 5 days</b>.</p>",
  score: 0.95,
};

// ── generateChatResponse ───────────────────────────────────────────────────
describe("generateChatResponse", () => {
  beforeEach(() => {
    mockGenerateEmbedding.mockReset();
    mockAggregate.mockReset();
    mockFind.mockReset();
    mockFindSort.mockReset();
    mockFindLimit.mockReset();
    mockFindSelect.mockReset();
    mockCreateContentGap.mockReset();
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
    });
    mockFind.mockReturnValue({ sort: mockFindSort });
    mockFindSort.mockReturnValue({ limit: mockFindLimit });
    mockFindLimit.mockReturnValue({ select: mockFindSelect });
    mockFindSelect.mockResolvedValue([]);
  });

  it("forwards 400 via next when question is missing", async () => {
    const next = vi.fn();
    const res = makeRes();

    await generateChatResponse(makeReq({ body: {} }), res, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toMatch(/question is required/i);
    expect(res.statusCode).toBe(400);
  });

  it("returns fallback and logs content gap when embedding generation fails", async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error("AI offline"));
    const res = makeRes();
    const next = vi.fn();

    await generateChatResponse(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: [],
        answer: expect.stringMatching(/couldn't find/i),
      }),
    );
    expect(mockCreateContentGap).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "What is the refund policy?",
        type: "unanswered_chat",
      }),
    );
  });

  it("returns fallback answer when no articles are found", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2]);
    mockAggregate.mockResolvedValue([]);
    const res = makeRes();

    await generateChatResponse(makeReq(), res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: [],
        answer: expect.stringMatching(/couldn't find/i),
      }),
    );
  });

  it("returns fallback when the top article score is below 0.6", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([{ ...fakeArticle, score: 0.55 }]);
    const res = makeRes();

    await generateChatResponse(makeReq(), res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ sources: [] }),
    );
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("strips HTML tags from article content before sending to LLM", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([fakeArticle]);
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "Refunds take 5 days [Source 1]." },
    });

    await generateChatResponse(makeReq(), makeRes(), vi.fn());

    const [prompt] = mockGenerateContent.mock.calls[0];
    expect(prompt).toContain("Refunds are processed within 5 days.");
    expect(prompt).not.toContain("<p>");
    expect(prompt).not.toContain("<b>");
  });

  it("includes source metadata with citation numbers", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([fakeArticle]);
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "Answer with [Source 1]." },
    });

    const res = makeRes();
    await generateChatResponse(makeReq(), res, vi.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]).toMatchObject({
      id: "article-1",
      title: "Refund Policy",
      citationNumber: 1,
    });
  });

  it("applies department filter for Employee role (RBAC)", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([{ ...fakeArticle, score: 0.4 }]);
    const req = makeReq({
      user: makeUser({ role: ["Employee"], department: "Sales" }),
    });

    await generateChatResponse(req, makeRes(), vi.fn());

    const [[pipeline]] = mockAggregate.mock.calls;
    const matchStage = pipeline[1].$match;
    expect(matchStage).toMatchObject({
      department: { $in: ["Sales"] },
    });
  });

  it("searches across all accessible companies when no company is specified", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([{ ...fakeArticle, score: 0.4 }]);
    const req = makeReq({
      user: makeUser({ companyId: ["company-001", "company-002"] }),
    });

    await generateChatResponse(req, makeRes(), vi.fn());

    const [[pipeline]] = mockAggregate.mock.calls;
    expect(pipeline[0].$vectorSearch.filter.companyId).toEqual({
      $in: [{ id: "company-001" }, { id: "company-002" }],
    });
  });

  it("restricts search to selected company when companyId is provided", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([{ ...fakeArticle, score: 0.4 }]);
    const req = makeReq({
      body: {
        question: "What is the refund policy?",
        companyId: "company-002",
      },
      user: makeUser({ companyId: ["company-001", "company-002"] }),
    });

    await generateChatResponse(req, makeRes(), vi.fn());

    const [[pipeline]] = mockAggregate.mock.calls;
    expect(pipeline[0].$vectorSearch.filter.companyId).toEqual({
      $eq: { id: "company-002" },
    });
  });

  it("forwards 403 via next when provided companyId is not accessible", async () => {
    const next = vi.fn();
    const res = makeRes();
    const req = makeReq({
      body: {
        question: "What is the refund policy?",
        companyId: "company-999",
      },
      user: makeUser({ companyId: ["company-001"] }),
    });

    await generateChatResponse(req, res, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toMatch(
      /not authorized for the selected company/i,
    );
    expect(res.statusCode).toBe(403);
  });

  it("does NOT apply department filter for Admin role (RBAC)", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([{ ...fakeArticle, score: 0.4 }]);
    const req = makeReq({ user: makeUser({ role: ["Admin"] }) });

    await generateChatResponse(req, makeRes(), vi.fn());

    const [[pipeline]] = mockAggregate.mock.calls;
    expect(pipeline[1].$match).toEqual({ status: "Approved" });
  });

  it("does NOT apply department filter for Manager role (RBAC)", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([{ ...fakeArticle, score: 0.4 }]);
    const req = makeReq({ user: makeUser({ role: ["Manager"] }) });

    await generateChatResponse(req, makeRes(), vi.fn());

    const [[pipeline]] = mockAggregate.mock.calls;
    expect(pipeline[1].$match).toEqual({ status: "Approved" });
  });

  it("forwards 503 via next when the AI returns a 503 error", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([fakeArticle]);
    const aiError = new Error("overloaded");
    aiError.status = 503;
    mockGenerateContent.mockRejectedValue(aiError);

    const next = vi.fn();
    const res = makeRes();
    await generateChatResponse(makeReq(), res, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toMatch(/high traffic/i);
    expect(res.statusCode).toBe(503);
  });
});
