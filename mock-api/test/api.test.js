const request = require('supertest');
const express = require('express');
const app = require('../index');

describe('API', () => {
  it('GET /api/categories returns categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
