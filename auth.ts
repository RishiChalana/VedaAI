import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

// Ensure a single Prisma client in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let prismaClient = globalForPrisma.prisma;
if (!prismaClient) {
  const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
  prismaClient = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaClient;
}
export const prisma = prismaClient;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "teacher" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // For prototype purposes, accept any login as the teacher
        const user = await prisma.user.upsert({
          where: { email: "teacher@vedaai.com" },
          update: {},
          create: {
            name: "Madhur Khang",
            email: "teacher@vedaai.com",
            school: "Delhi Public School",
          },
        });
        return user;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
});
