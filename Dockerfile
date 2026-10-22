FROM node:24-alpine

WORKDIR /app
COPY . .
RUN mkdir -p /data /app/uploads && chown -R node:node /data /app/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/portfolio.sqlite
EXPOSE 3000

USER node
CMD ["node", "server.js"]
