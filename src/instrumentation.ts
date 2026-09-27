export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to prevent edge runtime compilation errors for node-only crypto modules
    try {
      const { validateBootSecrets } = await import('@/lib/auth');
      validateBootSecrets();
      const { seedDatabaseIfEmpty } = await import('@/lib/db/seed');
      await seedDatabaseIfEmpty();
    } catch (err: any) {
      console.error('FATAL: Next.js server boot validation failed: ' + err.message);
      if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
