import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db";

type SchemaPresenceRow = {
  countValue: bigint | number;
};

export async function tableExists(tableName: string) {
  try {
    const rows = await prisma.$queryRaw<SchemaPresenceRow[]>(Prisma.sql`
      SELECT COUNT(*) AS countValue
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ${tableName}
    `);
    return Number(rows[0]?.countValue ?? 0) > 0;
  } catch {
    return true;
  }
}

export async function columnsExist(tableName: string, columnNames: string[]) {
  if (!columnNames.length) return true;
  try {
    const rows = await prisma.$queryRaw<SchemaPresenceRow[]>(Prisma.sql`
      SELECT COUNT(DISTINCT COLUMN_NAME) AS countValue
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ${tableName}
        AND COLUMN_NAME IN (${Prisma.join(columnNames)})
    `);
    return Number(rows[0]?.countValue ?? 0) === columnNames.length;
  } catch {
    return true;
  }
}
