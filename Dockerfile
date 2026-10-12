# Production container for Campus Placement Management System
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 4000

ENV NODE_ENV=production \
    PORT=4000

CMD ["node", "server.js"]
