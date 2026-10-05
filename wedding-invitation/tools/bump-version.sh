#!/bin/sh
# Stamp every local CSS/JS reference in index.html with ?v=<timestamp>
# so phones (and the LINE in-app browser) fetch fresh files after each change.
# Run this before every deploy.
set -e
cd "$(dirname "$0")/.."
VERSION=$(date +%Y%m%d%H%M)
# -i.bak works with both GNU sed (Git Bash on Windows) and BSD sed (macOS)
sed -E -i.bak "s#(href|src)=\"((css|js)/[a-z-]+\.(css|js))(\?v=[0-9]+)?\"#\1=\"\2?v=${VERSION}\"#g" index.html
rm -f index.html.bak
echo "Stamped css/ and js/ files with v=${VERSION}"
