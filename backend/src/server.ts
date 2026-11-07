import './loadEnv';
import { createApp } from './app';
import { connectDB } from './db';

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  await connectDB();
  createApp().listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
