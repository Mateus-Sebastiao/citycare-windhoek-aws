FROM node:20-slim

# better-sqlite3 needs build tools to compile its native addon on install
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=4000
EXPOSE 4000
VOLUME ["/app/data", "/app/uploads"]

CMD ["node", "src/server.js"]
