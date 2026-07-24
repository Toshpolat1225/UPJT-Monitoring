import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 200 }, // Ramp-up to 200 users over 2 minutes
    { duration: '5m', target: 200 }, // Stay at 200 users for 5 minutes
    { duration: '2m', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    http_req_duration: ['p(95)<500', 'p(99)<1500'], // 95% of requests must complete below 500ms
  },
};

const API_BASE_URL = 'http://localhost:8000/api/v1';

export default function () {
  // 1. Login to get a token (in a real test, you'd do this once per VU)
  const loginRes = http.post(`${API_BASE_URL}/auth/token`, {
    username: 'admin@example.com',
    password: 'adminpassword',
  });

  check(loginRes, { 'login successful': (r) => r.status === 200 });
  const authToken = loginRes.json('access_token');

  if (authToken) {
    const params = {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    };

    // 2. Hit a protected endpoint (e.g., health check)
    const res = http.get(`${API_BASE_URL}/health/database`, params);
    check(res, { 'database health is 200': (r) => r.status === 200 });
  }

  sleep(1);
}