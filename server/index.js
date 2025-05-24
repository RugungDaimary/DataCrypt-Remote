import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import transferRoutes from "./routes/transfers.js";
import inviteRoutes from "./routes/invite.js";


// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Set up Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});

// Socket.IO connection
io.on("connection", (socket) => {
  socket.on("join", (userEmail) => {
    socket.join(userEmail); // Join a room named after the user's email
  });
});

// Make io accessible in routes
app.set("io", io);

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Root route for testing
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

app.use("/api/invite", inviteRoutes);
// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transfers", transferRoutes);

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

// Start server with Socket.IO
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
