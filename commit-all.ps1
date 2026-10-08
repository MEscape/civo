# Error handling helper
function Commit-Changes {
    param([string]$message)
    $status = git status --porcelain
    if ($status) {
        git commit -m $message
    }
}

# GitHub Configs
git add .github/ISSUE_TEMPLATE/bug_report.yml
Commit-Changes "chore(github): add bug report issue template"

git add .github/ISSUE_TEMPLATE/feature_request.yml
Commit-Changes "chore(github): add feature request issue template"

git add .github/actions/ .github/workflows/ .github/dependabot.yml
Commit-Changes "chore(github): add actions and workflows"

# Root Configurations
git add tsconfig.json
Commit-Changes "chore(config): update typescript config"

git add vercel.json
Commit-Changes "chore(config): update vercel deployment config"

git add vitest*
Commit-Changes "chore(test): update vitest config"

git add eslint/
Commit-Changes "chore(config): update eslint config"

git add .prettier*
Commit-Changes "chore(config): add prettier configs"

git add .env*
Commit-Changes "chore(env): add example environment files"

git add .nvmrc
Commit-Changes "chore(nvm): add .nvmrc"

# Documentation
git add AI_RULES.md
Commit-Changes "docs: update AI_RULES.md"

git add GEMINI.md
Commit-Changes "docs: update GEMINI.md"

git add BACKLOG.md
Commit-Changes "docs: update BACKLOG.md"

git add docs/
Commit-Changes "docs: update project documentation"

# Infrastructure & DB
git add Dockerfile docker-compose.yml
Commit-Changes "build(docker): update dockerfile and compose"

git add docker/
Commit-Changes "build(docker): update docker scripts"

git add migrations/
Commit-Changes "build(db): add database migrations"

git add scripts/
Commit-Changes "chore(scripts): update utility scripts"

# Library & Core Utils
git add src/lib/db/
Commit-Changes "refactor(lib): restructure db utilities"

git add src/lib/errors/
Commit-Changes "refactor(lib): restructure error handling"

git add src/lib/logger/
Commit-Changes "refactor(lib): update logging utilities"

git add src/lib/result/
Commit-Changes "refactor(lib): update result types"

git add src/lib/utils/
Commit-Changes "refactor(lib): update general utilities"

git add src/lib/actions/
Commit-Changes "refactor(lib): update server actions base"

git add src/lib/fonts/ src/lib/config/ src/lib/seo/ src/lib/clock/ src/lib/README.md
Commit-Changes "refactor(lib): update miscellaneous libraries"

git add src/types/
Commit-Changes "refactor(types): update global types"

git add src/store/
Commit-Changes "refactor(store): update state management"

git add src/proxy.ts
Commit-Changes "refactor(proxy): update proxy configuration"

# App & Components
git add src/components/layout/
Commit-Changes "feat(core): update layout components"

git add src/components/ui/ src/components/shared/ src/components/providers/ src/components/README.md
Commit-Changes "feat(core): update ui and shared components"

git add src/app/
Commit-Changes "feat(core): update app routing and pages"

git add src/hooks/
Commit-Changes "feat(core): update custom hooks"

git add src/i18n/
Commit-Changes "feat(core): update internationalization"

# Modules
git add src/modules/auth/
Commit-Changes "feat(auth): restructure auth module"

git add src/modules/builder/
Commit-Changes "feat(builder): restructure builder module"

git add src/modules/component-platform/
Commit-Changes "feat(platform): restructure component-platform module"

git add src/modules/data-sources/
Commit-Changes "feat(data): restructure data-sources module"

git add src/modules/map/
Commit-Changes "feat(map): restructure map module"

git add src/modules/release/
Commit-Changes "feat(release): restructure release module"

git add src/modules/website/
Commit-Changes "feat(website): restructure website module"

# Tests
git add __tests__/
Commit-Changes "test: update test configurations and suites"

# Catch-all
git add -A
Commit-Changes "chore: catch all other remaining changes"

# Push
git push
