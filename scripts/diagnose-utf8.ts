import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "node:process";

loadEnvFile();

const prisma = new PrismaClient();

type TextColumn = {
  tableName: string;
  columnName: string;
  characterSetName: string | null;
  collationName: string | null;
};

type SuspiciousValue = {
  tableName: string;
  columnName: string;
  id: unknown;
  value: string;
  problemType: string;
};

const suspiciousSqlPatterns = [
  { label: "replacement-character", pattern: "%�%" },
  { label: "replacement-character-mojibake", pattern: "%ï¿½%" },
  { label: "double-encoded-utf8", pattern: "%Ãƒ%" },
  { label: "latin1-decoded-utf8", pattern: "%Ã%" },
  { label: "cp1252-punctuation-mojibake", pattern: "%â%" },
] as const;

const technicalColumnNames = new Set([
  "id",
  "checksum",
  "email",
  "microsoftEmail",
  "entraId",
  "representativeId",
  "accessTokenEncrypted",
  "refreshTokenEncrypted",
  "passwordHash",
  "outlookEventId",
  "outlookICalUId",
  "requestKey",
  "sessionId",
]);

function sqlIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function preview(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function isUserFacingTextColumn(columnName: string) {
  if (technicalColumnNames.has(columnName)) return false;
  if (columnName.endsWith("Id") || columnName.endsWith("_id")) return false;
  return true;
}

async function main() {
  const session = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT DATABASE() AS db, @@character_set_database AS character_set_database, @@collation_database AS collation_database, @@character_set_client AS character_set_client, @@character_set_connection AS character_set_connection, @@collation_connection AS collation_connection, @@character_set_results AS character_set_results"
  );
  console.log("Database UTF-8 session");
  console.table(session);

  const columns = await prisma.$queryRawUnsafe<TextColumn[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, CHARACTER_SET_NAME AS characterSetName, COLLATION_NAME AS collationName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND CHARACTER_SET_NAME IS NOT NULL
       AND DATA_TYPE IN ('char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext')
     ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );

  const nonUtf8Columns = columns.filter((column) => column.characterSetName !== "utf8mb4");
  console.log(`Text columns checked: ${columns.length}`);
  console.log(`Text columns not using utf8mb4: ${nonUtf8Columns.length}`);
  if (nonUtf8Columns.length) console.table(nonUtf8Columns);

  const tableCollations = await prisma.$queryRawUnsafe<Array<{ tableName: string; tableCollation: string | null }>>(
    `SELECT TABLE_NAME AS tableName, TABLE_COLLATION AS tableCollation
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`
  );
  const nonUtf8Tables = tableCollations.filter((table) => !table.tableCollation?.startsWith("utf8mb4"));
  console.log(`Tables checked: ${tableCollations.length}`);
  console.log(`Tables not defaulting to utf8mb4: ${nonUtf8Tables.length}`);
  if (nonUtf8Tables.length) console.table(nonUtf8Tables);

  const suspiciousValues: SuspiciousValue[] = [];
  for (const column of columns.filter((item) => isUserFacingTextColumn(item.columnName))) {
    for (const { label, pattern } of suspiciousSqlPatterns) {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: unknown; value: string }>>(
        `SELECT CAST(${sqlIdentifier("id")} AS CHAR) AS id, CAST(${sqlIdentifier(column.columnName)} AS CHAR) AS value
         FROM ${sqlIdentifier(column.tableName)}
         WHERE ${sqlIdentifier(column.columnName)} COLLATE utf8mb4_bin LIKE ?
         LIMIT 5`,
        pattern
      );
      suspiciousValues.push(
        ...rows.map((row) => ({
          tableName: column.tableName,
          columnName: column.columnName,
          id: row.id,
          value: preview(row.value),
          problemType: label,
        }))
      );
    }
  }

  console.log(`Suspicious text values found: ${suspiciousValues.length}`);
  if (suspiciousValues.length) console.table(suspiciousValues);

  const aurelieRows = await prisma.$queryRawUnsafe<Array<{ id: string; firstName: string; lastName: string; email: string }>>(
    `SELECT id, firstName, lastName, email
     FROM ${sqlIdentifier("User")}
     WHERE firstName LIKE '%Aur%' OR lastName LIKE '%Milet%' OR email LIKE '%milet%'
     ORDER BY email
     LIMIT 20`
  );
  console.log(`Aurelie/Milet candidate rows: ${aurelieRows.length}`);
  if (aurelieRows.length) console.table(aurelieRows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
