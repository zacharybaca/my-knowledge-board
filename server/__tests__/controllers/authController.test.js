import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockFindOne, mockUserCreate } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUserCreate: vi.fn(),
}));

vi.mock("../../models/User.js", () => ({
  default: { findOne: mockFindOne, create: mockUserCreate },
}));

vi.mock("../../models/Company.js", () => ({
  default: { findById: vi.fn() },
}));

vi.mock("../../utils/generateToken.js", () => ({
  default: vi.fn(),
}));

vi.mock("../../utils/sendEmail.js", () => ({
  default: vi.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  loginUser,
  registerUser,
  logoutUser,
} from "../../controllers/authController.js";
import generateToken from "../../utils/generateToken.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res._body = body;
    return res;
  });
  res.cookie = vi.fn().mockReturnThis();
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

// ── loginUser ─────────────────────────────────────────────────────────────────

describe("loginUser", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeUser(overrides = {}) {
    return {
      _id: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.com",
      role: ["Employee"],
      companyId: ["company-1"],
      department: "Engineering",
      avatar: null,
      isSuspended: false,
      suspensionReason: "",
      matchPassword: vi.fn().mockResolvedValue(true),
      populate: vi.fn().mockReturnThis(),
      ...overrides,
    };
  }

  it("sets a JWT cookie and returns user data on successful login", async () => {
    const user = makeUser();
    mockFindOne.mockReturnValue({ populate: vi.fn().mockResolvedValue(user) });

    const req = { body: { email: "jane@acme.com", password: "correct" } };
    const res = makeRes();

    await run(loginUser, req, res);

    expect(generateToken).toHaveBeenCalledWith(res, user._id);
    expect(res.statusCode).toBe(200);
    expect(res._body._id).toBe("user-1");
  });

  it("returns 401 when credentials are invalid", async () => {
    mockFindOne.mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    });

    const req = { body: { email: "nobody@acme.com", password: "wrong" } };
    const { res, nextArgs } = await run(loginUser, req, makeRes());

    expect(res.statusCode).toBe(401);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/invalid email or password/i);
  });

  it("returns 401 when password does not match", async () => {
    const user = makeUser({ matchPassword: vi.fn().mockResolvedValue(false) });
    mockFindOne.mockReturnValue({ populate: vi.fn().mockResolvedValue(user) });

    const req = { body: { email: "jane@acme.com", password: "wrong" } };
    const { res, nextArgs } = await run(loginUser, req, makeRes());

    expect(res.statusCode).toBe(401);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("returns 403 when the account is suspended", async () => {
    const user = makeUser({
      isSuspended: true,
      suspensionReason: "Policy violation",
    });
    mockFindOne.mockReturnValue({ populate: vi.fn().mockResolvedValue(user) });

    const req = { body: { email: "jane@acme.com", password: "correct" } };
    const { res, nextArgs } = await run(loginUser, req, makeRes());

    expect(res.statusCode).toBe(403);
    expect(nextArgs[0].message).toMatch(/account suspended/i);
    expect(nextArgs[0].message).toMatch(/policy violation/i);
    expect(generateToken).not.toHaveBeenCalled();
  });

  it("uses a default suspension message when no reason is stored", async () => {
    const user = makeUser({ isSuspended: true, suspensionReason: "" });
    mockFindOne.mockReturnValue({ populate: vi.fn().mockResolvedValue(user) });

    const req = { body: { email: "jane@acme.com", password: "correct" } };
    const { nextArgs } = await run(loginUser, req, makeRes());

    expect(nextArgs[0].message).toMatch(/please contact your manager/i);
  });
});

// ── registerUser ──────────────────────────────────────────────────────────────

describe("registerUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new user and returns 201 with user data", async () => {
    mockFindOne.mockResolvedValue(null); // no duplicate
    mockUserCreate.mockResolvedValue({
      _id: "new-user",
      firstName: "Bob",
      lastName: "Smith",
      email: "bob@acme.com",
      role: ["Employee"],
      companyId: ["company-1"],
    });

    const req = {
      body: {
        firstName: "Bob",
        lastName: "Smith",
        email: "bob@acme.com",
        password: "secret",
        department: "Engineering",
        companyId: "company-1",
      },
    };
    const { res } = await run(registerUser, req, makeRes());

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: ["company-1"] }),
    );
    expect(res.statusCode).toBe(201);
    expect(res._body._id).toBe("new-user");
  });

  it("returns 400 when a user with that email already exists", async () => {
    mockFindOne.mockResolvedValue({ _id: "existing-user" });

    const req = {
      body: { email: "dupe@acme.com", password: "secret" },
    };
    const { res, nextArgs } = await run(registerUser, req, makeRes());

    expect(res.statusCode).toBe(400);
    expect(nextArgs[0].message).toMatch(/user already exists/i);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});

// ── logoutUser ────────────────────────────────────────────────────────────────

describe("logoutUser", () => {
  it("clears the jwt cookie and returns a logout message", async () => {
    const req = {};
    const res = makeRes();
    const { res: result } = await run(logoutUser, req, res);

    expect(result.cookie).toHaveBeenCalledWith(
      "jwt",
      "",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result._body.message).toMatch(/logged out/i);
  });
});
