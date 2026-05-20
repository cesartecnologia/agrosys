import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const firebaseAliases = {
  "firebase/app": path.join(__dirname, "node_modules/firebase/app/dist/esm/index.esm.js"),
  "firebase/auth": path.join(__dirname, "node_modules/firebase/auth/dist/esm/index.esm.js"),
  "firebase/firestore": path.join(__dirname, "node_modules/firebase/firestore/dist/esm/index.esm.js")
};

const turbopackFirebaseAliases = {
  "firebase/app": "./node_modules/firebase/app/dist/esm/index.esm.js",
  "firebase/auth": "./node_modules/firebase/auth/dist/esm/index.esm.js",
  "firebase/firestore": "./node_modules/firebase/firestore/dist/esm/index.esm.js"
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
    resolveAlias: turbopackFirebaseAliases
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...firebaseAliases
    };
    return config;
  }
};

export default nextConfig;
