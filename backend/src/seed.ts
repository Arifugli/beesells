import { db } from "./db.js";
import bcrypt from "bcryptjs";
import {
  usersTable, branchesTable, branchManagersTable,
  branchOperatorsTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable
} from "./schema.js";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Idempotent seed starting...");

  // ── Admin ─────────────────────────────────────────────────────────────────
  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  if (existingAdmin.length > 0) {
    console.log("⏭  Admin already exists — skipping all seed data");
    console.log("✅ Seed complete (nothing changed)");
    process.exit(0);
  }

  const adminHash = await bcrypt.hash("admin123", 10);
  await db.insert(usersTable).values({
    name: "Администратор",
    role: "admin",
    passwordHash: adminHash,
  });
  console.log("✅ Admin created (password: admin123)");
  console.log("🎉 Seed complete! Run the app and log in as admin to set up branches and managers.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
