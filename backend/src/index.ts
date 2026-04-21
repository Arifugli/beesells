import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3001;
createApp().listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TelecomSales API v2 running on port ${PORT}`);
});
