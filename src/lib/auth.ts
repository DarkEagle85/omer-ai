import jwt from "jsonwebtoken";

type TokenPayload = {
  userId: string;
  email: string;
};

export function getUserFromRequest(req: Request): TokenPayload | null {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");

  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as TokenPayload;
  } catch {
    return null;
  }
}
