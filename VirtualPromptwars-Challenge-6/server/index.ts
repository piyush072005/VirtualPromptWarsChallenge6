import { createAppServer } from './app.ts';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

const server = createAppServer();

server.listen(port, host, () => {
  // Keep log minimal and free of secrets
  console.log(`AeroShield Family server listening at http://${host}:${port}`);
});
