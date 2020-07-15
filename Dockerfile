FROM node:12

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# ENV HOST=0.0.0.0 PORT=9000

EXPOSE ${PORT}

CMD [ "npm", "start" ]
