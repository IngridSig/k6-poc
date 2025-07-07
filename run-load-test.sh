#!/bin/bash

# Load Test Runner for Seller Profile Improvement Service
# Usage: ./run-load-test.sh [environment]
# Environment options: local, qa, staging

set -e

# Default to QA environment
ENVIRONMENT=${1:-qa}

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Environment configurations
case $ENVIRONMENT in
    "local")
        BASE_URL="http://localhost:8080"
        TOKEN_ISSUER_URL="http://localhost:9999/token"
        ;;
    "qa")
        BASE_URL="https://qa-1-api.d.bark.com"
        TOKEN_ISSUER_URL="https://fusionauth-gateway-admin.qa.barkenvs.systems/auth/issue-token"
        ;;
    "staging")
        BASE_URL="https://staging-1-api.d.bark.com"
        TOKEN_ISSUER_URL="https://fusionauth-gateway-admin.qa.barkenvs.systems/auth/issue-token"
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        print_info "Valid environments: local, qa, staging"
        exit 1
        ;;
esac

print_info "Setting up load test for $ENVIRONMENT environment"
print_info "Base URL: $BASE_URL"

# Check required environment variables
if [ -z "$FUSIONAUTH_API_KEY" ]; then
    print_error "FUSIONAUTH_API_KEY environment variable is required"
    print_info "Set it with: export FUSIONAUTH_API_KEY=your_api_key"
    exit 1
fi

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    print_error "k6 is not installed. Please install k6 first:"
    print_info "macOS: brew install k6"
    print_info "Other: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

print_success "Environment variables validated"

# Test health endpoint first
print_info "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/ready" || echo "000")

if [ "$HEALTH_RESPONSE" != "200" ]; then
    print_warning "Health check failed (HTTP $HEALTH_RESPONSE). Service might not be running."
    print_info "Continuing with load test anyway..."
else
    print_success "Health check passed!"
fi

# Run the load test
print_info "Starting K6 load test..."
print_info "Press Ctrl+C to stop the test"

export BASE_URL
export TOKEN_ISSUER_URL
export FUSIONAUTH_API_KEY
export ADMIN_TOKEN

k6 run \
    --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
    --summary-time-unit=ms \
    bff-load-test.js

print_success "Load test completed!" 