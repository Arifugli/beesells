import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const operatorsTable = pgTable("operators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["operator", "manager"] }).notNull().default("operator"),
  simTarget: integer("sim_target").notNull().default(250),
  deviceTarget: integer("device_target").notNull().default(50),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesEntriesTable = pgTable("sales_entries", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => operatorsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  simSold: integer("sim_sold").notNull().default(0),
  devicesSold: integer("devices_sold").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.operatorId, t.date),
]);

export type Operator = typeof operatorsTable.$inferSelect;
export type NewOperator = typeof operatorsTable.$inferInsert;
export type SalesEntry = typeof salesEntriesTable.$inferSelect;
export type NewSalesEntry = typeof salesEntriesTable.$inferInsert;
