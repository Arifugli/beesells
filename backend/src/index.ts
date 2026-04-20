import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3001;
const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TelecomSales API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
});
