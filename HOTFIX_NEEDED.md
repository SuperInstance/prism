# 🚨 URGENT HOTFIX REQUIRED

## Issue
The production-ready code that was just merged has a critical bug that prevents the server from starting.

**Error**: `projectSize is not defined`
**Impact**: Server fails to initialize (100% broken)
**Location**: `claude-code-plugin/daemon/server.js:123`

---

## Fix Applied Locally ✅

The fix has been applied and tested locally:
- **All 28 tests passing (100%)**
- **Server starts successfully**
- **All functionality working**

---

## What Was Fixed

**Before** (broken):
```javascript
console.log(`[PRISM] Project: ${this.projectInfo?.name || 'Unknown'} (${this.projectInfo?.language || 'unknown'})`);
console.log(`[PRISM] Adaptive config: ${projectSize} files, max ${this.config.maxFiles} files, ${this.config.maxFileSize / 1024 / 1024}MB max file size`);
```

**After** (working):
```javascript
console.log(`[PRISM] Project: ${this.projectInfo?.name || 'Unknown'} (${this.projectInfo?.language || 'unknown'})`);
```

**Change**: Removed the second console.log line that referenced undefined `projectSize` variable.

---

## How to Apply This Fix on GitHub

### Option 1: Quick Web Edit (Recommended - 30 seconds)

1. Go to: https://github.com/SuperInstance/prism/blob/main/claude-code-plugin/daemon/server.js

2. Click the pencil icon (✏️) to edit

3. Go to line 123

4. Delete this entire line:
   ```javascript
   console.log(`[PRISM] Adaptive config: ${projectSize} files, max ${this.config.maxFiles} files, ${this.config.maxFileSize / 1024 / 1024}MB max file size`);
   ```

5. Scroll down and commit directly to main:
   - Commit message: `fix: remove undefined projectSize variable`
   - Click "Commit changes"

Done! ✅

### Option 2: Create PR (More formal)

Use the commit I created locally:
```
commit 77e42f4
fix: remove undefined projectSize variable reference

- Removed console.log line that referenced undefined projectSize variable
- This was causing initialization failure on server startup
- All 28 integration tests now passing (100%)
```

---

## Verification

After applying the fix, the server will start successfully and all 28 integration tests will pass.

**Test Results After Fix**:
```
Total Tests: 28
Passed: 28
Failed: 0
Pass Rate: 100%
```

---

## Root Cause

This bug was introduced during the merge conflict resolution. The line referencing `projectSize` was leftover from an older version of the code that had adaptive configuration. The production-ready version doesn't have this variable, causing a ReferenceError on startup.

---

**Status**: Fix ready and tested ✅
**Impact**: Critical (100% broken without fix)
**Effort**: 30 seconds to apply via web edit
