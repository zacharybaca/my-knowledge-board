import { body, query, validationResult } from "express-validator";

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  res.status(400);
  throw new Error(errors.array()[0].msg);
};

const nonEmptyTrimmed = (field, label) =>
  body(field).isString().trim().notEmpty().withMessage(`${label} is required`);

const validateLogin = [
  body("email").isEmail().withMessage("Valid email is required"),
  nonEmptyTrimmed("password", "Password"),
  handleValidationErrors,
];

const validateRegistration = [
  nonEmptyTrimmed("firstName", "First name"),
  nonEmptyTrimmed("lastName", "Last name"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isString()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  nonEmptyTrimmed("department", "Department"),
  body("companyId").notEmpty().withMessage("Company is required"),
  handleValidationErrors,
];

const validateForgotPassword = [
  body("email").isEmail().withMessage("Valid email is required"),
  handleValidationErrors,
];

const validateArticlePayload = [
  nonEmptyTrimmed("title", "Title"),
  nonEmptyTrimmed("content", "Content"),
  body("departments")
    .isArray({ min: 1 })
    .withMessage("At least one department is required"),
  handleValidationErrors,
];

const validateArticleStatus = [
  body("status")
    .isIn(["Approved", "Rejected"])
    .withMessage("Status must be Approved or Rejected"),
  body("rejectionReason")
    .optional({ values: "falsy" })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
  handleValidationErrors,
];

const validateBulkArticleStatus = [
  body("articleIds")
    .isArray({ min: 1 })
    .withMessage("At least one article is required"),
  body("articleIds.*").isMongoId().withMessage("Invalid article ID"),
  body("status")
    .isIn(["Approved", "Rejected"])
    .withMessage("Status must be Approved or Rejected"),
  body("rejectionReason")
    .optional({ values: "falsy" })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
  handleValidationErrors,
];

const validateComment = [
  nonEmptyTrimmed("message", "Comment message"),
  body("message")
    .isLength({ min: 2, max: 2000 })
    .withMessage("Comment must be between 2 and 2000 characters"),
  handleValidationErrors,
];

const validateSearchQuery = [
  query("keyword").optional().isString().trim().isLength({ max: 120 }),
  query("tag").optional().isString().trim().isLength({ max: 60 }),
  query("department").optional().isString().trim().isLength({ max: 60 }),
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateFrom format"),
  query("dateTo").optional().isISO8601().withMessage("Invalid dateTo format"),
  query("page").optional().isInt({ min: 1 }).withMessage("Invalid page"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Invalid limit"),
  handleValidationErrors,
];

const validateChatQuestion = [
  nonEmptyTrimmed("question", "Question"),
  body("question")
    .isLength({ min: 3, max: 2000 })
    .withMessage("Question must be between 3 and 2000 characters"),
  handleValidationErrors,
];

export {
  validateLogin,
  validateRegistration,
  validateForgotPassword,
  validateArticlePayload,
  validateArticleStatus,
  validateBulkArticleStatus,
  validateComment,
  validateSearchQuery,
  validateChatQuestion,
};
