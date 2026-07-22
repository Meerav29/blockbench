import { PrismaClient } from "@prisma/client";
import { createPrismaAdapter } from "@/lib/prismaAdapter";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = createPrismaAdapter();
  return new PrismaClient({
    adapter,
    log: ["query"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
