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
  });
});
