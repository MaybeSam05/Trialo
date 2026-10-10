import type { Trial } from "@/lib/types";

export const demoTrials: Trial[] = [
  { id: "trial-a", name: "Trial A", inclusion: ["type 2 diabetes"], exclusion: ["pregnant"] },
  { id: "trial-b", name: "Trial B", inclusion: ["egfr"], exclusion: ["dialysis"] },
  { id: "trial-c", name: "Trial C", inclusion: ["chronic kidney disease"], exclusion: ["organ transplant"] },
  { id: "trial-d", name: "Trial D", inclusion: ["new jersey"], exclusion: ["another clinical trial"] },
  { id: "trial-e", name: "Trial E", inclusion: ["metformin"], exclusion: ["recent surgery"] }
];
