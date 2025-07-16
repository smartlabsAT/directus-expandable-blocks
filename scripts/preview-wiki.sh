#!/bin/bash

# Wiki Preview Script
# This script starts a local server to preview the wiki

echo "🚀 Starting Wiki Preview Server..."

# Check if grip is installed
if ! command -v grip &> /dev/null; then
    echo "❌ Grip not found. Installing..."
    pip install grip
fi

# Navigate to wiki directory
cd "$(dirname "$0")/../wiki" || exit

# Start grip server
echo "📖 Opening wiki preview at http://localhost:6419"
echo "Press Ctrl+C to stop the server"

grip