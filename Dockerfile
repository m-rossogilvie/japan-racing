FROM node:22-alpine

WORKDIR /app

COPY package.json server.js ./
COPY lib ./lib
COPY data ./data
COPY public ./public

ENV NODE_ENV=production
EXPOSE 8080

USER node

CMD ["node", "server.js"]
