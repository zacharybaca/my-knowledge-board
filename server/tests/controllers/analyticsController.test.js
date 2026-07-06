import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockFind, mockAggregate, mockCountDocuments, mockDeleteMany } =
  vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockAggregate: vi.fn(),
    mockCountDocuments: vi.fn(),
    mockDeleteMany: vi.fn(),
  }));

vi.mock("../../models/ContentGapLog.js", () => ({
  default: {
    find: mockFind,
    aggregate: mockAggregate,
    countDocuments: mockCountDocuments,
    deleteMany: mockDeleteMany,
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  getContentGaps,
  resolveContentGapsForArticle,
} from "../../controllers/analyticsController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    const originalJson = res.json.bind(res);
    res.json = vi.fn((...args) => {
      originalJson(...args);
      done();
    });
    const next = vi.fn((...args) => done(...args));
    controller(req, res, next);
  });
}

// ── resolveContentGapsForArticle ──────────────────────────────────────────────

describe("resolveContentGapsForArticle", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeCursor(logs) {
    const iter = logs[Symbol.asyncIterator]
      ? logs
      : (async function* () {
          for (const log of logs) yield log;
        })();
    return iter;
  }

  function mockFindCursor(logs) {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(makeCursor(logs)),
    });
  }

  it("is a no-op when articleEmbedding is empty", async () => {
    await resolveContentGapsForArticle([], "company-1");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("is a no-op when articleEmbedding is not an array", async () => {
    await resolveContentGapsForArticle(null, "company-1");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("deletes logs whose embedding similarity meets the threshold", async () => {
    // Identical unit vectors → cosine similarity = 1.0 ≥ 0.7 threshold
    const embedding = [1, 0];
    const matchingLog = { _id: "log-1", questionEmbedding: [1, 0] };
    mockFindCursor([matchingLog]);
    mockDeleteMany.mockResolvedValue({});

    await resolveContentGapsForArticle(embedding, "company-1");

    expect(mockDeleteMany).toHaveBeenCalledWith({
      _id: { $in: ["log-1"] },
    });
  });

  it("does not delete logs whose embedding similarity is below the threshold", async () => {
    // Orthogonal vectors → cosine similarity = 0 < 0.7
    const embedding = [1, 0];
    const nonMatchingLog = { _id: "log-2", questionEmbedding: [0, 1] };
    mockFindCursor([nonMatchingLog]);

    await resolveContentGapsForArticle(embedding, "company-1");

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("skips logs that have an empty questionEmbedding", async () => {
    const embedding = [1, 0];
    const logWithEmptyEmbedding = { _id: "log-3", questionEmbedding: [] };
    mockFindCursor([logWithEmptyEmbedding]);

    await resolveContentGapsForArticle(embedding, "company-1");

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("skips logs that have no questionEmbedding field", async () => {
    const embedding = [1, 0];
    const logWithoutEmbedding = { _id: "log-4" };
    mockFindCursor([logWithoutEmbedding]);

    await resolveContentGapsForArticle(embedding, "company-1");

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("normalises a scalar companyId into an array for the query", async () => {
    mockFindCursor([]);

    await resolveContentGapsForArticle([1, 0], "single-company");

    expect(mockFind).toHaveBeenCalledWith({
      companyId: { $in: ["single-company"] },
    });
  });

  it("swallows errors so the caller is never rejected", async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(new Error("DB error"));
            },
          };
        },
      }),
    });

    // Must resolve, not reject
    await expect(
      resolveContentGapsForArticle([1, 0], "company-1"),
    ).resolves.toBeUndefined();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });
});

// ── getContentGaps ────────────────────────────────────────────────────────────

describe("getContentGaps", () => {
  // Use a valid 24-char hex ObjectId string so mongoose.Types.ObjectId() doesn't throw
  const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";

  function managerReq(extra = {}) {
    return {
      user: {
        role: ["Manager"],
        companyId: [companyId],
      },
      query: {},
      ...extra,
    };
  }

  function mockFullQuery({ logs = [], topGaps = [], total = 0 } = {}) {
    mockFind.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(logs),
    });
    mockAggregate.mockResolvedValue(topGaps);
    mockCountDocuments.mockResolvedValue(total);
  }

  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for an Employee", async () => {
    const req = {
      user: { role: ["Employee"], companyId: [companyId] },
      query: {},
    };
    const { res, nextArgs } = await run(getContentGaps, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns logs, topGaps, and total for a Manager", async () => {
    const logs = [{ _id: "log-1", question: "How do I reset?" }];
    const topGaps = [{ _id: "How do I reset?", count: 3 }];
    mockFullQuery({ logs, topGaps, total: 1 });

    const { res } = await run(getContentGaps, managerReq(), makeRes());

    expect(res.json).toHaveBeenCalledWith({ logs, topGaps, total: 1 });
  });

  it("applies department filter to both queries when provided", async () => {
    mockFullQuery();

    await run(
      getContentGaps,
      { ...managerReq(), query: { department: "Engineering" } },
      makeRes(),
    );

    // The find filter must include department
    const findFilter = mockFind.mock.calls[0][0];
    expect(findFilter.department).toBe("Engineering");

    // The aggregate $match must also include department
    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline.find((s) => s.$match);
    expect(matchStage.$match.department).toBe("Engineering");
  });

  it("does not set department filter when query param is absent", async () => {
    mockFullQuery();

    await run(getContentGaps, managerReq(), makeRes());

    const findFilter = mockFind.mock.calls[0][0];
    expect(findFilter.department).toBeUndefined();
  });

  it("allows an Admin through the role guard", async () => {
    mockFullQuery();
    const req = {
      user: { role: ["Admin"], companyId: [companyId] },
      query: {},
    };

    const { res } = await run(getContentGaps, req, makeRes());
    expect(res.json).toHaveBeenCalled();
  });
});
