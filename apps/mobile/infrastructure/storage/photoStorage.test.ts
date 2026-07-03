const createCalls: unknown[] = [];
const copyCalls: Array<{ from: string; to: string }> = [];
const deleteCalls: string[] = [];
let mockFileExists = true;

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
    }
    get extension(): string {
      const match = this.uri.match(/\.[^./]+$/);
      return match ? match[0] : '';
    }
    get exists(): boolean {
      return mockFileExists;
    }
    async copy(destination: MockFile): Promise<void> {
      copyCalls.push({ from: this.uri, to: destination.uri });
    }
    delete(): void {
      deleteCalls.push(this.uri);
    }
  }
  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
    }
    create(options: unknown): void {
      createCalls.push(options);
    }
  }
  return { File: MockFile, Directory: MockDirectory, Paths: { document: 'file:///mock-documents' } };
});

import { persistVehiclePhoto, deleteVehiclePhoto } from './photoStorage';

describe('photoStorage', () => {
  beforeEach(() => {
    createCalls.length = 0;
    copyCalls.length = 0;
    deleteCalls.length = 0;
    mockFileExists = true;
  });

  it('persistVehiclePhoto copies the picked photo into a stable, vehicle-id-named path', async () => {
    const result = await persistVehiclePhoto('vehicle-1', {
      uri: 'file:///tmp/picker-cache/abc123.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
    });

    expect(createCalls).toEqual([{ idempotent: true }]);
    expect(copyCalls).toEqual([
      { from: 'file:///tmp/picker-cache/abc123.jpg', to: 'file:///mock-documents/vehicle-photos/vehicle-1.jpg' },
    ]);
    expect(result).toEqual({
      uri: 'file:///mock-documents/vehicle-photos/vehicle-1.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
  });

  it('preserves the source file extension', async () => {
    const result = await persistVehiclePhoto('vehicle-2', {
      uri: 'file:///tmp/picker-cache/xyz.png',
      name: 'photo.png',
      type: 'image/png',
    });

    expect(result.uri).toBe('file:///mock-documents/vehicle-photos/vehicle-2.png');
  });

  it('deleteVehiclePhoto deletes the file when it exists', () => {
    deleteVehiclePhoto('file:///mock-documents/vehicle-photos/vehicle-1.jpg');

    expect(deleteCalls).toEqual(['file:///mock-documents/vehicle-photos/vehicle-1.jpg']);
  });

  it('deleteVehiclePhoto is a no-op when the file no longer exists', () => {
    mockFileExists = false;

    deleteVehiclePhoto('file:///mock-documents/vehicle-photos/vehicle-1.jpg');

    expect(deleteCalls).toEqual([]);
  });
});
