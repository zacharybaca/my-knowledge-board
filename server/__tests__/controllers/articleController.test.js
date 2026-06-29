import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (must come first so factories see them) ─────────────────────

const {
  mockFindById,
  mockFind,
  mockCountDocuments,
  mockAggregate,
  mockGenerateEmbedding,
  mockNotificationCreate,
  mockSendEmail,
  mockUserFindById,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFind: vi.fn(),
  mockCountDocuments: vi.fn(),
  mockAggregate: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
  mockNotificationCreate: vi.fn(),
  mockSendEmail: vi.fn(),
  mockUserFindById: vi.fn(),
}));

vi.mock("../../models/Article.js", () => ({
  default: {
    findById: mockFindById,
    find: mockFind,
    countDocuments: mockCountDocuments,
    aggregate: mockAggregate,
  },
}));

vi.mock("../../models/User.js", () => ({
  default: { findById: mockUserFindById },
}));

vi.mock("../../models/Notification.js", () => ({
  default: { create: mockNotificationCreate },
}));

vi.mock("../../controllers/aiController.js", () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

vi.mock("../../utils/sendEmail.js", () => ({
  default: mockSendEmail,
}));

vi.mock("../../utils/sanitizeHtml.js", () => ({
  sanitizeRichText: (s) => s,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  getArticles,
  getArticleById,
  checkDuplicateArticle,
  voteArticle,
  approveRejectArticle,
  bulkUpdateArticleStatus,
  deleteArticle,
  addArticleComment,
  certifyArticle,
  rollbackArticleRevision,
  getArticleAnalytics,
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

// ── bulkUpdateArticleStatus ───────────────────────────────────────────────────

describe("bulkUpdateArticleStatus", () => {
  const companyId = "company-bulk";

  function fakeArticle(overrides = {}) {
    return {
      _id: "article-1",
      title: "Bulk Article",
      companyId: { toString: () => companyId },
      authorId: { toString: () => "author-1" },
      status: "Pending",
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  function elevatedUser() {
    return {
      _id: "manager-1",
      role: ["Manager"],
      companyId: [{ toString: () => companyId }],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockNotificationCreate.mockResolvedValue(true);
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ email: "author@example.com" }),
    });
  });

  it("returns 403 when the user is not a Manager or Admin", async () => {
    const req = {
      params: {},
      body: { articleIds: ["id1"], status: "Approved" },
      user: { _id: "emp-1", role: ["Employee"], companyId: [] },
      app: { get: vi.fn() },
    };
    const { res, nextArgs } = await run(bulkUpdateArticleStatus, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("updates all matching pending articles and returns the count", async () => {
    const articles = [fakeArticle(), fakeArticle({ _id: "article-2" })];
    mockFind.mockResolvedValue(articles);
    const req = {
      params: {},
      body: { articleIds: ["article-1", "article-2"], status: "Approved" },
      user: elevatedUser(),
      app: { get: vi.fn().mockReturnValue(null) },
    };
    const { res } = await run(bulkUpdateArticleStatus, req, makeRes());
    const payload = res.json.mock.calls[0][0];
    expect(payload.count).toBe(2);
    expect(articles[0].status).toBe("Approved");
    expect(articles[1].status).toBe("Approved");
  });

  it("sets rejectionReason when status is Rejected", async () => {
    const article = fakeArticle();
    mockFind.mockResolvedValue([article]);
    const req = {
      params: {},
      body: {
        articleIds: ["article-1"],
        status: "Rejected",
        rejectionReason: "Outdated info",
      },
      user: elevatedUser(),
      app: { get: vi.fn().mockReturnValue(null) },
    };
    await run(bulkUpdateArticleStatus, req, makeRes());
    expect(article.rejectionReason).toBe("Outdated info");
    expect(article.status).toBe("Rejected");
  });

  it("clears rejectionReason when status is Approved", async () => {
    const article = fakeArticle({ rejectionReason: "old reason" });
    mockFind.mockResolvedValue([article]);
    const req = {
      params: {},
      body: { articleIds: ["article-1"], status: "Approved" },
      user: elevatedUser(),
      app: { get: vi.fn().mockReturnValue(null) },
    };
    await run(bulkUpdateArticleStatus, req, makeRes());
    expect(article.rejectionReason).toBeNull();
  });

  it("returns count=0 when no articles match the query", async () => {
    mockFind.mockResolvedValue([]);
    const req = {
      params: {},
      body: { articleIds: ["nonexistent"], status: "Approved" },
      user: elevatedUser(),
      app: { get: vi.fn().mockReturnValue(null) },
    };
    const { res } = await run(bulkUpdateArticleStatus, req, makeRes());
    expect(res.json.mock.calls[0][0].count).toBe(0);
  });
});

// ── deleteArticle ─────────────────────────────────────────────────────────────

describe("deleteArticle", () => {
  const companyId = "company-del";

  function fakeArticle(authorId = "author-1") {
    return {
      _id: "article-1",
      companyId: { toString: () => companyId },
      authorId: { toString: () => authorId },
      deleteOne: vi.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("allows the article author to delete their own article", async () => {
    const article = fakeArticle("user-author");
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: {},
      user: {
        _id: "user-author",
        role: ["Employee"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res } = await run(deleteArticle, req, makeRes());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/deleted/i) }),
    );
    expect(article.deleteOne).toHaveBeenCalledOnce();
  });

  it("allows a Manager to delete an article they did not author", async () => {
    const article = fakeArticle("other-author");
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: {},
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res } = await run(deleteArticle, req, makeRes());
    expect(article.deleteOne).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 when an Employee tries to delete another user's article", async () => {
    const article = fakeArticle("other-author");
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: {},
      user: {
        _id: "employee-1",
        role: ["Employee"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res, nextArgs } = await run(deleteArticle, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(article.deleteOne).not.toHaveBeenCalled();
  });

  it("returns 403 when the user belongs to a different company", async () => {
    const article = fakeArticle("author-1");
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: {},
      user: {
        _id: "author-1",
        role: ["Employee"],
        companyId: [{ toString: () => "different-company" }],
      },
    };
    const { res, nextArgs } = await run(deleteArticle, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the article does not exist", async () => {
    mockFindById.mockResolvedValue(null);
    const req = {
      params: { id: "ghost" },
      body: {},
      user: {
        _id: "u1",
        role: ["Employee"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res, nextArgs } = await run(deleteArticle, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── addArticleComment ─────────────────────────────────────────────────────────

describe("addArticleComment", () => {
  const companyId = "company-comment";

  function fakeArticle() {
    const comments = [];
    return {
      _id: "article-1",
      companyId: { toString: () => companyId },
      comments,
      save: vi.fn().mockResolvedValue(true),
      populate: vi.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("appends the comment and returns 201 with the new comment", async () => {
    const article = fakeArticle();
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { message: "Great article!" },
      user: {
        _id: "user-1",
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res } = await run(addArticleComment, req, makeRes());
    expect(res.statusCode).toBe(201);
    expect(article.comments).toHaveLength(1);
    expect(article.comments[0].message).toBe("Great article!");
    expect(article.save).toHaveBeenCalledOnce();
  });

  it("returns 403 when the user belongs to a different company", async () => {
    const article = fakeArticle();
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { message: "Hi" },
      user: {
        _id: "user-1",
        companyId: [{ toString: () => "other-company" }],
      },
    };
    const { res, nextArgs } = await run(addArticleComment, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(article.save).not.toHaveBeenCalled();
  });

  it("returns 404 when the article is not found", async () => {
    mockFindById.mockResolvedValue(null);
    const req = {
      params: { id: "ghost" },
      body: { message: "Hi" },
      user: {
        _id: "user-1",
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res, nextArgs } = await run(addArticleComment, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── certifyArticle ────────────────────────────────────────────────────────────

describe("certifyArticle", () => {
  const companyId = "company-cert";

  function fakeArticle() {
    return {
      _id: "article-1",
      companyId: { toString: () => companyId },
      expiresAt: null,
      lastReviewedAt: null,
      lastReviewedBy: null,
      save: vi.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("extends expiry by 180 days and records reviewer", async () => {
    const article = fakeArticle();
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: {},
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const before = Date.now();
    const { res } = await run(certifyArticle, req, makeRes());
    const after = Date.now();

    expect(article.save).toHaveBeenCalledOnce();
    expect(article.lastReviewedBy).toBe("manager-1");
    const expiry = new Date(article.expiresAt).getTime();
    const expectedMin = before + 179 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 181 * 24 * 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(expectedMin);
    expect(expiry).toBeLessThanOrEqual(expectedMax);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/certified/i) }),
    );
  });

  it("returns 403 when an Employee tries to certify", async () => {
    const req = {
      params: { id: "article-1" },
      body: {},
      user: {
        _id: "emp-1",
        role: ["Employee"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res, nextArgs } = await run(certifyArticle, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 403 when a Manager belongs to a different company", async () => {
    const article = fakeArticle();
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: {},
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => "other-company" }],
      },
    };
    const { res, nextArgs } = await run(certifyArticle, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the article does not exist", async () => {
    mockFindById.mockResolvedValue(null);
    const req = {
      params: { id: "ghost" },
      body: {},
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res, nextArgs } = await run(certifyArticle, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── rollbackArticleRevision ───────────────────────────────────────────────────

describe("rollbackArticleRevision", () => {
  const companyId = "company-rb";

  function fakeRevision(id = "rev-1") {
    return {
      _id: id,
      title: "Old Title",
      content: "Old Content",
      summary: "Old Summary",
      tags: ["old"],
      department: ["HR"],
    };
  }

  function fakeArticle(revisions = []) {
    const revs = [...revisions];
    revs.id = (revId) => revs.find((r) => r._id === revId) ?? null;
    return {
      _id: "article-1",
      title: "Current Title",
      content: "Current Content",
      summary: "Current Summary",
      tags: ["current"],
      department: ["Engineering"],
      companyId: { toString: () => companyId },
      revisions: revs,
      status: "Approved",
      save: vi.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("restores article fields from the specified revision", async () => {
    const revision = fakeRevision("rev-1");
    const article = fakeArticle([revision]);
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { revisionId: "rev-1" },
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => companyId }],
      },
    };
    await run(rollbackArticleRevision, req, makeRes());
    expect(article.title).toBe("Old Title");
    expect(article.content).toBe("Old Content");
    expect(article.status).toBe("Approved");
    expect(article.save).toHaveBeenCalledOnce();
  });

  it("saves the current state as a new revision before overwriting", async () => {
    const revision = fakeRevision("rev-1");
    const article = fakeArticle([revision]);
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { revisionId: "rev-1" },
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => companyId }],
      },
    };
    await run(rollbackArticleRevision, req, makeRes());
    // Original revision + the snapshot of current state = 2 entries
    expect(article.revisions.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 403 when an Employee attempts a rollback", async () => {
    const req = {
      params: { id: "article-1" },
      body: { revisionId: "rev-1" },
      user: {
        _id: "emp-1",
        role: ["Employee"],
        companyId: [{ toString: () => companyId }],
      },
    };
    mockFindById.mockResolvedValue(fakeArticle([fakeRevision()]));
    const { res, nextArgs } = await run(rollbackArticleRevision, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the revision ID is not found in the article", async () => {
    const article = fakeArticle([fakeRevision("rev-existing")]);
    mockFindById.mockResolvedValue(article);
    const req = {
      params: { id: "article-1" },
      body: { revisionId: "rev-nonexistent" },
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res, nextArgs } = await run(rollbackArticleRevision, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 404 when the article does not exist", async () => {
    mockFindById.mockResolvedValue(null);
    const req = {
      params: { id: "ghost" },
      body: { revisionId: "rev-1" },
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [{ toString: () => companyId }],
      },
    };
    const { res, nextArgs } = await run(rollbackArticleRevision, req, makeRes());
    expect(res.statusCode).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── getArticleAnalytics ───────────────────────────────────────────────────────

describe("getArticleAnalytics", () => {
  const companyId = "company-analytics";

  function fakeArticle(title, viewCount, upvotes = [], downvotes = []) {
    return { _id: title, title, viewCount, upvotes, downvotes };
  }

  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when an Employee accesses analytics", async () => {
    const req = {
      params: {},
      body: {},
      user: { _id: "emp-1", role: ["Employee"], companyId: [companyId] },
    };
    const { res, nextArgs } = await run(getArticleAnalytics, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns totals, topViewed, and topVoted for a Manager", async () => {
    const articles = [
      fakeArticle("Article A", 100, ["u1", "u2"], []),
      fakeArticle("Article B", 50, ["u1"], ["u2"]),
    ];
    mockCountDocuments.mockResolvedValue(2);
    // Article.find is called twice (topViewed and votedCandidates)
    mockFind.mockImplementation(() => ({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue(articles),
    }));

    const req = {
      params: {},
      body: {},
      user: {
        _id: "manager-1",
        role: ["Manager"],
        companyId: [companyId],
      },
    };
    const { res } = await run(getArticleAnalytics, req, makeRes());
    const payload = res.json.mock.calls[0][0];
    expect(payload).toHaveProperty("totals");
    expect(payload).toHaveProperty("topViewed");
    expect(payload).toHaveProperty("topVoted");
    expect(payload.totals).toBe(2);
  });

  it("ranks topVoted by upvotes minus downvotes", async () => {
    const articles = [
      fakeArticle("Low Score", 10, ["u1"], ["u2", "u3"]), // score = -1
      fakeArticle("High Score", 5, ["u1", "u2", "u3"], []), // score = 3
    ];
    mockCountDocuments.mockResolvedValue(2);
    mockFind.mockImplementation(() => ({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue(articles),
    }));

    const req = {
      params: {},
      body: {},
      user: { _id: "manager-1", role: ["Manager"], companyId: [companyId] },
    };
    const { res } = await run(getArticleAnalytics, req, makeRes());
    const { topVoted } = res.json.mock.calls[0][0];
    expect(topVoted[0].title).toBe("High Score");
  });
});

// ── getArticles – filtering and pagination ────────────────────────────────────

describe("getArticles", () => {
  // Build a mock Mongoose query chain that is also thenable (Promise-like) so
  // that both `await query` (non-paginated path) and `query.skip().limit()`
  // (paginated path) work correctly in tests.
  function makeQueryMock(articles) {
    const mock = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(articles).then(onFulfilled, onRejected),
      catch: (onRejected) => Promise.resolve(articles).catch(onRejected),
      finally: (onFinally) => Promise.resolve(articles).finally(onFinally),
    };
    return mock;
  }

  const fakeArticles = [
    { _id: "a1", title: "Article One", tags: ["policy"] },
    { _id: "a2", title: "Article Two", tags: ["hr"] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all approved articles for the company without pagination", async () => {
    mockFind.mockReturnValue(makeQueryMock(fakeArticles));
    const req = {
      query: {},
      user: { companyId: ["company-001"] },
    };
    const { res } = await run(getArticles, req, makeRes());
    expect(res.json).toHaveBeenCalledWith(fakeArticles);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: { $in: ["company-001"] },
        status: "Approved",
      }),
    );
  });

  it("returns paginated result with pagination metadata when paginate=true", async () => {
    const pageArticles = [fakeArticles[0]];
    mockFind.mockReturnValue(makeQueryMock(pageArticles));
    mockCountDocuments.mockResolvedValue(15);
    const req = {
      query: { paginate: "true", page: "2", limit: "5" },
      user: { companyId: ["company-001"] },
    };
    const { res } = await run(getArticles, req, makeRes());
    const payload = res.json.mock.calls[0][0];
    expect(payload).toHaveProperty("articles");
    expect(payload).toHaveProperty("pagination");
    expect(payload.pagination.page).toBe(2);
    expect(payload.pagination.limit).toBe(5);
    expect(payload.pagination.total).toBe(15);
    expect(payload.pagination.totalPages).toBe(3);
    expect(payload.pagination.hasNextPage).toBe(true);
    expect(payload.pagination.hasPrevPage).toBe(true);
  });

  it("adds $or filter when keyword is provided", async () => {
    mockFind.mockReturnValue(makeQueryMock([]));
    const req = {
      query: { keyword: "onboarding" },
      user: { companyId: ["company-001"] },
    };
    await run(getArticles, req, makeRes());
    const filterArg = mockFind.mock.calls[0][0];
    expect(filterArg).toHaveProperty("$or");
    expect(filterArg.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: expect.anything() }),
        expect.objectContaining({ content: expect.anything() }),
        expect.objectContaining({ tags: expect.anything() }),
      ]),
    );
  });

  it("escapes regex special characters in keyword to prevent ReDoS", async () => {
    mockFind.mockReturnValue(makeQueryMock([]));
    const req = {
      query: { keyword: "policy.*" },
      user: { companyId: ["company-001"] },
    };
    await run(getArticles, req, makeRes());
    const filterArg = mockFind.mock.calls[0][0];
    const titleFilter = filterArg.$or.find((c) => c.title);
    expect(titleFilter.title.$regex).toContain("\\.");
    expect(titleFilter.title.$regex).toContain("\\*");
  });

  it("adds tags filter when tag is provided", async () => {
    mockFind.mockReturnValue(makeQueryMock([]));
    const req = {
      query: { tag: "hr" },
      user: { companyId: ["company-001"] },
    };
    await run(getArticles, req, makeRes());
    const filterArg = mockFind.mock.calls[0][0];
    expect(filterArg).toHaveProperty("tags");
    expect(filterArg.tags.$in).toHaveLength(1);
    expect(filterArg.tags.$in[0].flags).toContain("i");
  });

  it("reports hasNextPage=false and hasPrevPage=false on the only page", async () => {
    mockFind.mockReturnValue(makeQueryMock(fakeArticles));
    mockCountDocuments.mockResolvedValue(2);
    const req = {
      query: { paginate: "true", page: "1", limit: "10" },
      user: { companyId: ["company-001"] },
    };
    const { res } = await run(getArticles, req, makeRes());
    const { pagination } = res.json.mock.calls[0][0];
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.hasPrevPage).toBe(false);
    expect(pagination.totalPages).toBe(1);
  });
});
