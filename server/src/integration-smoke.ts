import { prisma } from './lib/prisma.js'

try {
  const rows = await prisma.$queryRaw<Array<{ ready: number }>>`SELECT 1 AS ready`
  if (rows[0]?.ready !== 1) throw new Error('Database readiness query returned an unexpected result.')
  const tables = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name IN ('staff', 'members', 'loans', 'copies')
  `
  if (tables.length !== 4) throw new Error(`Expected migrated library tables, found ${tables.length}/4.`)
  console.log('Database integration smoke test passed.')
} finally {
  await prisma.$disconnect()
}
