import fs from "node:fs";
import path from "node:path";

export const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");
export function hasAuth(): boolean {
  return fs.existsSync(AUTH_FILE);
}
