import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const disasters = pgTable("disasters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  severity: integer("severity"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  title: text("title"),
  description: text("description"),
  timestamp: timestamp("timestamp").notNull(),
  processed: boolean("processed").default(false),
  analysis: text("analysis"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const systemStats = pgTable("system_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalEvents: integer("total_events").default(0),
  processedEvents: integer("processed_events").default(0),
  highSeverityEvents: integer("high_severity_events").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(), // success, warning, error, info
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertDisasterSchema = createInsertSchema(disasters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  timestamp: true,
});

export const insertStatsSchema = createInsertSchema(systemStats).omit({
  id: true,
  lastUpdated: true,
});

export type InsertDisaster = z.infer<typeof insertDisasterSchema>;
export type Disaster = typeof disasters.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type SystemStats = typeof systemStats.$inferSelect;
