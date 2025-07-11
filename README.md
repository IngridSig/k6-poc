# K6 Load Testing for Seller Profile Improvement Service

This repository contains **K6 load testing scripts** for the Seller Profile Improvement Service, covering local development and QA environment testing scenarios.

## 🎯 Overview

The load tests validate:
- **Complete user workflow**: Website scraping → Data validation → Profile generation
- **Individual endpoint performance**: Stress testing specific APIs
- **Authentication systems**: Both local admin tokens and QA environment auth
- **Scalability**: Performance under increasing load (1-50 concurrent users)

## 📁 Files Overview

| File | Purpose | Environment | Use Case |
|------|---------|-------------|----------|
| `authenticated-local-load-test.js` | **Main comprehensive test** | Local | Full performance testing |
| `bff-load-test.js` | Light functional test | Local | Quick workflow verification |
| `qa-static-token-test.js` | QA environment test | QA | Production-like testing |
| `run-authenticated-load-test.sh` | Automated runner | Local | Easy execution |
| `run-light-functional-test.sh` | Quick test runner | Local | Fast verification |

## 🚀 Quick Start

### Prerequisites

1. **Install K6**:
   ```bash
   # macOS
   brew install k6
   
   # Linux/Windows
   # See: https://k6.io/docs/get-started/installation/
   ```

2. **Start Local Service**:
   ```bash
   cd /path/to/seller-profile-improvement-service
   source .env.local && uv run python -m seller_profile_improvement_service.apps.api
   ```

### Run Tests

#### Option 1: Quick Verification (2 minutes)
```bash
./run-light-functional-test.sh
```

#### Option 2: Full Load Testing (7 minutes)
```bash
./run-authenticated-load-test.sh
```

#### Option 3: QA Environment Testing
```bash
QA_JWT_TOKEN="your_qa_token_here" k6 run qa-static-token-test.js
```

## 🔧 Detailed Usage

### Local Environment Testing

#### Light Functional Test (`bff-load-test.js`)
**Purpose**: Quick verification that the workflow works  
**Load**: 1-2 concurrent users  
**Duration**: 2 minutes  
**Endpoints**: `/workflow-state`, `/validated-data`, `/submit-final-profile`

```bash
# Manual run
k6 run bff-load-test.js

# Automated run
./run-light-functional-test.sh
```

#### Comprehensive Load Test (`authenticated-local-load-test.js`)
**Purpose**: Full performance and scalability testing  
**Load**: 0→50 users across 3 scenarios  
**Duration**: 7 minutes  
**Coverage**: Complete workflow + individual endpoints + peak load simulation

```bash
# Manual run
k6 run authenticated-local-load-test.js

# Automated run (recommended)
./run-authenticated-load-test.sh
```

**Test Scenarios**:
1. **Complete Workflow** (0→50 users over 7min): Tests full user journey
2. **Endpoint Stress** (30 users for 3min): Hammers individual endpoints
3. **Peak Load** (20 req/sec for 2min): Simulates traffic bursts

### QA Environment Testing

#### Static Token Test (`qa-static-token-test.js`)
**Purpose**: Test against QA environment with pre-generated token  
**Prerequisites**: Valid QA JWT token  

```bash
# Get your QA token first, then:
export QA_JWT_TOKEN="your_token_here"
k6 run qa-static-token-test.js

# Or inline:
QA_JWT_TOKEN="your_token" k6 run qa-static-token-test.js
```

## 📊 Understanding Results

### Key Metrics to Watch

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| **http_req_failed** | <1% | 1-5% | >5% |
| **http_req_duration p(95)** | <1s | 1-3s | >3s |
| **checks** | >95% | 90-95% | <90% |

### Success Indicators
- ✅ **All thresholds passed**
- ✅ **<1% error rate** 
- ✅ **p(95) response time <1s**
- ✅ **No authentication failures**

### Common Issues

#### 100% Failures + Connection Refused
```
http_req_failed: 100.00%
"connect: connection refused"
```
**Solution**: Service not running. Start the local service first.

#### Authentication Errors (401/403)
```
"status": 401, "Unauthorized"
```
**Solution**: Check admin token or JWT token validity.

#### High Response Times (>5s)
```
http_req_duration p(95): 5000ms+
```
**Solution**: LangGraph API bottleneck. Check external service performance.

## 🏗️ Architecture Tested

### Local Flow
```
K6 Test → Local Service (localhost:8080) → LangGraph API → Response
```

### QA Flow  
```
K6 Test → QA Service (qa-1-api.d.bark.com) → Production APIs → Response
```

### Endpoints Tested

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/health/ready` | GET | Health check | No |
| `/workflow-state` | GET | Check workflow status | Yes |
| `/validated-data` | POST | Submit business data | Yes |
| `/submit-final-profile` | POST | Submit final profile | Yes |
| `/admin/initiate-scrape` | POST | Start website scraping | Yes (Admin) |

## 🔐 Authentication

### Local Testing
Uses simple admin token authentication:
```javascript
headers: { 'X-Admin-Token': 'foobar' }
```

### QA Testing  
Uses JWT Bearer token authentication:
```javascript
headers: { 'Authorization': 'Bearer your_jwt_token' }
```

## 🎛️ Customization

### Modify Load Patterns

Edit the `stages` array in any script:
```javascript
stages: [
  { duration: '1m', target: 10 },   // Ramp to 10 users
  { duration: '2m', target: 25 },   // Scale to 25 users  
  { duration: '1m', target: 0 },    // Ramp down
]
```

### Adjust Thresholds

```javascript
thresholds: {
  http_req_duration: ['p(95)<1000'],    // 95% under 1s
  http_req_failed: ['rate<0.01'],       // <1% errors
  checks: ['rate>0.95'],                // >95% success
}
```

### Test Different Environments

```bash
# Override base URL
BASE_URL=https://staging-api.example.com k6 run qa-static-token-test.js
```

## 🚨 Production Load Testing Guidelines

### Before Running Against Production
1. **Coordinate with team** - Announce load testing schedule
2. **Start small** - Begin with light tests
3. **Monitor dashboards** - Watch Datadog/metrics during tests
4. **Have rollback plan** - Be ready to stop if issues arise

### Scaling Recommendations
1. **Week 1**: Run light tests (2-5 users)
2. **Week 2**: Medium tests (10-25 users)  
3. **Week 3**: Full scale tests (50+ users)
4. **Monitor**: Always watch for bottlenecks

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check if port is in use
lsof -i :8080

# Check environment variables
source .env.local && env | grep -E "(TOKEN|API)"

# Check service logs
cd seller-profile-improvement-service && uv run python -m seller_profile_improvement_service.apps.api
```

### K6 Installation Issues
```bash
# Verify installation
k6 version

# Reinstall if needed
brew uninstall k6 && brew install k6
```

### Token Issues (QA)
- **JWT tokens expire** - Generate a fresh one
- **Wrong format** - Ensure it's a proper JWT (3 parts separated by dots)
- **Wrong claims** - Token might not have required permissions

## 📈 Continuous Integration

### GitHub Actions Example
```yaml
- name: Run Load Tests
  run: |
    cd k6-poc
    ./run-light-functional-test.sh
  env:
    SERVICE_URL: http://localhost:8080
```

## 🤝 Contributing

When modifying tests:
1. **Test locally first** with light load
2. **Update documentation** if changing endpoints
3. **Keep thresholds realistic** for the environment
4. **Add error handling** for new scenarios

## 📞 Support

- **Service Issues**: Check seller-profile-improvement-service logs
- **K6 Issues**: See [K6 Documentation](https://k6.io/docs/)
- **Authentication**: Ask team for QA credentials
- **Performance**: Review bottlenecks in LangGraph/external APIs

---

**Happy Load Testing!** 🚀

*Last Updated: [Current Date]*  
*Tested with: K6 v0.45+, Python 3.12+, UV package manager* 