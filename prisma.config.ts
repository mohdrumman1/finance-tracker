import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "path";

const tursoUrl = process.env.DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource:
    tursoUrl && tursoToken
      ? {
          adapter: new PrismaLibSql(
            createClient({ url: tursoUrl, authToken: tursoToken })
          ),
        }
      : {
          url: `file:${path.resolve(process.cwd(), "prisma/finance.db")}`,
        },
});
