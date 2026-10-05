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
# Non-root: the local Postgres mode refuses root. Default is still an external DATABASE_URL;
# local mode inside the container needs the runtime first (`bun run server/binary-entry.ts init`).
RUN mkdir -p /app/data && chown bun:bun /app /app/data
COPY --chown=bun:bun --from=build /app/node_modules ./node_modules
COPY --chown=bun:bun --from=build /app/build ./build
COPY --chown=bun:bun --from=build /app/server ./server
COPY --chown=bun:bun --from=build /app/package.json ./package.json
COPY --chown=bun:bun --from=build /app/CHANGELOG.md ./CHANGELOG.md
USER bun
VOLUME /app/data
EXPOSE 3005
CMD ["bun", "run", "server/binary-entry.ts", "start"]
