import mongoose from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFind,
  mockAggregate,
  mockCountDocuments,
  mockDeleteMany,
} = vi.hoisted(() => ({
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

import {
  getContentGaps,
  resolveContentGapsForArticle,
} from "../../controllers/analyticsController.js";

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

describe("getContentGaps", () => {
  const companyId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when a non-elevated user requests analytics", async () => {
    const req = {
      query: {},
      user: { role: ["Employee"], companyId: [companyId] },
    };

    const { res, nextArgs } = await run(getContentGaps, req, makeRes());

    expect(res.statusCode).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("filters analytics by workspace and trimmed department", async () => {
    const logs = [{ _id: "gap-1", question: "How do I file PTO?" }];
    const topGaps = [{ _id: "How do I file PTO?", count: 2 }];
    const queryChain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(logs),
    };

    mockFind.mockReturnValue(queryChain);
    mockAggregate.mockResolvedValue(topGaps);
    mockCountDocuments.mockResolvedValue(2);

    const req = {
      query: { department: " HR " },
      user: { role: ["Manager"], companyId: [companyId] },
    };

    const { res } = await run(getContentGaps, req, makeRes());

    expect(res.json).toHaveBeenCalledWith({ logs, topGaps, total: 2 });

    const findFilter = mockFind.mock.calls[0][0];
    expect(findFilter.department).toBe("HR");
    expect(findFilter.companyId.$in).toHaveLength(1);
    expect(String(findFilter.companyId.$in[0])).toBe(companyId);

    expect(mockAggregate).toHaveBeenCalledWith([
      {
        $match: {
          companyId: { $in: expect.any(Array) },
          department: "HR",
        },
      },
      {
        $group: {
          _id: "$question",
          count: { $sum: 1 },
          lastAsked: { $max: "$createdAt" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    const [{ $match }] = mockAggregate.mock.calls[0][0];
    expect($match.companyId.$in).toHaveLength(1);
    expect(String($match.companyId.$in[0])).toBe(companyId);
  });
});

describe("resolveContentGapsForArticle", () => {
  const companyId = "507f1f77bcf86cd799439011";
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("returns early when the article has no embedding", async () => {
    await resolveContentGapsForArticle([], companyId);

    expect(mockFind).not.toHaveBeenCalled();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes only content gaps that meet the similarity threshold", async () => {
    const cursor = {
      async *[Symbol.asyncIterator]() {
        yield { _id: "delete-me", questionEmbedding: [1, 0] };
        yield { _id: "keep-me", questionEmbedding: [0, 1] };
        yield { _id: "skip-mismatch", questionEmbedding: [1] };
        yield { _id: "skip-empty", questionEmbedding: [] };
      },
    };
    const queryChain = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      cursor: vi.fn().mockReturnValue(cursor),
    };

    mockFind.mockReturnValue(queryChain);
    mockDeleteMany.mockResolvedValue({ deletedCount: 1 });

    await resolveContentGapsForArticle([1, 0], companyId);

    expect(mockFind).toHaveBeenCalledWith({
      companyId: { $in: [companyId] },
    });
    expect(mockDeleteMany).toHaveBeenCalledWith({
      _id: { $in: ["delete-me"] },
    });
  });

  it("swallows delete-resolution errors so approval flows stay non-fatal", async () => {
    mockFind.mockImplementation(() => {
      throw new Error("database offline");
    });

    await expect(
      resolveContentGapsForArticle([1, 0], new mongoose.Types.ObjectId()),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });
});
