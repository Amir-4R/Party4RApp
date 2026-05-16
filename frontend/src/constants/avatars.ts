export interface Avatar {
  id: string;
  url: string;
}

export const AVATARS: Avatar[] = [
  { id: "avatar_ninja", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/9f445a6b5c2d87aaf1c4fb7765d4103acb39539b9c7b6504061dbf0f3f7ede48.png" },
  { id: "avatar_astronaut", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/2c9153d6859216661d262d8f1a5725d1eeda03987fe7a3893426139e2cd00563.png" },
  { id: "avatar_skull", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/f55dcb868c9bdeb03ce5912467520adf4b09fa4b2d71ba9a21e8cca3b664695b.png" },
  { id: "avatar_alien", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/eafe4503b44f3b955b91ebe64dd0176afe89e2a405acad0b4d82ade7bb5c8966.png" },
  { id: "avatar_robot", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/0b0ea51f9ba491da3116b8c31b2c1c18556ac4129b1d81aae3e37a21172434c1.png" },
  { id: "avatar_cat", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/f5701e045a5d35f44a19e7cf722d824430077a3827a1a7790fb0ac6fa3c0f490.png" },
];

export const LOGIN_BG_URL = "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/fe23407107d8ec51147db0e7004d8aabe78a835b4418012a37abfaa918253fbb.png";

export const COLORS = {
  bg: "#0B0B0F",
  surface: "#15151A",
  surfaceElevated: "#1C1C22",
  brand: "#00F2FE",
  brandDim: "rgba(0, 242, 254, 0.15)",
  brandGlow: "rgba(0, 242, 254, 0.4)",
  textPrimary: "#FFFFFF",
  textSecondary: "#6C7A89",
  textDisabled: "#3A404A",
  border: "#23242A",
  error: "#FF3B30",
  success: "#34C759",
};

export const getAvatarUrl = (id: string): string => {
  return AVATARS.find((a) => a.id === id)?.url || AVATARS[0].url;
};
