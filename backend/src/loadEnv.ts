import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/** Raíz del repo (.env compartido) y luego backend/.env (override local). */
const paths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];

for (const envPath of paths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
