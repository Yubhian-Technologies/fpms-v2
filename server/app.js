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

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, same-origin)
      if (!origin) return callback(null, true);
      // Allow all Vercel domains and configured origins
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
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

// Lightweight warmup endpoint — called by the frontend on tab focus to
// prevent cold-start delays when the user returns after an idle period
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
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

export default app;
