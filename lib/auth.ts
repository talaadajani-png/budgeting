import bcrypt from "bcryptjs";

// Node-runtime only (bcrypt). Used by the login route to verify the password.
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.APP_PASSWORD_HASH;
  if (!hash) {
    throw new Error("APP_PASSWORD_HASH is not set");
  }
  if (!password) return false;
  return bcrypt.compare(password, hash);
}
