require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const db = require("./models"); // Sequelize instance
const routes = require("./app/routes");
const ApiError = require("./error/ApiError");
const userLogHistory = require("./app/middlewares/userLogHistory");
const { initializeChatSocket } = require("./app/realtime/socket");

const app = express();
const server = http.createServer(app);
initializeChatSocket(server);

const PORT = process.env.PORT || 5000;

/* ========================
   SECURITY HEADERS
======================== */

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow /images to be served cross-origin
  }),
);

/* ========================
   CORS
======================== */

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

/* ========================
   RATE LIMITING
======================== */

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many attempts. Try again in 15 minutes.",
  },
  skipSuccessfulRequests: true,
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests. Slow down." },
});

app.use("/api/v1/user/login", authLimiter);
app.use("/api/v1/user/refresh-token", authLimiter);
app.use("/api/v1/user/register", authLimiter);
app.use("/api/v1", apiLimiter);

/* ========================
   MIDDLEWARE
======================== */

app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(userLogHistory);

/* ========================
   STATIC FILES
======================== */

app.use("/images", express.static("images"));

/* ========================
   ROUTES
======================== */

// Health check route (important for monitoring)
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API server is running",
  });
});

app.use("/api/v1", routes);

/* ========================
   404 HANDLER
======================== */

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "API not found",
  });
});

/* ========================
   GLOBAL ERROR HANDLER
======================== */

app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === "development";

  // Only log full error in development; production logs minimal info
  if (isDev) {
    console.error("Global Error:", err);
  } else {
    console.error(`[${new Date().toISOString()}] ${err.message}`);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(isDev && { stack: err.stack }),
    });
  }

  return res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

/* ========================
   SERVER START FUNCTION
======================== */

const startServer = async () => {
  try {
    // Authenticate DB connection
    await db.sequelize.authenticate();
    console.log("✅ Database connected successfully");

    // Sync models (optional in production)
    // await db.sequelize.sync();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to database:", error.message);
    if (error.original?.code === "ER_USER_LIMIT_REACHED") {
      console.error(
        "⚠️  DB connection limit exceeded. ১ ঘণ্টা পর আবার চেষ্টা করুন অথবা hosting panel থেকে connection reset করুন।",
      );
    }
    process.exit(1);
  }
};

startServer();

/* ========================
   GRACEFUL SHUTDOWN
======================== */

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await db.sequelize.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await db.sequelize.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// // 🔹 Memory limit (VERY IMPORTANT for cPanel)
// process.env.NODE_OPTIONS = "--max-old-space-size=1024";

// require("dotenv").config(); // ⬅️ dotenv first
// require("./models");

// const express = require("express");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");

// const routes = require("./app/routes");
// const ApiError = require("./error/ApiError");

// const app = express();

// /* -------------------- CORS -------------------- */
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://kafelamart.digitalever.com.bd",
// ];

// const corsOptions = {
//   origin: (origin, callback) => {
//     if (!origin || allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }
//     // ❗ crash না করে deny
//     return callback(null, false);
//   },
//   credentials: true,
// };

// app.use(cors(corsOptions));
// app.options("*", cors(corsOptions));

// /* -------------------- Middleware -------------------- */
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());
// app.use(cookieParser());

// /* -------------------- Static -------------------- */
// app.use("/media", express.static("media"));

// /* -------------------- Routes -------------------- */
// app.get("/", (req, res) => {
//   res.send("API server is running");
// });

// app.use("/api/v1", routes);

// /* -------------------- 404 -------------------- */
// app.use((req, res) => {
//   res.status(404).json({ error: "API not found" });
// });

// /* -------------------- Error Handler -------------------- */
// app.use((err, req, res, next) => {
//   if (err instanceof ApiError) {
//     return res.status(err.statusCode).json({
//       status: "error",
//       message: err.message,
//       ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
//     });
//   }

//   console.error(err);
//   res.status(500).json({
//     status: "error",
//     message: "Internal server error",
//   });
// });

// /* -------------------- Server -------------------- */
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
