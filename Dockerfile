FROM node:current-alpine3.19 as fe-build
WORKDIR /app
COPY frontend/package.json .
COPY shared/ /shared/
RUN npm install -g typescript
WORKDIR /shared
RUN tsc
WORKDIR /app
RUN npm install
COPY frontend/ .
RUN npm run build 

CMD ["sh"]


FROM node:current-alpine3.19 as be-build
WORKDIR /app
COPY backend/package.json .
RUN npm install
COPY shared/ /shared/
RUN npm install -g typescript
COPY backend/ .
RUN tsc


FROM node:current-alpine3.19 as prod
WORKDIR /app
COPY --from=be-build /app/build /app/build
COPY --from=be-build /app/node_modules /app/node_modules
COPY backend/package.json .
COPY --from=fe-build /app/dist /app/build/public
EXPOSE 3030
CMD ["npm", "run", "prod-linux"]