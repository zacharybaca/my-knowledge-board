import { describe, it, expect, vi, beforeEach } from "vitest";
import { moderateContent } from "../../middleware/moderationMiddleware.js";

const makeReq = (body = {}) => ({ body });
import { describe, it, expect, vi } from "vitest";

// The middleware imports leo-profanity at module load time, which is fine in tests.
import { moderateContent } from "../../middleware/moderationMiddleware.js";

const makeRes = () => {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  return res;
};

describe("moderateContent middleware", () => {
  let res, next;

  beforeEach(() => {
    res = makeRes();
    next = vi.fn();
  });

  // ── Happy paths ──────────────────────────────────────────────────────────

  it("calls next() with no error for clean title and body", async () => {
    await moderateContent(
      makeReq({ title: "Onboarding Best Practices", body: "Welcome." }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    // next called without an error argument
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("calls next() when the request body has no text fields", async () => {
    await moderateContent(makeReq({}), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  // ── Base profanity ────────────────────────────────────────────────────────

  it("rejects content containing base-dictionary profanity via body field", async () => {
    await moderateContent(makeReq({ body: "This is a shit show." }), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── Custom word list ─────────────────────────────────────────────────────

  it("rejects content containing custom word 'idiot' in comment field", async () => {
    await moderateContent(
      makeReq({ comment: "You are such an idiot." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rejects content containing custom word 'fraud' in title field", async () => {
    await moderateContent(
      makeReq({ title: "Our fraud process guide." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rejects content containing custom word 'charlatan' in text field", async () => {
    await moderateContent(
      makeReq({ text: "He is a charlatan." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── Field coverage ───────────────────────────────────────────────────────

  it("scans the content field (knowledge-base articles)", async () => {
    await moderateContent(
      makeReq({ content: "This creep should not be trusted." }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// asyncHandler forwards errors to next(err) rather than throwing, so we
// check that next was called with an Error instance when rejection is expected.
const expectRejection = (next, res, expectedStatus) => {
  const errorArg = next.mock.calls[0]?.[0];
  expect(errorArg).toBeInstanceOf(Error);
  expect(res.statusCode).toBe(expectedStatus);
};

describe("moderationMiddleware – moderateContent", () => {
  it("calls next() with no arguments when content is clean", async () => {
    const next = vi.fn();
    await moderateContent({ body: { body: "This is perfectly fine content." } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects content that contains a default-dictionary profane word", async () => {
    const next = vi.fn();
    const res = makeRes();
    await moderateContent({ body: { body: "what the fuck" } }, res, next);
    expectRejection(next, res, 400);
  });

  it("rejects content using a custom-added term (fraud)", async () => {
    const next = vi.fn();
    const res = makeRes();
    await moderateContent({ body: { title: "This person is a fraud" } }, res, next);
    expectRejection(next, res, 400);
  });

  it("scans the 'title' field", async () => {
    const next = vi.fn();
    const res = makeRes();
    await moderateContent({ body: { title: "total idiot" } }, res, next);
    expectRejection(next, res, 400);
  });

  it("scans the 'content' field", async () => {
    const next = vi.fn();
    const res = makeRes();
    await moderateContent({ body: { content: "you are a loser" } }, res, next);
    expectRejection(next, res, 400);
  });

  it("scans the 'comment' field", async () => {
    const next = vi.fn();
    const res = makeRes();
    await moderateContent({ body: { comment: "snake in the room" } }, res, next);
    expectRejection(next, res, 400);
  });

  it("scans the 'text' field", async () => {
    const next = vi.fn();
    const res = makeRes();
    await moderateContent({ body: { text: "complete moron" } }, res, next);
    expectRejection(next, res, 400);
  });

  it("calls next() with no arguments when body is entirely empty", async () => {
    const next = vi.fn();
    await moderateContent({ body: {} }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("passes the rejection error message up through next", async () => {
    const next = vi.fn();
    const res = makeRes();
    await moderateContent({ body: { body: "what the fuck" } }, res, next);
    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg.message).toMatch(/violates company guidelines/i);
  });
});
