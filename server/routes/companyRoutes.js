import express from "express";
import { registerCompany, getCompanies } from "../controllers/companyController.js";

const router = express.Router();

router.get("/", getCompanies);
router.post("/register", registerCompany);

export default router;
