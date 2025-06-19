// middlewares/upload.js
import multer from 'multer';
import { storage } from '../utils/cloudinary.js';

const upload = multer({ storage });

export default upload;
