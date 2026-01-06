import { useToast } from "../../hooks/use-toast";
import { AlertCircle, CheckCircle2, X, AlertTriangle } from "lucide-react";

export function Toaster() {
    const { toasts, dismiss } = useToast();

    return (
        <div className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
            {toasts.map(function ({ id, title, description, variant, action, onOpenChange, open, ...props }) {
                if (open === false) return null; // Don't render if closed
                return (
                    <div
                        key={id}
                        className={`
              group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all 
              ${variant === 'destructive' ? 'border-red-200 bg-red-50 text-red-900' :
                                variant === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' :
                                    variant === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' :
                                        'border-slate-200 bg-white text-slate-950'}
            `}
                        {...props}
                    >
                        <div className="flex gap-3">
                            {variant === 'destructive' && <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />}
                            {variant === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                            {variant === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />}
                            <div className="grid gap-1">
                                {title && <h3 className="text-sm font-semibold">{title}</h3>}
                                {description && <div className="text-sm opacity-90">{description}</div>}
                            </div>
                        </div>
                        {action}
                        <button
                            onClick={() => dismiss(id)}

                            className={`absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 ${variant === 'destructive' ? 'text-red-500 hover:text-red-900' :
                                    variant === 'warning' ? 'text-amber-500 hover:text-amber-900' :
                                        'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
