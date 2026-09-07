// A loopback HTTP preview cannot serve TLS. Upgrading its same-origin login
// navigation strands WebKit on an HTTPS URL with no listener. Keep production
// and non-loopback origins protected; this never removes a server CSP header.
const HTTP_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function shouldUpgradeInsecureRequests(location) {
  return !(location?.protocol === 'http:' && HTTP_LOOPBACK_HOSTS.has(location.hostname.toLowerCase()));
}
