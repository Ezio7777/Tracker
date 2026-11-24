const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');
const userRepository = require('../src/repositories/userRepository');

const PASSWORD = 'Password1';

// Every test file starts from empty tables.
const connect = () =>
  pool.query(`TRUNCATE TABLE notifications, work_item_history, comments, work_items,
              project_members, projects, refresh_tokens, users CASCADE`);
const clear = connect;
const disconnect = () => pool.end();

async function makeUser(role, name = role.toLowerCase()) {
  const email = `${name}-${Math.random().toString(36).slice(2, 8)}@test.dev`.toLowerCase();
  const user = await userRepository.insert({ name, email, passwordHash: await bcrypt.hash(PASSWORD, 4), role });
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  return { user, email, token: res.body.data.accessToken };
}

// api(token).get('/path') sends the request with that user's token
const api = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

module.exports = { app, pool, connect, disconnect, clear, makeUser, api, PASSWORD };
