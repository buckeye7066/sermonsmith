import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getRuntimeConfig } from '@/lib/runtimeConfig';

let base44SingletonPromise;

function createBase44Proxy() {
  const makeProxy = (path = []) =>
    new Proxy(() => {}, {
      get(_target, prop) {
        // Avoid looking like a Promise to React Query / await machinery.
        if (prop === 'then') return undefined;
        return makeProxy([...path, prop]);
      },
      apply(_target, _thisArg, args) {
        return (async () => {
          const client = await getBase44();

          // Walk the path to find the final function/property, preserving correct `this`.
          let parent = client;
          for (let i = 0; i < path.length - 1; i++) {
            parent = parent?.[path[i]];
          }
          const key = path[path.length - 1];
          const value = path.length === 0 ? client : parent?.[key];

          if (typeof value !== 'function') {
            throw new Error(
              `[base44Client] Tried to call ${path.join('.')}() but it is not a function.`
            );
          }

          return value.apply(parent, args);
        })();
      },
    });

  return makeProxy();
}

export async function getBase44() {
  if (!base44SingletonPromise) {
    base44SingletonPromise = (async () => {
      const { appId, backendUrl } = await getRuntimeConfig();
      const { token, functionsVersion } = appParams;

      // Create a client (auth optional; token may be null)
      return createClient({
        appId,
        serverUrl: backendUrl,
        token,
        functionsVersion,
        requiresAuth: false,
      });
    })();
  }

  return base44SingletonPromise;
}

// Convenience: many call sites can `await base44Promise`
export const base44Promise = getBase44();

// Backwards-compatible export: behaves like the Base44 client, but resolves lazily.
export const base44 = createBase44Proxy();
