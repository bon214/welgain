import { defineConfig } from 'vite';

const codespace = process.env.CODESPACE_NAME;
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    // Allow this Codespace's private forwarded host, without allowing every host.
    allowedHosts:
      codespace && forwardingDomain
        ? [`${codespace}-5173.${forwardingDomain}`]
        : [],
  },
});
