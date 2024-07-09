# Use the official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Expose port 5173 (default Vite port)
EXPOSE 5173

# Start the development server
CMD ["npm", "run", "dev"]
