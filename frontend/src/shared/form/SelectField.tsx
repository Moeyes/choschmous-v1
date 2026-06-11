// 'use client';
'use client';

import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/select';
import { FormField } from './FormField';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label: string;
    required?: boolean;
    placeholder?: string;
    options: SelectOption[];
    error?: string;
    hint?: string;
    htmlFor?: string;
    disabled?: boolean;
}

/**
 * Reusable select field with validation
 */
export function SelectField<T extends FieldValues>({
    control,
    name,
    label,
    required = false,
    placeholder = 'Select an option',
    options,
    error,
    hint,
    htmlFor,
    disabled = false,
}: SelectFieldProps<T>) {
    const fieldId = htmlFor || name;

    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => {
                const selectedValue = String(field.value || '');
                const selectedLabel = options.find((o) => o.value === selectedValue)?.label || placeholder;

                return (
                    <FormField
                        label={label}
                        required={required}
                        error={error}
                        hint={hint}
                        htmlFor={fieldId}
                    >
                        <Select 
                            value={selectedValue} 
                            disabled={disabled}
                            onValueChange={(value) => {
                                // For string fields (organizationId, eventType, gender, idDocumentType, role, leaderRole), keep as string
                                // For numeric ID fields (eventId, sportId, categoryId), convert to number
                                const stringFields = ['organizationId', 'eventType', 'gender', 'idDocumentType', 'role', 'leaderRole'];
                                const fieldNameStr = String(name);
                                const isStringField = stringFields.includes(fieldNameStr);

                                const finalValue = isStringField ? value : (!isNaN(Number(value)) ? Number(value) : value);
                                field.onChange(finalValue);
                            }}
                        >
                            <SelectTrigger
                                id={fieldId}
                                className={error ? 'border-destructive' : ''}
                            >
                                <SelectValue placeholder={placeholder}>
                                    {selectedLabel}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                );
            }}
        />
    );
}
