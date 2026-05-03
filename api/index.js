// Vercel serverless entry point — wraps the Express app as a handler.
// All /api/* requests are routed here by vercel.json rewrites.
import app from "../server/app.js";

export default app;
