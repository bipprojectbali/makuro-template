import { eq } from 'drizzle-orm';
import { db } from './db';
import { appSetting } from './db/schema';

const SINGLETON_ID = 'singleton';

export type AppSettings = {
  emailAuthEnabled: boolean;
  signupEnabled: boolean;
};

const DEFAULTS: AppSettings = {
  emailAuthEnabled: false,
  signupEnabled: true,
};

/** Read current app settings. Returns defaults if no row exists yet. */
export async function getSettings(): Promise<AppSettings> {
  const [row] = await db
    .select({
      emailAuthEnabled: appSetting.emailAuthEnabled,
      signupEnabled: appSetting.signupEnabled,
    })
    .from(appSetting)
    .where(eq(appSetting.id, SINGLETON_ID))
    .limit(1);
  return row ?? DEFAULTS;
}

/** Persist app settings. Creates the singleton row on first call. */
export async function upsertSettings(settings: AppSettings): Promise<AppSettings> {
  await db
    .insert(appSetting)
    .values({ id: SINGLETON_ID, ...settings, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSetting.id,
      set: { ...settings, updatedAt: new Date() },
    });
  return settings;
}
