// app/middleware/auth.ts
import { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import jwt from 'jsonwebtoken';

// Extend the request type to include userId after verification
export interface AuthenticatedRequest extends NextApiRequest {
  userId?: string;
}

/**
 * Middleware to protect API routes using JWT.
 *
 * It expects the token to be provided in the `Authorization` header as:
 *   Authorization: Bearer <token>
 *
 * The JWT secret is read from the environment variable `JWT_SECRET`.
 * On successful verification the decoded payload's `userId` property is attached to the request
 * object (req.userId) and the next handler is called.
 * If verification fails or the token is missing, a 401 response is sent.
 */
export function withAuth(handler: NextApiHandler) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not set in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      const decoded = jwt.verify(token, secret) as { userId: string };
      req.userId = decoded.userId;
      return handler(req, res);
    } catch (err) {
      console.error('JWT verification failed:', err);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
