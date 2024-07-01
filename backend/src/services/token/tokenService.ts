import jwt from "jsonwebtoken";
import { Request } from "express";
import { AppError } from "../error/errorService";
require("dotenv").config();

function getTokenFromRequest(req: Request) {
  const { cookies } = req;
  const isTokenInHeaders =
    req.headers.authorization && req.headers.authorization.startsWith("Bearer");
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const tokenFromHeaders = isTokenInHeaders ? req.headers.authorization!.split(" ")[1] : null;
  const token = cookies?.loginToken || tokenFromHeaders;
  return token;
}

function signToken(id: string) {
  if (!process.env.JWT_SECRET_CODE) throw new AppError("jwtSecretCode not found in config", 500);
  if (!process.env.JWT_EXPIRATION_TIME)
    throw new AppError("jwtExpirationTime not found in config", 500);

  const token = jwt.sign({ id }, process.env.JWT_SECRET_CODE, {
    expiresIn: process.env.JWT_EXPIRATION_TIME,
  });

  if (!token) throw new AppError("Token not created", 500);
  return token;
}

async function verifyToken(token: string): Promise<{ id: string; timeStamp: number } | null> {
  try {
    if (!process.env.JWT_SECRET_CODE) throw new AppError("jwtSecretCode not found in config", 500);

    const decoded = jwt.verify(token, process.env.JWT_SECRET_CODE) as {
      id: string;
      iat: number;
    };

    const { id, iat } = decoded;
    return { id, timeStamp: iat };
  } catch (err) {
    return null;
  }
}

export default { getTokenFromRequest, signToken, verifyToken };
