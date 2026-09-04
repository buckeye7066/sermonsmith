import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEV_API_URL,
  developmentServerConfig,
  resolveDevelopmentApiUrl,
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

  it('uses the Vite-loaded local override without mutating process environment', () => {
    const target = 'http://127.0.0.1:9999';

    expect(resolveDevelopmentApiUrl({ SERMONSMITH_DEV_API_URL: target })).toBe(target);
    expect(resolveDevelopmentApiUrl({})).toBe(DEFAULT_DEV_API_URL);
    expect(developmentServerConfig(resolveDevelopmentApiUrl({
      SERMONSMITH_DEV_API_URL: target,
    })).proxy['/api'].target).toBe(target);
  });
});
