FROM node:20-alpine
WORKDIR /app
COPY server.mjs ./
CMD ["node", "server.mjs"]
