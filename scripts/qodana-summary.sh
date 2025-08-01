#!/bin/bash
# Extract Qodana Issues Summary

SARIF_FILE=".qodana/qodana.sarif.json"

if [ ! -f "$SARIF_FILE" ]; then
    echo "❌ No SARIF report found. Run 'npm run qodana' first."
    exit 1
fi

echo "🔍 Qodana Issues Summary"
echo "========================"
echo ""

# Show critical issues
echo "🔴 CRITICAL Issues (First 10):"
jq -r '.runs[0].results[] | select(.level == "error") | "\(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine) - \(.message.text)"' "$SARIF_FILE" 2>/dev/null | head -10

echo ""
echo "🟡 HIGH Priority Issues (First 10):"
jq -r '.runs[0].results[] | select(.level == "warning" and .properties.severity == "HIGH") | "\(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine) - \(.message.text)"' "$SARIF_FILE" 2>/dev/null | head -10

echo ""
echo "📊 Issues by Type:"
jq -r '.runs[0].results[].ruleId' "$SARIF_FILE" 2>/dev/null | sort | uniq -c | sort -rn | head -15

echo ""
echo "📁 Files with Most Issues:"
jq -r '.runs[0].results[].locations[0].physicalLocation.artifactLocation.uri' "$SARIF_FILE" 2>/dev/null | sort | uniq -c | sort -rn | head -10