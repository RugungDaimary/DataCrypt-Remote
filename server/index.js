import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http"; // Uncommented http server import
import { Server as SocketIOServer } from "socket.io"; // Uncommented Socket.IO server import
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import transferRoutes from "./routes/transfers.js";
import inviteRoutes from "./routes/invite.js";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.IO (Uncommented)
const httpServer = createServer(app);

// Set up Socket.IO with updated CORS configuration (Uncommented)
const allowedOrigins = [
  process.env.CLIENT_URL, // Vercel client URL (from .env)
  "http://localhost:5173", // Local development
];
// console.log(allowedOrigins);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io accessible in routes (Uncommented)
app.set("io", io);

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS middleware

// app.use(cors())

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
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

// API routes
app.use("/api/invite", inviteRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transfers", transferRoutes);

// Serve static files in production (Commented out as frontend is served by Vercel)
// if (process.env.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname, "../dist")));

//   app.get("*", (req, res) => {
//     res.sendFile(path.join(__dirname, "../dist/index.html"));
//   });
// }

// Start server with Socket.IO (Uncommented - switch back to httpServer.listen)
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
