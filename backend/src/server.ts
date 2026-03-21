import './loadEnv';
import express from 'express';
import { connectDB } from './db';
import stockRoutes from './routes/stock';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use('/stock', stockRoutes);

async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
