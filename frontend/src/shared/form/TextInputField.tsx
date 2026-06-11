'use client';

import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { Input } from '@/shared/ui/input';
import { FormField } from './FormField';

interface TextInputFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label: string;
    required?: boolean;
    placeholder?: string;
    type?: string;
    hint?: string;
    error?: string;
    htmlFor?: string;
    lang?: string;
    onChange?: (value: string) => void;
}

/**
 * Reusable text input field with validation
 */
export function TextInputField<T extends FieldValues>({
    control,
    name,
    label,
    required = false,
    placeholder,
    type = 'text',
    hint,
    error,
    htmlFor,
    lang,
    onChange,
}: TextInputFieldProps<T>) {
    const fieldId = htmlFor || name;

    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <FormField
                    label={label}
                    required={required}
                    error={error}
                    hint={hint}
                    htmlFor={fieldId}
                >
                    <Input
                        {...field}
                        id={fieldId}
                        type={type}
                        placeholder={placeholder}
                        lang={lang}
                        value={field.value ?? ''}
                        onChange={(e) => {
                            field.onChange(e);
                            onChange?.(e.target.value);
                        }}
                        className={error ? 'border-destructive focus:ring-destructive' : ''}
                    />
                </FormField>
            )}
        />
    );
}
