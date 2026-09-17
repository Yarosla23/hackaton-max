FROM node:22.15.0-alpine3.21

WORKDIR /workspace

COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm install

COPY frontend frontend
COPY packages/contracts packages/contracts

WORKDIR /workspace/frontend

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
