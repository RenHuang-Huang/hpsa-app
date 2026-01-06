CREATE TABLE IF NOT EXISTS reagents (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inspection_results (
    uuid TEXT PRIMARY KEY,
    -- Primary Data
    id_no TEXT NOT NULL,
    -- 身分證/居留證號
    name TEXT,
    -- 姓名 (New)
    gender TEXT,
    -- 性別 (New)
    birth_date TEXT,
    -- 出生日期 (New)
    hospital_id TEXT NOT NULL,
    -- 醫療院所代碼
    outpatient_date TEXT NOT NULL,
    -- 門診日期 (ROC YYYMMDD)
    lab_id TEXT NOT NULL,
    -- 檢驗機構代碼
    lab_date TEXT NOT NULL,
    -- 檢驗日期 (ROC YYYMMDD)
    result INTEGER NOT NULL,
    -- 檢驗結果 (0=陰性, 1=陽性, 2=檢測失效)
    reagent_code TEXT NOT NULL,
    -- 試劑名稱 (Code)
    order_number TEXT,
    -- 檢驗單號 (New)
    report_date TEXT NOT NULL,
    -- 報告日期 (ROC YYYMMDD)
    -- Conditional Reagent (if Reagent Code = 999)
    other_reagent_zh TEXT,
    -- 其他試劑(中)
    other_reagent_en TEXT,
    -- 其他試劑(英)
    other_license_no TEXT,
    -- 許可證字號
    other_expire_date TEXT,
    -- 有效期限
    -- Secondary Data (if Result = 2)
    second_outpatient_date TEXT,
    -- 二次門診日期
    second_lab_date TEXT,
    -- 二次檢驗日期
    second_result INTEGER,
    -- 二次結果
    second_reagent_code TEXT,
    -- 二次試劑名稱
    second_report_date TEXT,
    -- 二次報告日期 (New)
    -- Secondary Other Reagent (if Second Reagent Code = 999)
    second_other_reagent_zh TEXT,
    second_other_reagent_en TEXT,
    second_other_license_no TEXT,
    second_other_expire_date TEXT,
    -- System
    is_printed BOOLEAN DEFAULT 0,
    is_exported BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- New Tables for User Settings & Hospital Management
CREATE TABLE IF NOT EXISTS hospitals (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);