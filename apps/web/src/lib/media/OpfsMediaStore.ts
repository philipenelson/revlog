import type { MediaRef, MediaStore, StoredMedia } from './MediaStore';

/**
 * Origin Private File System (OPFS) implementation of MediaStore.
 * All methods guard against SSR by checking for window and navigator.storage.
 */
export class OpfsMediaStore implements MediaStore {
  private async getRoot(): Promise<FileSystemDirectoryHandle> {
    if (typeof window === 'undefined' || !navigator?.storage?.getDirectory) {
      throw new Error('OPFS is not available in this environment');
    }
    return navigator.storage.getDirectory();
  }

  async save(logEntryId: string, file: File): Promise<MediaRef> {
    const id = crypto.randomUUID();
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `media/logentries/${logEntryId}/${id}.${ext}`;

    const root = await this.getRoot();
    const mediaDir = await root.getDirectoryHandle('media', { create: true });
    const logDir = await mediaDir.getDirectoryHandle('logentries', { create: true });
    const entryDir = await logDir.getDirectoryHandle(logEntryId, { create: true });
    const fileHandle = await entryDir.getFileHandle(`${id}.${ext}`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    const mediaType: 'IMAGE' | 'VIDEO' = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    return { id, mediaType, path };
  }

  async getUrl(ref: MediaRef): Promise<string> {
    const root = await this.getRoot();
    const parts = ref.path.split('/'); // ['media','logentries','entryId','filename']
    let dir: FileSystemDirectoryHandle = root;
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part);
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  }

  async delete(ref: MediaRef): Promise<void> {
    const root = await this.getRoot();
    const parts = ref.path.split('/');
    let dir: FileSystemDirectoryHandle = root;
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part);
    }
    await dir.removeEntry(parts[parts.length - 1]);
  }

  async listForEntry(logEntryId: string): Promise<StoredMedia[]> {
    const root = await this.getRoot();

    try {
      const mediaDir = await root.getDirectoryHandle('media');
      const logDir = await mediaDir.getDirectoryHandle('logentries');
      const entryDir = await logDir.getDirectoryHandle(logEntryId);

      const results: StoredMedia[] = [];
      let sortOrder = 0;

      for await (const [name, handle] of entryDir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
        if (handle.kind !== 'file') continue;
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        const mediaType: 'IMAGE' | 'VIDEO' = ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)
          ? 'VIDEO'
          : 'IMAGE';
        const id = name.replace(/\.[^.]+$/, '');
        const path = `media/logentries/${logEntryId}/${name}`;
        results.push({
          ref: { id, mediaType, path },
          url,
          sortOrder: sortOrder++,
        });
      }

      return results;
    } catch {
      // Directory doesn't exist yet — return empty
      return [];
    }
  }
}
