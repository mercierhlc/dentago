import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "www.dentalsky.com" },
      { protocol: "https", hostname: "cdn.dentalsky.com" },
      { protocol: "https", hostname: "www.septodont.co.uk" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "www.cranberryglobal.com" },
      { protocol: "https", hostname: "www.medicom.com" },
      { protocol: "https", hostname: "multimedia.3m.com" },
      { protocol: "https", hostname: "www.dentsplysirona.com" },
      { protocol: "https", hostname: "www.scican.com" },
      { protocol: "https", hostname: "assets.scican.com" },
      { protocol: "https", hostname: "assets.solventum.com" },
    ],
  },
};

export default nextConfig;
