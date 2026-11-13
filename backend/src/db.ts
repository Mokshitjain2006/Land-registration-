import path from "node:path";
import { PrismaClient } from "@prisma/client";

const defaultDbPath = path.resolve(process.cwd(), "backend", "prisma", "landchain.db");
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${defaultDbPath}`;
}

export const prisma = new PrismaClient();
