# Stage 1: Use an official Node.js runtime as a parent image
# Using a specific version like '20-alpine' is recommended for smaller size and consistency.
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to leverage Docker's build cache.
# This step is separated so 'npm install' only runs again if dependencies change.
COPY package*.json ./

# Install application dependencies using 'npm ci' which is faster and more reliable for builds
RUN npm ci --only=production

# Copy the rest of your application source code into the container
COPY . .

# Your server.js file listens on port 3000, so expose it from the container
EXPOSE 3000

# Define the command to run your application when the container starts
CMD [ "node", "server.js" ]