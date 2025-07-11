import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    // Full end-to-end workflow test
    complete_workflow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Ramp up to 10 users
        { duration: '2m', target: 25 },   // Ramp up to 25 users
        { duration: '2m', target: 50 },   // Ramp up to 50 users  
        { duration: '1m', target: 25 },   // Scale down
        { duration: '1m', target: 0 },    // Ramp down
      ],
      exec: 'fullWorkflowTest'
    },
    
    // High-volume individual endpoint testing
    endpoint_stress: {
      executor: 'constant-vus',
      vus: 30,
      duration: '3m',
      exec: 'endpointStressTest'
    },
    
    // Peak load simulation
    peak_load: {
      executor: 'constant-arrival-rate',
      rate: 20,           // 20 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'peakLoadTest'
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<5000'],     // 95% under 5s (LangGraph can be slow)
    http_req_failed: ['rate<0.1'],         // Error rate under 10%
    'group_duration{group:::Full Workflow}': ['p(95)<15000'], // Full workflow under 15s
    'group_duration{group:::Admin Operations}': ['p(95)<3000'],
    'group_duration{group:::User Operations}': ['p(95)<8000'],
    checks: ['rate>0.9'],                  // 90% success rate
  },
};

const BASE_URL = 'http://localhost:8080';
const ADMIN_TOKEN = 'foobar';  // From .env.local ADMIN_AUTH_TOKEN

const ADMIN_HEADERS = {
  'Authorization': `Bearer ${ADMIN_TOKEN}`,
  'Content-Type': 'application/json'
};

// Test data
const TEST_WEBSITES = [
  'https://www.bristolpersonaltrainer.com/',
  'https://example.com',
  'https://google.com',
  'https://github.com'
];

export function fullWorkflowTest() {
  const sellerProfileId = `load_test_${Math.random().toString(36).substr(2, 9)}`;
  const userId = Math.floor(Math.random() * 10000) + 1000;
  const website = TEST_WEBSITES[Math.floor(Math.random() * TEST_WEBSITES.length)];
  
  group('Full Workflow', () => {
    // Step 1: Initiate scrape
    group('1. Initiate Scrape', () => {
      const scrapePayload = {
        seller_profile_id: sellerProfileId,
        user_id: userId.toString(),
        category: 'Personal Trainer',
        url: website
      };
      
      const scrapeResp = http.post(
        `${BASE_URL}/admin/initiate-scrape`,
        JSON.stringify(scrapePayload),
        { headers: ADMIN_HEADERS }
      );
      
      check(scrapeResp, {
        'scrape initiation status is 200': (r) => r.status === 200,
        'scrape response time < 3s': (r) => r.timings.duration < 3000,
        'scrape response contains status': (r) => r.body && r.body.includes('status'),
      });
      
      if (scrapeResp.status !== 200) {
        console.log(`Scrape failed: ${scrapeResp.status} - ${scrapeResp.body}`);
        return; // Skip rest of workflow if scrape fails
      }
    });
    
    sleep(1); // Brief pause between workflow steps
    
    // Step 2: Check workflow state
    group('2. Check Workflow State', () => {
      const stateResp = http.get(
        `${BASE_URL}/workflow-state?seller_profile_id=${sellerProfileId}`,
        { headers: ADMIN_HEADERS }
      );
      
      check(stateResp, {
        'workflow state status is 200': (r) => r.status === 200,
        'workflow state response time < 2s': (r) => r.timings.duration < 2000,
        'workflow state contains data': (r) => r.body && r.body.length > 0,
      });
    });
    
    sleep(0.5);
    
    // Step 3: Submit validated data (simplified)
    group('3. Submit Validated Data', () => {
      const validatedData = {
        seller_profile_id: sellerProfileId,
        business_name: 'Test Business',
        services_offered: ['Personal Training', 'Fitness Coaching'],
        location: 'Bristol, UK'
      };
      
      const validatedResp = http.post(
        `${BASE_URL}/validated-data`,
        JSON.stringify(validatedData),
        { headers: ADMIN_HEADERS }
      );
      
      check(validatedResp, {
        'validated data status is 200 or 202': (r) => [200, 202].includes(r.status),
        'validated data response time < 5s': (r) => r.timings.duration < 5000,
      });
    });
    
    sleep(1);
    
    // Step 4: Submit final profile
    group('4. Submit Final Profile', () => {
      const finalProfile = {
        seller_profile_id: sellerProfileId,
        business_name: 'Test Business Final',
        services_offered: ['Personal Training', 'Fitness Coaching'],
        location: 'Bristol, UK',
        business_description: 'Professional fitness services'
      };
      
      const finalResp = http.post(
        `${BASE_URL}/submit-final-profile`,
        JSON.stringify(finalProfile),
        { headers: ADMIN_HEADERS }
      );
      
      check(finalResp, {
        'final profile submission status is 200 or 202': (r) => [200, 202].includes(r.status),
        'final profile response time < 3s': (r) => r.timings.duration < 3000,
      });
    });
  });
}

export function endpointStressTest() {
  const sellerProfileId = `stress_test_${Math.random().toString(36).substr(2, 9)}`;
  
  // Randomly test different endpoints
  const endpoints = [
    { 
      name: 'health_check',
      method: 'GET',
      url: '/health/ready',
      headers: {},
      expectedStatus: 200
    },
    {
      name: 'workflow_state', 
      method: 'GET',
      url: `/workflow-state?seller_profile_id=${sellerProfileId}`,
      headers: ADMIN_HEADERS,
      expectedStatus: 200
    },
    {
      name: 'docs',
      method: 'GET', 
      url: '/docs',
      headers: {},
      expectedStatus: 200
    }
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  group(`Endpoint Stress - ${endpoint.name}`, () => {
    let resp;
    if (endpoint.method === 'GET') {
      resp = http.get(`${BASE_URL}${endpoint.url}`, { headers: endpoint.headers });
    }
    
    check(resp, {
      [`${endpoint.name} status is ${endpoint.expectedStatus}`]: (r) => r.status === endpoint.expectedStatus,
      [`${endpoint.name} response time < 2s`]: (r) => r.timings.duration < 2000,
    });
  });
  
  sleep(0.1); // High frequency testing
}

export function peakLoadTest() {
  // Simulate realistic peak traffic patterns
  group('Peak Load', () => {
    const healthResp = http.get(`${BASE_URL}/health/ready`);
    check(healthResp, {
      'peak load health check OK': (r) => r.status === 200,
      'peak load response < 1s': (r) => r.timings.duration < 1000,
    });
  });
}

export function teardown(data) {
  console.log('🎯 Authenticated Load Test Completed!');
  console.log('📊 This tested the FULL seller-profile-improvement-service workflow');
  console.log('🔑 Including authentication, scraping, data validation, and profile submission');
  console.log('🚀 Check the results above for performance bottlenecks');
  console.log('💡 Pay attention to LangGraph API calls - they are likely the slowest part');
} 