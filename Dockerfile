# Stage 1: Build the frontend application
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Set up the Nginx server
FROM nginx:1.25-alpine AS server

# Install Brotli for on-the-fly compression
RUN apk add --no-cache nginx-mod-brotli

# Load Brotli modules in the main nginx.conf
RUN sed -i '1s/^/load_module \/usr\/lib\/nginx\/modules\/ngx_http_brotli_filter_module.so;\nload_module \/usr\/lib\/nginx\/modules\/ngx_http_brotli_static_module.so;\n/' /etc/nginx/nginx.conf

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend assets from the builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Nginx runs as non-root by default (nginx user)
USER nginx