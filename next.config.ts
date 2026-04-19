import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    "@libsql/client",
    "@prisma/adapter-libsql",
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "bcryptjs",
    "jsonwebtoken",
  ],
};

export default nextConfig;
