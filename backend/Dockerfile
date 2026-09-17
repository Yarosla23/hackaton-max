FROM node:22.15.0-alpine3.21

WORKDIR /workspace

COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm install

COPY backend backend
COPY packages/contracts packages/contracts

WORKDIR /workspace/backend

EXPOSE 8000

CMD ["npm", "run", "dev"]
