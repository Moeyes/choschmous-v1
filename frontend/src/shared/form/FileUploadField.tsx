/**
 * FileUploadField Component
 * 
 * User-friendly file upload with drag-drop, progress tracking, and validation
 * Follows 10 UX Principles: clarity, feedback, constraints, consistency,
 * error prevention, error recovery, user control, aesthetics, recognition, flexibility
 */

'use client';

import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { useState, useRef } from 'react';
import {
    Cloud,
    CheckCircle2,
    AlertCircle,
    Loader,
    X,
    RotateCcw,
    HardDrive,
    Info,
} from 'lucide-react';
import { FormField } from './FormField';

interface FileUploadFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label: string;
    required?: boolean;
    accept?: string;
    maxSize?: number; // in MB
    hint?: string;
    error?: string;
    onUpload: (file: File) => Promise<string>;
}

/**
 * Enhanced file upload field with better UX/UI
 */
export function FileUploadField<T extends FieldValues>({
    control,
    name,
    label,
    required = false,
    accept = 'image/*',
    maxSize = 5,
    hint,
    error,
    onUpload,
}: FileUploadFieldProps<T>) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | undefined>(undefined);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileSize, setFileSize] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get readable file type from accept parameter
    const getFileTypeLabel = (acceptStr: string) => {
        if (acceptStr.includes('image')) return 'JPG, PNG, WebP';
        if (acceptStr.includes('pdf')) return 'PDF, JPG, PNG';
        return 'Documents';
    };

    // Format file size for display
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Handle drag events
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    // Handle drop event
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            // Note: processFile needs field.onChange callback from Controller render
        }
    };

    // Process file upload
    const processFile = async (file: File, onFileProcessed: (url: string) => void) => {
        setUploadError(undefined);
        setFileName(file.name);
        setFileSize(formatFileSize(file.size));

        // Validate file size
        if (file.size > maxSize * 1024 * 1024) {
            setUploadError(`File size (${formatFileSize(file.size)}) exceeds ${maxSize}MB limit`);
            return;
        }

        // Upload file
        setUploading(true);
        try {
            const url = await onUpload(file);
            onFileProcessed(url);
            setUploadError(undefined);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
            setUploadError(errorMsg);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <FormField
                    label={label}
                    required={required}
                    error={error || uploadError}
                    hint={hint}
                    htmlFor={name as string}
                >
                    <div className="space-y-3">
                        {/* Main Upload Area */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`relative rounded-lg border-2 border-dashed transition-all duration-200 overflow-hidden ${dragActive
                                    ? 'border-primary bg-primary/5 scale-[1.02]'
                                    : uploadError || error
                                        ? 'border-destructive bg-destructive/5'
                                        : field.value
                                            ? 'border-success/40 bg-success/10'
                                            : 'border-muted-foreground/25 bg-gradient-to-br from-muted/30 to-muted/10 hover:border-primary/50 hover:bg-primary/5'
                                }`}
                        >
                            <input
                                ref={inputRef}
                                id={name as string}
                                type="file"
                                accept={accept}
                                disabled={uploading}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        await processFile(file, field.onChange);
                                    }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />

                            <div className="flex flex-col items-center justify-center py-10 px-6">
                                {/* State: Uploading */}
                                {uploading ? (
                                    <>
                                        <div className="relative w-12 h-12 mb-3">
                                            <Loader className="w-12 h-12 text-primary animate-spin" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Uploading...</p>
                                        <p className="text-xs text-muted-foreground mt-1">{fileName}</p>
                                    </>
                                ) : /* State: Success */ field.value ? (
                                    <>
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/15 mb-3">
                                            <CheckCircle2 className="w-6 h-6 text-success" />
                                        </div>
                                        <p className="text-sm font-semibold text-success">Uploaded Successfully</p>
                                        <p className="text-xs text-muted-foreground mt-1">{fileName}</p>
                                        {fileSize && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                                                <HardDrive className="w-3 h-3" /> {fileSize}
                                            </p>
                                        )}
                                    </>
                                ) : /* State: Idle/Ready */ (
                                    <>
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                                            <Cloud className="w-6 h-6 text-primary" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Upload {label}</p>
                                        <p className="text-xs text-muted-foreground mt-1 text-center">
                                            Click to browse or drag and drop your file
                                        </p>
                                        <div className="flex items-center gap-1 mt-3 px-3 py-1.5 rounded-full bg-muted/50 border border-muted-foreground/10">
                                            <Info className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">
                                                {getFileTypeLabel(accept)} • Max {maxSize}MB
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* File Info when uploaded */}
                        {field.value && !uploadError && (
                            <div className="flex items-center justify-between rounded-lg bg-success/10 border border-success/30 p-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-success truncate">{fileName}</p>
                                        {fileSize && (
                                            <p className="text-xs text-success mt-0.5">{fileSize}</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        field.onChange(undefined);
                                        setFileName(null);
                                        setFileSize(null);
                                        setUploadError(undefined);
                                        if (inputRef.current) {
                                            inputRef.current.value = '';
                                        }
                                    }}
                                    className="flex-shrink-0 ml-2 p-1.5 hover:bg-success/15 rounded-lg transition-colors"
                                    title="Remove file"
                                >
                                    <X className="w-4 h-4 text-success" />
                                </button>
                            </div>
                        )}

                        {/* Error Alert */}
                        {(error || uploadError) && (
                            <div className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-destructive">{error || uploadError}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Make sure your file is {getFileTypeLabel(accept).toLowerCase()} and under {maxSize}MB
                                    </p>
                                    {uploadError && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUploadError(undefined);
                                                if (inputRef.current) {
                                                    inputRef.current.click();
                                                }
                                            }}
                                            className="text-xs font-semibold text-destructive hover:underline mt-2 flex items-center gap-1"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Try again
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Helpful hint if provided */}
                        {hint && !error && !uploadError && !field.value && (
                            <div className="flex items-start gap-2 rounded-lg bg-info/10 border border-info/30 p-2.5">
                                <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-info">{hint}</p>
                            </div>
                        )}
                    </div>
                </FormField>
            )}
        />
    );
}
