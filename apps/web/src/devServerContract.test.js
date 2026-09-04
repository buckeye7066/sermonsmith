import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config.js';

describe('development server contract', () => {
  it('pins the declared web port and proxies API calls to the declared API port', () => {
    expect(viteConfig.server).toMatchObject({
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3101',
          changeOrigin: false,
        },
      },
    });
  });
});
