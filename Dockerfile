# Makuro production image (single port).
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Cache of the embedded Postgres/RustFS binaries. Inside /app rather than $HOME so the
# `embedded` stage can bake it in; without it every new container re-downloads them.
ENV XDG_CACHE_HOME=/app/.cache
# Non-root: the local Postgres mode refuses root.
RUN mkdir -p /app/data /app/.cache && chown bun:bun /app /app/data /app/.cache
COPY --chown=bun:bun --from=build /app/node_modules ./node_modules
COPY --chown=bun:bun --from=build /app/build ./build
COPY --chown=bun:bun --from=build /app/server ./server
COPY --chown=bun:bun --from=build /app/package.json ./package.json
COPY --chown=bun:bun --from=build /app/CHANGELOG.md ./CHANGELOG.md
USER bun
VOLUME /app/data
EXPOSE 3005
CMD ["bun", "run", "server/binary-entry.ts", "start"]

# Default target: Postgres + RustFS binaries already downloaded, so a fresh container
# boots without network. `--target runtime` gives the slim image for an external
# DATABASE_URL/S3_ENDPOINT. Either image still picks its mode from those env vars.
FROM runtime AS embedded
RUN bun -e "await (await import('/app/server/local-pg/runtime.ts')).ensureRuntime(); await (await import('/app/server/local-s3/runtime.ts')).ensureS3Runtime()"
