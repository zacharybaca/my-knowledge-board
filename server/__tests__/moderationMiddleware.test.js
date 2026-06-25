import { describe, it, expect, vi, beforeEach } from "vitest";
import { moderateContent } from "../middleware/moderationMiddleware.js";

const makeReq = (body = {}) => ({ body });
const makeRes = () => ({
  status: vi.fn().mockReturnThis(),
});

// asyncHandler passes errors to next(err); a clean pass calls next() with no args.
const flaggedError = (next) =>
  next.mock.calls.length > 0 && next.mock.calls[0][0] instanceof Error;

describe("moderateContent", () => {
  let next;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next() with no error when body contains no content fields", async () => {
    await moderateContent(makeReq({}), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(flaggedError(next)).toBe(false);
  });

  it("allows clean content through", async () => {
    await moderateContent(
      makeReq({ title: "How to reset a password", content: "Follow these steps." }),
      makeRes(),
      next,
    );
    expect(flaggedError(next)).toBe(false);
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks a standard profanity word", async () => {
    // 'dumb' is in the custom blocklist
    await moderateContent(
      makeReq({ title: "This is a dumb policy" }),
      makeRes(),
      next,
    );
    expect(flaggedError(next)).toBe(true);
  });

  it("blocks content flagged in the 'content' field", async () => {
    await moderateContent(
      makeReq({ content: "The manager is an idiot." }),
      makeRes(),
      next,
    );
    expect(flaggedError(next)).toBe(true);
  });

  it("blocks content flagged in the 'comment' field", async () => {
    await moderateContent(
      makeReq({ comment: "What a fraud this whole process is." }),
      makeRes(),
      next,
    );
    expect(flaggedError(next)).toBe(true);
  });

  it("blocks content when flagged term appears in 'body' field", async () => {
    await moderateContent(
      makeReq({ body: "This company is a sweatshop." }),
      makeRes(),
      next,
    );
    expect(flaggedError(next)).toBe(true);
  });

  it("returns 400 status and descriptive message when content is rejected", async () => {
    const res = makeRes();
    await moderateContent(makeReq({ title: "You are a loser" }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const err = next.mock.calls[0][0];
    expect(err.message).toMatch(/company guidelines/i);
  });

  it("scans all content fields together — clean fields don't hide a flagged one", async () => {
    await moderateContent(
      makeReq({
        title: "Good title",
        content: "Good content",
        comment: "You are a moron",
      }),
      makeRes(),
      next,
    );
    expect(flaggedError(next)).toBe(true);
  });
});
