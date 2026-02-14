FROM node:20-alpine

WORKDIR /app

# 依赖
COPY package.json ./
RUN npm install

# 应用代码
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
