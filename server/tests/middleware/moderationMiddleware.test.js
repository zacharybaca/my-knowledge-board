import { describe, it, expect, vi } from "vitest";
import { moderateContent } from "../../middleware/moderationMiddleware.js";

/**
 * Calls the moderateContent middleware and returns a promise that resolves
 * with the arguments passed to `next` (empty array on clean pass-through).
 */
function runMiddleware(body) {
  return new Promise((resolve) => {
    const req = { body };
    const res = {
      _code: 200,
      status(code) {
        this._code = code;
        return this;
      },
    };
    const next = vi.fn((...args) => resolve({ res, nextArgs: args }));
    moderateContent(req, res, next);
  });
}

describe("moderateContent middleware", () => {
  it("calls next() with no error when body is empty", async () => {
    const { nextArgs } = await runMiddleware({});
    expect(nextArgs).toHaveLength(0);
  });

  it("calls next() when content is clean", async () => {
    const { nextArgs } = await runMiddleware({
      title: "Getting started with Express",
      content: "This guide covers routing and middleware.",
    });
    expect(nextArgs).toHaveLength(0);
  });

  it("rejects content with a standard profane word", async () => {
    const { res, nextArgs } = await runMiddleware({
      body: "That feature is total shit",
    });
    expect(res._code).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
    expect(nextArgs[0].message).toMatch(/violates company guidelines/i);
  });

  it("rejects content with a custom term added to the dictionary", async () => {
    const { res, nextArgs } = await runMiddleware({
      title: "The manager is a total loser",
    });
    expect(res._code).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("scans the 'comment' field", async () => {
    const { res, nextArgs } = await runMiddleware({
      comment: "This guy is a complete idiot",
    });
    expect(res._code).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("scans the 'text' field", async () => {
    const { res, nextArgs } = await runMiddleware({
      text: "Call him an idiot",
    });
    expect(res._code).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("scans the 'content' field independently of others", async () => {
    const { res, nextArgs } = await runMiddleware({
      title: "Clean title",
      content: "He is a complete moron",
    });
    expect(res._code).toBe(400);
    expect(nextArgs[0]).toBeInstanceOf(Error);
  });

  it("allows undefined fields without error", async () => {
    const { nextArgs } = await runMiddleware({
      title: "Valid title",
      body: undefined,
      comment: undefined,
    });
    expect(nextArgs).toHaveLength(0);
  });
});
