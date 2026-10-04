import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  boolean,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const whatsAppAuthTable = pgTable("whatsapp_auth", {
  id: smallint("id").primaryKey(),
  encryptedPayload: text("encrypted_payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const whatsAppSettingsTable = pgTable("whatsapp_settings", {
  id: smallint("id").primaryKey(),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(false),
  creatorName: varchar("creator_name", { length: 80 }).notNull().default(""),
  tone: varchar("tone", { length: 16 }).notNull().default("spicy"),
  personaNotes: text("persona_notes"),
  lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const whatsAppContactsTable = pgTable("whatsapp_contacts", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 15 }).notNull().unique(),
  displayName: varchar("display_name", { length: 80 }),
  adultConfirmed: boolean("adult_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const whatsAppProcessedMessagesTable = pgTable("whatsapp_processed_messages", {
  messageId: varchar("message_id", { length: 128 }).primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertWhatsAppAuthSchema = createInsertSchema(whatsAppAuthTable).omit({
  updatedAt: true,
});
export const insertWhatsAppSettingsSchema = createInsertSchema(whatsAppSettingsTable).omit({
  updatedAt: true,
});
export const insertWhatsAppContactSchema = createInsertSchema(whatsAppContactsTable).omit({
  id: true,
  createdAt: true,
});
export const insertWhatsAppProcessedMessageSchema = createInsertSchema(
  whatsAppProcessedMessagesTable,
).omit({
  processedAt: true,
});

export type InsertWhatsAppAuth = z.infer<typeof insertWhatsAppAuthSchema>;
export type InsertWhatsAppSettings = z.infer<typeof insertWhatsAppSettingsSchema>;
export type InsertWhatsAppContact = z.infer<typeof insertWhatsAppContactSchema>;
export type InsertWhatsAppProcessedMessage = z.infer<
  typeof insertWhatsAppProcessedMessageSchema
>;
export type WhatsAppSettings = typeof whatsAppSettingsTable.$inferSelect;
export type WhatsAppContact = typeof whatsAppContactsTable.$inferSelect;
export type WhatsAppAuth = typeof whatsAppAuthTable.$inferSelect;
export type WhatsAppProcessedMessage = typeof whatsAppProcessedMessagesTable.$inferSelect;