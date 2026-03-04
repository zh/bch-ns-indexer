FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /data
ENV DB_PATH=/data/bchns.sqlite
EXPOSE 3100
CMD ["node", "index.js"]
