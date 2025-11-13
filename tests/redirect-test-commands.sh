#!/bin/bash

# Redirect Testing Script
# Tests all 301 redirects to ensure proper URL optimization
# Usage: bash tests/redirect-test-commands.sh

echo "🧪 Testing URL Redirect Rules for WhatsApp API Service"
echo "======================================================"
echo ""

# Set base URL (change for production testing)
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test redirect
test_redirect() {
    local from_url=$1
    local expected_to=$2
    local description=$3
    
    echo -n "Testing: $description ... "
    
    # Make request and capture response
    response=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "${BASE_URL}${from_url}")
    
    # Extract status code and redirect URL
    status_code=$(echo $response | cut -d'|' -f1)
    redirect_url=$(echo $response | cut -d'|' -f2)
    
    # Check if 301 redirect
    if [ "$status_code" = "301" ]; then
        # Check if redirects to expected URL
        if [[ "$redirect_url" == *"$expected_to"* ]]; then
            echo -e "${GREEN}✓ PASS${NC}"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAIL${NC} (redirects to: $redirect_url, expected: $expected_to)"
            ((FAILED++))
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (status: $status_code, expected: 301)"
        ((FAILED++))
    fi
}

# Documentation Redirects
echo "📚 Documentation Redirects"
echo "-------------------------"
test_redirect "/api-docs" "/docs/whatsapp-api" "Old API docs to new docs"
test_redirect "/documentation" "/docs/whatsapp-api" "Documentation alias"
test_redirect "/docs" "/docs/whatsapp-api" "Short docs URL"
echo ""

# Pricing Redirects
echo "💰 Pricing Redirects"
echo "-------------------"
test_redirect "/price" "/pricing" "Price to pricing"
test_redirect "/plans" "/pricing" "Plans to pricing"
test_redirect "/subscription" "/pricing" "Subscription to pricing"
echo ""

# Feature Redirects
echo "🎯 Feature Redirects"
echo "-------------------"
test_redirect "/features/bot" "/features/chatbot-builder" "Bot to chatbot-builder"
test_redirect "/features/automation" "/features/whatsapp-automation" "Generic automation"
test_redirect "/chatbot" "/features/whatsapp-chatbot-api" "Direct chatbot link"
echo ""

# Integration Redirects
echo "🔗 Integration Redirects"
echo "-----------------------"
test_redirect "/integration/shopify" "/integrations/shopify-whatsapp" "Singular to plural Shopify"
test_redirect "/shopify" "/integrations/shopify-whatsapp" "Direct Shopify link"
test_redirect "/integration/salesforce" "/integrations/salesforce-whatsapp" "Singular to plural Salesforce"
test_redirect "/salesforce" "/integrations/salesforce-whatsapp" "Direct Salesforce link"
echo ""

# Use Case Redirects
echo "📋 Use Case Redirects"
echo "--------------------"
test_redirect "/use-case/ecommerce" "/use-cases/ecommerce-order-notifications" "Singular to plural ecommerce"
test_redirect "/ecommerce" "/use-cases/ecommerce-order-notifications" "Direct ecommerce link"
test_redirect "/use-case/support" "/use-cases/customer-support-automation" "Singular to plural support"
echo ""

# Authentication Redirects
echo "🔐 Authentication Redirects"
echo "---------------------------"
test_redirect "/signup" "/register" "Signup to register"
test_redirect "/sign-up" "/register" "Sign-up to register"
test_redirect "/signin" "/login" "Signin to login"
test_redirect "/sign-in" "/login" "Sign-in to login"
echo ""

# Support Redirects
echo "❓ Support Redirects"
echo "-------------------"
test_redirect "/faq" "/help" "FAQ to help"
test_redirect "/faqs" "/help" "FAQs to help"
echo ""

# Company Redirects
echo "🏢 Company Redirects"
echo "-------------------"
test_redirect "/about-us" "/about" "About-us to about"
test_redirect "/company" "/about" "Company to about"
test_redirect "/contact-us" "/contact" "Contact-us to contact"
test_redirect "/get-in-touch" "/contact" "Get-in-touch to contact"
echo ""

# Trailing Slash Tests
echo "🔚 Trailing Slash Tests"
echo "----------------------"
test_redirect "/pricing/" "/pricing" "Remove trailing slash"
test_redirect "/about/" "/about" "Remove trailing slash from about"
echo ""

# Case Normalization Tests
echo "🔤 Case Normalization Tests"
echo "--------------------------"
test_redirect "/PRICING" "/pricing" "Uppercase to lowercase"
test_redirect "/About" "/about" "Mixed case to lowercase"
echo ""

# Summary
echo "======================================================"
echo "📊 Test Summary"
echo "======================================================"
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All redirect tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some redirect tests failed. Please review the output above.${NC}"
    exit 1
fi

