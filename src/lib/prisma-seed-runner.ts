import path from 'path';

export default async function runPrismaSeed() {
  const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts');
  // Dynamically import the seed script
  const mod = await import(seedPath);
  if (typeof mod.default === 'function') {
    await mod.default();
  } else if (typeof mod.main === 'function') {
    await mod.main();
  } else {
    // If no default export/main, just importing runs the script
  }
}