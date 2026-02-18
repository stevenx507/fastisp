# Stage 1: Builder
FROM node:20-alpine as builder

WORKDIR /app

# Copy package.json and optionally yarn.lock/package-lock.json for dependency caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend for production
RUN npm run build

# Stage 2: Production (Serve with Nginx)
FROM nginx:stable-alpine as production

# Create a non-root user and group
RUN addgroup -S nginx && adduser -S nginx -G nginx

# Copy the custom Nginx configuration from the build context
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Chown the nginx directories to the new user for logs, etc.
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Create and set permissions for the pid file
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to the non-root user
USER nginx

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]