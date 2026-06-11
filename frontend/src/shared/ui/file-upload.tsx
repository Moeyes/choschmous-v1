'use client';

import { useRef, useState } from 'react';
import { Camera, UploadCloud, FileCheck2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Button } from '@/shared/ui/button';

interface FileUploadProps {
  variant: 'hero' | 'tile';
  title?: string;
  subtitle?: string;
  accept?: string;
  maxSize?: number;
  onUpload: (file: File) => Promise<string>;
  onChange: (value: string) => void;
  value?: string;
  error?: string;
  className?: string;
}

export function FileUpload({
  variant,
  title,
  subtitle,
  accept,
  maxSize = 5 * 1024 * 1024,
  onUpload,
  onChange,
  value,
  error,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > maxSize) {
      setUploadError(`File must be under ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }
    if (!file.type.startsWith('image/') && variant === 'hero') {
      setUploadError('Please select an image file');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const objectUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    if (objectUrl) setPreviewUrl(objectUrl);
    setFileName(file.name);

    try {
      const path = await onUpload(file);
      onChange(path);
    } catch {
      setUploadError('Upload failed');
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(value || null);
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setFileName(null);
    setUploadError(null);
    onChange('');
  };

  if (previewUrl && variant === 'hero') {
    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
        <div className="relative size-32 overflow-hidden rounded-full border-4 border-border">
          <img
            src={previewUrl}
            alt="Preview"
            className="size-full object-cover"
          />
        </div>
        <div className="flex items-center gap-2">
          {fileName && (
            <span className="text-xs text-muted-foreground">{fileName}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleRemove}>
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  if (fileName && variant === 'tile') {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border border-success bg-success/5 p-3', className)}>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
          <FileCheck2 className="size-5 text-success" />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
          <span className="text-xs text-success">Uploaded</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={handleRemove}>
          <Trash2 className="size-3.5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  const isHero = variant === 'hero';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={uploading}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed transition-all outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          dragOver ? 'border-primary bg-primary-50/30' : 'border-border hover:border-primary/40',
          isHero ? 'py-8' : 'p-4',
        )}
      >
        {uploading ? (
          <Loader2 className={cn('animate-spin text-muted-foreground', isHero ? 'size-10' : 'size-6')} />
        ) : (
          <div
            className={cn(
              'flex items-center justify-center rounded-xl bg-primary-50',
              isHero ? 'size-16' : 'size-10',
            )}
          >
            {isHero ? (
              <Camera className="size-7 text-primary" />
            ) : (
              <UploadCloud className="size-5 text-primary" />
            )}
          </div>
        )}
        <div className="flex flex-col items-center gap-0.5">
          <span className={cn('font-medium text-foreground', isHero ? 'text-sm' : 'text-xs')}>
            {uploading ? 'Uploading...' : title || (isHero ? 'Upload photo' : 'Upload file')}
          </span>
          <span className="text-xs text-muted-foreground">
            {subtitle || (isHero ? 'PNG, JPG up to 5MB' : 'PDF up to 10MB')}
          </span>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept || (isHero ? 'image/png,image/jpeg,image/jpg' : '.pdf')}
        onChange={handleInputChange}
        className="hidden"
      />

      {(uploadError || error) && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3 shrink-0" />
          {uploadError || error}
        </p>
      )}
    </div>
  );
}
