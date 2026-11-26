import type { Config } from '@netlify/server';
import { createAppServer } from '../../server/app.ts';

// Netlify Server: export the node:http server without calling listen().
// Static frontend assets are served from `dist` by Netlify's CDN; only /api/* reaches here.
export default createAppServer();

export const config: Config = {
  path: '/api/*',
};
