# AI Coding Style Guide (HpSA Project)

This guide defines the coding standards and conventions for the HpSA project. All AI-generated code must adhere to these rules.

## 1. General Principles
-   **Language**: TypeScript is mandatory for all `.ts` and `.tsx` files.
-   **UI Language**: All user-facing text (labels, messages, errors) must be in **Traditional Chinese (繁體中文)**.
-   **Modularity**: Keep components small and focused. Extract utility functions to `src/lib`.
-   **Safety**: Always validate external inputs (User input, File imports).

## 2. Tech Stack Specifics

### React & Hooks
-   Use **Functional Components** with Hooks.
-   Use `const` for component definitions.
-   **Props**: Define explicit Interfaces/Types for props.
    ```tsx
    interface MyComponentProps {
        title: string;
        isActive?: boolean;
    }
    export const MyComponent = ({ title, isActive }: MyComponentProps) => { ... }
    ```
-   **Forms**: Use `react-hook-form` paired with `zod` for validation.
-   **Exports**: Use Named Exports (e.g., `export const App ...`) unless it's a page component where default export is idiomatic for routing (though this project seems to not use a router library heavily, sticking to named exports is safe).

### Styling (Tailwind CSS)
-   Use `tailwind-merge` and `clsx` via a `cn()` utility for class name merging.
-   Do not write custom CSS in `.css` files unless absolutely necessary (animations, heavy overrides). Use Tailwind types.
-   Group related Tailwind classes logically (Layout → Box Model → Typography → Visuals).
    ```tsx
    <div className="flex h-full w-full flex-col bg-white p-4">
    ```

### Electron & IPC
-   **Pattern**: Use `ipcMain.handle` (Main) and `ipcRenderer.invoke` (Renderer) for asynchronous communication.
-   **Type Safety**: Avoid `any` in IPC payloads. Define shared types in `src/types.ts` or similar shared location if possible.
-   **Error Handling**:
    -   **Main**: Catch errors in handlers and return `{ success: false, message: string }` object.
    -   **Renderer**: Check `success` flag and show toast notifications (`sonner`) for errors.

### Database (better-sqlite3)
-   Use `db.prepare(...).run()` or `.get()` or `.all()`.
-   **Parameters**: Always use named parameters (`@param`) or question marks (`?`) to prevent SQL injection. Never concatenate strings.
-   **Transactions**: Use `db.transaction()` for batch inserts/updates.

## 3. File & Naming Conventions
-   **Files**: `camelCase` for utilities (`validators.ts`), `PascalCase` for Components (`RecordForm.tsx`).
-   **Variables**: `camelCase` (e.g., `const userList = ...`).
-   **Constants**: `UPPER_SNAKE_CASE` (e.g., `const MAX_RETRY = 3`).
-   **Interfaces/Types**: `PascalCase` (e.g., `interface InspectionRecord`).

## 4. Documentation
-   **JSDoc**: Add JSDoc comments for complex logic, especially helper functions in `src/lib`.
-   **Comments**: Use Comments to explain *WHY*, not *WHAT*, unless the code is obscure.

## 5. Specific Project Patterns
-   **Date Format**: "ROC Date" stands for Republic of China calendar (e.g., 1120101). Always validate this format using `isValidROCDate`.
-   **Lists/Grids**: When displaying data tables, ensure virtualization or pagination if data > 100 rows. (Current code limits query to 500).
