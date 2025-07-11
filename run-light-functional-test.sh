#!/bin/bash

echo "🔍 Light Functional Test for BFF Load Test Script"
echo "================================================="

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed. Please install with: brew install k6"
    exit 1
fi

# Check if service is running
echo "🔍 Checking if service is running on localhost:8080..."
if curl -s -f http://localhost:8080/health/ready > /dev/null 2>&1; then
    echo "✅ Service is running!"
else
    echo "❌ Service is not running on localhost:8080"
    echo "   Start the service with:"
    echo "   cd /Users/ingrid.signoretti/projects/seller-profile-improvement-service"
    echo "   source .env.local && uv run python -m seller_profile_improvement_service.apps.api"
    exit 1
fi

# Run the light functional test
echo "🚀 Running light functional test..."
echo "   - Testing with 1-2 users maximum"
echo "   - Using admin token authentication"
echo "   - Testing complete workflow: workflow-state → validated-data → submit-final-profile"
echo ""

k6 run bff-load-test.js

echo ""
echo "✅ Light functional test completed!"
echo "   Check the output above to see if the workflow is working correctly." 