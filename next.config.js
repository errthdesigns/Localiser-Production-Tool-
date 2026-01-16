/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't try to bundle ffmpeg binary
      config.externals = config.externals || [];
      config.externals.push({
        '@ffmpeg-installer/ffmpeg': '@ffmpeg-installer/ffmpeg',
      });
    }
    return config;
  },
}

module.exports = nextConfig
