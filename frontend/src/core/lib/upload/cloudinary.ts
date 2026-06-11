/**
 * Cloudinary Upload Service
 * 
 * Handles direct image/document uploads to Cloudinary using pre-signed URLs
 */

import apiClient from '@/core/api/client';

export interface PresignUrlResponse {
    signature: string;
    timestamp: number;
    folder: string;
    public_id: string;
    cloud_name: string;
    api_key: string;
}

export interface UploadOptions {
    folder?: string;
    maxSize?: number; // in bytes
    allowedFormats?: string[];
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

/**
 * Get pre-signed URL from backend
 */
export async function getPresignedUrl(folder: string = 'domrov-pictures'): Promise<PresignUrlResponse> {
    const response = await apiClient.get('/api/cloudinary/presign-url', {
        params: { folder },
    });
    return response.data;
}

/**
 * Upload file directly to Cloudinary using presigned URL
 */
export async function uploadToCloudinary(
    file: File,
    options: UploadOptions = {}
): Promise<string> {
    const {
        folder = 'domrov-pictures',
        maxSize = DEFAULT_MAX_SIZE,
        allowedFormats = DEFAULT_ALLOWED_FORMATS,
    } = options;

    // Validate file size
    if (file.size > maxSize) {
        throw new Error(`File size exceeds limit of ${maxSize / 1024 / 1024}MB`);
    }

    // Validate file format
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedFormats.includes(fileExtension)) {
        throw new Error(`Invalid file format. Allowed: ${allowedFormats.join(', ')}`);
    }

    // Get presigned URL
    const presignData = await getPresignedUrl(folder);

    // Prepare form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', presignData.signature);
    formData.append('timestamp', presignData.timestamp.toString());
    formData.append('public_id', presignData.public_id);
    formData.append('folder', presignData.folder);
    formData.append('api_key', presignData.api_key);

    // Upload to Cloudinary
    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${presignData.cloud_name}/image/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        throw new Error('Upload failed');
    }

    const result = await response.json();
    return result.secure_url || result.url;
}

/**
 * Upload photo with specific constraints
 */
export async function uploadPhoto(file: File): Promise<string> {
    return uploadToCloudinary(file, {
        folder: 'domrov-photos',
        maxSize: 2 * 1024 * 1024, // 2MB for photos
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    });
}

/**
 * Upload document (ID, birth certificate, passport, etc.)
 */
export async function uploadDocument(file: File): Promise<string> {
    return uploadToCloudinary(file, {
        folder: 'domrov-documents',
        maxSize: 5 * 1024 * 1024, // 5MB for documents
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png', 'gif'],
    });
}
