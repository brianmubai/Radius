import { RadiusApp } from './app.ts';

const PORT = parseInt(process.env.PORT || '4000', 10);
const app = new RadiusApp();

app.listen(PORT, () => {
  console.log(`🚀 Radius Backend API listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
