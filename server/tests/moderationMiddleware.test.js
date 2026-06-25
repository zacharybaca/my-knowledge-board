import { describe, it, expect, vi } from "vitest";

// leoProfanity is initialised at module load time in the middleware file,
// so we import the middleware directly – no special mocking required.
import { moderateContent } from "../middleware/moderationMiddleware.js";

/**
 * Wrap the async middleware so tests can call it as a regular async function.
 * Returns the error thrown (if any), or null when next() is called without error.
 */
async function runMiddleware(body) {
  let calledNext = false;
  let thrownError = null;

  const req = { body };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
  const next = (err) => {
    if (err) {
      thrownError = err;
    } else {
      calledNext = true;
    }
  };

  try {
    await moderateContent(req, res, next);
  } catch (err) {
    // express-async-handler re-throws; capture it
    thrownError = err;
  }

  return { calledNext, thrownError, res };
}

describe("moderateContent middleware", () => {
  it("passes clean content through to next()", async () => {
    const { calledNext, thrownError } = await runMiddleware({
      title: "How to file an expense report",
      content: "Submit your receipts within 30 days.",
    });

    expect(thrownError).toBeNull();
    expect(calledNext).toBe(true);
  });

  it("rejects content containing a standard profanity word", async () => {
    const { thrownError, res } = await runMiddleware({
      body: "This is shit policy.",
    });

    expect(res.statusCode).toBe(400);
    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toMatch(/company guidelines/i);
  });

  it("rejects content containing a custom workplace-harassment term", async () => {
    const { thrownError, res } = await runMiddleware({
      comment: "The manager is a total idiot.",
    });

    expect(res.statusCode).toBe(400);
    expect(thrownError).not.toBeNull();
  });

  it("scans the 'text' field as well", async () => {
    const { thrownError } = await runMiddleware({
      text: "What a stupid rule.",
    });

    expect(thrownError).not.toBeNull();
  });

  it("scans the 'title' field", async () => {
    const { thrownError } = await runMiddleware({
      title: "Why this policy is so dumb",
    });

    expect(thrownError).not.toBeNull();
  });

  it("passes when no body fields are present", async () => {
    const { calledNext, thrownError } = await runMiddleware({});

    expect(thrownError).toBeNull();
    expect(calledNext).toBe(true);
  });

  it("passes when all body fields are empty strings (falsy)", async () => {
    const { calledNext, thrownError } = await runMiddleware({
      title: "",
      content: "",
      body: "",
      comment: "",
      text: "",
    });

    expect(thrownError).toBeNull();
    expect(calledNext).toBe(true);
  });

  it("combines multiple fields and flags cross-field violations", async () => {
    // 'fraud' is a custom-added term; split across title + content
    const { thrownError } = await runMiddleware({
      title: "Expense Policy",
      content: "The procurement team thinks this is a fraud.",
    });

    expect(thrownError).not.toBeNull();
/**
 * Tests for moderationMiddleware — moderateContent.
 *
 * The middleware scans req.body fields (title, content, body, comment, text)
 * for profanity / hostile language and rejects submissions that match.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moderateContent } from "../middleware/moderationMiddleware.js";

// moderateContent is wrapped in asyncHandler, so next() is called asynchronously.
function runModerate(body) {
  return new Promise((resolve) => {
    const res = {
      _status: null,
      status(code) {
        this._status = code;
        return this;
      },
    };
    moderateContent({ body }, res, (err) => resolve({ err, status: res._status }));
  });
}

describe("moderateContent middleware", () => {
  it("passes an empty body through without error", async () => {
    const { err } = await runModerate({});
    assert.strictEqual(err, undefined);
  });

  it("passes clean content through without error", async () => {
    const { err } = await runModerate({
      title: "Onboarding Process",
      content: "Welcome to the team. Here is how to get started.",
      comment: "Great article!",
    });
    assert.strictEqual(err, undefined);
  });

  it("rejects a submission containing a default profane word in title", async () => {
    const { err, status } = await runModerate({ title: "This contains an asshole phrase" });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("rejects a submission with a custom hostile word 'loser' in body.comment", async () => {
    const { err, status } = await runModerate({ comment: "You are such a loser" });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("rejects 'idiot' found in body.text", async () => {
    const { err, status } = await runModerate({ text: "Only an idiot would approve this." });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("rejects 'fraud' found in body.content", async () => {
    const { err, status } = await runModerate({
      content: "This process is a complete fraud.",
    });
    assert.ok(err instanceof Error);
    assert.match(err.message, /violates company guidelines/i);
    assert.strictEqual(status, 400);
  });

  it("passes when all checked fields are undefined (body has unrelated keys)", async () => {
    const { err } = await runModerate({ someOtherField: "Hello world" });
    assert.strictEqual(err, undefined);
  });
});
