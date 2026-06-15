// Generate a bcrypt hash for your app login password.
// Usage: node scripts/hash-password.mjs "your-password-here"
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your-password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
// Next.js dotenv expands "$..." as variable references, which corrupts bcrypt
// hashes (they contain several "$"). Escape each "$" as "\$" for .env.local.
const escaped = hash.replace(/\$/g, "\\$");
console.log("\nAdd this line to .env.local (the $ chars are escaped on purpose):\n");
console.log(`APP_PASSWORD_HASH=${escaped}\n`);
