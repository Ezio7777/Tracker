const request = require('supertest');
const h = require('./helpers');

beforeAll(h.connect);
afterAll(h.disconnect);
beforeEach(h.clear);

describe('auth', () => {
  const body = { name: 'Test User', email: 'test@example.com', password: 'Password1' };

  it('registers as MEMBER even if a role is sent (no privilege escalation)', async () => {
    const res = await request(h.app).post('/auth/register').send({ ...body, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('MEMBER');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await request(h.app).post('/auth/register').send(body);
    expect((await request(h.app).post('/auth/register').send(body)).status).toBe(409);
    expect((await request(h.app).post('/auth/register').send({ ...body, email: 'b@b.com', password: 'short' })).status).toBe(400);
  });

  it('logs in with valid credentials only', async () => {
    await request(h.app).post('/auth/register').send(body);
    const ok = await request(h.app).post('/auth/login').send({ email: body.email, password: body.password });
    expect(ok.status).toBe(200);
    const bad = await request(h.app).post('/auth/login').send({ email: body.email, password: 'Wrong1234' });
    expect(bad.status).toBe(401);
  });

  it('GET /auth/me requires a valid token', async () => {
    expect((await request(h.app).get('/auth/me')).status).toBe(401);
    expect((await request(h.app).get('/auth/me').set('Authorization', 'Bearer nope')).status).toBe(401);
    const { token, user } = await h.makeUser('MEMBER');
    const res = await h.api(token).get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it('deactivated users are locked out immediately', async () => {
    const { token, user } = await h.makeUser('MEMBER');
    await h.pool.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    expect((await h.api(token).get('/auth/me')).status).toBe(401);
  });

  it('refresh rotates the token and detects reuse', async () => {
    const reg = await request(h.app).post('/auth/register').send(body);
    const cookie = reg.headers['set-cookie'][0].split(';')[0];
    const first = await request(h.app).post('/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    const replay = await request(h.app).post('/auth/refresh').set('Cookie', cookie); // old token again
    expect(replay.status).toBe(401);
  });
});
