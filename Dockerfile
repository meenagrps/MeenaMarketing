# Use the official Puppeteer image which includes Node.js and Google Chrome
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to copy files, install dependencies, and set permissions
USER root

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install NPM dependencies
COPY package*.json ./
RUN npm install

# Copy your server.js and all other project files (marketing.js, JSONs, etc.)
COPY . .

# CRITICAL FIX: Grant the container permissions to write the Baileys session folder 
# and QR code files to the disk without throwing an EACCES (permission denied) error
RUN chown -R pptruser:pptruser /app

# Switch back to the safe, non-root user provided by the Puppeteer image
USER pptruser

# Expose port 7860 for your Express QR dashboard
EXPOSE 7860

# Start the bot
CMD ["npm", "start"]
