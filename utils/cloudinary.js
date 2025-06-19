// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from "dotenv";
dotenv.config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'Beyond90',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    public_id: (req, file) => file.fieldname + '-' + Date.now(),
    transformation: [{ width: 800, height: 600, crop: 'limit' }]
  }
});

export { cloudinary, storage };
