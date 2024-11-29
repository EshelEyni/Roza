import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",
      strategies: "generateSW",
      includeAssets: [
        "favicon.ico",
        "images/*.png",
        "fonts/**/*.ttf",
      ],
      manifest: {
        name: "Roza",
        short_name: "Roza",
        start_url: "/",
        scope: ".",
        display: "standalone",
        background_color: "transparent",
        theme_color: "#C39B78",
        description:
          "Roza is a book app.",
        dir: "ltr",
        orientation: "any",
        icons: [
          {
            src: "images/icon-48x48.png",
            sizes: "48x48",
            type: "image/png",
          },
          {
            src: "images/icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
          },
          {
            src: "images/icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "images/icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
          },
          {
            src: "images/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "images/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|tiff|ttf|woff|woff2|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-resources",
            },
          },
        ],
        navigateFallback: "/offline.html",
      },
    }),
  ],
});
