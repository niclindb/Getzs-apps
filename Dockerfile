FROM node:18-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

# Copy configuration files first
COPY .env .env
COPY shopify.app.production.toml shopify.app.toml
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev && npm cache clean --force
# Remove CLI packages since we don't need them in production
RUN npm remove @shopify/cli

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Start the application
CMD ["npm", "run", "docker-start"]
