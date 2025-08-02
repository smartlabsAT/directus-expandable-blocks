#!/bin/bash

# Cleanup script for test outputs
# Removes all temporary test and demo outputs

echo "🧹 Cleaning up test outputs..."

# Remove all content from test-output directory
if [ -d "test-output" ]; then
    rm -rf test-output/*
    echo "✅ Cleaned test-output directory"
else
    echo "📁 Creating test-output directory..."
    mkdir -p test-output
fi

# Recreate the directory structure
mkdir -p test-output/{test-results,playwright-report,demo-results,demo-test-results,reports,screenshots,qodana}

# Create .gitkeep files to preserve directory structure
touch test-output/.gitkeep
touch test-output/test-results/.gitkeep
touch test-output/playwright-report/.gitkeep
touch test-output/demo-results/.gitkeep
touch test-output/demo-test-results/.gitkeep
touch test-output/reports/.gitkeep
touch test-output/screenshots/.gitkeep
touch test-output/qodana/.gitkeep

echo "✅ Test output directories cleaned and ready!"
echo ""
echo "Directory structure:"
echo "  test-output/"
echo "  ├── test-results/"
echo "  ├── playwright-report/"
echo "  ├── demo-results/"
echo "  ├── demo-test-results/"
echo "  ├── reports/"
echo "  ├── screenshots/"
echo "  └── qodana/"