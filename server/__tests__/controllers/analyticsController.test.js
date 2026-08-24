import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockContentGapFind, mockContentGapDeleteMany, mockContentGapAggregate, mockContentGapCount } =
  vi.hoisted(() => ({
    mockContentGapFind: vi.fn(),
    mockContentGapDeleteMany: vi.fn(),
    mockContentGapAggregate: vi.fn(),
    mockContentGapCount: vi.fn(),
  }));

vi.mock("../../models/ContentGapLog.js", () => ({
  default: {
    find: mockContentGapFind,
    deleteMany: mockContentGapDeleteMany,
    aggregate: mockContentGapAggregate,
    countDocuments: mockContentGapCount,
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  resolveContentGapsForArticle,
  getContentGaps,
} from "../../controllers/analyticsController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/** Build an async-iterable cursor from a plain array. */
function makeCursor(items) {
  return {
    [Symbol.asyncIterator]() {
      return (async function* () {
        for (const item of items) yield item;
      })();
    },
  };
}

// ── resolveContentGapsForArticle ──────────────────────────────────────────────

describe("resolveContentGapsForArticle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when articleEmbedding is empty", async () => {
    await resolveContentGapsForArticle([], "company-001");
    expect(mockContentGapFind).not.toHaveBeenCalled();
  });

  it("does nothing when articleEmbedding is not an array", async () => {
    await resolveContentGapsForArticle(null, "company-001");
    expect(mockContentGapFind).not.toHaveBeenCalled();
  });

  it("deletes logs whose questionEmbedding is semantically similar (>= 0.7)", async () => {
    // Two identical unit vectors → cosine similarity = 1.0 (above threshold)
    const vec = [1, 0, 0];
    const similarLog = {
      _id: "log-1",
      questionEmbedding: [1, 0, 0],
    };
    const dissimilarLog = {
      _id: "log-2",
      questionEmbedding: [0, 1, 0], // orthogonal → similarity = 0
    };

    mockContentGapFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(makeCursor([similarLog, dissimilarLog])),
    });
    mockContentGapDeleteMany.mockResolvedValue({ deletedCount: 1 });

    await resolveContentGapsForArticle(vec, "company-001");

    expect(mockContentGapDeleteMany).toHaveBeenCalledWith({
      _id: { $in: ["log-1"] },
    });
  });

  it("does not call deleteMany when no logs exceed the threshold", async () => {
    const vec = [1, 0, 0];
    const dissimilarLog = { _id: "log-3", questionEmbedding: [0, 1, 0] };

    mockContentGapFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(makeCursor([dissimilarLog])),
    });

    await resolveContentGapsForArticle(vec, "company-001");

    expect(mockContentGapDeleteMany).not.toHaveBeenCalled();
  });

  it("skips logs with missing or empty questionEmbedding", async () => {
    const vec = [1, 0, 0];
    const noEmbeddingLog = { _id: "log-4", questionEmbedding: [] };
    const undefinedEmbeddingLog = { _id: "log-5" };

    mockContentGapFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(makeCursor([noEmbeddingLog, undefinedEmbeddingLog])),
    });

    await resolveContentGapsForArticle(vec, "company-001");

    expect(mockContentGapDeleteMany).not.toHaveBeenCalled();
  });

  it("is non-fatal — errors during cursor iteration are swallowed", async () => {
    const vec = [1, 0, 0];
    mockContentGapFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockImplementation(() => {
        throw new Error("DB error");
      }),
    });

    // Should not throw
    await expect(
      resolveContentGapsForArticle(vec, "company-001"),
    ).resolves.toBeUndefined();
  });

  it("accepts companyId as an array and uses $in correctly", async () => {
    const vec = [1, 0, 0];

    mockContentGapFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(makeCursor([])),
    });

    await resolveContentGapsForArticle(vec, ["company-001", "company-002"]);

    const filterArg = mockContentGapFind.mock.calls[0][0];
    expect(filterArg.companyId.$in).toEqual(["company-001", "company-002"]);
  });
});

// ── getContentGaps ────────────────────────────────────────────────────────────

describe("getContentGaps", () => {
  const adminUser = {
    companyId: [{ toString: () => "company-001" }, { toString: () => "company-002" }],
    role: ["Admin"],
  };

  const employeeUser = { companyId: ["company-001"], role: ["Employee"] };

  const fakeLogs = [{ _id: "log-1", question: "What is PTO policy?" }];
  const fakeTopGaps = [{ _id: "What is PTO policy?", count: 5 }];

  beforeEach(() => vi.clearAllMocks());

  it("rejects non-elevated users with 403", async () => {
    const req = { user: employeeUser, query: {} };
    const res = makeRes();

    const { nextArgs } = await run(getContentGaps, req, res);
    expect(res._code).toBe(403);
    expect(nextArgs[0].message).toMatch(/not authorized/i);
    expect(mockContentGapFind).not.toHaveBeenCalled();
  });

  it("returns logs, topGaps, and total for admin", async () => {
    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(fakeLogs),
    };
    mockContentGapFind.mockReturnValue(findChain);
    mockContentGapAggregate.mockResolvedValue(fakeTopGaps);
    mockContentGapCount.mockResolvedValue(1);

    const req = { user: adminUser, query: {} };
    const { res } = await run(getContentGaps, req, makeRes());

    expect(res._body).toMatchObject({
      logs: fakeLogs,
      topGaps: fakeTopGaps,
      total: 1,
    });
  });

  it("applies department filter when query.department is provided", async () => {
    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockContentGapFind.mockReturnValue(findChain);
    mockContentGapAggregate.mockResolvedValue([]);
    mockContentGapCount.mockResolvedValue(0);

    const req = { user: adminUser, query: { department: "HR" } };
    await run(getContentGaps, req, makeRes());

    const findFilter = mockContentGapFind.mock.calls[0][0];
    expect(findFilter.department).toBe("HR");

    const aggregatePipeline = mockContentGapAggregate.mock.calls[0][0];
    expect(aggregatePipeline[0].$match.department).toBe("HR");
  });

  it("does not apply department filter when query.department is absent", async () => {
    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockContentGapFind.mockReturnValue(findChain);
    mockContentGapAggregate.mockResolvedValue([]);
    mockContentGapCount.mockResolvedValue(0);

    const req = { user: adminUser, query: {} };
    await run(getContentGaps, req, makeRes());

    const findFilter = mockContentGapFind.mock.calls[0][0];
    expect(findFilter).not.toHaveProperty("department");
  });

  it("also accepts Manager role", async () => {
    const managerUser = { companyId: ["company-001"], role: ["Manager"] };
    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockContentGapFind.mockReturnValue(findChain);
    mockContentGapAggregate.mockResolvedValue([]);
    mockContentGapCount.mockResolvedValue(0);

    const req = { user: managerUser, query: {} };
    const { res } = await run(getContentGaps, req, makeRes());
    expect(res._code).toBe(200);
  });
});
