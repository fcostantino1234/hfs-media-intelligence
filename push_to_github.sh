#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "========================================================"
echo "🚀 Pushing HFS Media & Leads Intelligence Suite to GitHub"
echo "Repository: https://github.com/fcostantino1234/hfs-media-intelligence.git"
echo "========================================================"
echo ""

git push -u origin main

echo ""
echo "========================================================"
echo "✅ Successfully pushed to GitHub!"
echo ""
echo "👉 Next Step: Enable GitHub Pages in 30 seconds:"
echo "1. Open: https://github.com/fcostantino1234/hfs-media-intelligence/settings/pages"
echo "2. Under 'Build and deployment' -> 'Branch':"
echo "   Select: 'main' and folder '/ (root)'"
echo "3. Click 'Save'!"
echo ""
echo "🌐 Your live URL will be active at:"
echo "   https://fcostantino1234.github.io/hfs-media-intelligence/"
echo "========================================================"
