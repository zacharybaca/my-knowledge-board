import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockContentGapFind,
  mockContentGapDeleteMany,
  mockContentGapCountDocuments,
  mockContentGapAggregate,
} = vi.hoisted(() => ({
  mockContentGapFind: vi.fn(),
  mockContentGapDeleteMany: vi.fn(),
  mockContentGapCountDocuments: vi.fn(),
  mockContentGapAggregate: vi.fn(),
}));

vi.mock("../../models/ContentGapLog.js", () => ({
  default: {
    find: mockContentGapFind,
    deleteMany: mockContentGapDeleteMany,
    countDocuments: mockContentGapCountDocuments,
    aggregate: mockContentGapAggregate,
  },
}));

vi.mock("mongoose", () => ({
  default: {
    Types: {
      ObjectId: class {
        constructor(id) {
          this.id = id;
        }
        toString() {
          return this.id;
        }
      },
    },
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  resolveContentGapsForArticle,
  getContentGaps,
} from "../../controllers/analyticsController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns an async-iterable cursor from a plain array, matching the shape
 * that Mongoose's Query#cursor() produces.
 */
function asyncCursor(items) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) {
        yield item;
      }
    },
  };
}

function makeRes() {
  const res = { _code: 200, _body: null };
  res.status = vi.fn((code) => {
    res._code = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res._body = body;
    return res;
  });
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

  function setupCursor(logs) {
    mockContentGapFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(asyncCursor(logs)),
    });
    mockContentGapDeleteMany.mockResolvedValue({ deletedCount: logs.length });
  }

  it("no-ops immediately when embedding is empty", async () => {
    await resolveContentGapsForArticle([], "company-1");
    expect(mockContentGapFind).not.toHaveBeenCalled();
  });

  it("no-ops immediately when embedding is not an array", async () => {
    await resolveContentGapsForArticle(null, "company-1");
    expect(mockContentGapFind).not.toHaveBeenCalled();
  });

  it("deletes logs whose cosine similarity is at the threshold (>= 0.7)", async () => {
    // [1,0] · [1,0] = 1.0 — perfectly matched
    setupCursor([
      { _id: "gap-1", questionEmbedding: [1, 0] },
    ]);

    await resolveContentGapsForArticle([1, 0], "company-1");

    expect(mockContentGapDeleteMany).toHaveBeenCalledWith({
      _id: { $in: ["gap-1"] },
    });
  });

  it("keeps logs whose cosine similarity is below the threshold (< 0.7)", async () => {
    // [1,0] · [0,1] = 0.0 — orthogonal
    setupCursor([
      { _id: "gap-2", questionEmbedding: [0, 1] },
    ]);

    await resolveContentGapsForArticle([1, 0], "company-1");

    expect(mockContentGapDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes only the high-similarity logs when mixed results are returned", async () => {
    // gap-match: [1,0] vs [1,0] → similarity 1.0 (should be deleted)
    // gap-no:    [1,0] vs [0,1] → similarity 0.0 (should be kept)
    setupCursor([
      { _id: "gap-match", questionEmbedding: [1, 0] },
      { _id: "gap-no", questionEmbedding: [0, 1] },
    ]);

    await resolveContentGapsForArticle([1, 0], "company-1");

    expect(mockContentGapDeleteMany).toHaveBeenCalledWith({
      _id: { $in: ["gap-match"] },
    });
    const deletedIds =
      mockContentGapDeleteMany.mock.calls[0][0]._id.$in;
    expect(deletedIds).not.toContain("gap-no");
  });

  it("skips logs that have no questionEmbedding", async () => {
    setupCursor([{ _id: "gap-empty", questionEmbedding: [] }]);
    await resolveContentGapsForArticle([1, 0], "company-1");
    expect(mockContentGapDeleteMany).not.toHaveBeenCalled();
  });

  it("is non-fatal — swallows errors from ContentGapLog queries", async () => {
    mockContentGapFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error("DB error");
        },
      }),
    });

    // Should resolve without throwing
    await expect(
      resolveContentGapsForArticle([1, 0], "company-1"),
    ).resolves.toBeUndefined();
  });

  it("accepts a scalar companyId (non-array) by wrapping it", async () => {
    setupCursor([]);
    await resolveContentGapsForArticle([1, 0], "single-company");

    const filterArg = mockContentGapFind.mock.calls[0][0];
    expect(filterArg.companyId.$in).toContain("single-company");
  });
});

// ── getContentGaps ────────────────────────────────────────────────────────────

describe("getContentGaps", () => {
  const companyId = "company-gaps";

  function managerReq(overrides = {}) {
    return {
      query: {},
      user: { _id: "manager-1", role: ["Manager"], companyId: [companyId] },
      ...overrides,
    };
  }

  function setupAggregateResult() {
    const logs = [{ _id: "log-1", question: "What is the refund policy?" }];
    const topGaps = [{ _id: "What is the refund policy?", count: 3 }];
    const total = 5;

    mockContentGapFind.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(logs),
    });
    mockContentGapAggregate.mockResolvedValue(topGaps);
    mockContentGapCountDocuments.mockResolvedValue(total);

    return { logs, topGaps, total };
  }

  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when caller is an Employee", async () => {
    const req = {
      query: {},
      user: { _id: "emp-1", role: ["Employee"], companyId: [companyId] },
    };
    const { res, nextArgs } = await run(getContentGaps, req, makeRes());
    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns logs, topGaps, and total for a Manager", async () => {
    const { logs, topGaps, total } = setupAggregateResult();
    const { res } = await run(getContentGaps, managerReq(), makeRes());

    expect(res._body.logs).toEqual(logs);
    expect(res._body.topGaps).toEqual(topGaps);
    expect(res._body.total).toBe(total);
  });

  it("applies a department filter to both find and aggregate when provided", async () => {
    setupAggregateResult();
    const req = managerReq({ query: { department: "Engineering" } });
    await run(getContentGaps, req, makeRes());

    const findFilterArg = mockContentGapFind.mock.calls[0][0];
    expect(findFilterArg).toHaveProperty("department", "Engineering");

    const aggregateArg = mockContentGapAggregate.mock.calls[0][0];
    const matchStage = aggregateArg.find((s) => s.$match);
    expect(matchStage.$match).toHaveProperty("department", "Engineering");
  });

  it("does not add department filter when query param is absent", async () => {
    setupAggregateResult();
    await run(getContentGaps, managerReq(), makeRes());

    const findFilterArg = mockContentGapFind.mock.calls[0][0];
    expect(findFilterArg).not.toHaveProperty("department");
  });
});
