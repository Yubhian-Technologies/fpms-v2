import "dotenv/config";

import express from "express";
import cors from "cors";

import "./config/firebase.js";
import "./config/cloudinary.js";

import authRouter from "./routes/authRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import hodRouter from "./routes/hodRoutes.js";
import facultyRouter from "./routes/facultyRoutes.js";
import module1Router from "./routes/module1Routes.js";
import appealRouter from "./routes/appealRoutes.js";
import module1HodRouter from "./routes/module1HodRoutes.js";
import module5Router from "./routes/module5Routes.js";
import module1HodPartbRouter from "./routes/module1HodPartbRoutes.js";
import appealHodRouter from "./routes/appealHodRoutes.js";
import module2Router from "./routes/module2Routes.js";
import module3Router from "./routes/module3Routes.js";
import module4Router from "./routes/module4Routes.js";
import deanRouter from "./routes/deanRoutes.js";
import superadminRouter from "./routes/superadminRoutes.js";
import submissionRouter from "./routes/submissionRoutes.js";
import collegeRouter from "./routes/collegeRoutes.js";
import formRouter from "./routes/formsRoutes.js";
import cloudinaryRouter from "./routes/cloudinaryRoutes.js";
import viewerRouter from "./routes/viewerRoutes.js";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://vishnufpms.in",
      "https://www.vishnufpms.in",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow all Vercel preview URLs, configured origins, and local dev
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api", (req, res) => {
  res.json({ status: "API working", version: "2.0.0" });
});

// Diagnostic health endpoint — shows which env vars are present without leaking values
app.get("/api/health", (req, res) => {
  const vars = [
    "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY",
    "FIREBASE_PRIVATE_KEY_ID", "FIREBASE_WEB_API_KEY",
    "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
    "SUPERADMIN_DOC_ID", "COMMITTEE_EMAIL",
  ];
  const status = {};
  for (const v of vars) status[v] = process.env[v] ? "set" : "MISSING";
  res.json({ ok: true, env: status });
});

app.use("/api/auth", authRouter);
app.use("/api/committee", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/hod", hodRouter);
app.use("/api/dean", deanRouter);
app.use("/api/faculty", facultyRouter);
app.use("/api/module1", module1Router);
app.use("/api/module5", module5Router);
app.use("/api/appeal", appealRouter);
app.use("/api/hod/parta", module1HodRouter);
app.use("/api/hod/partb", module1HodPartbRouter);
app.use("/api/hod/appeals", appealHodRouter);
app.use("/api/module2", module2Router);
app.use("/api/module3", module3Router);
app.use("/api/module4", module4Router);
app.use("/api/superadmin", superadminRouter);
app.use("/api/submissions", submissionRouter);
app.use("/api/colleges", collegeRouter);
app.use("/api/forms", formRouter);
app.use("/api/cloudinary", cloudinaryRouter);
app.use("/api/viewer", viewerRouter);

// 404 — no route matched
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Express error]", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

export default app;
