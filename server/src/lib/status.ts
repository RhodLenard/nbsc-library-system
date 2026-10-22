export const mappingVersion = "2026-10-15.1";

const table: Record<string, Record<string, string>> = {
  member: { "1": "ACTIVE", active: "ACTIVE", "0": "INACTIVE", inactive: "INACTIVE" },
  staff: { "1": "ACTIVE", active: "ACTIVE", "0": "INACTIVE", inactive: "INACTIVE" },
  copy: { available: "AVAILABLE", borrowed: "ON_LOAN", reserved: "RESERVED", lost: "LOST", damaged: "DAMAGED", replaced: "REPLACED", "under repair": "REPAIR" },
  loan: { borrowed: "ACTIVE", issued: "ACTIVE", returned: "RETURNED", lost: "LOST" },
  reservation: { pending: "PENDING", ready: "READY", received: "RECEIVED", cancelled: "CANCELLED", canceled: "CANCELLED" },
  fine: { unpaid: "UNPAID", paid: "PAID", waived: "WAIVED" },
};

export function mapLegacyStatus(entity: keyof typeof table, value: unknown, fallback: string) {
  const original = value == null ? "" : String(value).trim();
  return { legacyStatus: original || null, status: table[entity][original.toLowerCase()] ?? fallback };
}
