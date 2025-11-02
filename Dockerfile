FROM node:18-alpine

WORKDIR /app

# Copy package.json dan install dependency
COPY package*.json ./
RUN npm ci --omit=dev

# Copy seluruh project
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Jalankan server
CMD ["node", "server.js"]
