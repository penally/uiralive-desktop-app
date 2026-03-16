import "dotenv/config";
import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
const ZIPLINE_URL = process.env.ZIPLINE_URL || 'https://cdn.uira.live/api/upload';
const ZIPLINE_COOKIE = process.env.ZIPLINE_COOKIE;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage (memory storage for uploading to Zipline)
const storage = multer.memoryStorage();

// File filter to only allow images
const fileFilter = (req: Request, file: multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// Upload avatar endpoint
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!ZIPLINE_COOKIE) {
      return res.status(500).json({ error: 'Zipline configuration missing' });
    }

    const userId = req.userId;

    // Create form data for Zipline upload
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);

    // Upload to Zipline
    const uploadResponse = await fetch(ZIPLINE_URL, {
      method: 'POST',
      headers: {
        'Cookie': ZIPLINE_COOKIE
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      console.error('Zipline upload failed:', uploadResponse.status, await uploadResponse.text());
      return res.status(500).json({ error: 'Failed to upload to image service' });
    }

    const uploadData = await uploadResponse.json();

    if (!uploadData.files || !uploadData.files[0] || !uploadData.files[0].url) {
      console.error('Invalid Zipline response:', uploadData);
      return res.status(500).json({ error: 'Invalid response from image service' });
    }

    const fileUrl = uploadData.files[0].url;

    // Update user avatar in database
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: fileUrl }
    });

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: fileUrl,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        avatar: fileUrl
      }
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Get avatar endpoint
router.get('/avatar/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return full URL if avatar exists, otherwise null
    const avatarUrl = user.avatar ? user.avatar : null;

    res.json({
      avatarUrl: avatarUrl,
      fallbackUrl: null
    });
  } catch (error) {
    console.error('Get avatar error:', error);
    res.status(500).json({ error: 'Failed to get avatar' });
  }
});

// Delete avatar endpoint
router.delete('/avatar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    // Note: We can't delete from Zipline via API, but we can clear the database entry
    // The file will remain on Zipline until manually deleted or expires

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null }
    });

    res.json({
      message: 'Avatar removed successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        avatar: null
      }
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({ error: 'Failed to remove avatar' });
  }
});

// Error handling middleware for multer errors
router.use((err: any, req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message });
  }
  next();
});

export default router;
