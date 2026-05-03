import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "task_evidence",
    resource_type: "auto",
    use_filename: true,
    unique_filename: true,
    allowed_formats: ["jpg", "png", "pdf", "doc", "docx", "jpeg", "html", "txt", "xlsx", "xls", "ppt", "pptx"],
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    console.log("Multer fileFilter - file received:", file.originalname, file.mimetype);
    cb(null, true);
  }
});

export default upload;
