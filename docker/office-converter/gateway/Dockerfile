FROM node:20-alpine

WORKDIR /app

COPY server.js .

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

USER node

CMD ["node", "server.js"]
