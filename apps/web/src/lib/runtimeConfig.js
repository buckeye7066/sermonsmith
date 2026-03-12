/**
 * Runtime configuration for SermonSmith.
 * Web builds use Vite env vars; Electron builds read from the preload bridge.
 */
export async function getRuntimeConfig() {
  const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;

  if (isElectron) {
    const cfg = await window.electron.getConfig();
    return { apiUrl: cfg?.apiUrl || 'http://localhost:3001' };
  }

  return {
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  };
}
