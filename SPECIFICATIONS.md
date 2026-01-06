# Project Specifications: HpSA Screening System

## 1. Project Overview
**HpSA Screening System (HpSA 篩檢系統)** is a desktop application built with Electron, designed to manage medical inspection results, specifically for H.pylori screening (implied by name). It allows medical personnel to input, manage, search, print, and export inspection data.

## 2. Technology Stack

### Core Frameworks
-   **Runtime**: Electron (v30+)
-   **Frontend**: React (v18), Vite (v5)
-   **Language**: TypeScript (v5)
-   **Language Level (UI)**: Traditional Chinese (zh-TW)

### Data & State
-   **Database**: SQLite (via `better-sqlite3`)
-   **Local Storage**: `electron-store` (or similar config file mechanism) for user preferences.
-   **Form Management**: `react-hook-form`
-   **Validation**: `zod` featuring custom validators for ROC dates and Taiwan ID numbers.

### UI & Styling
-   **Styling Engine**: Tailwind CSS (v4)
-   **Component Primitives**: Radix UI (Dialog, Label, Slot, Tooltip)
-   **Icons**: `lucide-react`
-   **Toast Notifications**: `sonner`
-   **Utilities**: `clsx`, `tailwind-merge`

### Build & Tooling
-   **Builder**: `electron-builder`
-   **Linter**: ESLint
-   **Package Manager**: npm

## 3. Key Features

### 3.1 Authentication & User Management
-   **Login System**: Username/Password authentication.
-   **Initial Setup**: Ability to create the first admin user if no users exist.
-   **Security**: Password hashing using PBKDF2/SHA512.

### 3.2 Record Management (Inspection Results)
-   **CRUD Operations**: Create, Read, Update, Delete records.
-   **Fields**:
    -   **Patient Info**: ID (Taiwan ID validation), Name, Gender, Birth Date (ROC format).
    -   **Visit Info**: Hospital Code, Outpatient Date, Report Date.
    -   **Lab Info**: Lab Code, Lab Date, Order Number (Auto-increment per date).
    -   **Result**: Positive (1), Negative (0), Invalid (2).
    -   **Reagents**: Reagent Code (001-042). Special code '999' triggers additional fields (Other Name EN/ZH, License No, Expiry).
    -   **Secondary Result**: If primary result is invalid (2), allows inputting a secondary result/reagent.
-   **Validation**: Strict validation for ROC dates (7 digits), Byte-length limits for texts, Cross-field dependencies (e.g., if Reagent=999, extra fields required).

### 3.3 Search & Filtering
-   **Quick Filter**: By Hospital ID.
-   **Global Search**: text search across ID, Name, Hospital Name, Birth Date.
-   **Advanced Filter**: Detailed filters for specific fields (Order No, Result, Printed Status, Exported Status, etc.).
-   **Date Range**: Filter by Lab Date.

### 3.4 Hospital Management
-   **Master Data**: Manage list of hospitals (Code, Name).
-   **Import**: Bulk import hospitals from Excel/CSV.

### 3.5 System Settings
-   **Database Path**: View and modify the location of the SQLite database (`hpsa_prod.db`). Requires restart.
-   **General Settings**: Key-Value store for application defaults.

### 3.6 Export & Reporting
-   **Export**: Generate CSV/TXT files for reporting.
    -   **Logic**: Filter by date/hospital, format filename as `HpSAA{LabId}_{RocYM}.csv`.
    -   **Modes**: Full export or "Deletion" export.
-   **Printing**: Mark records as "Printed" to track status. Print template handling (Paper size, formatting).

## 4. Database Schema (SQLite)

### `inspection_results`
Stores the core inspection data.
-   `uuid` (PK)
-   `id_no`, `name`, `gender`, `birth_date`
-   `hospital_id`, `outpatient_date`
-   `lab_id`, `lab_date`, `result`
-   `reagent_code`, `order_number`, `report_date`
-   `other_*` fields for custom reagents
-   `second_*` fields for re-tests
-   `is_printed`, `is_exported` (Flags)
-   `created_at`, `updated_at`

### `hospitals`
-   `code` (PK), `name`

### `users`
-   `username` (PK), `password_hash`, `salt`

### `reagents` (Master Data)
-   `code` (PK), `name`

## 5. Directory Structure
-   `/src`: Frontend React code.
    -   `/components`: Reusable UI components.
    -   `/lib`: Utilities and validators.
    -   `/services`: API layers (if any).
-   `/electron`: Main process code.
    -   `main.ts`: Entry point.
    -   `ipc.ts`: IPC Handlers (Backend API).
    -   `db.ts`: Database connection invocation.
    -   `schema.sql`: DB Schema definition.
