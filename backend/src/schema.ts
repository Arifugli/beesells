import { pgTable, text, serial, integer, timestamp, unique, boolean } from "drizzle-orm/pg-core";

// ─── Users (admin / manager / operator) ───────────────────────────────────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "manager", "operator"] }).notNull(),
  // only admin has a password hash
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Branches ─────────────────────────────────────────────────────────────────
export const branchesTable = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Branch ↔ Manager (many-to-many) ──────────────────────────────────────────
export const branchManagersTable = pgTable("branch_managers", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  managerId: integer("manager_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.branchId, t.managerId)]);

// ─── Branch ↔ Operator (operator belongs to one branch) ───────────────────────
export const branchOperatorsTable = pgTable("branch_operators", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId)]); // operator can only be in one branch

// ─── KPI Categories ───────────────────────────────────────────────────────────
export const kpiCategoriesTable = pgTable("kpi_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // e.g. "шт", "сум", "мин"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── KPI Targets (manager sets monthly plan per operator per category) ─────────
export const kpiTargetsTable = pgTable("kpi_targets", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => kpiCategoriesTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // YYYY-MM
  target: integer("target").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId, t.categoryId, t.month)]);

// ─── KPI Entries (operator logs daily results) ────────────────────────────────
export const kpiEntriesTable = pgTable("kpi_entries", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => kpiCategoriesTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  value: integer("value").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId, t.categoryId, t.date)]);

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof usersTable.$inferSelect;
export type Branch = typeof branchesTable.$inferSelect;
export type BranchManager = typeof branchManagersTable.$inferSelect;
export type BranchOperator = typeof branchOperatorsTable.$inferSelect;
export type KpiCategory = typeof kpiCategoriesTable.$inferSelect;
export type KpiTarget = typeof kpiTargetsTable.$inferSelect;
export type KpiEntry = typeof kpiEntriesTable.$inferSelect;
