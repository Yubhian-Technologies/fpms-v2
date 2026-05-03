import { useState } from "react";
import { api } from "@/api/api";

interface UploadProgress {
  uploading: boolean;
  progress: number;
  error: string | null;
}

/**
 * Uploads a file directly from the browser to Cloudinary using a server-signed
 * request. The server never sees the file bytes — only a signed URL is fetched
 * from /api/cloudinary/sign, which keeps the serverless function small and
 * makes concurrent uploads by many faculty members fully scalable.
 */
export function useCloudinaryUpload() {
  const [uploadState, setUploadState] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    error: null,
  });

  const uploadFile = async (file: File): Promise<string> => {
    setUploadState({ uploading: true, progress: 0, error: null });

    try {
      // Step 1: get signed upload params from our server
      const { data: signRes } = await api.post("/api/cloudinary/sign");
      const { signature, timestamp, folder, cloudName, apiKey } = signRes.data;

      // Step 2: upload directly to Cloudinary
      const form = new FormData();
      form.append("file", file);
      form.append("signature", signature);
      form.append("timestamp", String(timestamp));
      form.append("api_key", apiKey);
      form.append("folder", folder);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: "POST", body: form }
      );

      if (!cloudRes.ok) {
        const err = await cloudRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Cloudinary upload failed");
      }

      const result = await cloudRes.json();
      setUploadState({ uploading: false, progress: 100, error: null });
      return result.secure_url as string;
    } catch (err: any) {
      const message = err?.message || "Upload failed";
      setUploadState({ uploading: false, progress: 0, error: message });
      throw new Error(message);
    }
  };

  return { uploadFile, uploadState };
}
