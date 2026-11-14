import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 개발 모드 왼쪽 아래 Next.js 배지·Insight 알림 숨김 (에러 화면은 그대로 뜸)
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
