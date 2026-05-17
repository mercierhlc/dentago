FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Install all deps (including devDeps for tsc), build, then prune
COPY package*.json ./
RUN npm install

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN ./node_modules/.bin/tsc

# Remove devDeps after build
RUN npm prune --omit=dev

# Chromium is already installed in the base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 3100

CMD ["node", "dist/server.js"]
