#!/bin/bash
# Local Qodana Analysis Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Running Qodana Analysis Locally...${NC}"
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker.${NC}"
    exit 1
fi

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Create results directory
mkdir -p "$PROJECT_ROOT/test-output/qodana"

echo -e "${YELLOW}📦 Pulling Qodana image...${NC}"
docker pull jetbrains/qodana-js:2023.3

echo -e "${YELLOW}🚀 Running analysis...${NC}"
echo ""

# Copy qodana config files to project root for Docker to find them
cp "$PROJECT_ROOT/config/qodana.yaml" "$PROJECT_ROOT/qodana.yaml" 2>/dev/null || true
cp "$PROJECT_ROOT/config/qodana-baseline.sarif" "$PROJECT_ROOT/qodana-baseline.sarif" 2>/dev/null || true

# Run with or without token
if [ -n "$QODANA_TOKEN" ]; then
    echo -e "${GREEN}✓ Using Qodana Cloud token${NC}"
    docker run --rm \
        -v "$PROJECT_ROOT:/data/project/" \
        -v "$PROJECT_ROOT/test-output/qodana:/data/results/" \
        -e QODANA_TOKEN="$QODANA_TOKEN" \
        -p 8080:8080 \
        jetbrains/qodana-js:2023.3 \
        --show-report
else
    echo -e "${YELLOW}⚠️  Running without Qodana Cloud (Community mode)${NC}"
    docker run --rm \
        -v "$PROJECT_ROOT:/data/project/" \
        -v "$PROJECT_ROOT/test-output/qodana:/data/results/" \
        -p 8080:8080 \
        jetbrains/qodana-js:2023.3 \
        --show-report
fi

echo ""
echo -e "${BLUE}📊 Report available at: http://localhost:8080${NC}"
echo "Press Ctrl+C to stop the report server."

# Cleanup function to remove temporary files
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
    rm -f "$PROJECT_ROOT/qodana.yaml" 2>/dev/null || true
    rm -f "$PROJECT_ROOT/qodana-baseline.sarif" 2>/dev/null || true
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Set trap to cleanup on exit
trap cleanup EXIT