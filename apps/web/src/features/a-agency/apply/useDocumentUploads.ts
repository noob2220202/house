'use client';
import { type AgencyDocumentType, MediaPurpose } from '@house/shared';
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { uploadMedia } from '../api/queries';
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES, validateUpload } from '../lib/application';

/** A file picked for a document slot that has not been attached to the agency yet. */
export interface PendingDocument {
  type: AgencyDocumentType;
  fileName: string;
  status: 'uploading' | 'ready' | 'error';
  /** Set once the upload to POST /media finished. */
  mediaId?: string;
  error?: string;
}

export type PendingDocuments = Partial<Record<AgencyDocumentType, PendingDocument>>;

/**
 * Uploads picked files to the media API (purpose AGENCY_DOCUMENT — private) right away and keeps
 * the resulting media ids per document slot until the form attaches them to the agency.
 * `onUploaded` fires when a slot's upload finishes (used to attach immediately on the status page).
 */
export function useDocumentUploads(
  onUploaded?: (doc: Required<Pick<PendingDocument, 'type' | 'fileName' | 'mediaId'>>) => void,
) {
  const [docs, setDocs] = useState<PendingDocuments>({});
  // Latest upload token per slot so a slower, superseded upload cannot overwrite a newer one.
  const tokens = useRef<Partial<Record<AgencyDocumentType, number>>>({});
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const pick = useCallback(async (type: AgencyDocumentType, file: File) => {
    const token = (tokens.current[type] ?? 0) + 1;
    tokens.current[type] = token;
    const invalid = validateUpload(file, DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES);
    if (invalid) {
      setDocs((d) => ({
        ...d,
        [type]: { type, fileName: file.name, status: 'error', error: invalid },
      }));
      return;
    }
    setDocs((d) => ({ ...d, [type]: { type, fileName: file.name, status: 'uploading' } }));
    try {
      const media = await uploadMedia(file, MediaPurpose.AGENCY_DOCUMENT);
      if (tokens.current[type] !== token) return;
      setDocs((d) => ({
        ...d,
        [type]: { type, fileName: file.name, status: 'ready', mediaId: media.id },
      }));
      onUploadedRef.current?.({ type, fileName: file.name, mediaId: media.id });
    } catch (error) {
      if (tokens.current[type] !== token) return;
      setDocs((d) => ({
        ...d,
        [type]: { type, fileName: file.name, status: 'error', error: errorMessage(error) },
      }));
    }
  }, []);

  const remove = useCallback((type: AgencyDocumentType) => {
    tokens.current[type] = (tokens.current[type] ?? 0) + 1;
    setDocs((d) => {
      const next = { ...d };
      delete next[type];
      return next;
    });
  }, []);

  const list = Object.values(docs);
  return {
    docs,
    pick,
    remove,
    /** Uploaded and ready to attach. */
    ready: list.filter(
      (d): d is PendingDocument & { mediaId: string } => d.status === 'ready' && !!d.mediaId,
    ),
    uploading: list.some((d) => d.status === 'uploading'),
  };
}
