const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');

let mongod;
const PASSWORD = 'Password1';

const connect = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};
const disconnect = async () => {
  await mongoose.disconnect();
  await mongod.stop();
};
const clear = async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
};

async function makeUser(role, name = role.toLowerCase()) {
  const email = `${name}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
  const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(PASSWORD, 4) });
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  return { user, email, token: res.body.data.accessToken };
}

// auth('Bearer token') helper: api(token).get('/path')
const api = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

module.exports = { app, connect, disconnect, clear, makeUser, api, PASSWORD };
