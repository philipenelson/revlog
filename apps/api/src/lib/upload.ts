import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import type { Request, RequestHandler } from 'express';

// Resolved at import time — works whether running via tsx (src/lib/) or compiled (dist/lib/)
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const VEHICLES_UPLOAD_DIR = path.join(UPLOADS_DIR, 'vehicles');

// Ensure the upload directory exists on startup.
fs.mkdirSync(VEHICLES_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VEHICLES_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function imageFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
}

export const vehiclePhotoUpload: RequestHandler = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('photo') as unknown as RequestHandler;
