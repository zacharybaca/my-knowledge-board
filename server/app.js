import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import articleRoutes from "./routes/articleRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Configure Helmet with CSP directives tailored for MyKnowledgeBoard
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        "media-src": ["'self'", "https://res.cloudinary.com"],
        "connect-src": [
          "'self'",
          "http://localhost:5000",
          "ws://localhost:5000",
          "https://myknowledgeboard.online",
          "wss://myknowledgeboard.online",
        ],
      },
    },
  }),
);

const corsOptions = {
  origin: [
    process.env.CLIENT_URL,
    "https://myknowledgeboard.online", // Hardcoded fallback for your production domain
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean),
  credentials: true,
  // Explicitly define allowed methods and headers to fix the OPTIONS preflight failure
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent Express's default 404 handler from triggering a strict CSP block on favicon requests
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(errorHandler);

export default app;
