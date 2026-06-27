import { PrismaClient } from '@prisma/client';
import { migrateEntityRowsToTyped } from '../src/services/typedContent.js';

const prisma = new PrismaClient();

const TYPES = [
  'Sermon',
  'SermonSeries',
  'SermonOutline',
  'BibleStudy',
  'StudyNote',
  'Highlight',
  'Bookmark',
  'PrayerRequest',
  'SharedContent',
  'ForumPost',
  'StudyGroup',
];

async function main() {
  const requested = process.argv.slice(2);
  const types = requested.length > 0 ? requested : TYPES;
  for (const type of types) {
    const result = await migrateEntityRowsToTyped(prisma, type);
    console.log(`${result.type}: migrated ${result.created} ${result.sourceType} rows`);
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
