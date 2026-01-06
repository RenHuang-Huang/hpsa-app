import { useState, useEffect, forwardRef, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Activity, Plus, FileOutput, Search, Edit, Trash2, Printer, FileText,
  LayoutDashboard, X, AlertCircle,
  Calendar, Building2, User, Settings, Save, Archive, Database, Filter
} from 'lucide-react';
import { cn, toRocDate } from './lib/utils'; // Ensure this exists
import { useToast } from './hooks/use-toast';
import { Toaster } from './components/ui/toaster';

// TypeSafe IPC Wrapper (Mocking for dev if needed, but assuming window.ipcRenderer)
const ipc = (window as any).ipcRenderer;

// --- UI Primitives ---
const Button = ({ className, children, variant = "default", ...props }: any) => {
  const variants: any = {
    default: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    outline: "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shadow-sm",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    destructive: "bg-red-50 text-red-600 hover:bg-red-100",
    secondary: "bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50"
  };
  return (
    <button className={cn("inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95", variants[variant], className)} {...props}>
      {children}
    </button>
  );
};

const Input = forwardRef(({ className, icon: Icon, ...props }: any, ref: any) => (
  <div className="relative">
    {Icon && <Icon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />}
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
        Icon && "pl-9",
        className
      )}
      {...props}
    />
  </div>
));
Input.displayName = "Input";

const RocDateInput = forwardRef(({ className, value, onChange, ...props }: any, ref: any) => {
  // Format: 1120101 -> 112/01/01
  const formatDisplay = (val: string | number | undefined): string => {
    if (!val) return '';
    const strVal = String(val).replace(/\D/g, '');
    if (strVal.length <= 3) return strVal;
    if (strVal.length <= 5) return `${strVal.slice(0, 3)}/${strVal.slice(3)}`;
    return `${strVal.slice(0, 3)}/${strVal.slice(3, 5)}/${strVal.slice(5, 7)}`;
  };

  const [displayValue, setDisplayValue] = useState(formatDisplay(value));
  const lastValueRef = useRef(value);

  // Sync state if parent value changes externally
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setDisplayValue(formatDisplay(value));
      lastValueRef.current = value;
    }
  }, [value]);

  const handleChange = (e: any) => {
    let inputVal = e.target.value;

    // Allow digits and slash
    inputVal = inputVal.replace(/[^0-9/]/g, '');

    // Calculate raw value for parent (digits only)
    const clean = inputVal.replace(/\D/g, '').slice(0, 7);

    setDisplayValue(inputVal); // Let user type freely

    if (clean !== lastValueRef.current) {
      lastValueRef.current = clean;
      onChange({ target: { value: clean, name: props.name } });
    }
  };

  const handleBlur = () => {
    // On blur, enforce format (YYY/MM/DD)
    const clean = displayValue.replace(/\D/g, '').slice(0, 7);
    const formatted = formatDisplay(clean);
    setDisplayValue(formatted);
  };

  return (
    <div className="relative">
      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input
        type="text"
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="___/__/__"
        className={cn(
          "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 text-sm placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 font-mono",
          className
        )}
        maxLength={11} // Allow a bit more room for typing before format
        {...props}
      />
    </div>
  );
});
RocDateInput.displayName = "RocDateInput";

const Label = ({ className, children }: any) => <label className={cn("text-sm font-medium leading-none text-slate-700 mb-1.5 block", className)}>{children}</label>;

const Badge = ({ variant, children, ...props }: any) => {
  const variants: any = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    default: "bg-slate-100 text-slate-700 border-slate-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    destructive: "bg-red-50 text-red-700 border-red-200",
    info: "bg-blue-50 text-blue-700 border-blue-200"
  };
  // Handle case where variant is 2 (deleted) but mapped to 'destructive' in usage
  // Usage: variant={r.is_exported === 2 ? 'destructive' : ...}
  // My variants object didn't have 'destructive' key in the original code I read!
  // Original code: success, default, warning, danger.
  // Usage uses: 'destructive'.
  // I must add 'destructive' key.

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], props.className)} {...props}>
      {children}
    </span>
  );
};

// --- Schemas ---
import { formSchema } from './schema';
import { getPrintTemplate } from './printTemplate';
import { isValidTaiwanID } from './lib/validators';
import reagentsData from './resources/reagents.json';

// Reagent Codes 001-042
const REAGENT_OPTIONS = reagentsData.map(r => ({
  value: r.Code,
  label: `${r.Code} - ${r.License}`
}));

// --- Hooks ---
const useEnterNavigation = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle Enter and ArrowUp
    if (e.key !== 'Enter' && e.key !== 'ArrowUp') return;

    const target = e.target as HTMLElement;
    // Only act if target is an input-like element
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    // Check input type for specific exclusions
    if (target instanceof HTMLInputElement && (target.type === 'submit' || target.type === 'button' || target.type === 'radio' || target.type === 'checkbox')) return;

    const container = ref.current;
    if (!container) return;

    // Find all focusable inputs
    const selectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])';
    const inputs = Array.from(container.querySelectorAll(selectors)) as HTMLElement[];

    const currentIndex = inputs.indexOf(target);
    if (currentIndex === -1) return;

    e.preventDefault();

    if (e.key === 'Enter') {
      const nextIndex = currentIndex + 1;
      if (nextIndex < inputs.length) {
        inputs[nextIndex].focus();
      }
    } else if (e.key === 'ArrowUp') {
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        inputs[prevIndex].focus();
      }
    }
  }, []);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    if (ref.current) {
      ref.current.removeEventListener('keydown', handleKeyDown);
    }
    ref.current = node;
    if (ref.current) {
      ref.current.addEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  return setRef;
};

// App Component
export default function App() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("records");
  const [activeStatusMenu, setActiveStatusMenu] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ default_lab_id: '', default_reagent_code: '' });
  const [dbConfig, setDbConfig] = useState<{ path: string, isCustom: boolean }>({ path: '', isCustom: false });

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Initial Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      if (ipc) {
        try {
          const { isInitialized } = await ipc.invoke('auth-check-status');
          if (!isInitialized) {
            setIsSetupMode(true);
          }
        } catch (e) {
          console.error("Auth check failed", e);
        } finally {
          setIsAuthChecking(false);
        }
      } else {
        // Dev mode without IPC
        setIsAuthenticated(true);
        setIsAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  /* Hook for Keyboard Navigation - Defined Unconditionally */
  const loginRef = useEnterNavigation();
  const recordFormRef = useEnterNavigation();
  const usernameRef = useRef<HTMLInputElement>(null);

  // Auto-focus username on auth screen
  useEffect(() => {
    if (!isAuthenticated && !isAuthChecking) {
      // Small timeout to ensure render
      setTimeout(() => {
        usernameRef.current?.focus();
      }, 100);
    }
  }, [isAuthenticated, isAuthChecking]);

  const handleLogin = async () => {
    if (!authUsername || !authPassword) {
      toast({ title: "錯誤", description: "請輸入帳號密碼", variant: "destructive" });
      return;
    }
    try {
      if (isSetupMode) {
        const res = await ipc.invoke('auth-setup', { username: authUsername, password: authPassword });
        if (res.success) {
          toast({ title: "成功", description: "帳號建立成功，請填寫系統預設值" });
          setIsSetupMode(false);
          setIsAuthenticated(true); // Auto-login after setup
          setActiveTab('settings'); // Redirect to Settings
        } else {
          toast({ title: "錯誤", description: res.message || "建立失敗", variant: "destructive" });
        }
      } else {
        const res = await ipc.invoke('auth-login', { username: authUsername, password: authPassword });
        if (res.success) {
          setIsAuthenticated(true);
          toast({ title: "登入成功", description: "歡迎回來" });
        } else {
          toast({ title: "登入失敗", description: res.message || "帳號或密碼錯誤", variant: "destructive" });
        }
      }
    } catch (e: any) {
      toast({ title: "系統錯誤", description: e.message, variant: "destructive" });
    }
  };
  // UI State
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");

  const [selectedRecordUuids, setSelectedRecordUuids] = useState<string[]>([]);

  // Advanced Search State
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    order_number: "",
    lab_date: "",
    hospital_name: "",
    name: "",
    birth_date: "",
    id_no: "",
    outpatient_date: "",
    result: "" as "" | "0" | "1" | "2", // "" means all
    is_printed: "" as "" | "0" | "1", // "" means all
    is_exported: "" as "" | "0" | "1" | "2" // "" means all
  });

  // Export State
  const [exportHospitalId, setExportHospitalId] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  // Record Dialog State
  const [currentRecordUuid, setCurrentRecordUuid] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id_no: "", name: "", gender: "M", birth_date: "",
      hospital_id: "", outpatient_date: "",
      lab_id: settings.default_lab_id || "",
      lab_date: toRocDate(new Date()),
      result: "0" as "0" | "1" | "2",
      reagent_code: settings.default_reagent_code || "001",
      order_number: "", // Will autofill
      report_date: toRocDate(new Date()),

      second_outpatient_date: "",
      second_lab_date: "",
      second_result: "0",
      second_reagent_code: "",
      second_report_date: ""
    }
  });

  // --- Load Initial Data ---
  useEffect(() => {
    loadHospitals();
    loadSettings();
    loadDbConfig();
    // Default load (e.g. 30 days)
    loadRecords();
  }, []); // Only run once on mount

  useEffect(() => {
    if (!ipc) {
      console.error("IPC Renderer is missing!");
      // alert("Error: IPC Bridge not found. The app may not function correctly.");
    } else {
      console.log("IPC Bridge connected.");
    }
  }, []);

  const loadRecords = async (override?: { search?: string, startDate?: string, endDate?: string, filters?: any }) => {
    if (ipc) {
      try {
        const queryParams = {
          search: override?.search !== undefined ? override.search : search,
          startDate: override?.startDate !== undefined ? override.startDate : searchStartDate,
          endDate: override?.endDate !== undefined ? override.endDate : searchEndDate,
          filters: override?.filters !== undefined ? override.filters : (isAdvancedSearchOpen ? advancedFilters : undefined)
        };

        console.log("Loading records...", queryParams);
        const data = await ipc.invoke('get-records', queryParams);
        console.log("Records loaded:", data);
        setRecords(data);
      } catch (err) {
        console.error("Failed to load records:", err);
        alert("Failed to load records: " + err);
      }
    } else {
      console.warn("Skipping loadRecords - No IPC");
    }
  };

  const loadHospitals = async () => {
    if (ipc) {
      try {
        console.log("Loading hospitals...");
        const data = await ipc.invoke('get-hospitals');
        console.log("Hospitals loaded:", data);
        setHospitals(data);
      } catch (e) {
        console.error("Failed to load hospitals", e);
      }
    }
  };

  const loadSettings = async () => {
    if (ipc) {
      const data = await ipc.invoke('get-settings');
      if (data) setSettings(data);
    }
  };

  const loadDbConfig = async () => {
    if (ipc) {
      const config = await ipc.invoke('get-db-config');
      setDbConfig(config);
    }
  };

  // --- Handlers ---

  const handleOpenRecordDialog = () => {
    // Auto-fill defaults from Settings
    // Ensure we are in "Create Mode" (no uuid)
    setCurrentRecordUuid(null);
    form.reset({
      id_no: "",
      name: "",
      gender: "M",
      birth_date: "",
      hospital_id: "",
      outpatient_date: "",
      lab_id: settings.default_lab_id || "",
      lab_date: toRocDate(new Date()),
      result: "" as any, // Default empty to force selection
      reagent_code: settings.default_reagent_code || "",
      order_number: "",
      report_date: toRocDate(new Date()),

      // Other (Conditional) defaults
      other_reagent_zh: settings.default_reagent_code === '999' ? settings.default_other_reagent_zh : "",
      other_reagent_en: settings.default_reagent_code === '999' ? settings.default_other_reagent_en : "",
      other_license_no: settings.default_reagent_code === '999' ? settings.default_other_license_no : "",
      other_expire_date: settings.default_reagent_code === '999' ? settings.default_other_expire_date : "",

      // Secondary (Reset to empty/default)
      second_outpatient_date: "",
      second_lab_date: "",
      second_result: "" as any, // Default empty
      second_reagent_code: "",
      second_report_date: "",

      second_other_reagent_zh: "",
      second_other_reagent_en: "",
      second_other_license_no: "",
      second_other_expire_date: ""
    });
    setIsRecordDialogOpen(true);
  };



  const handleEditRecord = (record: any) => {
    setCurrentRecordUuid(record.uuid);
    form.reset({
      id_no: record.id_no,
      name: record.name || "",
      gender: record.gender || "M",
      birth_date: record.birth_date || "",
      hospital_id: record.hospital_id,
      outpatient_date: record.outpatient_date,
      lab_id: record.lab_id,
      lab_date: record.lab_date,
      result: String(record.result) as any,
      reagent_code: record.reagent_code,
      order_number: record.order_number || "",
      report_date: record.report_date,

      // Primary Reagent 999 Fields
      other_reagent_zh: record.other_reagent_zh || "",
      other_reagent_en: record.other_reagent_en || "",
      other_license_no: record.other_license_no || "",
      other_expire_date: record.other_expire_date || "",

      second_outpatient_date: record.second_outpatient_date || "",
      second_lab_date: record.second_lab_date || "",
      second_result: ((record.second_result !== null && record.second_result !== undefined && record.second_result !== '') ? String(record.second_result) : "") as any,
      second_reagent_code: record.second_reagent_code || "",
      second_report_date: record.second_report_date || "",

      // Secondary Reagent 999 Fields
      second_other_reagent_zh: record.second_other_reagent_zh || "",
      second_other_reagent_en: record.second_other_reagent_en || "",
      second_other_license_no: record.second_other_license_no || "",
      second_other_expire_date: record.second_other_expire_date || ""
    });
    setIsRecordDialogOpen(true);
  };

  const onSubmitRecord = async (data: any) => {
    if (ipc) {
      const payload = currentRecordUuid ? { ...data, uuid: currentRecordUuid } : data;
      await ipc.invoke('save-record', payload);
      loadRecords();
      setIsRecordDialogOpen(false);
    }
  };

  const handleDeleteRecord = async (uuid: string) => {
    if (ipc && await ipc.invoke('show-confirm', { message: '確定要刪除此筆紀錄嗎？' })) {
      await ipc.invoke('delete-record', uuid);
      loadRecords();
    }
  }

  // F1 Shortcut for New Record
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (activeTab === 'records') {
          handleOpenRecordDialog();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Dialog Focus Fix
  useEffect(() => {
    if (isRecordDialogOpen) {
      // Small timeout to ensure dialog is rendered and transition complete
      const timer = setTimeout(() => {
        form.setFocus("hospital_id");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRecordDialogOpen, form]);

  // Auto-Numbering Logic (New Record Only)
  const currentLabDate = form.watch("lab_date");
  useEffect(() => {
    const fetchNextOrder = async () => {
      if (!currentRecordUuid && ipc && isRecordDialogOpen && currentLabDate) {
        try {
          // Only if empty? User requirement says "automatically bring in".
          // If user clears it, maybe re-fetch?
          // Simplest: Always fetch on date change if new record.
          const nextNum = await ipc.invoke('get-next-order-number', currentLabDate);
          form.setValue("order_number", nextNum);
        } catch (e) {
          console.error("Failed to fetch next order number", e);
        }
      }
    };
    fetchNextOrder();
  }, [currentLabDate, currentRecordUuid, ipc, isRecordDialogOpen, form]);

  // Add effect to auto-fill defaults when 999 is selected
  useEffect(() => {
    const sub = form.watch((value, { name }) => {
      // Primary Reagent 999
      if (name === 'reagent_code' && value.reagent_code === '999') {
        const currentVal = form.getValues();
        if (!currentVal.other_reagent_zh) form.setValue('other_reagent_zh', settings.default_other_reagent_zh || "");
        if (!currentVal.other_reagent_en) form.setValue('other_reagent_en', settings.default_other_reagent_en || "");
        if (!currentVal.other_license_no) form.setValue('other_license_no', settings.default_other_license_no || "");
        if (!currentVal.other_expire_date) form.setValue('other_expire_date', settings.default_other_expire_date || "");
      }
      // Secondary Reagent 999
      if (name === 'second_reagent_code' && value.second_reagent_code === '999') {
        const currentVal = form.getValues();
        if (!currentVal.second_other_reagent_zh) form.setValue('second_other_reagent_zh', settings.default_other_reagent_zh || "");
        if (!currentVal.second_other_reagent_en) form.setValue('second_other_reagent_en', settings.default_other_reagent_en || "");
        if (!currentVal.second_other_license_no) form.setValue('second_other_license_no', settings.default_other_license_no || "");
        if (!currentVal.second_other_expire_date) form.setValue('second_other_expire_date', settings.default_other_expire_date || "");
      }


      // Auto-detect gender from ID
      if (name === 'id_no' && value.id_no && value.id_no.length >= 2) {
        const secondChar = value.id_no.charAt(1);
        if (secondChar === '1') {
          form.setValue('gender', 'M');
        } else if (secondChar === '2') {
          form.setValue('gender', 'F');
        }
      }
    });

    return () => sub.unsubscribe();
  }, [form.watch, settings]);

  // Hospital Management Handlers
  const [newHospitalCode, setNewHospitalCode] = useState("");
  const [newHospitalName, setNewHospitalName] = useState("");
  const handleAddHospital = async () => {
    if (!newHospitalCode || !newHospitalName) return toast({ title: "錯誤", description: "請輸入完整資訊", variant: "destructive" });

    // Strict Length Check
    if (newHospitalCode.length !== 10) {
      toast({ title: "錯誤", description: "院所代碼需為 10 碼", variant: "destructive" });
      return;
    }

    if (ipc) {
      try {
        console.log("Saving hospital...", { code: newHospitalCode, name: newHospitalName });
        const res = await ipc.invoke('save-hospital', { code: newHospitalCode, name: newHospitalName });
        console.log("Save hospital result:", res);
        setNewHospitalCode(""); setNewHospitalName("");
        await loadHospitals();
        toast({ title: "新增成功", description: "院所資料已更新", variant: "success" });
      } catch (e: any) {
        console.error("Save hospital failed:", e);
        toast({ title: "新增失敗", description: e.message, variant: "destructive" });
      }
    } else {
      toast({ title: "系統錯誤", description: "IPC not available", variant: "destructive" });
    }
  };

  const handleDeleteHospital = async (code: string) => {
    if (ipc) {
      await ipc.invoke('delete-hospital', code);
      loadHospitals();
      toast({ title: "已刪除", variant: "default" });
    }
  };

  const handleEditHospital = (h: any) => {
    setNewHospitalCode(h.code);
    setNewHospitalName(h.name);
  };



  // Settings Handlers
  const handleImportHospital = async () => {
    if (ipc) {
      const res = await ipc.invoke('import-hospitals');
      if (res.success) {
        toast({ title: "匯入成功", description: `已成功匯入 ${res.count} 筆資料`, variant: "success" });
        loadHospitals();
      } else if (res.message !== '取消匯入') {
        toast({ title: "匯入失敗", description: res.message, variant: "destructive" });
      }
    }
  };

  const handleSaveSettings = async () => {
    // Strict Length Check
    if (settings.default_lab_id && settings.default_lab_id.length !== 10) {
      if (ipc) await ipc.invoke('show-alert', { message: '錯誤：預設檢驗機構代碼需為 10 碼', type: 'error' });
      else alert("錯誤：預設檢驗機構代碼需為 10 碼");
      return;
    }

    // New Validation for 999
    if (settings.default_reagent_code === '999') {
      const { default_other_reagent_zh, default_other_reagent_en, default_other_license_no, default_other_expire_date } = settings;
      if (!default_other_reagent_zh || !default_other_reagent_en || !default_other_license_no || !default_other_expire_date) {
        if (ipc) await ipc.invoke('show-alert', { message: '錯誤：試劑代碼為 999 時，必須填寫完整試劑資訊', type: 'error' });
        else alert("錯誤：試劑代碼為 999 時，必須填寫完整試劑資訊");
        return;
      }

      // Length Checks
      if (default_other_reagent_zh.length > 100) {
        if (ipc) await ipc.invoke('show-alert', { message: '錯誤：試劑中文名稱超過 100 字', type: 'error' });
        return;
      }
      if (default_other_reagent_en.length > 100) {
        if (ipc) await ipc.invoke('show-alert', { message: '錯誤：試劑英文名稱超過 100 字', type: 'error' });
        return;
      }
      if (default_other_license_no.length > 30) {
        if (ipc) await ipc.invoke('show-alert', { message: '錯誤：試劑許可證字號超過 30 字', type: 'error' });
        return;
      }
      // Date is usually strictly controlled by input but just in case
      if (default_other_expire_date.length > 7) {
        if (ipc) await ipc.invoke('show-alert', { message: '錯誤：試劑有效期限格式錯誤 (超過 7 字)', type: 'error' });
        return;
      }
    }
    if (settings.default_reagent_code && settings.default_reagent_code.length !== 3) {
      if (ipc) await ipc.invoke('show-alert', { message: '錯誤：預設試劑代碼需為 3 碼', type: 'error' });
      else alert("錯誤：預設試劑代碼需為 3 碼");
      return;
    }
    if (!settings.default_technologist || settings.default_technologist.trim() === '') {
      if (ipc) await ipc.invoke('show-alert', { message: '錯誤：醫檢師名稱不能為空', type: 'error' });
      else alert("錯誤：醫檢師名稱不能為空");
      return;
    }

    if (ipc) {
      await ipc.invoke('save-setting', { key: 'default_lab_id', value: settings.default_lab_id });
      await ipc.invoke('save-setting', { key: 'default_reagent_code', value: settings.default_reagent_code });
      await ipc.invoke('save-setting', { key: 'default_technologist', value: settings.default_technologist });

      // Save additional 999 fields
      if (settings.default_reagent_code === '999') {
        await ipc.invoke('save-setting', { key: 'default_other_reagent_zh', value: settings.default_other_reagent_zh });
        await ipc.invoke('save-setting', { key: 'default_other_reagent_en', value: settings.default_other_reagent_en });
        await ipc.invoke('save-setting', { key: 'default_other_license_no', value: settings.default_other_license_no });
        await ipc.invoke('save-setting', { key: 'default_other_expire_date', value: settings.default_other_expire_date });
      }

      // Save new settings
      await ipc.invoke('save-setting', { key: 'default_lab_name', value: settings.default_lab_name });
      await ipc.invoke('save-setting', { key: 'print_title_source', value: settings.print_title_source });
      await ipc.invoke('save-setting', { key: 'export_format', value: settings.export_format });

      await ipc.invoke('show-alert', { message: '設定已儲存' });
    }
  };

  // Export Handlers
  // DB Config Handlers
  const handleChangeDbPath = async () => {
    if (ipc) {
      const folderPath = await ipc.invoke('select-db-path');
      if (folderPath) {
        const res = await ipc.invoke('set-db-path', folderPath);
        if (res.success) {
          await ipc.invoke('show-alert', { message: '資料庫路徑已更新，應用程式將自動關閉。請手動開啟以生效。', title: '設定已變更' });
          await ipc.invoke('app-exit');
        } else {
          await ipc.invoke('show-alert', { message: '更新失敗: ' + res.message, type: 'error' });
        }
      }
    }
  };

  const handleResetDbPath = async () => {
    if (ipc) {
      if (await ipc.invoke('show-confirm', { message: '確定要重設為預設資料庫路徑嗎？\n(將回復至安裝目錄下的 hpsa_prod.db)' })) {
        const res = await ipc.invoke('reset-db-path');
        if (res.success) {
          await ipc.invoke('show-alert', { message: '已重設，應用程式將自動關閉。請手動開啟以生效。', title: '設定已變更' });
          await ipc.invoke('app-exit');
        } else {
          await ipc.invoke('show-alert', { message: '重設失敗: ' + res.message, type: 'error' });
        }
      }
    }
  };

  // Export Handlers
  // Export Handlers
  const [exportMode, setExportMode] = useState<'all' | 'selected' | 'selected_del'>('all');

  const handleOpenExportDialog = (mode: 'all' | 'selected' | 'selected_del' = 'all') => {
    setExportMode(mode);
    setExportStartDate("");
    setExportEndDate("");
    setIsExportDialogOpen(true);
  };

  const handleExport = async () => {
    // 1. Validate Default Lab ID (Required for Filename)
    if (!settings.default_lab_id) {
      toast({ title: "錯誤", description: "無法匯出：請先至 [設定] 頁面填寫「預設檢驗機構代碼」", variant: "destructive" });
      return;
    }

    let targetUuids: string[] | undefined = undefined;
    let targetHospitalId = exportHospitalId;

    if (exportMode === 'selected' || exportMode === 'selected_del') {
      targetUuids = selectedRecordUuids;
      if (selectedRecordUuids.length > 0) {
        const firstRec = records.find(r => r.uuid === selectedRecordUuids[0]);
        if (firstRec) targetHospitalId = firstRec.hospital_id;
      }
    } else {
      // Condition: Either Hospital ID OR Date Range (or both)
      if (!exportHospitalId && (!exportStartDate || !exportEndDate)) {
        if (ipc) {
          const confirmed = await ipc.invoke('show-confirm', { message: "未指定院所代碼或日期範圍，確定要匯出所有未申報資料嗎？" });
          if (!confirmed) return;
        } else {
          if (!confirm("未指定院所代碼或日期範圍，確定要匯出所有未申報資料嗎？")) return;
        }
      }
    }

    if (ipc) {
      toast({ title: "匯出中...", description: "請稍候" });
      const suffix = exportMode === 'selected_del' ? 'Del' : undefined;
      const res = await ipc.invoke('export-batch', {
        hospitalId: targetHospitalId,
        labId: settings.default_lab_id, // Pass Lab ID for filename
        startDate: exportMode === 'all' ? exportStartDate : undefined,
        endDate: exportMode === 'all' ? exportEndDate : undefined,
        uuidList: targetUuids,
        suffix: suffix, // Pass suffix if applicable
        format: settings.export_format || 'fixed'
      });
      if (res.success) {
        toast({ title: "匯出成功", description: `共 ${res.count} 筆，檔案：${res.filePath}`, variant: "success" });
        loadRecords(); // Refresh status
        setIsExportDialogOpen(false);
        setIsExportDialogOpen(false);
        setSelectedRecordUuids([]); // Clear selection after export

        // Open browser after export
        if (ipc) {
          await ipc.invoke('open-external', 'https://pportal.hpa.gov.tw/Web/Notice.aspx');
        } else {
          window.open('https://pportal.hpa.gov.tw/Web/Notice.aspx', '_blank');
        }
      } else {
        toast({ title: "匯出失敗", description: res.error || 'Unknown', variant: "destructive" });
      }
    }
  }
  /* Preview Template Logic */
  const handlePreviewTemplate = () => {
    // Helper local to this function or reused if extracted
    const formatRoc = (val: string): string => {
      if (!val || val.length !== 7) return val;
      return `${val.slice(0, 3)}/${val.slice(3, 5)}/${val.slice(5, 7)}`;
    };

    const mockRepo = {
      hospitalName: '測試診所',
      name: 'Mock Patient',
      sex: '男',
      id: '0800501', // Mock ROC Birthday ID
      date: formatRoc('1120520'),
      orderNo: '00001',
      value: '(-)陰性',
      printDate: formatRoc('1120520'), // Match Lab Date
      technologist: settings.default_technologist || '醫檢師',
      birth: formatRoc('0800501'),
      visit: formatRoc('1120519')
    };

    const html = getPrintTemplate(mockRepo, { autoPrint: false });
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      toast({ title: "錯誤", description: "請允許彈跳視窗", variant: "destructive" });
    }
  };

  /* Print Logic */
  const handlePrint = async (recordsToPrint: any[], reportType: 'first' | 'second' | 'both' = 'first') => {
    if (!recordsToPrint || recordsToPrint.length === 0) return;

    const formatRoc = (val: string | number | undefined): string => {
      if (!val) return '';
      const strVal = String(val).replace(/\D/g, '');
      if (strVal.length !== 7) return String(val);
      return `${strVal.slice(0, 3)}/${strVal.slice(3, 5)}/${strVal.slice(5, 7)}`;
    };

    const formatBirthToMedicalId = (birthDate: string | undefined): string => {
      if (!birthDate) return '';
      const clean = birthDate.replace(/\D/g, '');
      if (clean.length === 6) return '0' + clean;
      return clean;
    };

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return toast({ title: "錯誤", description: "請允許彈跳視窗以進行列印", variant: "destructive" });

    const pagesHtml = recordsToPrint.flatMap((r: any) => {
      const hospital = hospitals.find(h => h.code === r.hospital_id);
      const hospitalName = settings.print_title_source === 'lab'
        ? (settings.default_lab_name || "未設定檢驗所名稱")
        : (hospital ? hospital.name : r.hospital_id);

      // Determine which reports to generate for this record
      const typesToGen: ('first' | 'second')[] = [];
      const hasSecond = r.second_result !== null && r.second_result !== undefined && String(r.second_result).trim() !== '';

      if (reportType === 'both') {
        typesToGen.push('first');
        // Only print second if it exists
        if (hasSecond) {
          typesToGen.push('second');
        }
      } else if (reportType === 'second') {
        // Fallback Logic: If 'second' requested but doesn't exist, print 'first'
        if (hasSecond) {
          typesToGen.push('second');
        } else {
          typesToGen.push('first');
        }
      } else {
        typesToGen.push('first'); // Default to 'first'
      }

      return typesToGen.map(type => {
        const targetResult = type === 'second' ? r.second_result : r.result;
        const targetLabDate = type === 'second' ? r.second_lab_date : r.lab_date;
        const targetOutpatientDate = type === 'second' ? r.second_outpatient_date : r.outpatient_date;


        let resultText = '';
        if (String(targetResult) === '0') resultText = '(-)陰性';
        else if (String(targetResult) === '1') resultText = '<span class="red-text">(+)陽性</span>';
        else if (String(targetResult) === '2') resultText = '檢測失效';
        else resultText = '失敗';

        const repo = {
          hospitalName,
          name: r.name || '',
          sex: r.gender === 'M' ? '男' : '女',
          id: formatBirthToMedicalId(r.birth_date),
          orderNo: r.order_number || '',
          value: resultText,
          printDate: formatRoc(targetLabDate), // Typically Lab Date is used for Print Date in Template
          technologist: settings.default_technologist || '醫檢師',
          birth: formatRoc(r.birth_date),
          visit: formatRoc(targetOutpatientDate),
        };
        return getPrintTemplate(repo);
      });
    }).join('');

    printWindow.document.write(pagesHtml);
    printWindow.document.close();
    // Trigger print after a short delay to allow rendering
    setTimeout(async () => {
      if (printWindow) {
        // Mark as printed BEFORE print dialog (to ensure it runs even if dialog blocks or weird state)
        if (ipc) {
          try {
            await ipc.invoke('mark-records-printed', recordsToPrint.map(r => r.uuid));
            loadRecords(); // Refresh UI
          } catch (e) { console.error("Failed to mark printed", e); }
        }

        printWindow.print();
        // printWindow.close(); // Optional: close after print
      }
    }, 500);
  };

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (isAuthChecking) {
    return <div className="flex h-screen items-center justify-center">載入中...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div ref={loginRef} className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isSetupMode ? "系統初次設定" : "系統登入"}
            </h1>
            <p className="text-slate-500">
              {isSetupMode ? "請設定管理員帳號與密碼" : "請輸入帳號密碼以繼續"}
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>帳號</Label>
              <Input
                ref={usernameRef}
                value={authUsername}
                onChange={(e: any) => setAuthUsername(e.target.value)}
                placeholder="輸入帳號"
              />
            </div>
            <div className="space-y-2">
              <Label>密碼</Label>
              <Input
                type="password"
                value={authPassword}
                onChange={(e: any) => setAuthPassword(e.target.value)}
                placeholder="輸入密碼"
                onKeyDown={(e: any) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button className="w-full" onClick={handleLogin}>
              {isSetupMode ? "建立帳號" : "登入"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50/50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden flex-col">
      {!ipc && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-md z-50">
          <AlertCircle className="h-5 w-5" />
          <span className="font-bold">系統錯誤:</span>
          <span>無法連接到後端服務 (IPC Bridge Missing)。請嘗試重新啟動應用程式。</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 transition-all duration-300 ease-in-out overflow-hidden relative",
            isSidebarOpen ? "w-72" : "w-16"
          )}
        >
          <div className="h-16 flex items-center px-4 border-b border-slate-100 bg-white/50 backdrop-blur-sm whitespace-nowrap overflow-hidden">
            <div
              className="min-w-[32px] h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200 mr-3 flex-shrink-0 cursor-pointer hover:bg-indigo-700 transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className={cn("transition-opacity duration-200", isSidebarOpen ? "opacity-100" : "opacity-0 invisible")}>
              <span className="text-base font-bold tracking-tight text-slate-900 block">糞便抗原篩檢申報</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">System v2.1</span>
            </div>
          </div>

          <div className="p-2 space-y-1 overflow-y-auto flex-1 overflow-x-hidden">
            <div className="py-2">
              <h3 className={cn("mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-opacity duration-200 whitespace-nowrap", isSidebarOpen ? "opacity-100" : "opacity-0 hidden")}>主要功能</h3>
              <Button
                variant={activeTab === 'records' ? 'secondary' : 'ghost'}
                className={cn("w-full mb-1 flex justify-start items-center overflow-hidden", isSidebarOpen ? "px-4" : "px-0 justify-center")}
                onClick={() => setActiveTab('records')}
                title={!isSidebarOpen ? "檢驗紀錄管理" : ""}
              >
                <LayoutDashboard className={cn("h-5 w-5 flex-shrink-0", isSidebarOpen ? "mr-2" : "")} />
                <span className={cn("transition-opacity duration-200 whitespace-nowrap", isSidebarOpen ? "opacity-100" : "opacity-0 w-0 hidden")}>檢驗紀錄管理</span>
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
                className={cn("w-full flex justify-start items-center overflow-hidden", isSidebarOpen ? "px-4" : "px-0 justify-center")}
                onClick={() => setActiveTab('settings')}
                title={!isSidebarOpen ? "系統設定與維護" : ""}
              >
                <Settings className={cn("h-5 w-5 flex-shrink-0", isSidebarOpen ? "mr-2" : "")} />
                <span className={cn("transition-opacity duration-200 whitespace-nowrap", isSidebarOpen ? "opacity-100" : "opacity-0 w-0 hidden")}>系統設定與維護</span>
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50">
          {activeTab === 'records' && (
            <>
              <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-20 px-8 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4 text-slate-400">
                  <span className="text-sm font-medium text-slate-900">檢驗紀錄 Dashboard</span>
                </div>
                <div className="flex items-center gap-3">
                  {import.meta.env.DEV && (
                    <>
                      <Button variant="ghost" className="text-xs text-slate-400 hover:text-slate-600" onClick={async () => {
                        if (ipc) {
                          if (await ipc.invoke('show-confirm', { message: 'Generate 100 mock records?' })) {
                            const res = await ipc.invoke('seed-records');
                            if (res.success) {
                              toast({ title: "Mock Data Generated", variant: "success" });
                              loadRecords();
                            } else {
                              toast({ title: "Failed", description: res.message, variant: "destructive" });
                            }
                          }
                        }
                      }}>
                        Mock 100
                      </Button>
                      <Button variant="ghost" className="text-xs text-slate-400 hover:text-indigo-600" onClick={handlePreviewTemplate}>
                        <FileText className="h-4 w-4 mr-1" /> 樣板預覽
                      </Button>
                    </>
                  )}
                  <Button variant="outline" className="gap-2" onClick={() => handleOpenExportDialog('all')}>
                    <FileOutput className="h-4 w-4 text-slate-500" /> 匯出申報檔案
                  </Button>
                  <Button className="gap-2 shadow-indigo-200 shadow-md" onClick={handleOpenRecordDialog}>
                    <Plus className="h-4 w-4" /> 新增紀錄(F1)
                  </Button>
                </div>
              </header>

              <div className="flex-1 overflow-auto p-5">
                <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-lg font-bold text-slate-800">最近檢驗紀錄</h2>
                        {(() => {
                          const isDefault = !search && !searchStartDate && !searchEndDate;
                          let displayStart = searchStartDate;
                          let displayEnd = searchEndDate;

                          if (isDefault) {
                            const now = new Date();
                            const rocYear = now.getFullYear() - 1911;
                            const month = String(now.getMonth() + 1).padStart(2, '0');
                            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                            displayStart = `${rocYear}/${month}/01`;
                            displayEnd = `${rocYear}/${month}/${lastDay}`;
                          }

                          if (displayStart || displayEnd) {
                            return (
                              <span className="text-xs text-slate-500 font-mono">
                                ({displayStart || '...'} ~ {displayEnd || '...'})
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      {selectedRecordUuids.length > 0 && (
                        <div className="flex gap-2">
                          <Button variant="secondary" className="gap-2 h-8" onClick={async () => {
                            const recordsToPrint = records.filter(r => selectedRecordUuids.includes(r.uuid));

                            const hasSecondResult = recordsToPrint.some(r => r.second_result !== null && r.second_result !== undefined && String(r.second_result).trim() !== '');

                            let choice = 'first';
                            if (hasSecondResult && ipc) {
                              const response = await ipc.invoke('show-message-box', {
                                type: 'question',
                                title: '選擇列印報告',
                                message: '偵測到部分紀錄包含二次檢驗結果，請選擇要列印的報告：',
                                buttons: ['第一次報告', '第二次報告', '全部列印', '取消'],
                                cancelId: 3
                              });
                              if (response === 0) choice = 'first';
                              else if (response === 1) choice = 'second';
                              else if (response === 2) choice = 'both';
                              else return;
                            }

                            handlePrint(recordsToPrint, choice as 'first' | 'second' | 'both');
                          }}>
                            <Printer className="h-4 w-4" /> 列印選取 ({selectedRecordUuids.length})
                          </Button>
                          <Button variant="secondary" className="gap-2 h-8" onClick={() => handleOpenExportDialog('selected')}>
                            <FileOutput className="h-4 w-4" /> 匯出選取
                          </Button>
                          {records.filter(r => selectedRecordUuids.includes(r.uuid)).every(r => Number(r.is_exported) === 1) && (
                            <Button variant="secondary" className="gap-2 h-8 bg-red-100 text-red-700 hover:bg-red-200" onClick={() => handleOpenExportDialog('selected_del')}>
                              <Trash2 className="h-4 w-4" /> 匯出欲刪除資料
                            </Button>
                          )}
                        </div>
                      )
                      }
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="relative w-64">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="搜尋姓名、身分證或院所..."
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadRecords()}
                          />
                        </div>
                      </div>


                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">檢驗日期:</span>
                        <div className="w-28">
                          <RocDateInput
                            placeholder="___/__/__"
                            value={searchStartDate}
                            onChange={(e: any) => setSearchStartDate(e.target.value)}
                            onKeyDown={(e: any) => e.key === 'Enter' && loadRecords()}
                            className="h-9 text-xs"
                          />
                        </div>
                        <span className="text-slate-400">-</span>
                        <div className="w-28">
                          <RocDateInput
                            placeholder="___/__/__"
                            value={searchEndDate}
                            onChange={(e: any) => setSearchEndDate(e.target.value)}
                            onKeyDown={(e: any) => e.key === 'Enter' && loadRecords()}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                      <Button onClick={() => loadRecords()} className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white">
                        查詢
                      </Button>
                      <Button
                        variant={isAdvancedSearchOpen ? "secondary" : "outline"}
                        className="gap-2 h-9"
                        onClick={() => setIsAdvancedSearchOpen(true)}
                      >
                        <Filter className="h-4 w-4" /> 進階搜尋
                      </Button>
                      {(search || searchStartDate || searchEndDate || Object.values(advancedFilters).some(v => v !== '')) && (
                        <Button variant="ghost" className="h-9 px-2 text-slate-400 hover:text-red-500" onClick={() => {
                          setSearch("");
                          setSearchStartDate("");
                          setSearchEndDate("");
                          setAdvancedFilters({
                            order_number: "", lab_date: "", hospital_name: "", name: "", birth_date: "", id_no: "", outpatient_date: "", result: "" as any, is_printed: "" as any, is_exported: "" as any
                          });
                          setIsAdvancedSearchOpen(false);
                          loadRecords({ search: "", startDate: "", endDate: "", filters: null });
                        }}>
                          <X className="h-4 w-4 mr-1" /> 清除
                        </Button>
                      )}
                    </div>
                  </div>


                  {/* Advanced Search Dialog */}
                  {isAdvancedSearchOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Filter className="h-5 w-5 text-indigo-600" /> 進階搜尋
                          </h2>
                          <button onClick={() => setIsAdvancedSearchOpen(false)}><X className="h-5 w-5 text-slate-500 hover:text-slate-800" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>檢驗單號</Label>
                              <Input
                                value={advancedFilters.order_number}
                                onChange={(e: any) => setAdvancedFilters({ ...advancedFilters, order_number: e.target.value })}
                                placeholder="例如: 00001"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>檢驗日期</Label>
                              <RocDateInput
                                value={advancedFilters.lab_date}
                                onChange={(e: any) => setAdvancedFilters({ ...advancedFilters, lab_date: e.target.value })}
                                placeholder="___/__/__"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>院所名稱/代碼</Label>
                              <Input
                                value={advancedFilters.hospital_name}
                                onChange={(e: any) => setAdvancedFilters({ ...advancedFilters, hospital_name: e.target.value })}
                                placeholder="輸入名稱關鍵字"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>姓名</Label>
                              <Input
                                value={advancedFilters.name}
                                onChange={(e: any) => setAdvancedFilters({ ...advancedFilters, name: e.target.value })}
                                placeholder="輸入姓名"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>生日</Label>
                              <RocDateInput
                                value={advancedFilters.birth_date}
                                onChange={(e: any) => setAdvancedFilters({ ...advancedFilters, birth_date: e.target.value })}
                                placeholder="___/__/__"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>身分證號</Label>
                              <Input
                                value={advancedFilters.id_no}
                                onChange={(e: any) => setAdvancedFilters({ ...advancedFilters, id_no: e.target.value })}
                                placeholder="輸入身分證號"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>門診日期</Label>
                              <RocDateInput
                                value={advancedFilters.outpatient_date}
                                onChange={(e: any) => setAdvancedFilters({ ...advancedFilters, outpatient_date: e.target.value })}
                                placeholder="___/__/__"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>檢驗結果</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3"
                                value={advancedFilters.result}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, result: e.target.value as any })}
                              >
                                <option value="">全部</option>
                                <option value="0">陰性 (-)</option>
                                <option value="1">陽性 (+)</option>
                                <option value="2">檢測失效</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>列印狀態</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3"
                                value={advancedFilters.is_printed}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, is_printed: e.target.value as any })}
                              >
                                <option value="">全部</option>
                                <option value="0">未列印</option>
                                <option value="1">已列印</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>上傳狀態</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3"
                                value={advancedFilters.is_exported}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, is_exported: e.target.value as any })}
                              >
                                <option value="">全部</option>
                                <option value="0">待申報</option>
                                <option value="1">已匯出</option>
                                <option value="2">已刪除</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                          <Button variant="ghost" onClick={() => {
                            setAdvancedFilters({
                              order_number: "", lab_date: "", hospital_name: "", name: "", birth_date: "", id_no: "", outpatient_date: "", result: "" as any, is_printed: "" as any, is_exported: "" as any
                            });
                          }}>重置條件</Button>
                          <Button onClick={() => {
                            // Keep dialog open? Maybe close it.
                            // User usually expects "Search" to execute and show results.
                            // I will close it for better UX, or let them refine?
                            // "查詢" usually implies action.
                            loadRecords();
                            setIsAdvancedSearchOpen(false);
                          }} className="bg-indigo-600 text-white hover:bg-indigo-700 w-32">
                            搜尋
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-4 w-10">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={records.length > 0 && selectedRecordUuids.length === records.length}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedRecordUuids(records.map(r => r.uuid));
                                else setSelectedRecordUuids([]);
                              }}
                            />
                          </th>
                          <th className="px-3 py-3">檢驗單號</th>
                          <th className="px-3 py-3">檢驗日期</th>
                          <th className="px-3 py-3">院所名稱</th>
                          <th className="px-3 py-3">姓名</th>
                          <th className="px-3 py-3">生日</th>
                          <th className="px-3 py-3">身分證號</th>
                          <th className="px-3 py-3">門診日期</th>
                          <th className="px-3 py-3">檢驗結果</th>
                          <th className="px-3 py-3">列印狀態</th>
                          <th className="px-3 py-3">上傳狀態</th>
                          <th className="px-3 py-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.map((r) => {
                          const hospital = hospitals.find(h => h.code === r.hospital_id);
                          return (
                            <tr key={r.uuid} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-4">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300"
                                  checked={selectedRecordUuids.includes(r.uuid)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedRecordUuids([...selectedRecordUuids, r.uuid]);
                                    else setSelectedRecordUuids(selectedRecordUuids.filter(id => id !== r.uuid));
                                  }}
                                />
                              </td>
                              <td className="px-3 py-3 font-medium text-slate-900">{r.order_number}</td>
                              <td className="px-3 py-3">{r.lab_date}</td>
                              <td className="px-3 py-3">{hospital ? hospital.name : r.hospital_id}</td>
                              <td className="px-3 py-3">{r.name}</td>
                              <td className="px-3 py-3">{r.birth_date}</td>
                              <td className="px-3 py-3 font-mono text-slate-500">{r.id_no}</td>
                              <td className="px-3 py-3">{r.outpatient_date}</td>
                              <td className="px-3 py-3">
                                {String(r.result) === '0' && <Badge variant="success">陰性 (-)</Badge>}
                                {String(r.result) === '1' && <Badge variant="danger">陽性 (+)</Badge>}
                                {String(r.result) === '2' && (
                                  <div className="flex flex-col items-start gap-1">
                                    <Badge variant="warning">檢測失效</Badge>
                                    {String(r.second_result) === '0' && <Badge variant="success">二次: 陰性 (-)</Badge>}
                                    {String(r.second_result) === '1' && <Badge variant="danger">二次: 陽性 (+)</Badge>}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {r.is_printed ? (
                                  <div className="flex justify-center items-center text-green-600">
                                    <Printer className="h-4 w-4 mr-1" />
                                    <span className="text-xs font-bold">已列印</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="relative">
                                  <Badge
                                    className={cn(
                                      "cursor-pointer hover:opacity-80 transition-opacity",
                                      Number(r.is_exported) === 1 && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                      Number(r.is_exported) === 2 && "bg-red-50 text-red-700 border-red-200",
                                      Number(r.is_exported) !== 1 && Number(r.is_exported) !== 2 && "bg-blue-50 text-blue-700 border-blue-200"
                                    )}
                                    variant="outline"
                                    onClick={(e: any) => {
                                      e.stopPropagation();
                                      if (activeStatusMenu === r.uuid) setActiveStatusMenu(null);
                                      else setActiveStatusMenu(r.uuid);
                                    }}
                                  >
                                    {Number(r.is_exported) === 2 ? '已刪除' : (Number(r.is_exported) === 1 ? '已匯出' : '待申報')}
                                  </Badge>

                                  {activeStatusMenu === r.uuid && (
                                    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 flex flex-col gap-2 p-2 animate-in fade-in zoom-in-95 duration-100 min-w-[100px]">
                                      {[
                                        { label: '待申報', value: 0, variant: 'info' },
                                        { label: '已匯出', value: 1, variant: 'success' },
                                        { label: '已刪除', value: 2, variant: 'destructive' }
                                      ].map((opt) => {
                                        const isDisabled = opt.value === 2 && Number(r.is_exported) !== 1 && Number(r.is_exported) !== 2;
                                        return (
                                          <button
                                            key={opt.value}
                                            disabled={isDisabled}
                                            className={cn(
                                              "flex items-center justify-center w-full focus:outline-none transition-all",
                                              isDisabled ? "opacity-30 cursor-not-allowed" : "hover:scale-105 active:scale-95"
                                            )}
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (isDisabled) return;

                                              setActiveStatusMenu(null);
                                              if (ipc) {
                                                const res = await ipc.invoke('update-record-status', { uuid: r.uuid, status: opt.value });
                                                if (res.success) {
                                                  toast({ title: "狀態更新成功", variant: "success" });
                                                  loadRecords();
                                                } else {
                                                  toast({ title: "更新失敗", description: res.message, variant: "destructive" });
                                                }
                                              }
                                            }}
                                          >
                                            <Badge variant={opt.variant} className={cn("w-full justify-center", Number(r.is_exported) === opt.value && "ring-2 ring-offset-1 ring-indigo-500")}>
                                              {opt.label}
                                            </Badge>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {activeStatusMenu === r.uuid && (
                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveStatusMenu(null);
                                    }} />
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600" onClick={async () => {
                                    const hasSecond = r.second_result !== null && r.second_result !== undefined && String(r.second_result).trim() !== '';
                                    let choice = 'first';
                                    if (hasSecond && ipc) {
                                      const response = await ipc.invoke('show-message-box', {
                                        type: 'question',
                                        title: '選擇列印報告',
                                        message: '偵測到此紀錄包含二次檢驗結果，請選擇要列印的報告：',
                                        buttons: ['第一次報告', '第二次報告', '全部列印', '取消'],
                                        cancelId: 3
                                      });
                                      if (response === 0) choice = 'first';
                                      else if (response === 1) choice = 'second';
                                      else if (response === 2) choice = 'both';
                                      else return;
                                    }
                                    handlePrint([r], choice as 'first' | 'second' | 'both');
                                  }} title="列印"><Printer className="h-4 w-4" /></Button>
                                  <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600" onClick={() => handleEditRecord(r)} title="編輯"><Edit className="h-4 w-4" /></Button>
                                  <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" onClick={() => handleDeleteRecord(r.uuid)} title="刪除"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="p-8 space-y-8 overflow-auto">
              <h2 className="text-2xl font-bold text-slate-900">系統設定與維護</h2>

              {/* 1. Database Settings */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-600" /> 資料庫設定
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>目前資料庫路徑</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600 font-mono break-all">
                        {dbConfig.path || 'Loading...'}
                      </div>
                      <Button variant="outline" onClick={handleChangeDbPath}>變更路徑</Button>
                      {dbConfig.isCustom && (
                        <Button variant="destructive" onClick={handleResetDbPath}>重設預設值</Button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {dbConfig.isCustom ? '目前使用自訂路徑' : '目前使用系統預設路徑'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Default Values */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Archive className="h-5 w-5 text-indigo-600" /> 預設值設定
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>預設檢驗所名稱</Label>
                    <Input
                      value={settings.default_lab_name || ''}
                      onChange={(e: any) => setSettings({ ...settings, default_lab_name: e.target.value })}
                      placeholder="例如: XX醫事檢驗所"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>報告抬頭來源</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3"
                      value={settings.print_title_source || 'hospital'}
                      onChange={(e: any) => setSettings({ ...settings, print_title_source: e.target.value })}
                    >
                      <option value="hospital">依醫療院所名稱</option>
                      <option value="lab">依檢驗所名稱</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>預設檢驗機構代碼</Label>
                    <Input
                      value={settings.default_lab_id}
                      onChange={(e: any) => setSettings({ ...settings, default_lab_id: e.target.value })}
                      placeholder="例如: 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>預設試劑代碼</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3"
                      value={settings.default_reagent_code}
                      onChange={(e: any) => setSettings({ ...settings, default_reagent_code: e.target.value })}
                    >
                      <option value="">請選擇</option>
                      {REAGENT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {settings.default_reagent_code === '999' && (
                    <>
                      <div className="space-y-2 col-span-2 border-t border-slate-100 pt-4 mt-2 grid grid-cols-2 gap-4">
                        <div className="col-span-2 mb-2">
                          <Label className="text-indigo-600">其他試劑詳細資訊 (必填)</Label>
                        </div>
                        <div className="space-y-2">
                          <Label>試劑中文名稱</Label>
                          <Input
                            value={settings.default_other_reagent_zh || ''}
                            onChange={(e: any) => setSettings({ ...settings, default_other_reagent_zh: e.target.value })}
                            placeholder="請輸入中文名稱"
                          />
                          {settings.default_other_reagent_zh?.length > 100 && (
                            <p className="text-xs text-red-500 font-bold">已超過字數限制 (最多100字)</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>試劑英文名稱</Label>
                          <Input
                            value={settings.default_other_reagent_en || ''}
                            onChange={(e: any) => setSettings({ ...settings, default_other_reagent_en: e.target.value })}
                            placeholder="請輸入英文名稱"
                          />
                          {settings.default_other_reagent_en?.length > 100 && (
                            <p className="text-xs text-red-500 font-bold">已超過字數限制 (最多100字)</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>試劑許可證字號</Label>
                          <Input
                            value={settings.default_other_license_no || ''}
                            onChange={(e: any) => setSettings({ ...settings, default_other_license_no: e.target.value })}
                            placeholder="請輸入許可證字號"
                          />
                          {settings.default_other_license_no?.length > 30 && (
                            <p className="text-xs text-red-500 font-bold">已超過字數限制 (最多30字)</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>試劑有效期限 (ROC)</Label>
                          <RocDateInput
                            value={settings.default_other_expire_date || ''}
                            onChange={(e: any) => setSettings({ ...settings, default_other_expire_date: e.target.value })}
                          />
                          {settings.default_other_expire_date?.length > 7 && (
                            <p className="text-xs text-red-500 font-bold">日期格式長度錯誤 (最多7字)</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label>醫檢師名稱</Label>
                    <Input
                      value={settings.default_technologist}
                      onChange={(e: any) => setSettings({ ...settings, default_technologist: e.target.value })}
                      placeholder="預設醫檢師名稱"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>匯出格式</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3"
                      value={settings.export_format || 'fixed'}
                      onChange={(e: any) => setSettings({ ...settings, export_format: e.target.value })}
                    >
                      <option value="fixed">資料以總長匯出 (預設)</option>
                      <option value="csv">資料以逗號分隔匯出 (CSV)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveSettings} className="gap-2"><Save className="h-4 w-4" /> 儲存設定</Button>
              </div>
              { /* 2. Hospital Management */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" /> 醫療院所管理
                </h3>

                <div className="flex gap-4 mb-6 bg-slate-50 p-4 rounded-lg items-end">
                  <div className="space-y-2 flex-1">
                    <Label>院所代碼</Label>
                    <Input value={newHospitalCode} onChange={(e: any) => setNewHospitalCode(e.target.value)} placeholder="代碼" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>院所名稱</Label>
                    <Input value={newHospitalName} onChange={(e: any) => setNewHospitalName(e.target.value)} placeholder="名稱" />
                  </div>
                  <Button onClick={handleAddHospital} variant="secondary">
                    {hospitals.some(h => h.code === newHospitalCode) ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {hospitals.some(h => h.code === newHospitalCode) ? "更新院所" : "新增院所"}
                  </Button>
                  <Button onClick={handleImportHospital} variant="outline" className="gap-2">
                    <FileOutput className="h-4 w-4" /> 匯入(CSV/Excel)
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">院所代碼</th>
                        <th className="px-4 py-3">院所名稱</th>
                        <th className="px-4 py-3 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hospitals.map(h => (
                        <tr key={h.code} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono">{h.code}</td>
                          <td className="px-4 py-3">{h.name}</td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-slate-400 hover:text-indigo-600 mr-2" onClick={() => handleEditHospital(h)}><Edit className="h-4 w-4" /></button>
                            <button className="text-red-500 hover:text-red-700" onClick={() => handleDeleteHospital(h.code)}><Trash2 className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ))}
                      {hospitals.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">目前無資料</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
          }
        </main >
      </div >



      {/* Record Dialog */}
      {
        isRecordDialogOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <h2 className="text-xl font-bold text-slate-900">{currentRecordUuid ? "編輯檢驗紀錄" : "新增檢驗紀錄"}</h2>
                <button onClick={() => setIsRecordDialogOpen(false)}><X className="h-5 w-5 text-slate-500" /></button>
              </div>



              <div className="overflow-y-auto p-6 space-y-8 bg-slate-50/30" ref={recordFormRef as any}>
                <form onSubmit={form.handleSubmit(onSubmitRecord, (errors) => console.error("Form Validation Errors:", errors))} className="space-y-8">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-700 mb-2">
                      <User className="h-5 w-5" />
                      <h3 className="font-semibold">基本資料</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-5 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="space-y-2">
                        <Label>醫療院所 <span className="text-red-500">*</span></Label>
                        <Input list="hospitals_list" {...form.register("hospital_id")} placeholder="輸入代碼或名稱搜尋..." />
                        <datalist id="hospitals_list">
                          {hospitals.map(h => (
                            <option key={h.code} value={h.code}>{h.name} ({h.code})</option>
                          ))}
                        </datalist>
                        {form.formState.errors.hospital_id && <p className="text-xs text-red-500 mt-1">{form.formState.errors.hospital_id.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label>身分證/居留證號 <span className="text-red-500">*</span></Label>
                        <Input
                          {...form.register("id_no")}
                          className="font-mono"
                          onBlur={async (e: any) => {
                            form.register("id_no").onBlur(e); // Propagate React Hook Form's blur
                            const val = e.target.value;

                            // Validate format on blur
                            if (val && !isValidTaiwanID(val)) {
                              toast({
                                title: "身分證/居留證號格式錯誤",
                                description: "格式不符或檢查碼錯誤，請再次確認",
                                variant: "warning",
                                duration: 5000
                              });
                            }

                            if (val && val.length === 10 && ipc && !currentRecordUuid) {
                              // Only auto-fill in Create mode
                              try {
                                const results = await ipc.invoke('get-records', { search: val });
                                if (results && results.length > 0) {
                                  // Find latest record with info
                                  const match = results.find((r: any) => r.name);
                                  if (match) {
                                    let confirmed = false;
                                    const message = `發現已存在的病患資料：${match.name} \n是否自動帶入基本資料(姓名、性別、生日)？`;

                                    if (ipc) {
                                      confirmed = await ipc.invoke('show-confirm', { message });
                                    } else {
                                      confirmed = confirm(message);
                                    }

                                    if (confirmed) {
                                      form.setValue("name", match.name);
                                      form.setValue("gender", match.gender);
                                      form.setValue("birth_date", match.birth_date);
                                    }
                                  }
                                }
                              } catch (err) {
                                console.error("Auto-fill error", err);
                              }
                            }
                          }}

                        />
                        {form.formState.errors.id_no && <p className="text-xs text-red-500 mt-1">{form.formState.errors.id_no.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label>姓名</Label>
                        <Input {...form.register("name")} placeholder="姓名" />
                      </div>
                      <div className="space-y-2">
                        <Label>性別</Label>
                        <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3" {...form.register("gender")}>
                          <option value="M">男</option>
                          <option value="F">女</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>出生日期 (ROC)</Label>
                        <RocDateInput
                          value={form.watch("birth_date")}
                          onChange={(e: any) => form.setValue("birth_date", e.target.value)}
                        />
                        {form.formState.errors.birth_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.birth_date.message}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Results */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-700 mb-2">
                      <Activity className="h-5 w-5" />
                      <h3 className="font-semibold">檢驗結果</h3>
                    </div>
                    <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 gap-5">
                      <div className="space-y-2 col-span-2">
                        <Label>門診日期 (ROC)</Label>
                        <RocDateInput
                          value={form.watch("outpatient_date")}
                          onChange={(e: any) => form.setValue("outpatient_date", e.target.value)}
                        />
                        {form.formState.errors.outpatient_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.outpatient_date.message}</p>}
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>檢驗結果</Label>
                        <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3" {...form.register("result")}>
                          <option value="" disabled>請選擇</option>
                          <option value="0">陰性 (-)</option>
                          <option value="1">陽性 (+)</option>
                          <option value="2">檢測失效</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>檢驗機構代碼</Label>
                        <Input {...form.register("lab_id")} />
                        {form.formState.errors.lab_id && <p className="text-xs text-red-500 mt-1">{form.formState.errors.lab_id.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>試劑代碼</Label>
                        <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3" {...form.register("reagent_code")}>
                          <option value="">請選擇</option>
                          {REAGENT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {form.formState.errors.reagent_code && <p className="text-xs text-red-500 mt-1">{form.formState.errors.reagent_code.message}</p>}
                      </div>

                      {/* Reagent 999 Fields */}
                      {form.watch("reagent_code") === '999' && (
                        <div className="col-span-2 grid grid-cols-2 gap-5 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                          <div className="col-span-2 text-sm font-semibold text-indigo-700">其他試劑詳細資訊</div>
                          <div className="space-y-2">
                            <Label>試劑中文名稱</Label>
                            <Input {...form.register("other_reagent_zh")} placeholder="中文名稱" />
                            {form.formState.errors.other_reagent_zh && <p className="text-xs text-red-500 mt-1">{form.formState.errors.other_reagent_zh.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>試劑英文名稱</Label>
                            <Input {...form.register("other_reagent_en")} placeholder="English Name" />
                            {form.formState.errors.other_reagent_en && <p className="text-xs text-red-500 mt-1">{form.formState.errors.other_reagent_en.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>許可證字號</Label>
                            <Input {...form.register("other_license_no")} placeholder="字號" />
                            {form.formState.errors.other_license_no && <p className="text-xs text-red-500 mt-1">{form.formState.errors.other_license_no.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>有效期限 (ROC)</Label>
                            <RocDateInput
                              value={form.watch("other_expire_date")}
                              onChange={(e: any) => form.setValue("other_expire_date", e.target.value)}
                            />
                            {form.formState.errors.other_expire_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.other_expire_date.message}</p>}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>檢驗單號 <span className="text-red-500">*</span></Label>
                        <Input {...form.register("order_number")} placeholder="00001" maxLength={5} />
                        {form.formState.errors.order_number && <p className="text-xs text-red-500 mt-1">{form.formState.errors.order_number.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>檢驗日期</Label>
                        <RocDateInput
                          value={form.watch("lab_date")}
                          onChange={(e: any) => form.setValue("lab_date", e.target.value)}
                        />
                        {form.formState.errors.lab_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.lab_date.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>報告日期</Label>
                        <RocDateInput
                          value={form.watch("report_date")}
                          onChange={(e: any) => form.setValue("report_date", e.target.value)}
                        />
                        {form.formState.errors.report_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.report_date.message}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Secondary Results (Conditional) */}
                  {form.watch("result") === "2" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-700 mb-2">
                        <AlertCircle className="h-5 w-5" />
                        <h3 className="font-semibold">二次檢驗結果</h3>
                      </div>
                      <div className="p-5 bg-orange-50/50 rounded-xl border border-orange-100 shadow-sm grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label>二次門診日期</Label>
                          <RocDateInput
                            value={form.watch("second_outpatient_date")}
                            onChange={(e: any) => form.setValue("second_outpatient_date", e.target.value)}
                          />
                          {form.formState.errors.second_outpatient_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_outpatient_date.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>二次檢驗日期</Label>
                          <RocDateInput
                            value={form.watch("second_lab_date")}
                            onChange={(e: any) => form.setValue("second_lab_date", e.target.value)}
                          />
                          {form.formState.errors.second_lab_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_lab_date.message}</p>}
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label>二次檢驗結果</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3"
                            value={form.watch("second_result")}
                            onChange={(e: any) => {
                              form.setValue("second_result", e.target.value as any);
                              // Auto-fill reagent code from defaults if available
                              if (settings.default_reagent_code) {
                                form.setValue("second_reagent_code", settings.default_reagent_code);
                              }
                            }}
                          >
                            <option value="">請選擇</option>
                            <option value="0">陰性 (-)</option>
                            <option value="1">陽性 (+)</option>
                          </select>
                          {form.formState.errors.second_result && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_result.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>二次試劑代碼</Label>
                          <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3" {...form.register("second_reagent_code")}>
                            <option value="">請選擇</option>
                            {REAGENT_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {form.formState.errors.second_reagent_code && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_reagent_code.message}</p>}
                        </div>

                        {/* Secondary Reagent 999 Fields */}
                        {form.watch("second_reagent_code") === '999' && (
                          <div className="col-span-2 grid grid-cols-2 gap-5 p-4 bg-orange-100/50 rounded-lg border border-orange-200">
                            <div className="col-span-2 text-sm font-semibold text-orange-700">其他試劑(二次)詳細資訊</div>
                            <div className="space-y-2">
                              <Label>試劑中文名稱</Label>
                              <Input {...form.register("second_other_reagent_zh")} placeholder="中文名稱" />
                              {form.formState.errors.second_other_reagent_zh && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_other_reagent_zh.message}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label>試劑英文名稱</Label>
                              <Input {...form.register("second_other_reagent_en")} placeholder="English Name" />
                              {form.formState.errors.second_other_reagent_en && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_other_reagent_en.message}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label>許可證字號</Label>
                              <Input {...form.register("second_other_license_no")} placeholder="字號" />
                              {form.formState.errors.second_other_license_no && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_other_license_no.message}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label>有效期限 (ROC)</Label>
                              <RocDateInput
                                value={form.watch("second_other_expire_date")}
                                onChange={(e: any) => form.setValue("second_other_expire_date", e.target.value)}
                              />
                              {form.formState.errors.second_other_expire_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_other_expire_date.message}</p>}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>二次報告日期</Label>
                          <RocDateInput
                            value={form.watch("second_report_date")}
                            onChange={(e: any) => form.setValue("second_report_date", e.target.value)}
                          />
                          {form.formState.errors.second_report_date && <p className="text-xs text-red-500 mt-1">{form.formState.errors.second_report_date.message}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsRecordDialogOpen(false)}>取消</Button>
                    <Button type="submit">儲存紀錄</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )
      }

      {/* Export Dialog */}
      {
        isExportDialogOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-6">
              <h3 className="text-lg font-bold">
                {exportMode === 'selected' ? '匯出選取資料' :
                  exportMode === 'selected_del' ? '匯出欲刪除資料' : '匯出申報檔案'}
              </h3>
              <div className="space-y-4">
                {exportMode === 'all' && (
                  <>
                    <div className="space-y-2">
                      <Label>醫療院所代碼 (選填)</Label>
                      <Input list="hospitals_export_list" value={exportHospitalId} onChange={(e: any) => setExportHospitalId(e.target.value)} placeholder="輸入代碼..." />
                      <datalist id="hospitals_export_list">
                        {hospitals.map(h => (
                          <option key={h.code} value={h.code}>{h.name}</option>
                        ))}
                      </datalist>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>檢驗日期(起)</Label>
                        <RocDateInput value={exportStartDate} onChange={(e: any) => setExportStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>檢驗日期(迄)</Label>
                        <RocDateInput value={exportEndDate} onChange={(e: any) => setExportEndDate(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>取消</Button>
                <Button onClick={handleExport}>確認匯出</Button>
              </div>
            </div>
          </div>
        )
      }

      <Toaster />
    </div >
  );
}
