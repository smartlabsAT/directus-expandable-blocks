#!/bin/bash
# Filter Qodana results to show only real issues (not Vue 3 false positives)

SARIF_FILE="${1:-test-output/qodana/qodana.sarif.json}"

if [ ! -f "$SARIF_FILE" ]; then
    echo "❌ No Qodana results found at $SARIF_FILE"
    echo "Run 'npm run qodana' first"
    exit 1
fi

echo "🔍 Filtering Qodana Real Issues"
echo "================================"
echo ""

# Count total issues
TOTAL=$(jq '.runs[0].results | length' "$SARIF_FILE")
echo "Total issues found: $TOTAL"
echo ""

# Filter out Vue 3 false positives
echo "🚨 Real Issues (excluding Vue 3 false positives):"
echo ""

# Get issues that are NOT Vue 3 import related
jq -r '
  .runs[0].results[] | 
  select(
    .ruleId != "TypeScriptCheckImport" and
    .ruleId != "TypeScriptUnresolvedReference" and
    .ruleId != "ES6PreferShortImport" and
    .ruleId != "RegExpRedundantEscape" and
    (.locations[0].physicalLocation.artifactLocation.uri | test("\\.vue$") | not or .ruleId != "ES6UnusedImports")
  ) |
  "\(.ruleId): \(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine) - \(.message.text)"
' "$SARIF_FILE" | head -20

echo ""
echo "📊 Real Issues by Type:"
jq -r '
  .runs[0].results[] | 
  select(
    .ruleId != "TypeScriptCheckImport" and
    .ruleId != "TypeScriptUnresolvedReference" and
    .ruleId != "ES6PreferShortImport" and
    .ruleId != "RegExpRedundantEscape"
  ) |
  .ruleId
' "$SARIF_FILE" | sort | uniq -c | sort -rn | head -10

echo ""
echo "📁 Files with Real Issues:"
jq -r '
  .runs[0].results[] | 
  select(
    .ruleId != "TypeScriptCheckImport" and
    .ruleId != "TypeScriptUnresolvedReference" and
    .ruleId != "ES6PreferShortImport" and
    .ruleId != "RegExpRedundantEscape"
  ) |
  .locations[0].physicalLocation.artifactLocation.uri
' "$SARIF_FILE" | sort | uniq -c | sort -rn | head -10

# Count real issues
REAL_ISSUES=$(jq '
  [.runs[0].results[] | 
  select(
    .ruleId != "TypeScriptCheckImport" and
    .ruleId != "TypeScriptUnresolvedReference" and
    .ruleId != "ES6PreferShortImport" and
    .ruleId != "RegExpRedundantEscape"
  )] | length
' "$SARIF_FILE")

echo ""
echo "✅ Summary:"
echo "- Total issues: $TOTAL"
echo "- False positives filtered: $((TOTAL - REAL_ISSUES))"
echo "- Real issues remaining: $REAL_ISSUES"

if [ "$REAL_ISSUES" -lt 50 ]; then
    echo ""
    echo "🎉 Code quality is GOOD! (< 50 real issues)"
    exit 0
else
    echo ""
    echo "⚠️  Consider fixing the remaining issues"
    exit 1
fi