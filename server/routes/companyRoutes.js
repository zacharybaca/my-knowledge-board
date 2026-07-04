import express from "express";
import {
  registerCompany,
  getCompanies,
  getCompanyById,
  updateCompanyDepartments,
  updateCompanyLogo,
  deleteCompany,
} from "../controllers/companyController.js";
import { upload } from "../middleware/cloudinary.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getCompanies);
router.post("/register", upload.single("companyImage"), registerCompany);
router.patch("/:id/departments", protect, updateCompanyDepartments);
router.patch("/:id/logo", protect, upload.single("companyLogo"), updateCompanyLogo);
router.route("/:id").get(getCompanyById).delete(protect, deleteCompany);

export default router;
