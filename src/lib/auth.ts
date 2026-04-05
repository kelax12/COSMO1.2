import { betterAuth } from "better-auth";
import { organization, twoFactor } from "better-auth/plugins";
import pg from "pg";

const { Pool } = pg;

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization(),
    twoFactor(),
  ],
});
