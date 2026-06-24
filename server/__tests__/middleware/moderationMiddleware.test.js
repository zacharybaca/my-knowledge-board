import { describe, it, expect, vi } from "vitest";

// The middleware imports leo-profanity at module load time, which is fine in tests.
import { moderateContent } from "../../middleware/moderationMiddleware.js";

const makeRes = () => {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
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
