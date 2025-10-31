FROM node:18-alpine

WORKDIR /app

# Copy package.json dan install dependency
COPY package*.json ./
RUN npm ci --omit=dev

# Copy seluruh project
COPY . .

# Jalankan server
CMD ["node", "server.js"]
