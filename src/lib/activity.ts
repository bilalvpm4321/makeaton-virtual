import type { Prisma, PrismaClient } from "@prisma/client";

/** Writes an Activity row. Pass the transaction client when logging inside a transaction. */
export async function logActivity(
  client: Prisma.TransactionClient | PrismaClient,
  {
    entityType,
    entityId,
    message,
    userId,
  }: {
    entityType: string;
    entityId: string;
    message: string;
    userId?: string | null;
  },
): Promise<void> {
  await client.activity.create({
    data: { entityType, entityId, message, userId: userId ?? null },
  });
}
