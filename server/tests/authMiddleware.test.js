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
  });
});
