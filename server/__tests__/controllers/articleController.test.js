import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (must come first so factories see them) ─────────────────────

const { mockFindById, mockAggregate, mockGenerateEmbedding } = vi.hoisted(
  () => ({
    mockFindById: vi.fn(),
    mockAggregate: vi.fn(),
    mockGenerateEmbedding: vi.fn(),
  }),
);

vi.mock("../../models/Article.js", () => ({
  default: { findById: mockFindById, aggregate: mockAggregate },
}));

vi.mock("../../models/User.js", () => ({
  default: { findById: vi.fn() },
}));

vi.mock("../../models/Notification.js", () => ({
  default: {},
}));

vi.mock("../../controllers/aiController.js", () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  getArticleById,
  checkDuplicateArticle,
  voteArticle,
  approveRejectArticle,
} from "../../controllers/articleController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeCompanyId = "company-001";

const makeReq = (body = {}) => ({
  body: { title: "Test Title", content: "Test content", ...body },
  user: { companyId: [fakeCompanyId] },
});

function makeRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn();
  return res;
}

function run(controller, req, res) {
  return new Promise((resolve) => {
    const done = (...args) => resolve({ res, nextArgs: args });
    const origJson = res.json.bind(res);
    res.json = vi.fn((...args) => {
      origJson(...args);
      done();
    });
    const next = vi.fn((...args) => done(...args));
    controller(req, res, next);
  });
}

// ── getArticleById ────────────────────────────────────────────────────────────

describe("getArticleById", () => {
  const articleCompanyId = "company-abc";

  const fakeArticle = {
    _id: "article-1",
    companyId: { toString: () => articleCompanyId },
    title: "Test Article",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(fakeArticle),
    });
  });

  it("returns the article when the user belongs to the article's company", async () => {
    const req = {
      params: { id: "article-1" },
      user: { companyId: [{ toString: () => articleCompanyId }] },
    };
    const { res } = await run(getArticleById, req, makeRes());
    expect(res.json).toHaveBeenCalledWith(fakeArticle);
  });

  it("returns 403 when the user does not belong to the article's company", async () => {
    const req = {
      params: { id: "article-1" },
      user: { companyId: [{ toString: () => "different-company" }] },
    };
    const { res, nextArgs } = await run(getArticleById, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the article does not exist", async () => {
    mockFindById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    });
    const req = {
      params: { id: "nonexistent" },
      user: { companyId: [{ toString: () => "company-x" }] },
    };
    const { res, nextArgs } = await run(getArticleById, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── checkDuplicateArticle – score threshold ───────────────────────────────────

describe("checkDuplicateArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2]);
  });

  it("reports isLikelyDuplicate=false when all scores are at or below 0.85", async () => {
    mockAggregate.mockResolvedValue([
      { _id: "a1", title: "Close but not duplicate", score: 0.84 },
      { _id: "a2", title: "Another near miss", score: 0.8 },
    ]);
    const { res } = await run(checkDuplicateArticle, makeReq(), makeRes());
    const payload = res.json.mock.calls[0][0];
    expect(payload.isLikelyDuplicate).toBe(false);
    expect(payload.similarArticles).toHaveLength(0);
  });

  it("reports isLikelyDuplicate=true when at least one score exceeds 0.85", async () => {
    mockAggregate.mockResolvedValue([
      { _id: "a1", title: "Near-exact duplicate", score: 0.95 },
      { _id: "a2", title: "Somewhat similar", score: 0.7 },
    ]);
    const { res } = await run(checkDuplicateArticle, makeReq(), makeRes());
    const payload = res.json.mock.calls[0][0];
    expect(payload.isLikelyDuplicate).toBe(true);
    expect(payload.similarArticles).toHaveLength(1);
  });

  it("does NOT flag an article with score exactly 0.85 (strict > threshold)", async () => {
    mockAggregate.mockResolvedValue([
      { _id: "a5", title: "Boundary Article", score: 0.85 },
    ]);
    const { res } = await run(checkDuplicateArticle, makeReq(), makeRes());
    const payload = res.json.mock.calls[0][0];
    expect(payload.isLikelyDuplicate).toBe(false);
  });

  it("forwards a 500 via next when embedding generation fails", async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error("AI offline"));
    const res = makeRes();
    const { nextArgs } = await run(checkDuplicateArticle, makeReq(), res);
    expect(res.statusCode).toBe(500);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("embeds the combined title + content string", async () => {
    mockAggregate.mockResolvedValue([]);
    const req = makeReq({ title: "My Title", content: "My Content" });
    await run(checkDuplicateArticle, req, makeRes());
    expect(mockGenerateEmbedding).toHaveBeenCalledWith(
      "Title: My Title\nContent: My Content",
    );
  });
});

// ── voteArticle – toggle logic ────────────────────────────────────────────────

describe("voteArticle", () => {
  const userId = "user-1";

  function makeArticle(upvotes = [], downvotes = []) {
    const up = [...upvotes];
    const down = [...downvotes];
    up.includes = (id) => up.indexOf(id) !== -1;
    up.pull = (id) => {
      const idx = up.indexOf(id);
      if (idx !== -1) up.splice(idx, 1);
    };
    up.push = (id) => {
      up[up.length] = id;
    };
    down.includes = (id) => down.indexOf(id) !== -1;
    down.pull = (id) => {
      const idx = down.indexOf(id);
      if (idx !== -1) down.splice(idx, 1);
    };
    down.push = (id) => {
      down[down.length] = id;
    };
    return {
      _id: "article-1",
      upvotes: up,
      downvotes: down,
      save: vi.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("adds an upvote when user has not yet voted", async () => {
    const article = makeArticle([], []);
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { voteType: "up" },
      user: { _id: userId },
    };
    await run(voteArticle, req, makeRes());
    expect(article.upvotes).toContain(userId);
    expect(article.downvotes).not.toContain(userId);
  });

  it("removes an upvote (toggle off) when user already upvoted", async () => {
    const article = makeArticle([userId], []);
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { voteType: "up" },
      user: { _id: userId },
    };
    await run(voteArticle, req, makeRes());
    expect(article.upvotes).not.toContain(userId);
  });

  it("switches from upvote to downvote", async () => {
    const article = makeArticle([userId], []);
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { voteType: "down" },
      user: { _id: userId },
    };
    await run(voteArticle, req, makeRes());
    expect(article.downvotes).toContain(userId);
    expect(article.upvotes).not.toContain(userId);
  });

  it("removes a downvote (toggle off) when user already downvoted", async () => {
    const article = makeArticle([], [userId]);
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { voteType: "down" },
      user: { _id: userId },
    };
    await run(voteArticle, req, makeRes());
    expect(article.downvotes).not.toContain(userId);
  });

  it("returns 404 when article is not found", async () => {
    mockFindById.mockResolvedValue(null);
    const req = {
      params: { id: "ghost" },
      body: { voteType: "up" },
      user: { _id: userId },
    };
    const { res, nextArgs } = await run(voteArticle, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── approveRejectArticle – company access guard ───────────────────────────────

describe("approveRejectArticle", () => {
  const companyId = "company-xyz";

  function fakeArticle() {
    return {
      _id: "article-1",
      companyId: { toString: () => companyId },
      status: "Pending",
      save: vi.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("approves the article when the manager belongs to the same company", async () => {
    const article = fakeArticle();
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { status: "Approved" },
      user: { _id: "manager-1", companyId: [{ toString: () => companyId }] },
    };
    await run(approveRejectArticle, req, makeRes());
    expect(article.status).toBe("Approved");
  });

  it("persists the rejectionReason when status is Rejected", async () => {
    const article = fakeArticle();
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { status: "Rejected", rejectionReason: "Off-topic" },
      user: { _id: "manager-1", companyId: [{ toString: () => companyId }] },
    };
    await run(approveRejectArticle, req, makeRes());
    expect(article.status).toBe("Rejected");
    expect(article.rejectionReason).toBe("Off-topic");
  });

  it("clears rejectionReason when article is approved", async () => {
    const article = { ...fakeArticle(), rejectionReason: "Old reason" };
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { status: "Approved" },
      user: { _id: "manager-1", companyId: [{ toString: () => companyId }] },
    };
    await run(approveRejectArticle, req, makeRes());
    expect(article.rejectionReason).toBeNull();
  });

  it("returns 403 when the manager belongs to a different company", async () => {
    const article = fakeArticle();
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { status: "Approved" },
      user: {
        _id: "manager-1",
        companyId: [{ toString: () => "other-company" }],
      },
    };
    const { res, nextArgs } = await run(approveRejectArticle, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the article does not exist", async () => {
    mockFindById.mockResolvedValue(null);
    const req = {
      params: { id: "ghost" },
      body: { status: "Approved" },
      user: { _id: "manager-1", companyId: [{ toString: () => companyId }] },
    };
    const { res, nextArgs } = await run(approveRejectArticle, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});
