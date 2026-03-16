import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface OptionalAuthRequest extends Request {
  userId?: number;
  sessionId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Optional auth: attaches userId if token is valid, but does not require it.
 */
export const optionalAuth = (req: OptionalAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next();
    }
    req.userId = (decoded as any).userId;
    req.sessionId = (decoded as any).sessionId ?? undefined;
    next();
  });
};
