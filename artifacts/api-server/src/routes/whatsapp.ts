import { Router, type IRouter } from "express";
import { count, desc, eq } from "drizzle-orm";
import {
  AddWhatsAppContactBody,
  AddWhatsAppContactResponse,
  DeleteWhatsAppContactParams,
  GetWhatsAppStatusResponse,
  ListWhatsAppContactsResponse,
  UpdateWhatsAppSettingsBody,
} from "@workspace/api-zod";
import {
  db,
  whatsAppContactsTable,
  whatsAppSettingsTable,
} from "@workspace/db";
import { whatsAppManager } from "../lib/whatsapp-manager";

const router: IRouter = Router();

function normalizePhoneNumber(input: string): string | null {
  if (!/^[+\d\s().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, "");
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

router.get("/whatsapp/status", async (_req, res): Promise<void> => {
  const status = await whatsAppManager.getStatus();
  res.json(GetWhatsAppStatusResponse.parse(status));
});

router.post("/whatsapp/connect", async (req, res): Promise<void> => {
  try {
    await whatsAppManager.connect();
    res.json(GetWhatsAppStatusResponse.parse(await whatsAppManager.getStatus()));
  } catch (error) {
    req.log.error({ err: error }, "Could not start WhatsApp connection.");
    res.status(503).json({ error: "WhatsApp connection is unavailable right now." });
  }
});

router.post("/whatsapp/disconnect", async (req, res): Promise<void> => {
  try {
    await whatsAppManager.disconnect();
    res.json(GetWhatsAppStatusResponse.parse(await whatsAppManager.getStatus()));
  } catch (error) {
    req.log.error({ err: error }, "Could not disconnect WhatsApp.");
    res.status(500).json({ error: "WhatsApp could not be disconnected right now." });
  }
});

router.patch("/whatsapp/settings", async (req, res): Promise<void> => {
  const parsed = UpdateWhatsAppSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please check the auto-reply settings." });
    return;
  }

  const creatorName = parsed.data.creatorName.trim();
  const personaNotes = parsed.data.personaNotes?.trim() || null;
  if (parsed.data.autoReplyEnabled) {
    if (!creatorName) {
      res.status(400).json({ error: "Add your creator name before enabling auto-replies." });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ error: "Gemini is not configured for automatic replies." });
      return;
    }

    const [approved] = await db
      .select({ value: count() })
      .from(whatsAppContactsTable)
      .where(eq(whatsAppContactsTable.adultConfirmed, true));
    if (!approved?.value) {
      res.status(400).json({
        error: "Approve at least one adult contact before enabling auto-replies.",
      });
      return;
    }
  }

  await db
    .insert(whatsAppSettingsTable)
    .values({
      id: 1,
      autoReplyEnabled: parsed.data.autoReplyEnabled,
      creatorName,
      tone: parsed.data.tone,
      personaNotes,
    })
    .onConflictDoUpdate({
      target: whatsAppSettingsTable.id,
      set: {
        autoReplyEnabled: parsed.data.autoReplyEnabled,
        creatorName,
        tone: parsed.data.tone,
        personaNotes,
        updatedAt: new Date(),
      },
    });

  res.json(GetWhatsAppStatusResponse.parse(await whatsAppManager.getStatus()));
});

router.get("/whatsapp/contacts", async (_req, res): Promise<void> => {
  const contacts = await db
    .select()
    .from(whatsAppContactsTable)
    .orderBy(desc(whatsAppContactsTable.createdAt));
  const response = contacts.map((contact) => ({
    id: contact.id,
    phoneNumber: `+${contact.phoneNumber}`,
    displayName: contact.displayName,
    adultConfirmed: contact.adultConfirmed,
    createdAt: contact.createdAt.toISOString(),
  }));
  res.json(ListWhatsAppContactsResponse.parse(response));
});

router.post("/whatsapp/contacts", async (req, res): Promise<void> => {
  const parsed = AddWhatsAppContactBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.adultConfirmed) {
    res.status(400).json({
      error: "Confirm this contact is 18 or older before approving them.",
    });
    return;
  }

  const phoneNumber = normalizePhoneNumber(parsed.data.phoneNumber);
  if (!phoneNumber) {
    res.status(400).json({
      error: "Enter a valid international phone number with 7–15 digits.",
    });
    return;
  }

  try {
    const [contact] = await db
      .insert(whatsAppContactsTable)
      .values({
        phoneNumber,
        displayName: parsed.data.displayName?.trim() || null,
        adultConfirmed: true,
      })
      .returning();
    res
      .status(201)
      .json(
        AddWhatsAppContactResponse.parse({
          id: contact.id,
          phoneNumber: `+${contact.phoneNumber}`,
          displayName: contact.displayName,
          adultConfirmed: contact.adultConfirmed,
          createdAt: contact.createdAt.toISOString(),
        }),
      );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "This phone number is already approved." });
      return;
    }
    req.log.error({ err: error }, "Could not add an approved WhatsApp contact.");
    res.status(500).json({ error: "The contact could not be added right now." });
  }
});

router.delete("/whatsapp/contacts/:contactId", async (req, res): Promise<void> => {
  const params = DeleteWhatsAppContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid contact." });
    return;
  }

  const [deleted] = await db
    .delete(whatsAppContactsTable)
    .where(eq(whatsAppContactsTable.id, params.data.contactId))
    .returning({ id: whatsAppContactsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Contact not found." });
    return;
  }

  const [remaining] = await db
    .select({ value: count() })
    .from(whatsAppContactsTable)
    .where(eq(whatsAppContactsTable.adultConfirmed, true));
  if (!remaining?.value) {
    await db
      .update(whatsAppSettingsTable)
      .set({ autoReplyEnabled: false, updatedAt: new Date() })
      .where(eq(whatsAppSettingsTable.id, 1));
  }

  res.status(204).send();
});

export default router;