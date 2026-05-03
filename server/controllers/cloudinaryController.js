import { v2 as cloudinary } from "cloudinary";

// Returns signed upload parameters so the browser can upload directly to
// Cloudinary without routing the file bytes through the server. This removes
// the server as a bottleneck and avoids Vercel's 4.5 MB serverless body limit.
export const getSignedUploadParams = (req, res) => {
  try {
    const folder = "task_evidence";
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign = { folder, timestamp };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
      success: true,
      data: {
        signature,
        timestamp,
        folder,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
      },
    });
  } catch (error) {
    console.error("cloudinary sign error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
