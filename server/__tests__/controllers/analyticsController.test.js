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
    const origJson = res.json.bind(res);
    res.json = vi.fn((...args) => {
      origJson(...args);
      done();
    });
    const next = vi.fn((...args) => done(...args));
    controller(req, res, next);
  });
}

// ── getContentGaps ────────────────────────────────────────────────────────────

describe("getContentGaps", () => {
  // Valid 24-hex-char ObjectId strings required by mongoose.Types.ObjectId
  const companyId = "507f1f77bcf86cd799439011";
  const managerUser = {
    role: ["Manager"],
    companyId: [companyId],
  };

  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when an Employee requests analytics", async () => {
    const req = { user: { role: ["Employee"], companyId: [companyId] }, query: {} };
    const { res, nextArgs } = await run(getContentGaps, req, makeRes());
    expect(res.statusCode).toBe(403);
    expect(nextArgs[0].message).toMatch(/not authorized/i);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("returns logs, topGaps, and total for a Manager", async () => {
    const fakeLogs = [{ _id: "log1", question: "Where is the refund policy?" }];
    const fakeTopGaps = [{ _id: "Where is the refund policy?", count: 3 }];

    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(fakeLogs),
    };
    mockFind.mockReturnValue(findChain);
    mockAggregate.mockResolvedValue(fakeTopGaps);
    mockCountDocuments.mockResolvedValue(1);

    const req = { user: managerUser, query: {} };
    const { res } = await run(getContentGaps, req, makeRes());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        logs: fakeLogs,
        topGaps: fakeTopGaps,
        total: 1,
      }),
    );
  });

  it("applies department filter when department query param is provided", async () => {
    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockFind.mockReturnValue(findChain);
    mockAggregate.mockResolvedValue([]);
    mockCountDocuments.mockResolvedValue(0);

    const req = {
      user: managerUser,
      query: { department: "Engineering" },
    };
    await run(getContentGaps, req, makeRes());

    const findFilter = mockFind.mock.calls[0][0];
    expect(findFilter.department).toBe("Engineering");

    const aggregatePipeline = mockAggregate.mock.calls[0][0];
    expect(aggregatePipeline[0].$match.department).toBe("Engineering");
  });

  it("does not apply department filter when param is absent", async () => {
    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockFind.mockReturnValue(findChain);
    mockAggregate.mockResolvedValue([]);
    mockCountDocuments.mockResolvedValue(0);

    const req = { user: managerUser, query: {} };
    await run(getContentGaps, req, makeRes());

    const findFilter = mockFind.mock.calls[0][0];
    expect(findFilter.department).toBeUndefined();
  });
});

// ── resolveContentGapsForArticle ──────────────────────────────────────────────

describe("resolveContentGapsForArticle", () => {
  // Unit-tests the pure logic without going through Express.

  beforeEach(() => vi.clearAllMocks());

  function makeCursor(logs) {
    // Simulate an async iterable cursor
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const log of logs) yield log;
      },
    };
  }

  function makeFindChain(cursor) {
    return {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(cursor),
    };
  }

  it("returns early without querying when embedding is empty", async () => {
    await resolveContentGapsForArticle([], "c1");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("returns early without querying when embedding is not an array", async () => {
    await resolveContentGapsForArticle(null, "c1");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("deletes logs whose embedding is cosine-similar above the threshold", async () => {
    // Two identical unit vectors → cosine similarity = 1.0 (above 0.7 threshold)
    const articleEmbedding = [1, 0, 0];
    const similarLog = {
      _id: "log1",
      questionEmbedding: [1, 0, 0],
    };
    const cursor = makeCursor([similarLog]);
    mockFind.mockReturnValue(makeFindChain(cursor));
    mockDeleteMany.mockResolvedValue({});

    await resolveContentGapsForArticle(articleEmbedding, "c1");

    expect(mockDeleteMany).toHaveBeenCalledWith({ _id: { $in: ["log1"] } });
  });

  it("does NOT delete logs whose embedding is below the similarity threshold", async () => {
    // Orthogonal vectors → cosine similarity = 0.0 (below 0.7 threshold)
    const articleEmbedding = [1, 0, 0];
    const dissimilarLog = {
      _id: "log2",
      questionEmbedding: [0, 1, 0],
    };
    const cursor = makeCursor([dissimilarLog]);
    mockFind.mockReturnValue(makeFindChain(cursor));

    await resolveContentGapsForArticle(articleEmbedding, "c1");

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("skips logs that have no questionEmbedding", async () => {
    const articleEmbedding = [1, 0, 0];
    const emptyLog = { _id: "log3", questionEmbedding: [] };
    const cursor = makeCursor([emptyLog]);
    mockFind.mockReturnValue(makeFindChain(cursor));

    await resolveContentGapsForArticle(articleEmbedding, "c1");

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("wraps companyId scalar in an array for the query", async () => {
    const articleEmbedding = [1, 0, 0];
    const cursor = makeCursor([]);
    mockFind.mockReturnValue(makeFindChain(cursor));

    await resolveContentGapsForArticle(articleEmbedding, "single-id");

    const filterArg = mockFind.mock.calls[0][0];
    expect(filterArg.companyId).toEqual({ $in: ["single-id"] });
  });

  it("swallows errors and does not propagate them to the caller", async () => {
    mockFind.mockImplementation(() => {
      throw new Error("DB down");
    });
    await expect(
      resolveContentGapsForArticle([1, 0, 0], "c1"),
    ).resolves.toBeUndefined();
  });
});
