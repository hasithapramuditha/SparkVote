# --- Frontend build stage ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# --- Backend build stage ---
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --production
COPY backend/ .

# --- Production image ---
FROM node:20-alpine AS production
WORKDIR /app

# Copy backend
COPY --from=backend-build /app/backend ./backend

# Copy frontend build to backend/public (or serve with nginx)
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Install Nginx for static frontend
RUN apk add --no-cache nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Set environment variables
ENV NODE_ENV=production

# Expose ports: 80 for frontend, 5000 for backend
EXPOSE 80 3000

# Start both backend and nginx
CMD ["sh", "-c", "node ./backend/server.js & nginx -g 'daemon off;'"] 