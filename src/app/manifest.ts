import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Open Avocado — Adaptive Learning",
    short_name: "Open Avocado",
    description:
      "Adaptive learning platform. Multi-user, mastery-driven, locally-hosted.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#399103",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
