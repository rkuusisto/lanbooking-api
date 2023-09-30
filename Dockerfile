FROM node:18 as base
# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
RUN npm install
# RUN npm ci
# If you are building your code for production
# RUN npm ci --omit=dev

# Bundle app source
COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]

FROM base as production

ENV NODE_PATH=./build

RUN npm run build