/**
 * The "Pendaftaran terbuka" setting must be enforced by the server, not just
 * hidden in the login form. The guard sits on user creation, so it also covers
 * a first Google sign-in (no email in the request body); demo visitors and
 * admin-created accounts stay exempt.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { api } from '../server/api';
import { auth } from '../server/auth';
import { db } from '../server/db';
import { appSetting, user } from '../server/db/schema';
import { upsertSettings } from '../server/settings';
import { invalidateSettingsCache, SINGLETON_ID } from '../server/settings.core';

const PASS = 'TestPass123!';
const emails: string[] = [];
const anonIds: string[] = [];

function freshEmail(tag: string): string {
  const email = `${tag}-${crypto.randomUUID()}@test.local`;
  emails.push(email);
  return email;
}

function signUp(email: string) {
  return api.handle(
    new Request('http://localhost/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASS, name: 'Signup Tester' }),
    }),
  );
}

function userRows(email: string) {
  return db.select({ id: user.id }).from(user).where(eq(user.email, email));
}

async function setSignup(signupEnabled: boolean) {
  await upsertSettings({ emailAuthEnabled: true, signupEnabled });
}

afterAll(async () => {
  for (const email of emails) await db.delete(user).where(eq(user.email, email));
  for (const id of anonIds) await db.delete(user).where(eq(user.id, id));
  await db.delete(appSetting).where(eq(appSetting.id, SINGLETON_ID));
  invalidateSettingsCache();
});

describe('signupEnabled guard on user creation', () => {
  test('closed: email sign-up is refused with 403 and creates no user row', async () => {
    await setSignup(false);
    const email = freshEmail('closed');
    const res = await signUp(email);
    expect(res.status).toBe(403);
    expect(await userRows(email)).toHaveLength(0);
  });

  test('closed: anonymous demo visitors are still created', async () => {
    await setSignup(false);
    const { response } = await auth.api.signInAnonymous({
      headers: new Headers(),
      returnHeaders: true,
    });
    const id = response?.user.id;
    expect(id).toBeTruthy();
    if (id) anonIds.push(id);
  });

  test('open: email sign-up succeeds', async () => {
    await setSignup(true);
    const email = freshEmail('open');
    const res = await signUp(email);
    expect(res.status).toBe(200);
    expect(await userRows(email)).toHaveLength(1);
  });

  test('no settings row at all: sign-up stays open', async () => {
    await db.delete(appSetting).where(eq(appSetting.id, SINGLETON_ID));
    invalidateSettingsCache();
    const email = freshEmail('default');
    const res = await signUp(email);
    expect(res.status).toBe(200);
    expect(await userRows(email)).toHaveLength(1);
  });
});
