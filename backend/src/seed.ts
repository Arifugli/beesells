import { db } from "./db.js";
import { operatorsTable, salesEntriesTable } from "./schema.js";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create operators
  const ops = await db.insert(operatorsTable).values([
    { name: "Алишер Каримов", role: "operator", simTarget: 300, deviceTarget: 60 },
    { name: "Дилноза Юсупова", role: "operator", simTarget: 280, deviceTarget: 55 },
    { name: "Бобур Рахимов", role: "operator", simTarget: 250, deviceTarget: 50 },
    { name: "Нилуфар Азимова", role: "operator", simTarget: 320, deviceTarget: 65 },
    { name: "Санжар Исмоилов", role: "operator", simTarget: 260, deviceTarget: 45 },
    { name: "Умид Хасанов", role: "manager", simTarget: 0, deviceTarget: 0 },
  ]).returning();

  console.log(`✅ Created ${ops.length} operators`);

  // Create some sales entries for the current month
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  const entries = [];
  for (const op of ops.filter(o => o.role === "operator")) {
    for (let day = 1; day <= Math.min(today.getDate() - 1, 20); day++) {
      entries.push({
        operatorId: op.id,
        date: `${year}-${month}-${String(day).padStart(2, "0")}`,
        simSold: Math.floor(Math.random() * 15) + 3,
        devicesSold: Math.floor(Math.random() * 4),
      });
    }
  }

  if (entries.length > 0) {
    await db.insert(salesEntriesTable).values(entries);
    console.log(`✅ Created ${entries.length} sales entries`);
  }

  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
