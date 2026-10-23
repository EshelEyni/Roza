FROM node:current-alpine3.19 AS fe-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY shared/ /shared/
RUN ./node_modules/.bin/tsc --build /shared/tsconfig.json --force
COPY frontend/ .
RUN npm run build

FROM node:current-alpine3.19 AS be-build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY shared/ /shared/
COPY backend/ .
RUN ./node_modules/.bin/tsc --build /app/tsconfig.json --force

FROM node:current-alpine3.19 AS prod
WORKDIR /app
COPY --from=be-build /app/build /app/build
COPY --from=be-build /app/node_modules /app/node_modules
COPY --from=be-build /app/dictionary /app/dictionary
COPY backend/package.json .
COPY --from=fe-build /app/dist /app/build/public
EXPOSE 3030
CMD ["npm", "run", "prod-linux"]
