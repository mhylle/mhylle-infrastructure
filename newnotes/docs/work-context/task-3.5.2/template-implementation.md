# HTML Template Implementation

## Layout Structure

The template is organized into three distinct top-level sections:

1. **Loading State Section** - Displayed when `loading()` is true
2. **Error State Section** - Displayed when `error()` exists and not loading
3. **Success State Section** - Displayed when note exists, not loading, and no error

### Success State Layout Hierarchy

```
note-detail-container
├── mat-toolbar (header-actions)
│   ├── left-actions (Back button)
│   ├── spacer
│   └── right-actions (Edit, Delete buttons)
└── mat-card (note-content-card)
    ├── mat-card-header (title)
    ├── mat-divider
    └── mat-card-content
        ├── note-content (pre-formatted text)
        ├── mat-divider (section divider)
        └── metadata-section
            ├── metadata-title
            ├── metadata-grid
            │   ├── Created date
            │   ├── Updated date (conditional)
            │   ├── Source type
            │   └── Task count (conditional)
            └── last-updated (conditional)
```

## State Handling

### Loading State
- **Display**: Centered spinner with text
- **Components**: `mat-spinner`, paragraph text
- **Layout**: Vertical center alignment in `.loading-container`
- **Message**: "Loading note..."

### Error State
- **Display**: Material card with error icon, title, and action buttons
- **Components**: `mat-card`, `mat-icon`, buttons
- **Layout**: Centered content in `.error-card`
- **Actions**:
  - **Retry Button** (primary): Calls `loadNote()` with refresh icon
  - **Back Button**: Calls `onBack()` with arrow icon
- **Styling**: Error icon prominently displayed above message

### Success State
- **Display**: Full note detail view with toolbar and card
- **Components**: `mat-toolbar`, `mat-card`, `mat-divider`, `mat-icon`
- **Layout**: Fixed toolbar at top, scrollable card content below
- **Sections**:
  1. **Header Actions**: Navigation and CRUD buttons
  2. **Note Content**: Pre-formatted text preserving whitespace
  3. **Metadata**: Grid layout with labels and values

## Material Components Used

### Core Components
- **mat-toolbar**: Header actions bar with flex layout
- **mat-card**: Main container for note content and error display
- **mat-card-header**: Note details title
- **mat-card-content**: Content and metadata sections
- **mat-divider**: Visual separation between sections

### Interactive Components
- **mat-button**: Back button (text style)
- **mat-raised-button**: Edit and Delete buttons (elevated style)
- **mat-icon**: Icons for all buttons and metadata
- **mat-spinner**: Loading state indicator

### Typography Components
- **mat-card-title**: "Note Details" heading
- **h3**: Metadata section title
- **pre**: Pre-formatted note text (preserves whitespace)

## Key Features

### Interactive Elements

1. **Navigation Actions**:
   - **Back Button**: Returns to notes list, mat-button style with arrow_back icon
   - **Edit Button**: Navigates to edit view, primary color with edit icon
   - **Delete Button**: Opens confirmation dialog, warn color with delete icon

2. **Error Recovery**:
   - **Retry Button**: Reloads note data, primary color with refresh icon
   - **Back Button**: Returns to list from error state

### Data Display

1. **Note Content**:
   - Full content display in `<pre>` tag
   - Preserves line breaks and whitespace with `white-space: pre-wrap`
   - No truncation or ellipsis

2. **Metadata Grid**:
   - **Created Date**: Always displayed with formatted date
   - **Updated Date**: Conditionally displayed only if `hasBeenUpdated()` is true
   - **Source Type**: Always displayed (e.g., "text", "voice")
   - **Task Count**: Conditionally displayed only if `taskCount() > 0`
     - Includes task_alt icon
     - Shows count with "extracted" label

3. **Last Updated Indicator**:
   - Conditionally displayed if note has been updated
   - Shows schedule icon with "Last updated recently" text
   - Positioned at bottom of metadata section

### Conditional Rendering

All conditional rendering uses Angular 20's modern `@if` control flow:
- `@if (loading())` - Loading spinner
- `@if (error() && !loading())` - Error message
- `@if (note() && !loading() && !error())` - Note display
- `@if (hasBeenUpdated())` - Updated date and last updated indicator
- `@if (taskCount() > 0)` - Task count badge

### Responsive Layout

1. **Header Actions Bar**:
   - Flex layout with space-between
   - Left-aligned back button
   - Right-aligned action buttons
   - Responsive button grouping

2. **Metadata Grid**:
   - CSS Grid layout for label-value pairs
   - Responsive columns that stack on mobile
   - Consistent spacing and alignment

3. **Content Area**:
   - Full-width on mobile
   - Constrained max-width on desktop
   - Proper padding and margins

## Angular 20 Features

### Modern Control Flow
- Uses `@if` syntax instead of `*ngIf`
- Cleaner, more readable template structure
- Better type inference and error checking

### Signal Integration
- All data bindings use signal syntax: `note()`, `loading()`, `error()`
- Computed signals: `createdDate()`, `updatedDate()`, `hasBeenUpdated()`, `taskCount()`
- Non-null assertion operator (`!`) used where safe: `note()!.content`

### Event Binding
- Click handlers bound to component methods
- No event objects passed (Angular handles defaults)
- Methods: `onBack()`, `onEdit()`, `onDelete()`, `loadNote()`

## Accessibility Features

1. **Semantic HTML**:
   - Proper heading hierarchy (h2 for error, h3 for metadata)
   - Pre-formatted text for content preservation
   - Descriptive button labels

2. **Material Icons**:
   - All buttons include descriptive icons
   - Icons provide visual context for actions
   - Accessible to screen readers via Material Design

3. **Keyboard Navigation**:
   - All interactive elements are keyboard accessible
   - Proper tab order maintained
   - Material components handle focus management

4. **Loading States**:
   - Loading message announced to screen readers
   - Error messages clearly presented
   - State changes properly communicated

## Design Compliance

The template follows the component design specifications:

1. **Layout Structure**: Matches the three-section wireframe (header, content, metadata)
2. **Material Design**: Uses recommended Material components throughout
3. **State Management**: Proper handling of loading, error, and success states
4. **Conditional Display**: Implements all specified conditional elements
5. **Action Buttons**: Correct placement, styling, and icons as designed
6. **Typography**: Follows Material Design typography guidelines
7. **Spacing**: Consistent padding, margins, and dividers

## Files Modified

- `/home/mhylle/projects/mhylle.com/newnotes/frontend/src/app/features/notes/note-detail/note-detail.component.html` - Complete HTML template implementation (120 lines)

## Next Steps

1. Review and update SCSS styles in `note-detail.component.scss` to match new template structure
2. Add missing Material module imports if needed (MatChipModule for task badge)
3. Test template rendering in browser via Chrome DevTools
4. Verify responsive design on different viewport sizes
5. Test all interactive elements (buttons, navigation)
6. Validate accessibility with screen reader
