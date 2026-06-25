import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, manager } from "../middleware/authMiddleware.js";

// Synchronous guard helpers – no async, no DB, pure logic.

const makeRes = () => {
  let code = null;
  return {
    status(c) {
      code = c;
      return this;
    },
    get statusCode() {
      return code;
    },
    set statusCode(c) {
      code = c;
    },
  };
};

describe("admin guard", () => {
  it("calls next() when user.isAdmin is true", () => {
    const req = { user: { isAdmin: true, role: "Employee" } };
    let nextCalled = false;
    admin(req, makeRes(), () => {
      nextCalled = true;
    });
    assert.ok(nextCalled);
  });

  it("calls next() when user.role is Admin", () => {
    const req = { user: { isAdmin: false, role: "Admin" } };
    let nextCalled = false;
    admin(req, makeRes(), () => {
      nextCalled = true;
    });
    assert.ok(nextCalled);
  });

  it("throws 403 when user lacks admin rights", () => {
    const req = { user: { isAdmin: false, role: "Employee" } };
    const res = makeRes();
    assert.throws(
      () => admin(req, res, () => {}),
      /Not authorized as an admin/,
    );
    assert.equal(res.statusCode, 403);
  });

  it("throws 403 when req.user is absent", () => {
    const req = {};
    const res = makeRes();
    assert.throws(() => admin(req, res, () => {}), /Not authorized as an admin/);
    assert.equal(res.statusCode, 403);
  });
});

describe("manager guard", () => {
  it("calls next() for Manager role", () => {
    const req = { user: { role: "Manager" } };
    let nextCalled = false;
    manager(req, makeRes(), () => {
      nextCalled = true;
    });
    assert.ok(nextCalled);
  });

  it("calls next() for Admin role", () => {
    const req = { user: { role: "Admin" } };
    let nextCalled = false;
    manager(req, makeRes(), () => {
      nextCalled = true;
    });
    assert.ok(nextCalled);
  });

  it("throws 403 for Employee role", () => {
    const req = { user: { role: "Employee" } };
    const res = makeRes();
    assert.throws(
      () => manager(req, res, () => {}),
      /Manager role required/,
    );
    assert.equal(res.statusCode, 403);
  });

  it("throws 403 when req.user is absent", () => {
    const req = {};
    const res = makeRes();
    assert.throws(() => manager(req, res, () => {}), /Manager role required/);
    assert.equal(res.statusCode, 403);
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";

// We use vi.mock so that User.findById can be controlled per-test.
vi.mock("../models/User.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

import { protect, admin, manager } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRes() {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
  return res;
}

async function runMiddleware(middleware, req) {
  const res = makeRes();
  let nextCalled = false;
  let thrownError = null;
  const next = (err) => {
    if (err) thrownError = err;
    else nextCalled = true;
  };

  try {
    await middleware(req, res, next);
  } catch (err) {
    thrownError = err;
  }

  return { res, nextCalled, thrownError };
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// protect
// ---------------------------------------------------------------------------
describe("protect middleware", () => {
  it("calls next() when a valid JWT is supplied and the user exists", async () => {
    const userId = "64aabbcc112233445566aabb";
    const token = jwt.sign({ userId }, "test-secret");
    const mockUser = { _id: userId, firstName: "Alice" };

    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    });

    const req = { cookies: { jwt: token }, originalUrl: "/api/articles" };
    const { nextCalled, thrownError } = await runMiddleware(protect, req);

    expect(thrownError).toBeNull();
    expect(nextCalled).toBe(true);
    expect(req.user).toBe(mockUser);
  });

  it("throws 401 when the token is invalid", async () => {
    const req = {
      cookies: { jwt: "bad.token.here" },
      originalUrl: "/api/articles",
    };
    const { res, thrownError } = await runMiddleware(protect, req);

    expect(res.statusCode).toBe(401);
    expect(thrownError).not.toBeNull();
  });

  it("throws 401 when no cookie is present", async () => {
    const req = { cookies: {}, originalUrl: "/api/articles" };
    const { res, thrownError } = await runMiddleware(protect, req);

    expect(res.statusCode).toBe(401);
    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toMatch(/no token/i);
  });

  it("calls next() without attaching req.user for /api/users/me when token is missing", async () => {
    // The /api/users/me route is allowed to pass through unauthenticated so
    // the client can poll for session status without forcing a redirect loop.
    const req = { cookies: {}, originalUrl: "/api/users/me" };
    const { nextCalled, thrownError } = await runMiddleware(protect, req);

    expect(thrownError).toBeNull();
    expect(nextCalled).toBe(true);
  });

  it("calls next() for /api/users/me even when the token is invalid (session probe)", async () => {
    const req = {
      cookies: { jwt: "invalid.token" },
      originalUrl: "/api/users/me",
    };
    const { nextCalled, thrownError } = await runMiddleware(protect, req);

    expect(thrownError).toBeNull();
    expect(nextCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// admin guard
// ---------------------------------------------------------------------------
describe("admin middleware", () => {
  it("calls next() for a user with isAdmin=true", async () => {
    const req = { user: { isAdmin: true, role: ["Employee"] } };
    const { nextCalled } = await runMiddleware(admin, req);
    expect(nextCalled).toBe(true);
  });

  it("calls next() for a user whose role array contains 'Admin'", async () => {
    const req = { user: { isAdmin: false, role: ["Admin"] } };
    const { nextCalled } = await runMiddleware(admin, req);
    expect(nextCalled).toBe(true);
  });

  it("rejects a regular employee with 403", async () => {
    const req = { user: { isAdmin: false, role: ["Employee"] } };
    const { res, thrownError } = await runMiddleware(admin, req);
    expect(res.statusCode).toBe(403);
    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toMatch(/admin/i);
  });

  it("rejects when req.user is absent", async () => {
    const req = {};
    const { res, thrownError } = await runMiddleware(admin, req);
    expect(res.statusCode).toBe(403);
    expect(thrownError).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// manager guard
// ---------------------------------------------------------------------------
describe("manager middleware", () => {
  it("calls next() for a Manager role", async () => {
    const req = { user: { role: ["Manager"] } };
    const { nextCalled } = await runMiddleware(manager, req);
    expect(nextCalled).toBe(true);
  });

  it("calls next() for an Admin role (admins supersede managers)", async () => {
    const req = { user: { role: ["Admin"] } };
    const { nextCalled } = await runMiddleware(manager, req);
    expect(nextCalled).toBe(true);
  });

  it("rejects a plain Employee with 403", async () => {
    const req = { user: { role: ["Employee"] } };
    const { res, thrownError } = await runMiddleware(manager, req);
    expect(res.statusCode).toBe(403);
    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toMatch(/manager role required/i);
  });

  it("rejects when req.user is absent", async () => {
    const req = {};
    const { res, thrownError } = await runMiddleware(manager, req);
    expect(res.statusCode).toBe(403);
    expect(thrownError).not.toBeNull();
/**
 * Tests for authMiddleware — protect, admin, manager.
 *
 * "protect" is wrapped in asyncHandler so it calls next(err) on failure.
 * "admin" and "manager" are synchronous and throw directly on denial.
 *
 * DB-reaching code paths (valid JWT + User.findById) are intentionally
 * excluded here; they belong in integration tests that run against a
 * real or in-memory MongoDB instance.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { protect, admin, manager } from "../middleware/authMiddleware.js";

const TEST_SECRET = "test-jwt-secret";

// Resolve when next() fires, giving us the error argument (or undefined).
function runAsync(middleware, req, res) {
  return new Promise((resolve) => {
    middleware(req, res, (err) => resolve(err));
  });
}

describe("admin middleware", () => {
  let res;

  beforeEach(() => {
    res = {
      _status: null,
      status(code) {
        this._status = code;
        return this;
      },
    };
  });

  it("calls next() when user has isAdmin: true", () => {
    let called = false;
    admin({ user: { isAdmin: true, role: ["Employee"] } }, res, () => {
      called = true;
    });
    assert.ok(called);
  });

  it("calls next() when user role array contains Admin", () => {
    let called = false;
    admin({ user: { isAdmin: false, role: ["Admin"] } }, res, () => {
      called = true;
    });
    assert.ok(called);
  });

  it("throws 403 for an Employee role", () => {
    assert.throws(
      () => admin({ user: { isAdmin: false, role: ["Employee"] } }, res, () => {}),
      /Not authorized as an admin/,
    );
    assert.strictEqual(res._status, 403);
  });

  it("throws 403 for a Manager role (admin routes are strictly admin-only)", () => {
    assert.throws(
      () => admin({ user: { isAdmin: false, role: ["Manager"] } }, res, () => {}),
      /Not authorized as an admin/,
    );
    assert.strictEqual(res._status, 403);
  });

  it("throws 403 when there is no authenticated user", () => {
    assert.throws(
      () => admin({ user: null }, res, () => {}),
      /Not authorized as an admin/,
    );
    assert.strictEqual(res._status, 403);
  });
});

describe("manager middleware", () => {
  let res;

  beforeEach(() => {
    res = {
      _status: null,
      status(code) {
        this._status = code;
        return this;
      },
    };
  });

  it("calls next() for a Manager role", () => {
    let called = false;
    manager({ user: { role: ["Manager"] } }, res, () => {
      called = true;
    });
    assert.ok(called);
  });

  it("calls next() for an Admin role (admins inherit manager access)", () => {
    let called = false;
    manager({ user: { role: ["Admin"] } }, res, () => {
      called = true;
    });
    assert.ok(called);
  });

  it("throws 403 for an Employee role", () => {
    assert.throws(
      () => manager({ user: { role: ["Employee"] } }, res, () => {}),
      /Manager role required/,
    );
    assert.strictEqual(res._status, 403);
  });

  it("throws 403 when there is no authenticated user", () => {
    assert.throws(
      () => manager({ user: null }, res, () => {}),
      /Manager role required/,
    );
    assert.strictEqual(res._status, 403);
  });
});

describe("protect middleware", () => {
  let originalSecret;
  let res;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
    res = {
      _status: null,
      status(code) {
        this._status = code;
        return this;
      },
    };
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("calls next(error) with 401 when no token is present", async () => {
    const req = { cookies: {}, originalUrl: "/api/articles" };
    const err = await runAsync(protect, req, res);
    assert.ok(err instanceof Error);
    assert.match(err.message, /no token/i);
    assert.strictEqual(res._status, 401);
  });

  it("calls next() without error for /api/users/me when no token is present", async () => {
    const req = { cookies: {}, originalUrl: "/api/users/me" };
    const err = await runAsync(protect, req, res);
    assert.strictEqual(err, undefined);
  });

  it("calls next(error) with 401 when the JWT is signed with the wrong secret", async () => {
    const badToken = jwt.sign({ userId: "abc123" }, "wrong-secret");
    const req = { cookies: { jwt: badToken }, originalUrl: "/api/articles" };
    const err = await runAsync(protect, req, res);
    assert.ok(err instanceof Error);
    assert.match(err.message, /token failed/i);
    assert.strictEqual(res._status, 401);
  });

  it("calls next() without error for /api/users/me even with an invalid token", async () => {
    const badToken = jwt.sign({ userId: "abc123" }, "wrong-secret");
    const req = { cookies: { jwt: badToken }, originalUrl: "/api/users/me" };
    const err = await runAsync(protect, req, res);
    assert.strictEqual(err, undefined);
  });
});
