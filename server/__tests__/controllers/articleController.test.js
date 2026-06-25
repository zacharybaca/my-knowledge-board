import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../models/Article.js", () => ({
  default: {
    findById: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../../models/User.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../models/Notification.js", () => ({
  default: {},
}));

vi.mock("../../controllers/aiController.js", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

import Article from "../../models/Article.js";
import {
  getArticleById,
  checkDuplicateArticle,
  voteArticle,
  approveRejectArticle,
} from "../../controllers/articleController.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  res.json = vi.fn();
  return res;
};

const makeNext = () => vi.fn();

// ─── getArticleById ───────────────────────────────────────────────────────────

describe("getArticleById", () => {
  const articleCompanyId = "company-abc";

  const fakeArticle = {
    _id: "article-1",
    companyId: { toString: () => articleCompanyId },
    title: "Test Article",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Article.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(fakeArticle),
    });
  });

  it("returns 200 and the article when the user belongs to the article's company", async () => {
    const req = {
      params: { id: "article-1" },
      user: {
        companyId: [{ toString: () => articleCompanyId }],
      },
    };
    const res = makeRes();
    const next = makeNext();

    await getArticleById(req, res, next);

    expect(res.json).toHaveBeenCalledWith(fakeArticle);
  });

  it("returns 403 when the user does not belong to the article's company", async () => {
    const req = {
      params: { id: "article-1" },
      user: {
        companyId: [{ toString: () => "different-company" }],
      },
    };
    const res = makeRes();
    const next = makeNext();

    await getArticleById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("returns 404 when the article does not exist", async () => {
    Article.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    });

    const req = {
      params: { id: "nonexistent" },
      user: { companyId: [{ toString: () => "company-x" }] },
    };
    const res = makeRes();
    const next = makeNext();

    await getArticleById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── checkDuplicateArticle – score threshold ──────────────────────────────────

describe("checkDuplicateArticle", () => {
  const baseReq = {
    body: { title: "Sample Title", content: "Some content", companyId: "co-1" },
    user: { companyId: ["co-1"] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports isLikelyDuplicate=false when all scores are at or below 0.85", async () => {
    Article.aggregate.mockResolvedValue([
      { _id: "a1", title: "Close but not duplicate", score: 0.84 },
      { _id: "a2", title: "Another near miss", score: 0.80 },
    ]);

    const res = makeRes();
    const next = makeNext();

    await checkDuplicateArticle(baseReq, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.isLikelyDuplicate).toBe(false);
    expect(payload.similarArticles).toHaveLength(0);
  });

  it("reports isLikelyDuplicate=true when at least one score exceeds 0.85", async () => {
    Article.aggregate.mockResolvedValue([
      { _id: "a1", title: "Near-exact duplicate", score: 0.95 },
      { _id: "a2", title: "Somewhat similar", score: 0.70 },
    ]);

    const res = makeRes();
    const next = makeNext();

    await checkDuplicateArticle(baseReq, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.isLikelyDuplicate).toBe(true);
    expect(payload.similarArticles).toHaveLength(1);
    expect(payload.similarArticles[0].title).toBe("Near-exact duplicate");
  });

  it("reports isLikelyDuplicate=false when no articles are returned", async () => {
    Article.aggregate.mockResolvedValue([]);

    const res = makeRes();
    const next = makeNext();

    await checkDuplicateArticle(baseReq, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.isLikelyDuplicate).toBe(false);
    expect(payload.similarArticles).toHaveLength(0);
  });
});

// ─── voteArticle – toggle logic ───────────────────────────────────────────────

describe("voteArticle", () => {
  const userId = "user-1";

  const makeArticle = (upvotes = [], downvotes = []) => {
    const article = {
      _id: "article-1",
      upvotes: [...upvotes],
      downvotes: [...downvotes],
      save: vi.fn().mockResolvedValue(true),
    };
    article.upvotes.includes = (id) => article.upvotes.indexOf(id) !== -1;
    article.upvotes.pull = (id) => {
      const idx = article.upvotes.indexOf(id);
      if (idx !== -1) article.upvotes.splice(idx, 1);
    };
    article.upvotes.push = (id) => article.upvotes[article.upvotes.length] = id;
    article.downvotes.includes = (id) => article.downvotes.indexOf(id) !== -1;
    article.downvotes.pull = (id) => {
      const idx = article.downvotes.indexOf(id);
      if (idx !== -1) article.downvotes.splice(idx, 1);
    };
    article.downvotes.push = (id) => article.downvotes[article.downvotes.length] = id;
    return article;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds an upvote when user has not yet voted", async () => {
    const article = makeArticle([], []);
    Article.findById.mockResolvedValue(article);

    const req = { params: { id: "article-1" }, body: { voteType: "up" }, user: { _id: userId } };
    const res = makeRes();

    await voteArticle(req, res, makeNext());

    expect(article.upvotes).toContain(userId);
    expect(article.downvotes).not.toContain(userId);
  });

  it("removes an upvote (toggle off) when user already upvoted", async () => {
    const article = makeArticle([userId], []);
    Article.findById.mockResolvedValue(article);

    const req = { params: { id: "article-1" }, body: { voteType: "up" }, user: { _id: userId } };
    const res = makeRes();

    await voteArticle(req, res, makeNext());

    expect(article.upvotes).not.toContain(userId);
  });

  it("switches from upvote to downvote, removing the prior upvote", async () => {
    const article = makeArticle([userId], []);
    Article.findById.mockResolvedValue(article);

    const req = { params: { id: "article-1" }, body: { voteType: "down" }, user: { _id: userId } };
    const res = makeRes();

    await voteArticle(req, res, makeNext());

    expect(article.downvotes).toContain(userId);
    expect(article.upvotes).not.toContain(userId);
  });

  it("removes a downvote (toggle off) when user already downvoted", async () => {
    const article = makeArticle([], [userId]);
    Article.findById.mockResolvedValue(article);

    const req = { params: { id: "article-1" }, body: { voteType: "down" }, user: { _id: userId } };
    const res = makeRes();

    await voteArticle(req, res, makeNext());

    expect(article.downvotes).not.toContain(userId);
  });
});

// ─── approveRejectArticle – company access guard ──────────────────────────────

describe("approveRejectArticle", () => {
  const companyId = "company-xyz";

  const fakeArticle = () => ({
    _id: "article-1",
    companyId: { toString: () => companyId },
    status: "Pending",
    save: vi.fn().mockResolvedValue(true),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves the article when the manager belongs to the same company", async () => {
    const article = fakeArticle();
    Article.findById.mockResolvedValue(article);

    const req = {
      params: { id: "article-1" },
      body: { status: "Approved" },
      user: {
        _id: "manager-1",
        companyId: [{ toString: () => companyId }],
      },
    };
    const res = makeRes();

    await approveRejectArticle(req, res, makeNext());

    expect(article.status).toBe("Approved");
    expect(res.json).toHaveBeenCalled();
  });

  it("returns 403 when the manager belongs to a different company", async () => {
    const article = fakeArticle();
    Article.findById.mockResolvedValue(article);

    const req = {
      params: { id: "article-1" },
      body: { status: "Approved" },
      user: {
        _id: "manager-1",
        companyId: [{ toString: () => "other-company" }],
      },
    };
    const res = makeRes();
    const next = makeNext();

    await approveRejectArticle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
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
