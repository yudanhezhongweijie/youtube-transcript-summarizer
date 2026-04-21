import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9990,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:9993",
        changeOrigin: true,
        /** `0` = no socket timeout; SSE can run as long as the server keeps the connection open. */
        timeout: 0,
        proxyTimeout: 0,
        /** When the browser aborts the SSE fetch, tear down the upstream socket to the API server. */
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const destroy = (): void => {
              proxyReq.destroy();
            };
            req.once("aborted", destroy);
            req.socket?.once("close", destroy);
          });
        },
      },
    },
  },
});
