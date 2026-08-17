import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../models/ContentGapLog.js", () => ({
  default: {
    find: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import ContentGapLog from "../../models/ContentGapLog.js";
import {
  getContentGaps,
  resolveContentGapsForArticle,
} from "../../controllers/analyticsController.js";

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

function makeCursor(items) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* items;
    },
  };
}

describe("resolveContentGapsForArticle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes only logs that meet the semantic similarity threshold", async () => {
    const cursor = makeCursor([
      { _id: "keep", questionEmbedding: [0, 1] },
      { _id: "remove", questionEmbedding: [1, 0] },
      { _id: "skip-empty", questionEmbedding: [] },
    ]);
    const select = vi.fn().mockReturnValue({ lean: vi.fn().mockReturnValue({ cursor: vi.fn().mockReturnValue(cursor) }) });
    ContentGapLog.find.mockReturnValue({ select });

    await resolveContentGapsForArticle([1, 0], "company1");

    expect(ContentGapLog.find).toHaveBeenCalledWith({
      companyId: { $in: ["company1"] },
    });
    expect(ContentGapLog.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ["remove"] },
    });
  });

  it("swallows operational errors and logs them", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    ContentGapLog.find.mockImplementation(() => {
      throw new Error("db down");
    });

    await expect(
      resolveContentGapsForArticle([1, 0], "company1"),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe("getContentGaps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-elevated users", async () => {
    const req = { user: { role: ["Employee"], companyId: ["company1"] }, query: {} };
    const { res, nextArgs } = await run(getContentGaps, req, makeRes());

    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns logs, top gaps, and total scoped by company and department", async () => {
    const logs = [{ question: "Where is PTO policy?" }];
    const topGaps = [{ _id: "Where is PTO policy?", count: 3 }];
    const findChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(logs),
    };
    ContentGapLog.find.mockReturnValue(findChain);
    ContentGapLog.aggregate.mockResolvedValue(topGaps);
    ContentGapLog.countDocuments.mockResolvedValue(8);

    const req = {
      user: { role: ["Manager"], companyId: ["66ad8c7eb43dbf26cf75f001"] },
      query: { department: "HR " },
    };
    const res = makeRes();

    await run(getContentGaps, req, res);

    const calledFilter = ContentGapLog.find.mock.calls[0][0];
    expect(calledFilter.department).toBe("HR");
    expect(calledFilter.companyId.$in).toHaveLength(1);
    expect(calledFilter.companyId.$in[0].constructor.name).toBe("ObjectId");

    const pipeline = ContentGapLog.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.department).toBe("HR");
    expect(res._body).toEqual({ logs, topGaps, total: 8 });
  });
});
