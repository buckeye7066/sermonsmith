import { describe, expect, it } from 'vitest';
import viteConfig, {
  DEFAULT_DEV_API_URL,
  developmentServerConfig,
} from '../vite.config.js';

describe('development server contract', () => {
  it('pins the declared web port and proxies API calls to the declared API port', () => {
    expect(developmentServerConfig()).toMatchObject({
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: DEFAULT_DEV_API_URL,
          changeOrigin: false,
        },
      },
    });
  });

  it('accepts a development API override without mutating the test process environment', () => {
    const before = process.env.SERMONSMITH_DEV_API_URL;
    const target = 'http://127.0.0.1:9999';

    expect(developmentServerConfig(target).proxy['/api'].target).toBe(target);
    expect(process.env.SERMONSMITH_DEV_API_URL).toBe(before);
    expect(viteConfig.server.proxy['/api'].target).toBe(
      before || DEFAULT_DEV_API_URL,
    );
  });
});
