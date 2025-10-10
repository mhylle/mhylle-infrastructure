# Quickstart Guide - Integration Test Scenarios

**Feature**: Notes CRUD, Conversations, and Categorization
**Purpose**: Validate end-to-end functionality through manual/automated testing
**Prerequisites**: Backend running, authenticated user token available

## Setup

```bash
# Start backend (from mynotes/backend directory)
npm run start:dev

# Backend should be running on http://localhost:3000
# Ensure database is initialized with system categories
```

**Test User**:
- Create test user via `/api/auth/register` or use existing account
- Obtain JWT token via `/api/auth/login`
- Set token in environment variable for commands below:
```bash
export TOKEN="your-jwt-token-here"
```

---

## Scenario 1: Complete Note Lifecycle

**Objective**: Test full CRUD operations on notes with category management

### Step 1: Create Standalone Note
```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Meeting Notes",
    "content": "Discussed Q4 planning and budget allocation"
  }'
```

**Expected Response** (201 Created):
```json
{
  "id": "note-uuid-1",
  "title": "Meeting Notes",
  "content": "Discussed Q4 planning and budget allocation",
  "userId": "user-uuid",
  "conversationId": null,
  "createdAt": "2025-10-05T10:00:00Z",
  "updatedAt": "2025-10-05T10:00:00Z",
  "categories": []
}
```

**Validation**:
- ✅ Note created with standalone status (conversationId = null)
- ✅ Timestamps populated automatically
- ✅ No categories assigned initially

---

### Step 2: Edit Note Content
```bash
curl -X PUT http://localhost:3000/api/notes/note-uuid-1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q4 Planning Meeting Notes",
    "content": "Discussed Q4 planning, budget allocation, and team expansion"
  }'
```

**Expected Response** (200 OK):
```json
{
  "id": "note-uuid-1",
  "title": "Q4 Planning Meeting Notes",
  "content": "Discussed Q4 planning, budget allocation, and team expansion",
  "updatedAt": "2025-10-05T10:05:00Z",
  ...
}
```

**Validation**:
- ✅ Title and content updated
- ✅ `updatedAt` timestamp changed
- ✅ `createdAt` timestamp unchanged

---

### Step 3: Assign Categories to Note

First, get available categories:
```bash
curl -X GET http://localhost:3000/api/categories \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200 OK):
```json
{
  "categories": [
    { "id": "cat-work", "name": "Work", "type": "system" },
    { "id": "cat-tasks", "name": "Tasks", "type": "system" },
    { "id": "cat-ideas", "name": "Ideas", "type": "system" }
  ]
}
```

Now assign categories:
```bash
curl -X PUT http://localhost:3000/api/notes/note-uuid-1/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryIds": ["cat-work", "cat-tasks"]
  }'
```

**Expected Response** (200 OK):
```json
{
  "id": "note-uuid-1",
  "categories": [
    { "id": "cat-work", "name": "Work", "type": "system" },
    { "id": "cat-tasks", "name": "Tasks", "type": "system" }
  ]
}
```

**Validation**:
- ✅ Multiple categories assigned simultaneously
- ✅ Categories appear in note response

---

### Step 4: Add Note to Conversation

Create conversation first:
```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q4 Planning Discussion",
    "description": "All notes related to Q4 planning process"
  }'
```

**Expected Response** (201 Created):
```json
{
  "id": "conv-uuid-1",
  "title": "Q4 Planning Discussion",
  "description": "All notes related to Q4 planning process",
  "userId": "user-uuid",
  "noteCount": 0,
  "createdAt": "2025-10-05T10:10:00Z",
  "updatedAt": "2025-10-05T10:10:00Z"
}
```

Add note to conversation:
```bash
curl -X PATCH http://localhost:3000/api/notes/note-uuid-1/conversation \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv-uuid-1"
  }'
```

**Expected Response** (200 OK):
```json
{
  "id": "note-uuid-1",
  "conversationId": "conv-uuid-1",
  "updatedAt": "2025-10-05T10:12:00Z"
}
```

**Validation**:
- ✅ Note now belongs to conversation
- ✅ Note retains existing categories

---

### Step 5: Remove Note from Conversation
```bash
curl -X PATCH http://localhost:3000/api/notes/note-uuid-1/conversation \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": null
  }'
```

**Expected Response** (200 OK):
```json
{
  "id": "note-uuid-1",
  "conversationId": null,
  "updatedAt": "2025-10-05T10:15:00Z"
}
```

**Validation**:
- ✅ Note becomes standalone again (conversationId = null)
- ✅ Note still exists with categories intact

---

### Step 6: Delete Note
```bash
curl -X DELETE http://localhost:3000/api/notes/note-uuid-1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (204 No Content)

**Validation**:
- ✅ Note permanently deleted
- ✅ Category associations removed automatically
- ✅ Attempting to fetch note returns 404

---

## Scenario 2: Conversation Management

**Objective**: Test conversation CRUD with note relationships

### Step 1: Create Conversation with Metadata
```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Project Alpha Planning",
    "description": "Collection of brainstorming notes for Project Alpha launch"
  }'
```

**Expected Response** (201 Created):
```json
{
  "id": "conv-uuid-2",
  "title": "Project Alpha Planning",
  "description": "Collection of brainstorming notes for Project Alpha launch",
  "userId": "user-uuid",
  "noteCount": 0,
  "createdAt": "2025-10-05T11:00:00Z",
  "updatedAt": "2025-10-05T11:00:00Z"
}
```

**Validation**:
- ✅ Conversation created with title and description
- ✅ Empty conversation (noteCount = 0)

---

### Step 2: Create Note Directly in Conversation
```bash
curl -X POST http://localhost:3000/api/conversations/conv-uuid-2/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Initial Brainstorm",
    "content": "Key features: user dashboard, analytics, mobile app"
  }'
```

**Expected Response** (201 Created):
```json
{
  "id": "note-uuid-2",
  "title": "Initial Brainstorm",
  "content": "Key features: user dashboard, analytics, mobile app",
  "conversationId": "conv-uuid-2",
  "userId": "user-uuid",
  "categories": [],
  "createdAt": "2025-10-05T11:05:00Z",
  "updatedAt": "2025-10-05T11:05:00Z"
}
```

**Validation**:
- ✅ Note created and automatically assigned to conversation
- ✅ conversationId populated

---

### Step 3: Add Existing Note to Conversation

Create standalone note:
```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tech Stack Decisions",
    "content": "Frontend: Angular, Backend: NestJS, Database: PostgreSQL"
  }'
```

Add to conversation:
```bash
curl -X PATCH http://localhost:3000/api/notes/note-uuid-3/conversation \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv-uuid-2"
  }'
```

**Validation**:
- ✅ Existing standalone note added to conversation
- ✅ Conversation now contains multiple notes

---

### Step 4: View Conversation with All Notes
```bash
curl -X GET http://localhost:3000/api/conversations/conv-uuid-2 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200 OK):
```json
{
  "id": "conv-uuid-2",
  "title": "Project Alpha Planning",
  "description": "Collection of brainstorming notes for Project Alpha launch",
  "userId": "user-uuid",
  "createdAt": "2025-10-05T11:00:00Z",
  "updatedAt": "2025-10-05T11:05:00Z",
  "categories": [],
  "notes": [
    {
      "id": "note-uuid-2",
      "title": "Initial Brainstorm",
      "content": "Key features: user dashboard, analytics, mobile app",
      "createdAt": "2025-10-05T11:05:00Z",
      ...
    },
    {
      "id": "note-uuid-3",
      "title": "Tech Stack Decisions",
      "content": "Frontend: Angular, Backend: NestJS, Database: PostgreSQL",
      "createdAt": "2025-10-05T11:10:00Z",
      ...
    }
  ]
}
```

**Validation**:
- ✅ Conversation includes title and description
- ✅ Notes ordered chronologically (createdAt ASC)
- ✅ All notes in conversation returned

---

### Step 5: Edit Conversation Metadata
```bash
curl -X PUT http://localhost:3000/api/conversations/conv-uuid-2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Project Alpha - MVP Planning",
    "description": "Refined planning notes focusing on MVP features"
  }'
```

**Expected Response** (200 OK):
```json
{
  "id": "conv-uuid-2",
  "title": "Project Alpha - MVP Planning",
  "description": "Refined planning notes focusing on MVP features",
  "updatedAt": "2025-10-05T11:20:00Z"
}
```

**Validation**:
- ✅ Title and description updated
- ✅ Notes remain in conversation unchanged

---

### Step 6: Delete Conversation (Notes Become Standalone)
```bash
curl -X DELETE http://localhost:3000/api/conversations/conv-uuid-2 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (204 No Content)

Verify notes are standalone:
```bash
curl -X GET http://localhost:3000/api/notes/note-uuid-2 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200 OK):
```json
{
  "id": "note-uuid-2",
  "conversationId": null,
  ...
}
```

**Validation**:
- ✅ Conversation deleted
- ✅ Notes preserved as standalone (conversationId = null)
- ✅ Notes retain all content and categories

---

## Scenario 3: Category System

**Objective**: Test category CRUD and filtering functionality

### Step 1: List System Categories
```bash
curl -X GET http://localhost:3000/api/categories?type=system \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200 OK):
```json
{
  "categories": [
    { "id": "cat-work", "name": "Work", "type": "system", "createdAt": "..." },
    { "id": "cat-personal", "name": "Personal", "type": "system", "createdAt": "..." },
    { "id": "cat-ideas", "name": "Ideas", "type": "system", "createdAt": "..." },
    { "id": "cat-tasks", "name": "Tasks", "type": "system", "createdAt": "..." },
    { "id": "cat-reference", "name": "Reference", "type": "system", "createdAt": "..." }
  ]
}
```

**Validation**:
- ✅ System categories seeded on database initialization
- ✅ 5 default categories available
- ✅ All marked as type "system"

---

### Step 2: Create Custom Category
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Alpha"
  }'
```

**Expected Response** (201 Created):
```json
{
  "id": "cat-custom-1",
  "name": "Project Alpha",
  "type": "user",
  "userId": "user-uuid",
  "createdAt": "2025-10-05T12:00:00Z",
  "updatedAt": "2025-10-05T12:00:00Z"
}
```

**Validation**:
- ✅ Custom category created as type "user"
- ✅ Owned by authenticated user

---

### Step 3: Assign Multiple Categories to Note

Create test note:
```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Alpha MVP Features",
    "content": "User authentication, data visualization, export functionality"
  }'
```

Assign categories (mix of system and custom):
```bash
curl -X PUT http://localhost:3000/api/notes/note-uuid-4/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryIds": ["cat-work", "cat-tasks", "cat-custom-1"]
  }'
```

**Expected Response** (200 OK):
```json
{
  "id": "note-uuid-4",
  "categories": [
    { "id": "cat-work", "name": "Work", "type": "system" },
    { "id": "cat-tasks", "name": "Tasks", "type": "system" },
    { "id": "cat-custom-1", "name": "Project Alpha", "type": "user" }
  ]
}
```

**Validation**:
- ✅ Note tagged with multiple categories (system + user)
- ✅ Categories appear in note response

---

### Step 4: Assign Categories to Conversation

Create conversation:
```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Planning",
    "description": "Weekly sprint planning discussions"
  }'
```

Assign categories:
```bash
curl -X PUT http://localhost:3000/api/conversations/conv-uuid-3/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryIds": ["cat-work", "cat-custom-1"]
  }'
```

**Validation**:
- ✅ Conversation tagged with categories
- ✅ Works same way as note categorization

---

### Step 5: Filter Notes by Category
```bash
curl -X GET http://localhost:3000/api/categories/cat-work/notes \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200 OK):
```json
{
  "notes": [
    {
      "id": "note-uuid-4",
      "title": "Alpha MVP Features",
      "content": "User authentication, data visualization, export functionality",
      "categories": [
        { "name": "Work" },
        { "name": "Tasks" },
        { "name": "Project Alpha" }
      ],
      ...
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**Validation**:
- ✅ Returns notes tagged with "Work" category
- ✅ Notes may have multiple categories (appear in multiple filter results)

---

### Step 6: Edit Custom Category Name
```bash
curl -X PUT http://localhost:3000/api/categories/cat-custom-1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Alpha - MVP"
  }'
```

**Expected Response** (200 OK):
```json
{
  "id": "cat-custom-1",
  "name": "Project Alpha - MVP",
  "updatedAt": "2025-10-05T12:30:00Z"
}
```

**Validation**:
- ✅ Custom category name updated
- ✅ All notes/conversations with this category show updated name

---

### Step 7: Delete Custom Category (Items Retain Other Categories)
```bash
curl -X DELETE http://localhost:3000/api/categories/cat-custom-1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (204 No Content)

Verify note still exists with remaining categories:
```bash
curl -X GET http://localhost:3000/api/notes/note-uuid-4 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200 OK):
```json
{
  "id": "note-uuid-4",
  "categories": [
    { "id": "cat-work", "name": "Work", "type": "system" },
    { "id": "cat-tasks", "name": "Tasks", "type": "system" }
  ],
  ...
}
```

**Validation**:
- ✅ Custom category deleted
- ✅ Note preserved with remaining categories
- ✅ Category removed from all associated notes/conversations

---

## Error Scenarios

### Unauthorized Access
```bash
curl -X GET http://localhost:3000/api/notes \
  -H "Authorization: Bearer invalid-token"
```

**Expected Response** (401 Unauthorized):
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### Access Another User's Resource
```bash
curl -X PUT http://localhost:3000/api/notes/other-user-note-id \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked"}'
```

**Expected Response** (403 Forbidden):
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### Validation Error
```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": ""
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "statusCode": 400,
  "message": ["title should not be empty", "title must be longer than or equal to 1 characters"],
  "error": "Bad Request"
}
```

### Modify System Category (Should Fail)
```bash
curl -X PUT http://localhost:3000/api/categories/cat-work \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Modified Work"
  }'
```

**Expected Response** (403 Forbidden):
```json
{
  "statusCode": 403,
  "message": "Cannot modify system categories",
  "error": "Forbidden"
}
```

---

## Cleanup

After testing, clean up test data:
```bash
# Delete all test notes
curl -X GET http://localhost:3000/api/notes -H "Authorization: Bearer $TOKEN" | \
  jq -r '.notes[].id' | \
  xargs -I {} curl -X DELETE http://localhost:3000/api/notes/{} -H "Authorization: Bearer $TOKEN"

# Delete all test conversations
curl -X GET http://localhost:3000/api/conversations -H "Authorization: Bearer $TOKEN" | \
  jq -r '.conversations[].id' | \
  xargs -I {} curl -X DELETE http://localhost:3000/api/conversations/{} -H "Authorization: Bearer $TOKEN"

# Delete custom categories
curl -X GET http://localhost:3000/api/categories?type=user -H "Authorization: Bearer $TOKEN" | \
  jq -r '.categories[].id' | \
  xargs -I {} curl -X DELETE http://localhost:3000/api/categories/{} -H "Authorization: Bearer $TOKEN"
```

---

## Summary

**Scenarios Covered**:
1. ✅ Complete note lifecycle: create → edit → categorize → assign to conversation → remove → delete
2. ✅ Conversation management: create → add notes → view → edit → delete (notes preserved)
3. ✅ Category system: list system → create custom → assign to items → filter → edit → delete

**Key Validations**:
- Data integrity maintained across all operations
- Cascade deletions preserve entity data by default
- Authorization enforced on all endpoints
- Validation errors return clear messages
- System categories immutable
- Relationships (note-conversation, note-category) work correctly

**Status**: ✅ Complete - Ready for automated E2E test implementation
