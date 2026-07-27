import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaskFlow",
    short_name: "TaskFlow",
    description: "Groups, projects, and tasks in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#141318",
    theme_color: "#141318",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
