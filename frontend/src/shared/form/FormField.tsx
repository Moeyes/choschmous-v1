import { ReactNode } from 'react';

interface FormFieldProps {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    htmlFor: string;
    children: ReactNode;
}

/**
 * Form field wrapper with label, error, and hint text
 */
export function FormField({
    label,
    required = false,
    error,
    hint,
    htmlFor,
    children,
}: FormFieldProps) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={htmlFor}
                className="block text-sm font-medium text-foreground"
            >
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
            </label>
            {children}
            {hint && !error && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
            {error && (
                <p className="text-xs text-destructive font-medium">{error}</p>
            )}
        </div>
    );
}
