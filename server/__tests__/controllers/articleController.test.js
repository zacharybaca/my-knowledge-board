import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted ensures mock fns exist when the factory is evaluated ─────────
const { mockAggregate, mockGenerateEmbedding } = vi.hoisted(() => ({
  mockAggregate: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
}));

vi.mock("../../models/Article.js", () => ({
  default: { aggregate: mockAggregate },
}));

vi.mock("../../controllers/aiController.js", () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

import { checkDuplicateArticle } from "../../controllers/articleController.js";

// ── Helpers ────────────────────────────────────────────────────────────────
const fakeCompanyId = "company-001";
const makeUser = () => ({ companyId: [fakeCompanyId] });

const makeReq = (body = {}) => ({
  body: { title: "Test Title", content: "Test content", ...body },
  user: makeUser(),
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

// ── checkDuplicateArticle ──────────────────────────────────────────────────
describe("checkDuplicateArticle", () => {
  beforeEach(() => {
    mockGenerateEmbedding.mockReset();
    mockAggregate.mockReset();
  });

  it("returns isLikelyDuplicate:false when no articles exceed the 0.85 threshold", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2]);
    mockAggregate.mockResolvedValue([
      { _id: "a1", title: "Article A", status: "Approved", score: 0.80 },
      { _id: "a2", title: "Article B", status: "Approved", score: 0.70 },
    ]);

    const res = makeRes();
    await checkDuplicateArticle(makeReq(), res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ isLikelyDuplicate: false, similarArticles: [] }),
    );
  });

  it("returns isLikelyDuplicate:true when an article exceeds the 0.85 threshold", async () => {
    const highScorerArticle = { _id: "a3", title: "Article C", status: "Approved", score: 0.92 };
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2]);
    mockAggregate.mockResolvedValue([
      highScorerArticle,
      { _id: "a4", title: "Article D", status: "Approved", score: 0.60 },
    ]);

    const res = makeRes();
    await checkDuplicateArticle(makeReq(), res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isLikelyDuplicate: true,
        similarArticles: [highScorerArticle],
      }),
    );
  });

  it("uses companyId from req.body when provided", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.5]);
    mockAggregate.mockResolvedValue([]);

    const req = makeReq({ companyId: "explicit-company" });
    await checkDuplicateArticle(req, makeRes(), vi.fn());

    expect(mockAggregate).toHaveBeenCalledOnce();
  });

  it("falls back to the first company in user array when no companyId in body", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.5]);
    mockAggregate.mockResolvedValue([]);

    const req = makeReq();
    await checkDuplicateArticle(req, makeRes(), vi.fn());

    expect(mockAggregate).toHaveBeenCalledOnce();
  });

  it("forwards 500 via next when embedding generation fails", async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error("AI offline"));

    const next = vi.fn();
    const res = makeRes();
    await checkDuplicateArticle(makeReq(), res, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toMatch(/failed to generate embedding/i);
    expect(res.statusCode).toBe(500);
  });

  it("embeds the combined title + content string", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([]);

    const req = makeReq({ title: "My Title", content: "My Content" });
    await checkDuplicateArticle(req, makeRes(), vi.fn());

    expect(mockGenerateEmbedding).toHaveBeenCalledWith(
      "Title: My Title\nContent: My Content",
    );
  });

  it("does NOT flag an article with score exactly 0.85 (strict > threshold)", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockAggregate.mockResolvedValue([
      { _id: "a5", title: "Boundary Article", score: 0.85 },
    ]);

    const res = makeRes();
    await checkDuplicateArticle(makeReq(), res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ isLikelyDuplicate: false }),
    );
  });
});
