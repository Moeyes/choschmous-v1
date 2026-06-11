/**
 * Database-backed file upload service.
 *
 * Uploads a file to the backend, which stores the raw bytes in the database
 * under a freshly-minted UUID and returns a relative URL (`/api/files/{id}`).
 * That URL is what callers persist (e.g. in a registration's photo/document
 * field) and render directly — same-origin, so it needs no CSP changes and
 * carries the auth cookie automatically when fetched.
 *
 * Replaces the previous Cloudinary upload path.
 */

import apiClient from '@/core/api/client';

interface UploadResult {
    id: string;
    url: string;
}

interface UploadConstraints {
    /** Accepted MIME types. */
    allowedTypes: string[];
    /** Max size in bytes. */
    maxSize: number;
    /** Human-readable list for error messages, e.g. "JPG, PNG, WebP". */
    label: string;
}

const PHOTO: UploadConstraints = {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 2 * 1024 * 1024, // 2MB
    label: 'JPG, PNG, WebP',
};

const DOCUMENT: UploadConstraints = {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSize: 5 * 1024 * 1024, // 5MB
    label: 'JPG, PNG, WebP, PDF',
};

async function uploadFile(file: File, c: UploadConstraints): Promise<string> {
    // Client-side validation is UX only — the server re-validates type (by magic
    // bytes) and size on every upload.
    if (!c.allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Allowed: ${c.label}.`);
    }
    if (file.size > c.maxSize) {
        throw new Error(`File is too large. Maximum size is ${c.maxSize / 1024 / 1024}MB.`);
    }

    // postForm serializes to multipart/form-data with the correct boundary,
    // overriding the client's default JSON Content-Type.
    const { data } = await apiClient.postForm<UploadResult>('/api/files', { file });
    return data.url;
}

/** Upload a profile/student photo (images only, <= 2MB). */
export async function uploadPhoto(file: File): Promise<string> {
    return uploadFile(file, PHOTO);
}

/** Upload a supporting document — ID, birth certificate, passport (images or PDF, <= 5MB). */
export async function uploadDocument(file: File): Promise<string> {
    return uploadFile(file, DOCUMENT);
}
