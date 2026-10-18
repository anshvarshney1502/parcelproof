import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getClient } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Lazy: the adapter only connects when a request needs it, so builds don't require MongoDB.
  adapter: MongoDBAdapter(() => getClient(), { databaseName: process.env.MONGODB_DB_NAME || "parcelproof" }),
  providers: [Google],
  session: { strategy: "database", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/sign-in" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
