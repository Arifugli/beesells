import { db } from "./db.js";
import bcrypt from "bcryptjs";
import {
  usersTable, branchesTable, branchManagersTable,
  branchOperatorsTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable
} from "./schema.js";

async function seed() {
  console.log("🌱 Seeding v2...");

  // Admin
  const adminHash = await bcrypt.hash("admin123", 10);
  const [admin] = await db.insert(usersTable).values({ name: "Администратор", role: "admin", passwordHash: adminHash }).returning();
  console.log("✅ Admin created (password: admin123)");

  // Managers
  const [mgr1, mgr2] = await db.insert(usersTable).values([
    { name: "Умид Хасанов", role: "manager" },
    { name: "Феруза Назарова", role: "manager" },
  ]).returning();

  // Branches
  const [b1, b2] = await db.insert(branchesTable).values([
    { name: "Филиал Юнусабад", address: "Юнусабадский район, ул. Амира Темура 15" },
    { name: "Филиал Чиланзар", address: "Чиланзарский район, ул. Бунёдкор 22" },
  ]).returning();

  // Assign managers to branches
  await db.insert(branchManagersTable).values([
    { branchId: b1.id, managerId: mgr1.id },
    { branchId: b2.id, managerId: mgr2.id },
    { branchId: b2.id, managerId: mgr1.id }, // mgr1 manages both
  ]);

  // Operators
  const ops1 = await db.insert(usersTable).values([
    { name: "Алишер Каримов", role: "operator" },
    { name: "Дилноза Юсупова", role: "operator" },
    { name: "Бобур Рахимов", role: "operator" },
  ]).returning();

  const ops2 = await db.insert(usersTable).values([
    { name: "Нилуфар Азимова", role: "operator" },
    { name: "Санжар Исмоилов", role: "operator" },
  ]).returning();

  // Assign operators to branches
  await db.insert(branchOperatorsTable).values([
    ...ops1.map(op => ({ branchId: b1.id, operatorId: op.id })),
    ...ops2.map(op => ({ branchId: b2.id, operatorId: op.id })),
  ]);

  // KPI Categories
  const cats = await db.insert(kpiCategoriesTable).values([
    { name: "SIM-карты", unit: "шт" },
    { name: "Устройства", unit: "шт" },
    { name: "Тарифные подключения", unit: "шт" },
    { name: "Выручка", unit: "сум" },
  ]).returning();

  // Targets and entries for current month
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const allOps = [...ops1, ...ops2];
  const targets = [300, 60, 150, 5000000];

  for (const op of allOps) {
    for (let i = 0; i < cats.length; i++) {
      await db.insert(kpiTargetsTable).values({
        operatorId: op.id,
        categoryId: cats[i].id,
        month,
        target: targets[i] + Math.floor(Math.random() * 50),
      });
    }

    // Daily entries for past days
    for (let day = 1; day < today.getDate(); day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      for (const cat of cats) {
        const baseValues: Record<string, number> = {
          "SIM-карты": 12, "Устройства": 2, "Тарифные подключения": 6, "Выручка": 180000
        };
        const base = baseValues[cat.name] || 5;
        await db.insert(kpiEntriesTable).values({
          operatorId: op.id,
          categoryId: cat.id,
          date,
          value: Math.floor(base * (0.6 + Math.random() * 0.8)),
        });
      }
    }
  }

  console.log("✅ Branches, managers, operators, KPI categories, targets & entries created");
  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
