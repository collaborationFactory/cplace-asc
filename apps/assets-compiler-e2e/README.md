# Assets Compiler E2E Tests

This package contains E2E tests for the cplace Assets compiler, implementing test cases from the Quality Assurance workspace.

## Test Coverage

-   **TC1**: Basic Assets Compiler Verification ✅ Implemented

## Setup

1. Install dependencies:

```bash
npm install
```

2. Ensure the assets compiler scripts exist in the project root:
    - `assets-compiler.sh` (Mac/Linux)
    - `assets-compiler.cmd` (Windows)

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with coverage

```bash
npm run test:coverage
```

### Run specific test (TC1)

```bash
npx jest --testNamePattern="TC1"
```

## Test Structure

### TC1: Basic Assets Compiler Verification

-   **File**: `src/__tests__/assets-compiler.test.ts`
-   **Command**: `./assets-compiler.sh -c` (Mac) or `./assets-compiler.cmd -c` (Windows)
-   **Verifies**:
    -   Node version display
    -   "You are using a correct Node version" message
-   **Timeout**: 30 seconds

## Prerequisites

-   Node.js (correct version as required by assets compiler)
-   npm installed and in PATH
-   Assets compiler scripts must be executable (Mac/Linux: `chmod +x assets-compiler.sh`)

## Troubleshooting

### Test Fails with "Permission denied"

```bash
chmod +x assets-compiler.sh
```

### Test Fails with "Command not found"

Ensure you're running tests from the project root directory where the assets compiler scripts are located.

### Test Timeout

If compilation takes longer than expected, increase the timeout in the test configuration.

## Implementation Status

-   [x] **TC1**: Basic Assets Compiler Verification
-   [ ] **TC2**: Watch Mode Compilation
-   [ ] **TC3**: Production Mode Compilation
-   [ ] **TC4-10**: Additional Compilation Modes
-   [ ] **TC11-14**: Advanced Compilation Options
-   [ ] **TC15**: Incorrect Node.js Version Error Handling
-   [ ] **TC16**: Missing NPM Error Handling
-   [ ] **TC17**: Missing $LOCAL_ASC Variable
-   [ ] **TC18**: Permission Denied Error (Mac/Linux)
-   [ ] **TC19**: Command Flag Conflict Detection
-   [ ] **TC20**: Error Handling Edge Cases

## Next Implementation Steps

1. Run TC1 to validate the test environment setup
2. Implement TC2-3 for additional compilation modes
3. Add error handling test cases (TC15-20)
4. Integrate with CI/CD pipeline
