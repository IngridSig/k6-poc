import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    // Light functional test for QA with static token
    qa_static_token_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 1 },   // Ramp up to 1 user
        { duration: '1m', target: 2 },    // Ramp up to 2 users  
        { duration: '30s', target: 0 },   // Ramp down
      ],
      exec: 'qaStaticTokenTest'
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<10000'],  // 95% of requests under 10s (very relaxed for QA)
    http_req_failed: ['rate<0.3'],       // Error rate under 30% (relaxed for setup verification)
    'group_duration{group:::QA User Workflow}': ['p(95)<20000'], // QA workflow under 20s (relaxed)
  }
};

// Environment configuration for QA
const BASE_URL = __ENV.BASE_URL || 'https://qa-1-api.d.bark.com';
const QA_JWT_TOKEN = __ENV.QA_JWT_TOKEN; // Your pre-generated token

// Test Scenario: QA Environment Workflow with Static Token
export function qaStaticTokenTest() {
  const userId = Math.floor(Math.random() * 100); // Small range for light testing
  
  console.log(`🧪 QA Static Token Test - Testing workflow for user ${userId}`);
  
  // Check if token is provided
  if (!QA_JWT_TOKEN) {
    console.error('❌ QA_JWT_TOKEN environment variable is required');
    console.error('   Set it with: export QA_JWT_TOKEN=your_generated_token');
    console.error('   Or run: QA_JWT_TOKEN=your_token k6 run qa-static-token-test.js');
    return;
  }
  
  console.log(`🔑 Using pre-generated JWT token (length: ${QA_JWT_TOKEN.length} chars)`);
  
  const userHeaders = {
    headers: {
      'Authorization': `Bearer ${QA_JWT_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  group('QA User Workflow', () => {
    // Step 1: Check workflow state
    console.log(`1️⃣ Checking workflow state...`);
    let response = http.get(`${BASE_URL}/workflow-state`, userHeaders);
    check(response, { 
      'QA workflow state status 200': (r) => r.status === 200,
      'QA workflow state status 401 (auth issue)': (r) => r.status === 401,
      'QA workflow state status 403 (permissions)': (r) => r.status === 403,
      'QA workflow state has response': (r) => r.body && r.body.length > 0
    });
    
    if (response.status === 200) {
      console.log(`✅ Workflow state check successful`);
    } else if (response.status === 401) {
      console.error(`🔐 Authentication failed - token may be expired or invalid`);
      console.error(`   Response: ${response.body}`);
    } else if (response.status === 403) {
      console.error(`🚫 Access forbidden - token valid but insufficient permissions`);
      console.error(`   Response: ${response.body}`);
    } else {
      console.error(`❌ Workflow state failed: ${response.status} ${response.body}`);
    }
    
    sleep(1); // Give QA environment time between requests
    
    // Step 2: Submit validated data (only if workflow state worked)
    if (response.status === 200) {
      console.log(`2️⃣ Submitting validated data...`);
      const businessData = {
        business_name: `QA Static Token Test ${userId}`,
        address: "123 QA Test Street, Test City, TS 12345",
        phone: "+1-555-QA1-TEST",
        website: `https://qa-static-test-${userId}.com`,
        business_hours: {
          monday: "9:00 AM - 6:00 PM",
          tuesday: "9:00 AM - 6:00 PM"
        },
        services: ["QA Testing", "Load Testing", "Performance Testing"]
      };
      
      response = http.post(`${BASE_URL}/validated-data`, JSON.stringify(businessData), userHeaders);
      check(response, { 
        'QA validated data status 200': (r) => r.status === 200,
        'QA validated data status 401': (r) => r.status === 401,
        'QA validated data status 403': (r) => r.status === 403,
        'QA validated data returns response': (r) => r.body && r.body.length > 0
      });
      
      if (response.status === 200) {
        console.log(`✅ Validated data submission successful`);
      } else {
        console.error(`❌ Validated data failed: ${response.status} ${response.body}`);
      }
      
      sleep(2); // Extra time for QA environment processing
      
      // Step 3: Submit final profile (only if validated data worked)
      if (response.status === 200) {
        console.log(`3️⃣ Submitting final profile...`);
        const finalProfile = {
          business_name: `QA Static Token Test ${userId}`,
          services_offered: ["QA Testing", "Load Testing"],
          location: "QA Test City, Test State",
          business_description: `QA testing with static token. Business ID: ${userId}`
        };
        
        response = http.post(`${BASE_URL}/submit-final-profile`, JSON.stringify(finalProfile), userHeaders);
        check(response, { 
          'QA final profile status 200': (r) => r.status === 200,
          'QA final profile status 401': (r) => r.status === 401,
          'QA final profile status 403': (r) => r.status === 403,
          'QA final profile returns response': (r) => r.body && r.body.length > 0
        });
        
        if (response.status === 200) {
          console.log(`✅ Final profile submission successful`);
        } else {
          console.error(`❌ Final profile failed: ${response.status} ${response.body}`);
        }
      }
    }
  });
  
  sleep(3); // Longer sleep for QA environment
}

// Health check test for QA environment (no auth needed)
export function qaHealthCheck() {
  console.log(`🏥 Checking QA environment health...`);
  const response = http.get(`${BASE_URL}/health/ready`);
  check(response, {
    'QA health check status 200': (r) => r.status === 200,
    'QA service is ready': (r) => r.body && r.body.includes('ready')
  });
  
  if (response.status === 200) {
    console.log(`✅ QA environment is healthy`);
  } else {
    console.error(`❌ QA environment health check failed: ${response.status}`);
  }
}

export function setup() {
  console.log('🚀 Starting QA Static Token Test');
  console.log('🎯 Purpose: Test QA endpoints with your pre-generated JWT token');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log('🔑 Using your manually generated JWT token');
  console.log('⚡ Light load: Max 2 concurrent users');
  console.log('');
  
  if (!QA_JWT_TOKEN) {
    console.log('❌ No token provided - test will fail');
  } else {
    console.log(`✅ Token provided (${QA_JWT_TOKEN.length} characters)`);
  }
  console.log('');
}

export function teardown(data) {
  console.log('');
  console.log('✅ QA Static Token Test Completed!');
  console.log('📊 This tested your manually generated JWT token with:');
  console.log('   - QA environment endpoints');
  console.log('   - Complete workflow without FusionAuth dependency');
  console.log('   - Real authentication (your actual token)');
  console.log('');
  console.log('🎯 Results:');
  console.log('   - If 200s: Your token works! You can scale up testing');
  console.log('   - If 401s: Token expired or malformed');
  console.log('   - If 403s: Token valid but wrong permissions');
  console.log('   - If 500s: Service issues (not auth related)');
} 