# Stage 1: Build the frontend application
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Set up the Nginx server
FROM nginx:1.25-alpine AS server


# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend assets from the builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
