import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  id: number;
  role: "admin" | "manager" | "operator";
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "telecom-secret-change-in-production";

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function requireAuth(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const payload = verifyToken(auth.slice(7));
      if (roles.length > 0 && !roles.includes(payload.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}
