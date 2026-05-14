import express from "express";
import {
  registerCompany,
  getCompanies,
} from "../controllers/companyController.js";
import { upload } from "../middleware/cloudinary.js";

const router = express.Router();

router.get("/", getCompanies);
router.post("/register", upload.single("companyImage"), registerCompany);

export default router;
