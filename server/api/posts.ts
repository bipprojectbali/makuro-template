/**
 * Posts API. Reads are public; writes need a session. Editing or deleting
 * someone else's post requires an admin role and is audited.
 */
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { AUDIT_ACTIONS, audit } from '../audit';
import { db } from '../db';
import { post } from '../db/schema';
import { requireRole, resolveActor } from '../guard';
import { logger } from '../logger';
import { isAdminRole, ROLES } from '../permissions';
import {
  CONTENT_MAX,
  getPost,
  listPosts,
  PostListQuery,
  postStats,
  TITLE_MAX,
} from './posts.query';

const PostBody = t.Object({
  title: t.String({ minLength: 1, maxLength: TITLE_MAX }),
  content: t.Optional(t.Nullable(t.String({ maxLength: CONTENT_MAX }))),
});

export const postsApi = new Elysia({ prefix: '/posts' })
  .derive(async ({ request }) => {
    const who = await resolveActor(request);
    return { me: who?.user ?? null, role: who?.role ?? null };
  })
  .get('/', ({ query }) => listPosts(query), { query: PostListQuery })
  .get('/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return postStats();
  })
  .get(
    '/:id',
    async ({ params, status }) => (await getPost(params.id)) ?? status(404, { error: 'Not found' }),
  )
  .post(
    '/',
    async ({ me, body, status }) => {
      if (!me) return status(401, { error: 'Unauthorized' });
      const [created] = await db
        .insert(post)
        .values({ title: body.title.trim(), content: body.content ?? null, authorId: me.id })
        .returning({ id: post.id });
      logger.info({ postId: created.id }, 'post created');
      return getPost(created.id);
    },
    { body: PostBody },
  )
  .put(
    '/:id',
    async ({ me, role, params, body, request, status }) => {
      if (!me) return status(401, { error: 'Unauthorized' });
      const existing = await getPost(params.id);
      if (!existing) return status(404, { error: 'Not found' });
      const own = existing.authorId === me.id;
      if (!own && !isAdminRole(role))
        return status(403, { error: 'Hanya pemilik atau admin yang boleh mengubah' });
      await db
        .update(post)
        .set({ title: body.title.trim(), content: body.content ?? null, updatedAt: new Date() })
        .where(eq(post.id, params.id));
      if (!own)
        void audit({
          actor: me,
          headers: request.headers,
          action: AUDIT_ACTIONS.POST_UPDATE,
          targetType: 'post',
          targetId: params.id,
          summary: `Admin mengubah post "${existing.title}" milik ${existing.authorEmail ?? existing.authorId}`,
        });
      return getPost(params.id);
    },
    { body: PostBody },
  )
  .delete('/:id', async ({ me, role, params, request, status }) => {
    if (!me) return status(401, { error: 'Unauthorized' });
    const existing = await getPost(params.id);
    if (!existing) return status(404, { error: 'Not found' });
    const own = existing.authorId === me.id;
    if (!own && !isAdminRole(role))
      return status(403, { error: 'Hanya pemilik atau admin yang boleh menghapus' });
    await db.delete(post).where(eq(post.id, params.id));
    if (!own)
      void audit({
        actor: me,
        headers: request.headers,
        action: AUDIT_ACTIONS.POST_DELETE,
        targetType: 'post',
        targetId: params.id,
        summary: `Admin menghapus post "${existing.title}" milik ${existing.authorEmail ?? existing.authorId}`,
      });
    return { ok: true };
  });
