import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50, // 50 virtual users
  duration: '2m', // for 2 minutes
};

const BASE_URL = __ENV.BASE_URL;
const TOKEN = __ENV.TOKEN;

export default function () {
  const headers = {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.get(`${BASE_URL}/v1/some-endpoint`, headers);

  check(res, {
    'is status 200': (r) => r.status === 200,
  });

  sleep(1); // simulate pacing between requests
}
