import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("../../models/User.js", () => ({
  default: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn(), find: vi.fn() },
}));

vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: vi.fn() } },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import User from "../../models/User.js";

import {
  toggleFavoriteArticle,
  updateUserStatus,
  updateUserRole,
  createElevatedUser,
  deleteUserById,
  getCompanyDirectory,
} from "../../controllers/userController.js";

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

/**
 * Drives an asyncHandler-wrapped controller to completion, resolving once
 * either `next` is called (error path) or `res.json` is called (success path).
 */
function run(controller, req, res) {
  return new Promise((resolve) => {
    const done = (...args) => resolve({ res, nextArgs: args });
    // Wrap res.json so success paths also resolve the promise
    const originalJson = res.json.bind(res);
    res.json = vi.fn((...args) => {
      originalJson(...args);
      done();
    });
    const next = vi.fn((...args) => done(...args));
    controller(req, res, next);
  });
}

// ── toggleFavoriteArticle ─────────────────────────────────────────────────────

describe("toggleFavoriteArticle", () => {
  const articleId = "article123";

  beforeEach(() => vi.clearAllMocks());

  it("adds an article when it is not already in favorites", async () => {
    const fakeUser = {
      _id: "u1",
      favoriteArticles: [],
      save: vi.fn().mockResolvedValue(true),
    };
    User.findById.mockResolvedValue(fakeUser);

    const req = {
      user: { _id: "u1" },
      params: { articleId },
    };
    const res = makeRes();

    await run(toggleFavoriteArticle, req, res);

    expect(fakeUser.favoriteArticles).toContain(articleId);
    expect(res._body.message).toBe("Added to favorites");
  });

  it("removes an article when it is already in favorites", async () => {
    const fakeUser = {
      _id: "u1",
      favoriteArticles: [articleId],
      save: vi.fn().mockResolvedValue(true),
    };
    User.findById.mockResolvedValue(fakeUser);

    const req = {
      user: { _id: "u1" },
      params: { articleId },
    };
    const res = makeRes();

    await run(toggleFavoriteArticle, req, res);

    expect(fakeUser.favoriteArticles).not.toContain(articleId);
    expect(res._body.message).toBe("Removed from favorites");
  });

  it("returns 404 when user is not found", async () => {
    User.findById.mockResolvedValue(null);

    const req = { user: { _id: "ghost" }, params: { articleId } };
    const res = makeRes();

    const { nextArgs } = await run(toggleFavoriteArticle, req, res);

    expect(res._code).toBe(404);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });
});

// ── updateUserStatus ──────────────────────────────────────────────────────────

describe("updateUserStatus", () => {
  const managerId = "manager1";
  const targetId = "employee1";

  beforeEach(() => vi.clearAllMocks());

  function makeManager(overrides = {}) {
    return {
      _id: managerId,
      role: ["Manager"],
      companyId: [{ toString: () => "company1" }],
      ...overrides,
    };
  }

  function makeTargetUser(overrides = {}) {
    return {
      _id: targetId,
      companyId: [{ toString: () => "company1" }],
      isSuspended: false,
      suspensionReason: "",
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  it("returns 403 when caller is not a Manager or Admin", async () => {
    const req = {
      user: { ...makeManager(), role: ["Employee"] },
      params: { id: targetId },
      body: { isSuspended: true },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateUserStatus, req, res);

    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 400 when manager tries to suspend their own account", async () => {
    const target = makeTargetUser({ _id: managerId });
    User.findById.mockResolvedValue(target);

    const req = {
      user: makeManager({ _id: managerId }),
      params: { id: managerId },
      body: { isSuspended: true },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateUserStatus, req, res);

    expect(res._code).toBe(400);
    expect(nextArgs[0].message).toMatch(/cannot suspend your own/i);
  });

  it("returns 404 when no shared company workspace exists", async () => {
    const target = makeTargetUser({
      companyId: [{ toString: () => "other-company" }],
    });
    User.findById.mockResolvedValue(target);

    const req = {
      user: makeManager(),
      params: { id: targetId },
      body: { isSuspended: true },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateUserStatus, req, res);

    expect(res._code).toBe(404);
    expect(nextArgs[0].message).toMatch(/access denied/i);
  });

  it("suspends the user and returns a success message", async () => {
    const target = makeTargetUser();
    User.findById.mockResolvedValue(target);

    const req = {
      user: makeManager(),
      params: { id: targetId },
      body: { isSuspended: true, suspensionReason: "Policy violation" },
    };
    const res = makeRes();

    await run(updateUserStatus, req, res);

    expect(target.isSuspended).toBe(true);
    expect(target.suspensionReason).toBe("Policy violation");
    expect(res._body.message).toMatch(/suspended/i);
  });

  it("restores a suspended user", async () => {
    const target = makeTargetUser({
      isSuspended: true,
      suspensionReason: "Old reason",
    });
    User.findById.mockResolvedValue(target);

    const req = {
      user: makeManager(),
      params: { id: targetId },
      body: { isSuspended: false, suspensionReason: "" },
    };
    const res = makeRes();

    await run(updateUserStatus, req, res);

    expect(target.isSuspended).toBe(false);
    expect(res._body.message).toMatch(/restored/i);
  });
});

// ── createElevatedUser ────────────────────────────────────────────────────────

describe("createElevatedUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when caller is an Employee", async () => {
    const req = {
      user: { role: ["Employee"], companyId: ["company1"] },
      body: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@test.com",
        password: "pass",
        role: "Manager",
      },
    };
    const res = makeRes();

    const { nextArgs } = await run(createElevatedUser, req, res);

    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 400 when an invalid role is provided", async () => {
    const req = {
      user: { role: ["Admin"], companyId: ["company1"] },
      body: { role: "SuperUser" },
    };
    const res = makeRes();

    const { nextArgs } = await run(createElevatedUser, req, res);

    expect(res._code).toBe(400);
    expect(nextArgs[0].message).toMatch(/invalid role/i);
  });

  it("creates a user with multiple departments and workspaces", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: "new-user",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@test.com",
      role: ["Manager"],
      department: ["Engineering", "Product"],
      companyId: ["company1", "company2"],
    });

    const req = {
      user: { role: ["Admin"], companyId: ["company1", "company2"] },
      body: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@test.com",
        password: "pass12345",
        department: ["Engineering", "Product"],
        companyId: ["company1", "company2"],
        role: ["Manager"],
      },
    };
    const res = makeRes();

    await run(createElevatedUser, req, res);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        department: ["Engineering", "Product"],
        companyId: ["company1", "company2"],
      }),
    );
    expect(res._code).toBe(201);
  });

  it("returns 403 when assigning a workspace caller does not have", async () => {
    const req = {
      user: { role: ["Admin"], companyId: ["company1"] },
      body: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@test.com",
        password: "pass12345",
        department: ["Engineering"],
        companyId: ["company2"],
        role: ["Employee"],
      },
    };
    const res = makeRes();

    const { nextArgs } = await run(createElevatedUser, req, res);

    expect(res._code).toBe(403);
    expect(nextArgs[0].message).toMatch(/not authorized to assign users/i);
  });
});

// ── deleteUserById ────────────────────────────────────────────────────────────

describe("deleteUserById", () => {
  const adminId = "admin1";
  const targetId = "user99";

  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when caller is not a Manager or Admin", async () => {
    const req = {
      user: { _id: adminId, role: ["Employee"], companyId: ["c1"] },
      params: { id: targetId },
    };
    const res = makeRes();

    const { nextArgs } = await run(deleteUserById, req, res);

    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 400 when admin tries to delete their own account via this route", async () => {
    const target = {
      _id: adminId,
      companyId: [{ toString: () => "company1" }],
      deleteOne: vi.fn(),
    };
    User.findById.mockResolvedValue(target);

    const req = {
      user: {
        _id: adminId,
        role: ["Admin"],
        companyId: [{ toString: () => "company1" }],
      },
      params: { id: adminId },
    };
    const res = makeRes();

    const { nextArgs } = await run(deleteUserById, req, res);

    expect(res._code).toBe(400);
    expect(nextArgs[0].message).toMatch(/profile settings/i);
  });

  it("returns 404 when target user has no shared company with caller", async () => {
    const target = {
      _id: targetId,
      companyId: [{ toString: () => "other-company" }],
      deleteOne: vi.fn(),
    };
    User.findById.mockResolvedValue(target);

    const req = {
      user: {
        _id: adminId,
        role: ["Admin"],
        companyId: [{ toString: () => "company1" }],
      },
      params: { id: targetId },
    };
    const res = makeRes();

    const { nextArgs } = await run(deleteUserById, req, res);

    expect(res._code).toBe(404);
    expect(nextArgs[0].message).toMatch(/access denied/i);
  });

  it("deletes the target user when all guards pass", async () => {
    const target = {
      _id: targetId,
      companyId: [{ toString: () => "company1" }],
      deleteOne: vi.fn().mockResolvedValue(true),
    };
    User.findById.mockResolvedValue(target);

    const req = {
      user: {
        _id: adminId,
        role: ["Admin"],
        companyId: [{ toString: () => "company1" }],
      },
      params: { id: targetId },
    };
    const res = makeRes();

    await run(deleteUserById, req, res);

    expect(target.deleteOne).toHaveBeenCalled();
    expect(res._body.message).toMatch(/permanently deleted/i);
  });
});

// ── updateUserRole ──────────────────────────────────────────────────────────────

describe("updateUserRole", () => {
  const managerId = "manager1";
  const targetId = "employee9";

  beforeEach(() => vi.clearAllMocks());

  const managerUser = {
    _id: managerId,
    role: ["Manager"],
    companyId: [{ toString: () => "company1" }],
  };

  const targetUser = {
    _id: targetId,
    role: ["Employee"],
    companyId: [{ toString: () => "company1" }],
    isAdmin: false,
    save: vi.fn().mockResolvedValue(true),
  };

  it("returns 403 when caller is not manager/admin", async () => {
    const req = {
      user: { ...managerUser, role: ["Employee"] },
      params: { id: targetId },
      body: { role: "Manager" },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateUserRole, req, res);
    expect(res._code).toBe(403);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 400 when attempting to modify own role", async () => {
    User.findById.mockResolvedValue({ ...targetUser, _id: managerId });
    const req = {
      user: managerUser,
      params: { id: managerId },
      body: { role: "Admin" },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateUserRole, req, res);
    expect(res._code).toBe(400);
    expect(nextArgs[0].message).toMatch(/own role/i);
  });

  it("returns 400 for invalid roles", async () => {
    User.findById.mockResolvedValue(targetUser);
    const req = {
      user: managerUser,
      params: { id: targetId },
      body: { role: "SuperUser" },
    };
    const res = makeRes();

    const { nextArgs } = await run(updateUserRole, req, res);
    expect(res._code).toBe(400);
    expect(nextArgs[0].message).toMatch(/invalid role/i);
  });

  it("updates role and admin flag successfully", async () => {
    const mutableUser = {
      ...targetUser,
      save: vi.fn().mockResolvedValue(true),
    };
    User.findById.mockResolvedValue(mutableUser);
    const req = {
      user: managerUser,
      params: { id: targetId },
      body: { role: "Admin" },
    };
    const res = makeRes();

    await run(updateUserRole, req, res);
    expect(mutableUser.role).toEqual(["Admin"]);
    expect(mutableUser.isAdmin).toBe(true);
    expect(res._body.message).toMatch(/updated successfully/i);
  });
});

// ── getCompanyDirectory ───────────────────────────────────────────────────────

describe("getCompanyDirectory", () => {
  const companyId = "company-dir";

  function fakeUsers(n = 2) {
    return Array.from({ length: n }, (_, i) => ({
      _id: `user-${i}`,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `user${i}@example.com`,
      role: ["Employee"],
      avatar: null,
    }));
  }

  function mockQuery(users) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(users),
    };
    User.find.mockReturnValue(chain);
    return chain;
  }

  beforeEach(() => vi.clearAllMocks());

  it("returns all directory members when no q param is provided", async () => {
    const users = fakeUsers(3);
    const chain = mockQuery(users);

    const req = {
      user: { companyId: [companyId] },
      query: {},
    };
    const res = makeRes();

    await run(getCompanyDirectory, req, res);

    expect(User.find).toHaveBeenCalledWith({
      companyId: { $in: [companyId] },
    });
    // No limit applied for unfiltered queries
    expect(chain.limit).not.toHaveBeenCalled();
    expect(res._body).toEqual(users);
  });

  it("applies prefix filter and limit when q is provided", async () => {
    const matched = fakeUsers(1);
    const chain = mockQuery(matched);

    const req = {
      user: { companyId: [companyId] },
      query: { q: "Al", limit: "5" },
    };
    const res = makeRes();

    await run(getCompanyDirectory, req, res);

    const filterArg = User.find.mock.calls[0][0];
    expect(filterArg.$or).toBeDefined();
    expect(filterArg.$or[0].firstName.$regex).toMatch(/^\^Al/i);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(res._body).toEqual(matched);
  });

  it("caps the limit at 50 regardless of what is requested", async () => {
    const chain = mockQuery(fakeUsers(1));

    const req = {
      user: { companyId: [companyId] },
      query: { q: "Bo", limit: "200" },
    };
    const res = makeRes();

    await run(getCompanyDirectory, req, res);

    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("defaults limit to 25 when q is provided but no limit is given", async () => {
    const chain = mockQuery(fakeUsers(1));

    const req = {
      user: { companyId: [companyId] },
      query: { q: "Ca" },
    };
    const res = makeRes();

    await run(getCompanyDirectory, req, res);

    expect(chain.limit).toHaveBeenCalledWith(25);
  });

  it("uses companyId from query param when provided", async () => {
    const altCompany = "alt-company";
    const chain = mockQuery([]);

    const req = {
      user: { companyId: [companyId] },
      query: { companyId: altCompany },
    };
    const res = makeRes();

    await run(getCompanyDirectory, req, res);

    expect(User.find).toHaveBeenCalledWith({
      companyId: { $in: [altCompany] },
    });
    expect(chain.limit).not.toHaveBeenCalled();
  });

  it("escapes regex metacharacters in the keyword", async () => {
    const chain = mockQuery([]);

    const req = {
      user: { companyId: [companyId] },
      query: { q: "O'Brien.Jr" },
    };
    const res = makeRes();

    await run(getCompanyDirectory, req, res);

    const filterArg = User.find.mock.calls[0][0];
    // Metacharacters must be escaped so they are treated as literals
    expect(filterArg.$or[0].firstName.$regex).not.toMatch(/[^\\]\./);
  });
});
