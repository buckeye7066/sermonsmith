import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import aiRoutes from './routes/ai.js';
import functionRoutes from './routes/functions.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/functions', functionRoutes);

app.use((err, _req, res, _next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SermonSmith API running on port ${PORT}`);
});
