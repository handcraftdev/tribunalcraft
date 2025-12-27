# Contributing to ScaleCraft

## Project Structure

```
scalecraft/
├── programs/scalecraft/   # Solana program (Rust)
├── packages/sdk/             # TypeScript SDK
├── app/                      # Next.js frontend
└── scripts/                  # Deployment scripts
```

## Development Setup

```bash
# Install dependencies
yarn install

# Build SDK
cd packages/sdk && yarn build

# Run frontend locally
cd app && yarn dev

# Run program tests
anchor test
```

## Git Workflow

### Branch Naming

```
feature/short-description   # New features
fix/short-description       # Bug fixes
docs/short-description      # Documentation
refactor/short-description  # Code refactoring
```

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   Commit message prefixes:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

3. **Push and create Pull Request**
   ```bash
   git push -u origin feature/my-feature
   gh pr create
   ```

4. **Wait for CI checks to pass**
   - Program builds and tests
   - SDK type checks and builds
   - Frontend lints and builds

5. **Merge after review**
   - Frontend auto-deploys to Vercel on merge to `main`

## Versioning

We use [Semantic Versioning](https://semver.org/):

```
vMAJOR.MINOR.PATCH

PATCH - Bug fixes (backwards compatible)
MINOR - New features (backwards compatible)
MAJOR - Breaking changes
```

### Version Examples

| Change | Version Bump | Example |
|--------|--------------|---------|
| Fix escrow calculation bug | PATCH | `v0.1.0` → `v0.1.1` |
| Add appeal feature | MINOR | `v0.1.1` → `v0.2.0` |
| Change dispute structure | MAJOR | `v0.2.0` → `v1.0.0` |

## Release Process

### SDK Release

1. Ensure all changes are merged to `main`
2. Create and push a version tag:
   ```bash
   git checkout main
   git pull origin main
   git tag v0.2.0
   git push --tags
   ```
3. GitHub Actions automatically publishes to npm

### Program Release

1. Test on devnet first:
   - Go to GitHub → Actions → "Deploy Program"
   - Select `devnet`, run workflow

2. Deploy to mainnet (when ready):
   - Go to GitHub → Actions → "Deploy Program"
   - Select `mainnet`, run workflow
   - Check "Initialize protocol" if first deployment

### Frontend Release

Automatic! Merging to `main` triggers Vercel deployment.

## Release Coordination

When making changes that span multiple components:

### Scenario: New Feature (e.g., adding Appeals)

```
1. Program changes
   └── Deploy to devnet, test thoroughly

2. SDK changes
   └── Update types, add new methods
   └── Tag and release (v0.x.0)

3. Frontend changes
   └── Update to new SDK version
   └── Merge to main (auto-deploys)

4. When stable
   └── Deploy program to mainnet
```

### Scenario: Bug Fix

```
1. Fix in relevant component
2. If SDK affected: bump PATCH version
3. Merge to main
4. If program affected: redeploy to devnet/mainnet
```

## Environment Guide

| Environment | Program | Frontend | Purpose |
|-------------|---------|----------|---------|
| Localnet | `anchor test` | `yarn dev` | Local development |
| Devnet | Deployed | Preview URL | Testing & staging |
| Mainnet | Deployed | Production URL | Live production |

## Scripts Reference

```bash
# Deploy program (local)
./scripts/deploy-program.sh devnet|mainnet

# Initialize protocol
npx ts-node scripts/init-protocol.ts devnet|mainnet [treasury]

# Publish SDK (local)
./scripts/publish-sdk.sh patch|minor|major

# Deploy frontend (local)
cd app && vercel --prod
```

## CI/CD Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| CI | Push/PR to main | Run tests |
| Deploy Program | Manual | Deploy to devnet/mainnet |
| Publish SDK | Tag `v*` | Publish to npm |
| Deploy Frontend | Push to main | Deploy to Vercel |

## Questions?

Open an issue on GitHub for questions or discussions.
