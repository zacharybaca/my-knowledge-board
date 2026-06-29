import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  validateLogin,
  validateRegistration,
  validateForgotPassword,
  validateArticlePayload,
  validateArticleStatus,
  validateBulkArticleStatus,
  validateComment,
  validateSearchQuery,
  validateChatQuestion,
} from "../../middleware/validationMiddleware.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Runs a validator chain (array of express middleware) against a fake request.
 * Returns { passed: true } when all validators succeed, or { passed: false, error, res }
 * when the final handleValidationErrors step fires.
 */
async function runChain(chain, body = {}, query = {}) {
  const req = {
    body,
    query,
    headers: {},
    params: {},
    cookies: {},
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };

  // Run every validator middleware except the last (handleValidationErrors),
  // which is synchronous and either calls next() or throws.
  const validators = chain.slice(0, -1);
  const check = chain[chain.length - 1];

  for (const mw of validators) {
    await new Promise((resolve) => mw(req, res, resolve));
  }

  let thrownError = null;
  let nextCalled = false;

  try {
    check(req, res, () => {
      nextCalled = true;
    });
  } catch (err) {
    thrownError = err;
  }

  if (nextCalled) return { passed: true, res };
  return { passed: false, error: thrownError, res };
}

// ── validateLogin ─────────────────────────────────────────────────────────────

describe("validateLogin", () => {
  it("passes with valid email and password", async () => {
    const { passed } = await runChain(validateLogin, {
      email: "user@example.com",
      password: "secret",
    });
    expect(passed).toBe(true);
  });

  it("rejects a malformed email", async () => {
    const { passed, error } = await runChain(validateLogin, {
      email: "not-an-email",
      password: "secret",
    });
    expect(passed).toBe(false);
    expect(error.message).toMatch(/email/i);
  });

  it("rejects when password is missing", async () => {
    const { passed } = await runChain(validateLogin, {
      email: "user@example.com",
      password: "",
    });
    expect(passed).toBe(false);
  });
});

// ── validateRegistration ──────────────────────────────────────────────────────

describe("validateRegistration", () => {
  const valid = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    password: "password123",
    department: "Engineering",
    companyId: "abc123",
  };

  it("passes with all required fields present", async () => {
    const { passed } = await runChain(validateRegistration, valid);
    expect(passed).toBe(true);
  });

  it("rejects when firstName is blank", async () => {
    const { passed } = await runChain(validateRegistration, {
      ...valid,
      firstName: "   ",
    });
    expect(passed).toBe(false);
  });

  it("rejects when password is fewer than 8 characters", async () => {
    const { passed, error } = await runChain(validateRegistration, {
      ...valid,
      password: "short",
    });
    expect(passed).toBe(false);
    expect(error.message).toMatch(/8 characters/i);
  });

  it("rejects when companyId is absent", async () => {
    const { passed } = await runChain(validateRegistration, {
      ...valid,
      companyId: "",
    });
    expect(passed).toBe(false);
  });

  it("rejects an invalid email format", async () => {
    const { passed } = await runChain(validateRegistration, {
      ...valid,
      email: "bad-email",
    });
    expect(passed).toBe(false);
  });
});

// ── validateForgotPassword ────────────────────────────────────────────────────

describe("validateForgotPassword", () => {
  it("passes with a valid email", async () => {
    const { passed } = await runChain(validateForgotPassword, {
      email: "user@example.com",
    });
    expect(passed).toBe(true);
  });

  it("rejects an invalid email", async () => {
    const { passed } = await runChain(validateForgotPassword, {
      email: "notvalid",
    });
    expect(passed).toBe(false);
  });
});

// ── validateArticlePayload ────────────────────────────────────────────────────

describe("validateArticlePayload", () => {
  it("passes with title, content, and departments", async () => {
    const { passed } = await runChain(validateArticlePayload, {
      title: "My Article",
      content: "Some content here.",
      departments: ["Engineering"],
    });
    expect(passed).toBe(true);
  });

  it("rejects when title is empty", async () => {
    const { passed } = await runChain(validateArticlePayload, {
      title: "",
      content: "Content",
      departments: ["Engineering"],
    });
    expect(passed).toBe(false);
  });

  it("rejects when departments array is empty", async () => {
    const { passed, error } = await runChain(validateArticlePayload, {
      title: "Title",
      content: "Content",
      departments: [],
    });
    expect(passed).toBe(false);
    expect(error.message).toMatch(/department/i);
  });

  it("rejects when departments is not an array", async () => {
    const { passed } = await runChain(validateArticlePayload, {
      title: "Title",
      content: "Content",
      departments: "Engineering",
    });
    expect(passed).toBe(false);
  });
});

// ── validateArticleStatus ─────────────────────────────────────────────────────

describe("validateArticleStatus", () => {
  it("passes with status Approved", async () => {
    const { passed } = await runChain(validateArticleStatus, {
      status: "Approved",
    });
    expect(passed).toBe(true);
  });

  it("passes with status Rejected and an optional rejectionReason", async () => {
    const { passed } = await runChain(validateArticleStatus, {
      status: "Rejected",
      rejectionReason: "Off-topic content",
    });
    expect(passed).toBe(true);
  });

  it("rejects an invalid status value", async () => {
    const { passed, error } = await runChain(validateArticleStatus, {
      status: "Pending",
    });
    expect(passed).toBe(false);
    expect(error.message).toMatch(/approved or rejected/i);
  });
});

// ── validateBulkArticleStatus ─────────────────────────────────────────────────

describe("validateBulkArticleStatus", () => {
  const validMongoId = "507f1f77bcf86cd799439011";

  it("passes with a non-empty articleIds array and valid status", async () => {
    const { passed } = await runChain(validateBulkArticleStatus, {
      articleIds: [validMongoId],
      status: "Approved",
    });
    expect(passed).toBe(true);
  });

  it("rejects when articleIds is empty", async () => {
    const { passed } = await runChain(validateBulkArticleStatus, {
      articleIds: [],
      status: "Approved",
    });
    expect(passed).toBe(false);
  });

  it("rejects when an articleId is not a valid MongoId", async () => {
    const { passed, error } = await runChain(validateBulkArticleStatus, {
      articleIds: ["not-a-mongo-id"],
      status: "Approved",
    });
    expect(passed).toBe(false);
    expect(error.message).toMatch(/invalid article id/i);
  });

  it("rejects an invalid status", async () => {
    const { passed } = await runChain(validateBulkArticleStatus, {
      articleIds: [validMongoId],
      status: "Draft",
    });
    expect(passed).toBe(false);
  });
});

// ── validateComment ───────────────────────────────────────────────────────────

describe("validateComment", () => {
  it("passes with a valid message", async () => {
    const { passed } = await runChain(validateComment, {
      message: "Great article!",
    });
    expect(passed).toBe(true);
  });

  it("rejects when message is blank", async () => {
    const { passed } = await runChain(validateComment, { message: "" });
    expect(passed).toBe(false);
  });

  it("rejects when message is only 1 character", async () => {
    const { passed, error } = await runChain(validateComment, { message: "x" });
    expect(passed).toBe(false);
    expect(error.message).toMatch(/2 and 2000/i);
  });

  it("rejects when message exceeds 2000 characters", async () => {
    const { passed } = await runChain(validateComment, {
      message: "a".repeat(2001),
    });
    expect(passed).toBe(false);
  });
});

// ── validateSearchQuery ───────────────────────────────────────────────────────

describe("validateSearchQuery", () => {
  it("passes with no query params (all optional)", async () => {
    const { passed } = await runChain(validateSearchQuery, {}, {});
    expect(passed).toBe(true);
  });

  it("passes with valid keyword, tag, page, and limit", async () => {
    const { passed } = await runChain(
      validateSearchQuery,
      {},
      { keyword: "policy", tag: "hr", page: "1", limit: "10" },
    );
    expect(passed).toBe(true);
  });

  it("rejects page=0 (min is 1)", async () => {
    const { passed, error } = await runChain(
      validateSearchQuery,
      {},
      { page: "0" },
    );
    expect(passed).toBe(false);
    expect(error.message).toMatch(/invalid page/i);
  });

  it("rejects limit=51 (max is 50)", async () => {
    const { passed, error } = await runChain(
      validateSearchQuery,
      {},
      { limit: "51" },
    );
    expect(passed).toBe(false);
    expect(error.message).toMatch(/invalid limit/i);
  });
});

// ── validateChatQuestion ──────────────────────────────────────────────────────

describe("validateChatQuestion", () => {
  it("passes with a valid question", async () => {
    const { passed } = await runChain(validateChatQuestion, {
      question: "What is the vacation policy?",
    });
    expect(passed).toBe(true);
  });

  it("rejects when question is empty", async () => {
    const { passed } = await runChain(validateChatQuestion, { question: "" });
    expect(passed).toBe(false);
  });

  it("rejects when question is fewer than 3 characters", async () => {
    const { passed, error } = await runChain(validateChatQuestion, {
      question: "hi",
    });
    expect(passed).toBe(false);
    expect(error.message).toMatch(/3 and 2000/i);
  });

  it("rejects when question exceeds 2000 characters", async () => {
    const { passed } = await runChain(validateChatQuestion, {
      question: "q".repeat(2001),
    });
    expect(passed).toBe(false);
  });
});
