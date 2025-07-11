import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    // Light functional test - just verify the workflow works
    user_workflow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 1 },   // Ramp up to 1 user
        { duration: '1m', target: 2 },    // Ramp up to 2 users  
        { duration: '30s', target: 0 },   // Ramp down
      ],
      exec: 'userWorkflowTest'
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // 95% of requests under 5s (relaxed)
    http_req_failed: ['rate<0.2'],      // Error rate under 20% (relaxed)
    'group_duration{group:::User Workflow}': ['p(95)<10000'], // User workflow under 10s (relaxed)
  }
};

// Environment configuration - LOCAL TESTING
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || 'foobar';

// Test Scenario 1: Complete User Workflow (LOCAL VERSION)
export function userWorkflowTest() {
  const userId = Math.floor(Math.random() * 1000);
  const sellerProfileId = `load_test_profile_${userId}`;
  
  // Use admin token for local testing (no FusionAuth)
  const userHeaders = {
    headers: {
      'X-Admin-Token': ADMIN_TOKEN,
      'Content-Type': 'application/json'
    }
  };
  
  group('User Workflow', () => {
    // Step 1: Check workflow state
    console.log(`Testing workflow for user ${userId}`);
    let response = http.get(`${BASE_URL}/workflow-state`, userHeaders);
    check(response, { 
      'workflow state check status 200': (r) => r.status === 200,
      'workflow state has valid response': (r) => r.body && r.body.length > 0
    });
    
    if (response.status !== 200) {
      console.error(`Workflow state failed: ${response.status} ${response.body}`);
    }
    
    // Step 2: Submit validated data
    const businessData = {
      business_name: `Test Business ${userId}`,
      address: "123 Test Street, Test City, TS 12345",
      phone: "+1-555-123-4567",
      website: `https://test-business-${userId}.com`,
      business_hours: {
        monday: "9:00 AM - 6:00 PM",
        tuesday: "9:00 AM - 6:00 PM"
      },
      services: ["Consulting", "Support", "Training"]
    };
    
    response = http.post(`${BASE_URL}/validated-data`, JSON.stringify(businessData), userHeaders);
    check(response, { 
      'validated data status 200': (r) => r.status === 200,
      'validated data returns response': (r) => r.body && r.body.length > 0
    });
    
    if (response.status !== 200) {
      console.error(`Validated data failed: ${response.status} ${response.body}`);
    }
    
    // Step 3: Submit final profile
    const finalProfile = {
      business_name: `Test Business ${userId}`,
      services_offered: ["Consulting", "Support"],
      location: "Test City, Test State",
      business_description: `Professional services company specializing in consulting and support. Business ID: ${userId}`
    };
    
    response = http.post(`${BASE_URL}/submit-final-profile`, JSON.stringify(finalProfile), userHeaders);
    check(response, { 
      'final profile status 200': (r) => r.status === 200,
      'final profile returns response': (r) => r.body && r.body.length > 0
    });
    
    if (response.status !== 200) {
      console.error(`Final profile failed: ${response.status} ${response.body}`);
    }
  });
  
  sleep(2); // Longer sleep for lighter testing
}

// Health check test (can be used for warm-up)
export function healthCheck() {
  const response = http.get(`${BASE_URL}/health/ready`);
  check(response, {
    'health check status 200': (r) => r.status === 200,
    'service is ready': (r) => r.body && r.body.includes('ready')
  });
}
