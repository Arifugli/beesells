import { pgTable, text, serial, integer, timestamp, unique, boolean, bigint } from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "manager", "operator"] }).notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires", { withTimezone: true }),
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

export const branchManagersTable = pgTable("branch_managers", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  managerId: integer("manager_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.branchId, t.managerId)]);

export const branchOperatorsTable = pgTable("branch_operators", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId)]);

// ─── KPI ──────────────────────────────────────────────────────────────────────
export const kpiCategoriesTable = pgTable("kpi_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kpiTargetsTable = pgTable("kpi_targets", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => kpiCategoriesTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  target: integer("target").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId, t.categoryId, t.month)]);

export const kpiEntriesTable = pgTable("kpi_entries", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => kpiCategoriesTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  value: integer("value").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId, t.categoryId, t.date)]);

// ─── Tariffs (created by admin) ───────────────────────────────────────────────
export const tariffsTable = pgTable("tariffs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: bigint("price", { mode: "number" }).notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Manager optionally sets monthly plan per operator per tariff
export const tariffTargetsTable = pgTable("tariff_targets", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tariffId: integer("tariff_id").notNull().references(() => tariffsTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  target: integer("target").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId, t.tariffId, t.month)]);

// Operator logs daily tariff connections
export const tariffSalesTable = pgTable("tariff_sales", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tariffId: integer("tariff_id").notNull().references(() => tariffsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  quantity: integer("quantity").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.operatorId, t.tariffId, t.date)]);

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof usersTable.$inferSelect;
export type Branch = typeof branchesTable.$inferSelect;
export type KpiCategory = typeof kpiCategoriesTable.$inferSelect;
export type KpiTarget = typeof kpiTargetsTable.$inferSelect;
export type KpiEntry = typeof kpiEntriesTable.$inferSelect;
export type Tariff = typeof tariffsTable.$inferSelect;
export type TariffTarget = typeof tariffTargetsTable.$inferSelect;
export type TariffSale = typeof tariffSalesTable.$inferSelect;
