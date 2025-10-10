# Feature Specification: Notes CRUD, Conversations, and Categorization

**Feature Branch**: `001-right-now-you`
**Created**: 2025-10-05
**Status**: Draft
**Input**: User description: "right now, you are able to enter a note with a title and content. we need to start expanding on this:

- we need to add standard crud -> edit, delete.

- we need to add \"conversations\", where a conversation can consist of several notes.

- we need to be able to categorise both notes and conversations"

## Clarifications

### Session 2025-10-05

- Q: Can a single note belong to multiple conversations simultaneously, or is each note exclusive to one conversation? → A: Each note belongs to at most one conversation (one-to-many relationship)
- Q: Can notes and conversations be assigned multiple categories simultaneously, or only a single category each? → A: Items can have multiple categories (many-to-many tagging system)
- Q: How are categories created and managed? → A: Hybrid (system provides default categories + users can add custom ones)
- Q: Do conversations have their own metadata (like title and description)? → A: Yes - conversations have title and optional description
- Q: When a user deletes a note that belongs to a conversation, what should happen? → A: Note is deleted immediately; conversation automatically updated

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Users can manage their notes by creating, viewing, editing, and deleting individual notes. Users can organize related notes into conversations, creating a threaded discussion or collection of connected thoughts. Both individual notes and entire conversations can be organized using categories for better information management and retrieval.

### Acceptance Scenarios

#### Note CRUD Operations
1. **Given** a user has created a note, **When** they select the edit option for that note, **Then** they can modify the title and content and save the changes
2. **Given** a user has one or more notes, **When** they select the delete option for a note, **Then** the note is removed from the system (and automatically removed from its conversation if it belongs to one) [NEEDS CLARIFICATION: Should there be a confirmation dialog? Is deletion permanent or soft-delete?]
3. **Given** a user is viewing their notes, **When** they select a note to view, **Then** they can see the full title and content of that note

#### Conversation Management
4. **Given** a user wants to create a conversation, **When** they provide a title and optionally a description, **Then** a new conversation is created and they can add existing notes to it
5. **Given** a user is viewing a conversation, **When** they add a new note to the conversation, **Then** the note is created and associated with that conversation
6. **Given** a user has created a conversation, **When** they view that conversation, **Then** they can see the conversation title, description (if provided), and all notes belonging to that conversation in a structured format [NEEDS CLARIFICATION: What order should notes appear in - chronological, manual ordering, or other?]
7. **Given** a user is viewing or editing a conversation, **When** they modify the title or description, **Then** the conversation metadata is updated

#### Categorization
8. **Given** a user is creating or editing a note, **When** they assign one or more categories to the note, **Then** the note is tagged with those categories
9. **Given** a user is creating or editing a conversation, **When** they assign one or more categories to the conversation, **Then** the conversation is tagged with those categories
10. **Given** a user has categorized notes and conversations, **When** they filter or search by category, **Then** they see all items tagged with that category (items may appear in multiple category filters if they have multiple tags)

### Edge Cases
- When a user deletes a note that belongs to a conversation, the note is permanently removed and the conversation is automatically updated (note count decreases)
- How does the system handle empty conversations (conversations with no notes)?
- What happens when a user deletes a custom category? (System-provided categories cannot be deleted) [NEEDS CLARIFICATION: Are items un-categorized or reassigned?]
- What happens when a conversation has only one note and that note is deleted? (Conversation becomes empty but persists)

## Requirements *(mandatory)*

### Functional Requirements

#### Note CRUD Operations
- **FR-001**: System MUST allow users to edit existing notes by modifying title and content
- **FR-002**: System MUST allow users to delete individual notes (deletion automatically removes the note from its conversation if applicable)
- **FR-003**: System MUST allow users to view the full details of any note they have created
- **FR-004**: System MUST preserve the original creation timestamp when editing notes
- **FR-005**: System MUST [NEEDS CLARIFICATION: Should system track edit history or last modified timestamp?]

#### Conversation Management
- **FR-006**: System MUST allow users to create conversations by providing a required title and optional description
- **FR-007**: System MUST allow users to add existing notes to conversations (note: adding a note already in another conversation will move it to the new conversation, as each note belongs to at most one conversation)
- **FR-008**: System MUST allow users to create new notes directly within a conversation
- **FR-009**: System MUST display conversation title, description (if provided), and all notes belonging to a conversation when viewing that conversation
- **FR-010**: System MUST allow users to view a list of all their conversations
- **FR-011**: System MUST allow users to edit conversation title and description
- **FR-012**: System MUST [NEEDS CLARIFICATION: Can users delete entire conversations? What happens to the notes?]
- **FR-013**: System MUST allow users to remove notes from conversations, making them standalone notes again

#### Categorization
- **FR-014**: System MUST allow users to assign multiple categories to individual notes (from both system-provided and user-created categories)
- **FR-015**: System MUST allow users to assign multiple categories to conversations (from both system-provided and user-created categories)
- **FR-016**: System MUST allow users to filter or search for notes by category (notes with multiple categories appear in results for any of their assigned categories)
- **FR-017**: System MUST allow users to filter or search for conversations by category (conversations with multiple categories appear in results for any of their assigned categories)
- **FR-018**: System MUST provide a set of default system categories available to all users
- **FR-019**: System MUST allow users to add and remove individual categories from notes and conversations without affecting other assigned categories
- **FR-020**: System MUST allow users to create custom categories for their personal use
- **FR-021**: System MUST allow users to edit the names of their custom categories
- **FR-022**: System MUST allow users to delete their custom categories (system categories cannot be deleted)
- **FR-023**: System MUST prevent users from modifying or deleting system-provided categories

#### Data Integrity
- **FR-024**: System MUST maintain referential integrity between notes and conversations
- **FR-025**: System MUST automatically update conversation note lists when notes are deleted (cascade deletion: deleting a note removes it from its conversation)
- **FR-026**: System MUST allow empty conversations to persist (conversations with zero notes remain valid)

### Key Entities *(include if feature involves data)*

- **Note**: Represents a single piece of content with a title and body. Can exist independently (standalone) or belong to exactly one conversation. Can be assigned to zero or more categories (many-to-many relationship). Has creation timestamp and potentially edit history.

- **Conversation**: Represents a collection of related notes. Has a one-to-many relationship with notes (one conversation contains zero or more notes; each note belongs to at most one conversation). Can be assigned to zero or more categories (many-to-many relationship). Contains metadata: required title and optional description.

- **Category**: Represents a classification or tag that can be applied to both notes and conversations. Has a many-to-many relationship with notes and conversations (one category can tag multiple items; one item can have multiple categories). Categories exist in two types: system-provided categories (available to all users, cannot be modified or deleted) and user-created custom categories (created and managed by individual users).

- **User**: The actor who owns and manages notes, conversations, and categories. All entities belong to a specific user.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain (13 clarifications needed)
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted (CRUD operations, conversations, categories)
- [x] Ambiguities marked (13 clarification points identified)
- [x] User scenarios defined
- [x] Requirements generated (22 functional requirements)
- [x] Entities identified (Note, Conversation, Category, User)
- [ ] Review checklist passed (blocked by clarification markers)

---

## Summary

This specification expands the current note-taking functionality with three major capabilities: full CRUD operations for notes, conversation grouping for related notes, and categorization for both notes and conversations.

**Status**: ⚠️ WARN "Spec has uncertainties" - 13 clarification points identified

**Key Uncertainties Requiring Clarification**:
1. Delete confirmation and permanence strategy
2. Note ordering within conversations
3. Single vs. multiple category assignment
4. Category creation and management approach
5. Conversation metadata and CRUD operations
6. Note-conversation relationship rules (exclusive vs. shared)
7. Cascade deletion behavior
8. Edit history tracking requirements

**Next Steps**: Address clarification points before proceeding to planning phase.
