import { PrismaPg } from "@prisma/adapter-pg";

function shouldUseSsl(connectionString: string) {
  try {
    const { hostname } = new URL(connectionString);
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

export function createPrismaAdapter(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Local Postgres commonly runs without TLS; hosted databases usually require it.
  if (!shouldUseSsl(connectionString)) {
    return new PrismaPg({ connectionString });
  }

  return new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}
