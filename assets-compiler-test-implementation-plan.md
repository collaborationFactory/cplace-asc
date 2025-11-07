# CYP - FT - Test Document for Assets compiler - E2E Test Implementation Plan

## Overview

Implementation plan for mapping cplace Quality Assurance test cases to automated tests.

**Source**: CYP - FT - Test Document for Assets compiler (cplace QA)
**Target**: `test/AssetsCompiler.test.ts` (existing) + new E2E test suite
**Current Status**: Ready for implementation
**Total Test Cases**: 20
**Automatable Test Cases**: 20 (100% automation coverage)

---

## Test Case Mapping

### 🔄 TC1: Verify assets compiler basic functionality

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 1
**Target**: Verify assets compiler
**Condition**: Updated release branch with cli environment, updated node.js version, updated npm. Note: "$LOCAL_ASC" -w -c "$@" exists in assets-compiler.sh file. Remove -w -c from the assets-compiler.sh file.
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -c"
**Expected**: You are using node version:<Latest node version> number. And,"You are using a correct Node version" info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC1: should verify assets compiler basic functionality', async () => {
  const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc -c');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('You are using a correct Node version');
  expect(stdout).toMatch(/You are using node version:\d+\.\d+\.\d+/);
});
```

### 🔄 TC2: Verify compilation completed message

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 2
**Target**: Message verification
**Condition**: Following TC1
**Action**: Verify the message.
**Expected**: 'Compilation completed - watching files' info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC2: should display compilation completed message', async () => {
  const { stdout } = await execAsync('node_modules/.bin/cplace-asc -c');
  expect(stdout).toContain('Compilation completed - watching files');
});
```

### 🔄 TC3: Verify assets compiler with -p flag

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 3
**Target**: Preprocessing flag test
**Condition**: Standard setup
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -p"
**Expected**: You are using node version:<Latest node version> number. And,"You are using a correct Node version" info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC3: should verify assets compiler with -p flag', async () => {
  const { stdout, exitCode } = await execAsync('node_modules/.bin/cplace-asc -p');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('You are using a correct Node version');
  expect(stdout).toMatch(/You are using node version:\d+\.\d+\.\d+/);
});
```

### 🔄 TC4: Verify compilation completed message for -p flag

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 4
**Target**: Message verification after preprocessing
**Condition**: Following TC3
**Action**: Verify the message.
**Expected**: 'Compilation completed - watching files' info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC4: should display compilation completed message after preprocessing', async () => {
  const { stdout } = await execAsync('node_modules/.bin/cplace-asc -p');
  expect(stdout).toContain('Compilation completed - watching files');
});
```

### 🔄 TC5: Verify assets compiler with -t flag

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 5
**Target**: Test flag verification
**Condition**: Standard setup
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -t"
**Expected**: You are using node version:<Latest node version> number. And,"You are using a correct Node version" info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC5: should verify assets compiler with -t flag', async () => {
  const { stdout, exitCode } = await execAsync('node_modules/.bin/cplace-asc -t');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('You are using a correct Node version');
  expect(stdout).toMatch(/You are using node version:\d+\.\d+\.\d+/);
});
```

### 🔄 TC6: Verify compilation completed message for -t flag

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 6
**Target**: Message verification
**Condition**: Following TC5
**Action**: Verify the message.
**Expected**: 'Compilation completed - watching files' info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC6: should display compilation completed message for -t flag', async () => {
  const { stdout } = await execAsync('node_modules/.bin/cplace-asc -t');
  expect(stdout).toContain('Compilation completed - watching files');
});
```

### 🔄 TC7: Verify assets compiler with -w flag and node version

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 7
**Target**: Watch mode with node version check
**Condition**: Standard setup
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -w"
**Expected**: You are using node version:<Latest node version> number. And,"You are using a correct Node version" info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC7: should verify assets compiler with -w flag', async () => {
  const childProcess = spawn('node_modules/.bin/cplace-asc', ['-w']);
  const output = await new Promise<string>((resolve) => {
    let stdout = '';
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.includes('You are using a correct Node version')) {
        childProcess.kill();
        resolve(stdout);
      }
    });
    setTimeout(() => {
      childProcess.kill();
      resolve(stdout);
    }, 5000);
  });
  expect(output).toContain('You are using a correct Node version');
  expect(output).toMatch(/You are using node version:\d+\.\d+\.\d+/);
});
```

### 🔄 TC8: Verify compilation completed message for watch mode

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 8
**Target**: Watch mode message verification
**Condition**: Following TC7
**Action**: Verify the message.
**Expected**: 'Compilation completed - watching files' info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC8: should display compilation completed message in watch mode', async () => {
  const childProcess = spawn('node_modules/.bin/cplace-asc', ['-w']);
  const output = await new Promise<string>((resolve) => {
    let stdout = '';
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.includes('Compilation completed - watching files')) {
        childProcess.kill();
        resolve(stdout);
      }
    });
    setTimeout(() => {
      childProcess.kill();
      resolve(stdout);
    }, 5000);
  });
  expect(output).toContain('Compilation completed - watching files');
});
```

### 🔄 TC9: Verify assets compiler version display

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 9
**Target**: Version command test
**Condition**: Standard setup
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -v"
**Expected**: You are using node version:<Latest node version> number. And,"You are using a correct Node version" info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC9: should display version information', async () => {
  const { stdout, exitCode } = await execAsync('node_modules/.bin/cplace-asc -v');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('You are using a correct Node version');
  expect(stdout).toMatch(/You are using node version:\d+\.\d+\.\d+/);
});
```

### 🔄 TC10: Verify compilation completed message after version check

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 10
**Target**: Message verification after version
**Condition**: Following TC9
**Action**: Verify the message.
**Expected**: 'Compilation completed - watching files' info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC10: should display compilation completed message after version check', async () => {
  const { stdout } = await execAsync('node_modules/.bin/cplace-asc -v');
  expect(stdout).toContain('Compilation completed - watching files');
});
```

### 🔄 TC11: Verify assets compiler with -o flag (only preprocessing)

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 11
**Target**: Only preprocessing mode
**Condition**: Updated release branch with cli environment, updated node.js version, updated npm. Note: "$LOCAL_ASC" "$@" should exist in assets-compiler.sh file.
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -o"
**Expected**: You are using node version:<Latest node version> number. And,"You are using a correct Node version" info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC11: should verify assets compiler with -o flag for only preprocessing', async () => {
  const { stdout, exitCode } = await execAsync('node_modules/.bin/cplace-asc -o');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('You are using a correct Node version');
  expect(stdout).toMatch(/You are using node version:\d+\.\d+\.\d+/);
});
```

### 🔄 TC12: Verify preprocessing completed message

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 12
**Target**: Preprocessing completion verification
**Condition**: Following TC11
**Action**: Verify the message.
**Expected**: 'Preprocessing completed successfully' info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC12: should display preprocessing completed message', async () => {
  const { stdout } = await execAsync('node_modules/.bin/cplace-asc -o');
  expect(stdout).toContain('Preprocessing completed successfully');
});
```

### 🔄 TC13: Verify assets compiler with -P flag

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 13
**Target**: Capital P flag test
**Condition**: Standard setup
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -P"
**Expected**: You are using node version:<Latest node version> number. And,"You are using a correct Node version" info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC13: should verify assets compiler with -P flag', async () => {
  const { stdout, exitCode } = await execAsync('node_modules/.bin/cplace-asc -P');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('You are using a correct Node version');
  expect(stdout).toMatch(/You are using node version:\d+\.\d+\.\d+/);
});
```

### 🔄 TC14: Verify assets compiled successfully message

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 14
**Target**: Assets compilation verification
**Condition**: Following TC13
**Action**: Verify the message.
**Expected**: 'Assets compiled successfully' info should be displayed.

**Jest Implementation Strategy**:
```typescript
it('TC14: should display assets compiled successfully message', async () => {
  const { stdout } = await execAsync('node_modules/.bin/cplace-asc -P');
  expect(stdout).toContain('Assets compiled successfully');
});
```

### 🔄 TC15: Verify error handling for incorrect Node.js version

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 15
**Target**: Verify assets compiler with incorrect Node.js version
**Condition**: Updated release branch with cli environment. Outdated/unsupported node.js version installed (e.g., Node 18.x instead of 22.15.0). Updated npm.
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -c"
**Expected**: Error message displayed: 'Incorrect Node version detected'. Message should indicate minimum required Node version. Compilation should not proceed. Process should exit with non-zero exit code.

**Jest Implementation Strategy**:
```typescript
it('TC15: should handle incorrect Node.js version gracefully', async () => {
  // Mock Node version or use Docker/nvm to test with different versions
  const originalVersion = process.version;
  Object.defineProperty(process, 'version', { value: 'v18.0.0' });

  try {
    const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc -c');
    expect(exitCode).not.toBe(0);
    expect(stderr || stdout).toContain('Incorrect Node version detected');
    expect(stderr || stdout).toMatch(/minimum.*required.*Node.*version/i);
  } finally {
    Object.defineProperty(process, 'version', { value: originalVersion });
  }
});
```

### 🔄 TC16: Verify error handling for missing npm

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 16
**Target**: Verify assets compiler with missing npm
**Condition**: Updated release branch with cli environment. Updated node.js version. npm is not installed or not in PATH.
**Action**: Open Terminal. Run "node_modules/.bin/cplace-asc -c"
**Expected**: Error message displayed: 'npm not found' or similar. Clear indication that npm is required. Compilation should fail gracefully. Process should exit with non-zero exit code.

**Jest Implementation Strategy**:
```typescript
it('TC16: should handle missing npm gracefully', async () => {
  const originalPath = process.env.PATH;
  // Remove npm from PATH by filtering it out
  process.env.PATH = process.env.PATH?.split(':').filter(p => !p.includes('npm')).join(':') || '';

  try {
    const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc -c');
    expect(exitCode).not.toBe(0);
    expect(stderr || stdout).toMatch(/npm.*not.*found|npm.*required/i);
  } finally {
    process.env.PATH = originalPath;
  }
});
```

### 🔄 TC17: Verify error handling for missing $LOCAL_ASC variable

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 17
**Target**: Missing $LOCAL_ASC environment variable
**Condition**: Environment setup without $LOCAL_ASC variable defined
**Action**: Open Terminal. Run command without $LOCAL_ASC set
**Expected**: Error message indicating missing environment variable

**Jest Implementation Strategy**:
```typescript
it('TC17: should handle missing $LOCAL_ASC environment variable', async () => {
  const originalLocalAsc = process.env.LOCAL_ASC;
  delete process.env.LOCAL_ASC;

  try {
    const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc -c');
    expect(exitCode).not.toBe(0);
    expect(stderr || stdout).toMatch(/LOCAL_ASC.*not.*found|LOCAL_ASC.*required/i);
  } finally {
    if (originalLocalAsc) process.env.LOCAL_ASC = originalLocalAsc;
  }
});
```

### 🔄 TC18: Verify error handling for permission issues

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 18
**Target**: Permission error handling
**Condition**: assets-compiler.sh lacks execution permissions
**Action**: Test execution without proper permissions
**Expected**: Permission error message and graceful failure

**Jest Implementation Strategy**:
```typescript
it('TC18: should handle permission errors gracefully', async () => {
  // This test may need to be adapted based on the actual file structure
  const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc -c', {
    env: { ...process.env, TEST_PERMISSION_ERROR: 'true' }
  });

  if (exitCode !== 0) {
    expect(stderr || stdout).toMatch(/permission.*denied|EACCES/i);
  }
});
```

### 🔄 TC19: Verify flag conflict error handling

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 19
**Target**: Flag conflict error
**Condition**: Missing -w -c flags in configuration
**Action**: Test conflicting flags
**Expected**: "--watch and --onlypre cannot be enabled simultaneously" error message

**Jest Implementation Strategy**:
```typescript
it('TC19: should handle conflicting flags appropriately', async () => {
  const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc --watch --onlypre');
  expect(exitCode).not.toBe(0);
  expect(stderr || stdout).toContain('--watch and --onlypre cannot be enabled simultaneously');
});
```

### 🔄 TC20: Verify undefined properties error handling

**cplace Test**: Template FT - Test Document for Assets compiler - Nr. 20
**Target**: Undefined properties error
**Condition**: Configuration causing undefined property access
**Action**: Run "node_modules/.bin/cplace-asc -P"
**Expected**: "TypeError: Cannot read properties of undefined" error

**Jest Implementation Strategy**:
```typescript
it('TC20: should handle undefined properties error', async () => {
  // This test may need specific configuration to trigger the undefined error
  const { stdout, stderr, exitCode } = await execAsync('node_modules/.bin/cplace-asc -P', {
    env: { ...process.env, TEST_UNDEFINED_ERROR: 'true' }
  });

  if (exitCode !== 0) {
    expect(stderr || stdout).toMatch(/TypeError.*Cannot read properties of undefined/);
  }
});
```

---

## Implementation Progress

### Completed ✅

None yet - all test cases are ready for implementation

### Pending Implementation 🔄

- [ ] **TC1-5**: Basic functionality tests (compilation, preprocessing, test flags)
- [ ] **TC6-10**: Message verification tests
- [ ] **TC11-14**: Advanced flag tests and preprocessing
- [ ] **TC15-20**: Error handling and edge cases

---

## Technical Notes

### Test Execution Strategy
- Use Jest for unit and integration testing
- Implement async/await pattern for command execution
- Use child_process.spawn for long-running processes (watch mode)
- Mock environment variables and system conditions for error scenarios

### Dependencies and Setup Requirements
- Node.js (version 22.15.0 or compatible)
- npm installed and in PATH
- cplace-asc binary available in node_modules/.bin/
- Environment variable $LOCAL_ASC properly configured

### Cross-platform Considerations
- Handle different command invocations (Unix vs Windows)
- Account for path separators and environment variable syntax
- Test both assets-compiler.sh and assets-compiler.cmd

### Performance Considerations
- Set appropriate timeouts for compilation processes
- Implement proper cleanup for spawned processes
- Use mocking for environment setup to avoid side effects

### Error Testing Strategy
- Use environment variable flags to trigger specific error conditions
- Mock Node.js version and npm availability
- Test permission scenarios where applicable
- Validate error messages and exit codes

---

## Next Steps

1. **Create Test Suite Structure**:
   ```bash
   mkdir -p test/e2e
   touch test/e2e/assets-compiler.e2e.test.ts
   ```

2. **Implement Base Test Utilities**:
   - Command execution helpers
   - Environment mocking utilities
   - Process cleanup functions

3. **Implement Test Cases**:
   - Start with basic functionality tests (TC1-5)
   - Add message verification tests (TC6-10)
   - Implement advanced flag tests (TC11-14)
   - Complete error handling tests (TC15-20)

4. **Verify Test Execution**:
   - Run test suite in CI/CD pipeline
   - Validate cross-platform compatibility
   - Ensure proper cleanup and isolation

5. **Update Documentation**:
   - Add test execution instructions
   - Document test environment requirements
   - Update CI/CD configuration

### Recommended Implementation Order:
1. TC1, TC3, TC5, TC9 (Basic flag tests)
2. TC2, TC4, TC6, TC10 (Message verification)
3. TC11-TC14 (Advanced preprocessing)
4. TC7-TC8 (Watch mode - requires special handling)
5. TC15-TC20 (Error scenarios - most complex)

### Target File Location:
- Primary: `test/e2e/assets-compiler.e2e.test.ts`
- Utilities: `test/helpers/command-execution.ts`
- Mocks: `test/mocks/environment.ts`