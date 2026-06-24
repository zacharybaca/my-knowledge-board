import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const activeArticleViewers = {};

if (!MONGO_URI) {
  console.error("FATAL ERROR: MONGO_URI is not defined in .env");
  process.exit(1);
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL,
      "https://myknowledgeboard.online", // Matching the app.js explicitly
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ].filter(Boolean),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // --- Real-Time Presence Indicators ---
  socket.on("join_article", ({ articleId, user }) => {
    socket.join(`article_${articleId}`);

    // Initialize array if this is the first viewer for the article
    if (!activeArticleViewers[articleId]) {
      activeArticleViewers[articleId] = [];
    }

    // Check for existing user to prevent duplicates if they have multiple tabs open
    const existingIndex = activeArticleViewers[articleId].findIndex(
      (v) => v.user._id === user._id,
    );
    if (existingIndex === -1) {
      activeArticleViewers[articleId].push({ socketId: socket.id, user });
    } else {
      activeArticleViewers[articleId][existingIndex].socketId = socket.id;
    }

    // Broadcast the updated list of viewers to everyone in this article's room
    io.to(`article_${articleId}`).emit(
      "presence_update",
      activeArticleViewers[articleId].map((v) => v.user),
    );
  });

  socket.on("leave_article", ({ articleId, user }) => {
    socket.leave(`article_${articleId}`);

    if (activeArticleViewers[articleId]) {
      // Remove the user from the active array
      activeArticleViewers[articleId] = activeArticleViewers[articleId].filter(
        (v) => v.user._id !== user._id,
      );
      io.to(`article_${articleId}`).emit(
        "presence_update",
        activeArticleViewers[articleId].map((v) => v.user),
      );
    }
  });

  socket.on("join_user_room", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    // Automatically scrub the disconnected socket from all article rooms
    for (const articleId in activeArticleViewers) {
      const originalLength = activeArticleViewers[articleId].length;
      activeArticleViewers[articleId] = activeArticleViewers[articleId].filter(
        (v) => v.socketId !== socket.id,
      );

      // Only broadcast an update if this specific room's viewer count changed
      if (activeArticleViewers[articleId].length !== originalLength) {
        io.to(`article_${articleId}`).emit(
          "presence_update",
          activeArticleViewers[articleId].map((v) => v.user),
        );
      }
    }
  });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    process.exit(1);
  });

process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
});
