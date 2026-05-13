import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js"; // New
import userRoutes from "./routes/userRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

const corsOptions = {
  origin: [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ].filter(Boolean),
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes); // New
app.use("/api/users", userRoutes);

// Error Handling Middleware

app.use(errorHandler);

export default app;
