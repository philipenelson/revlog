export interface MediaRef {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  path: string;
}

export interface StoredMedia {
  ref: MediaRef;
  url: string;
  caption?: string;
  sortOrder: number;
}

export interface MediaStore {
  save(logEntryId: string, file: File): Promise<MediaRef>;
  getUrl(ref: MediaRef): Promise<string>;
  delete(ref: MediaRef): Promise<void>;
  listForEntry(logEntryId: string): Promise<StoredMedia[]>;
}
