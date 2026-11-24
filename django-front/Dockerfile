# Use an official Node.js runtime as a parent image
FROM node:22-alpine AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the frontend application's code
COPY . .

# Build the application
RUN npm run build

# Final image
FROM nginx:1.27-alpine

# Copy the built application from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the port the app runs on
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
