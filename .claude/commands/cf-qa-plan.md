---
# Tool Permissions
allowed-tools: mcp__cplacemcp__cplace_search_pages_fulltext, mcp__cplacemcp__cplace_get_page_by_id, mcp__cplacemcp__cplace_list_workspaces, mcp__cplacemcp__cplace_search_pages, Write(*), Read(*), Glob(*)

# User Interface Hints
argument-hint: <test_document_name>
description: Read QA test document from cplace and generate implementation plan for automatable test cases only

# Model Configuration
model: claude-sonnet-4-20250514
---

# Generate Test Implementation Plan from cplace QA Document

## Main Task/Instructions

Read a test document page from the cplace Quality Assurance workspace and generate a comprehensive test implementation plan in markdown format. **Focus exclusively on test cases marked for automation** in the "To automate" field (checkboxes that are checked).

- `$1` (test_document_name): Name or partial name of the test document page in cplace QA workspace

## Step-by-Step Process

1. **Find QA Workspace:**
   - Use cplace_list_workspaces to find the Quality Assurance workspace
   - Look for workspace names containing "QA", "Quality", "Assurance", or "Test"

2. **Search Test Document:**
   - Use cplace_search_pages_fulltext to find the test document by name
   - Filter results to the QA workspace
   - If multiple matches, select the most relevant one

3. **Read Test Document:**
   - Use cplace_get_page_by_id to retrieve the full test document content
   - Extract test cases, steps, expected results, and conditions
   - Parse structured test information from the page content

4. **Analyze Test Structure:**
   - **Focus on "To automate" field**: Extract only test cases marked for automation (checkboxes checked in "To automate" column)
   - Identify individual test cases and their numbers
   - Extract test conditions, actions, and expected results for automatable cases only
   - Determine test type (E2E, unit, integration, etc.) based on automatable cases
   - Identify target application or component from automatable test cases

5. **Generate Implementation Plan:**
   - Create markdown file with structured implementation plan
   - Map each QA test case to Jest/Cypress test implementation
   - Include code examples and strategies for each test case
   - Add technical notes, dependencies, and execution instructions
   - Mark implementation status for tracking progress

6. **Save Implementation Plan:**
   - Generate filename based on test document name
   - Save in appropriate directory (apps/[project]-e2e/ or similar)
   - Follow naming convention: `[component]-test-implementation-plan.md`

## Implementation Plan Template Structure

````markdown
# [Test Document Name] - E2E Test Implementation Plan

## Overview

Implementation plan for mapping cplace Quality Assurance test cases to automated tests.

**Source**: [QA Document Name]
**Target**: `[target_test_file_path]`
**Current Status**: [status]
**Total Test Cases**: [number]
**Automatable Test Cases**: [number_marked_for_automation]

---

## Test Case Mapping

### ✅/🔄 TC[N]: [Test Case Name]

**cplace Test**: [Original QA test reference]
**Target**: [Description of what to test]
**Condition**: [Prerequisites/conditions]
**Action**: [Steps to execute]
**Expected**: [Expected results]

**Jest/Cypress Implementation Strategy**:

```typescript
it('TC[N]: should [description]', () => {
  // Implementation code example
});
```
````

---

## Implementation Progress

### Completed ✅

- [ ] **TC[N]**: [Description]

### Pending Implementation 🔄

- [ ] **TC[N]**: [Description]

---

## Technical Notes

- Test execution strategy
- Dependencies and setup requirements
- Cross-platform considerations
- Performance considerations

---

## Next Steps

1. Implement test cases following the strategies
2. Verify test execution
3. Update documentation

```

## Requirements/Constraints

- **Priority**: Focus exclusively on test cases marked for automation in "To automate" field
- Search specifically in Quality Assurance workspace
- Handle multiple test document matches gracefully
- Extract structured test information from cplace pages, filtering for automatable cases only
- Generate implementation-ready code examples for automatable tests
- Use appropriate test framework (Jest for E2E, Cypress for UI)
- Follow cplace frontend testing conventions
- Create meaningful file names and locations

## Output Format

Provide:
- Confirmation of QA workspace and document found
- Summary of automatable test cases (those marked in "To automate" field)
- Count of automatable vs total test cases
- Path to generated implementation plan file
- Brief overview of automatable test coverage and strategy
- Next steps for implementation

## Error Handling

- If QA workspace not found, list available workspaces
- If test document not found, suggest similar documents
- If document has no structured test content, provide analysis guidance
- Handle permission or access issues gracefully
```
