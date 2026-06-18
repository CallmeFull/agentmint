/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Avoid bundling server-only Node modules on the client
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't try to resolve native node modules in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
