# Works on Render, Railway, Fly.io, or a plain VPS (docker run).
FROM node:22-slim AS build
WORKDIR /app

# Vite bakes VITE_-prefixed env vars into the JS bundle at BUILD time (when
# `npm run build` runs below) — NOT at container-run time. A plain Docker
# `ENV`/dashboard env var set on the platform is normally only injected into
# the running container, so without this explicit ARG, `npm run build` never
# sees it and the deployed app silently ends up with no Maps key.
#
# On platforms that auto-map dashboard "Environment Variables" to matching
# build args for Docker services (Render does this — see your service's
# Environment tab), this ARG picks that value up automatically at build
# time. If your platform does NOT do this, pass it explicitly instead:
#   docker build --build-arg VITE_GOOGLE_MAPS_API_KEY=your_key .
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
