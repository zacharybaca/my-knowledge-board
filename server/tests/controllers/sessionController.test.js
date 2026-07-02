import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../models/SessionLog.js", () => ({
  default: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("../../models/User.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

import SessionLog from "../../models/SessionLog.js";
import User from "../../models/User.js";
import { clearSessions } from "../../controllers/sessionController.js";

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

describe("clearSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-manager/admin users", async () => {
    const req = {
      user: { role: ["Employee"], companyId: ["company1"] },
    };
    const res = makeRes();

    const { nextArgs } = await run(clearSessions, req, res);
    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("deletes only logs for users in caller's companies", async () => {
    User.find.mockReturnValue({
      select: vi.fn().mockResolvedValue([{ _id: "u1" }, { _id: "u2" }]),
    });
    SessionLog.deleteMany.mockResolvedValue({ deletedCount: 3 });

    const req = {
      user: {
        role: ["Manager"],
        companyId: [{ toString: () => "company1" }],
      },
    };
    const res = makeRes();

    await run(clearSessions, req, res);

    expect(User.find).toHaveBeenCalledWith({
      companyId: { $in: req.user.companyId },
    });
    expect(SessionLog.deleteMany).toHaveBeenCalledWith({
      userId: { $in: ["u1", "u2"] },
    });
    expect(res._body.deletedCount).toBe(3);
  });
});
