FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Fichiers donnés à « node » : certains arrivent du Mac en 600 et seraient illisibles sans root.
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
EXPOSE 3000
# Pas de root dans le conteneur (dossier sécurité, R9) : l'utilisateur « node » est fourni par l'image.
USER node
CMD ["node", "dist/main.js"]
