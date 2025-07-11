#!/bin/bash

# Authenticated Load Test Runner for Seller Profile Improvement Service
# This tests the FULL authenticated workflow including LangGraph API calls

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if service is running
print_info "Checking if seller-profile-improvement-service is running on localhost:8080..."
if ! curl -s http://localhost:8080/health/ready > /dev/null; then
    print_error "Service is not running on localhost:8080"
    print_info "Please start the service first:"
    print_info "  cd /Users/ingrid.signoretti/projects/seller-profile-improvement-service"
    print_info "  source .env.local && uv run python -m seller_profile_improvement_service.apps.api"
    exit 1
fi

print_success "Service is running and responding to health checks"

# Display test information
echo ""
print_info "🚀 Starting Authenticated Load Test"
print_info "📋 Test Configuration:"
echo "   • Target: http://localhost:8080"
echo "   • Authentication: Admin token (Bearer foobar)"
echo "   • Max Virtual Users: 50"
echo "   • Test Duration: ~7 minutes"
echo "   • Scenarios: Full Workflow + Stress Testing + Peak Load"
echo ""
print_info "🎯 What this tests:"
echo "   • Complete user workflow (scrape → validate → submit)"
echo "   • Authentication and authorization"
echo "   • LangGraph API performance"
echo "   • Database operations under load"
echo "   • System resource utilization"
echo ""

# Ask for confirmation
read -p "Continue with load test? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Test cancelled"
    exit 0
fi

# Run the load test
print_info "🔥 Starting load test..."
print_warning "Monitor system resources (CPU, memory) in another terminal during the test"
echo ""

if k6 run authenticated-local-load-test.js; then
    echo ""
    print_success "🎉 Load test completed successfully!"
    print_info "📊 Key metrics to analyze:"
    echo "   • http_req_duration: Check 95th percentile response times"
    echo "   • http_req_failed: Should be < 10%"
    echo "   • Group durations: Identify workflow bottlenecks"
    echo "   • Checks: Should be > 90% success rate"
    echo ""
    print_info "💡 Performance tuning tips:"
    echo "   • If LangGraph calls are slow → Consider caching or async processing"
    echo "   • If database calls are slow → Check connection pooling"
    echo "   • If memory usage is high → Look for memory leaks in business logic"
    echo "   • If CPU usage is high → Consider horizontal scaling"
else
    print_error "Load test failed or was interrupted"
    exit 1
fi 