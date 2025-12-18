#!/bin/bash
set -e

# TribunalCraft SDK Publish Script
# Usage: ./scripts/publish-sdk.sh [patch|minor|major]

VERSION_BUMP=${1:-patch}

# Validate version bump
if [[ "$VERSION_BUMP" != "patch" && "$VERSION_BUMP" != "minor" && "$VERSION_BUMP" != "major" ]]; then
    echo "Error: Invalid version bump. Use 'patch', 'minor', or 'major'"
    exit 1
fi

echo "=== TribunalCraft SDK Publish ==="
echo "Version bump: $VERSION_BUMP"
echo ""

# Navigate to SDK directory
cd "$(dirname "$0")/../packages/sdk"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "Warning: You have uncommitted changes."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Publish cancelled."
        exit 1
    fi
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Bump version
npm version "$VERSION_BUMP" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

# Build
echo ""
echo "Building SDK..."
yarn build

# Run type check
echo ""
echo "Running type check..."
yarn typecheck

# Publish
echo ""
echo "Publishing to npm..."
npm publish --access public

echo ""
echo "=== Publish Complete ==="
echo "Published @tribunalcraft/sdk@$NEW_VERSION"
echo ""
echo "Next steps:"
echo "  1. Commit version bump: git add . && git commit -m 'chore: bump sdk to v$NEW_VERSION'"
echo "  2. Create git tag: git tag v$NEW_VERSION"
echo "  3. Push: git push && git push --tags"
