import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    // End-to-end user workflow test
    user_workflow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Ramp up to 10 users
        { duration: '2m', target: 25 },   // Ramp up to 25 users  
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      exec: 'userWorkflowTest'
    },
    
    // Admin bulk operations test
    admin_bulk: {
      executor: 'constant-arrival-rate',
      rate: 5,           // 5 requests per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 10,
      exec: 'adminBulkTest'
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95% of requests under 3s
    http_req_failed: ['rate<0.1'],      // Error rate under 10%
    'group_duration{group:::User Workflow}': ['p(95)<5000'], // User workflow under 5s
  }
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'https://qa-1-api.d.bark.com';
const FUSIONAUTH_API_KEY = __ENV.FUSIONAUTH_API_KEY;
const TOKEN_ISSUER_URL = __ENV.TOKEN_ISSUER_URL || 'https://fusionauth-gateway-admin.qa.barkenvs.systems/auth/issue-token';

// Generate JWT Token for user authentication
function generateJWTToken(userId, sellerProfileId) {
  const tokenPayload = {
    claims: {
      spfid: sellerProfileId,  // seller profile ID
      brkuid: userId          // user ID  
    },
    expires_in: 3600
  };
  
  const response = http.post(
    TOKEN_ISSUER_URL,
    JSON.stringify(tokenPayload),
    {
      headers: {
        'api-key': FUSIONAUTH_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.status !== 200) {
    console.error(`Failed to generate JWT token: ${response.status} ${response.body}`);
    return null;
  }
  
  return JSON.parse(response.body).token;
}

// Test Scenario 1: Complete User Workflow
export function userWorkflowTest() {
  const userId = Math.floor(Math.random() * 10000);
  const sellerProfileId = `load_test_profile_${userId}`;
  
  // Generate JWT token for this user
  const jwtToken = generateJWTToken(userId, sellerProfileId);
  if (!jwtToken) {
    console.error('Failed to generate JWT token, skipping user workflow test');
    return;
  }
  
  const userHeaders = {
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  group('User Workflow', () => {
    // Step 1: Check workflow state
    let response = http.get(`${BASE_URL}/workflow-state`, userHeaders);
    check(response, { 
      'workflow state check status 200': (r) => r.status === 200,
      'workflow state has valid response': (r) => r.body.includes('status')
    });
    
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
      'validated data returns profile': (r) => r.body.includes('status')
    });
    
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
      'final profile accepted': (r) => r.body.includes('success') || r.body.includes('status')
    });
  });
  
  sleep(1);
}

// Health check test (can be used for warm-up)
export function healthCheck() {
  const response = http.get(`${BASE_URL}/health/ready`);
  check(response, {
    'health check status 200': (r) => r.status === 200,
    'service is ready': (r) => r.body.includes('ready')
  });
}
