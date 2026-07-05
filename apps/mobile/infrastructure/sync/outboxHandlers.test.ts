import { ApiError, type HttpClient } from '@maintenance-log/api-client';
import { RetryableOutboxError } from './SyncService';
import { createOutboxHandlers } from './outboxHandlers';

jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  createVehicle: jest.fn(),
  createVehicleWithPhotoUri: jest.fn(),
  updateVehicle: jest.fn(),
  setVehiclePhotoUri: jest.fn(),
  deleteVehicle: jest.fn(),
  initiateTransfer: jest.fn(),
  cancelTransfer: jest.fn(),
  createLogEntry: jest.fn(),
  updateLogEntry: jest.fn(),
  deleteLogEntry: jest.fn(),
}));
jest.mock('@/infrastructure/storage/photoStorage', () => ({
  deleteVehiclePhoto: jest.fn(),
  openVehiclePhotoFile: jest.fn(),
}));

import { createVehicle, createVehicleWithPhotoUri, updateVehicle, setVehiclePhotoUri, deleteVehicle, initiateTransfer, cancelTransfer, createLogEntry, updateLogEntry, deleteLogEntry } from '@maintenance-log/api-client';
import { deleteVehiclePhoto, openVehiclePhotoFile } from '@/infrastructure/storage/photoStorage';

const mockCreateVehicle = createVehicle as jest.MockedFunction<typeof createVehicle>;
const mockCreateVehicleWithPhotoUri = createVehicleWithPhotoUri as jest.MockedFunction<typeof createVehicleWithPhotoUri>;
const mockUpdateVehicle = updateVehicle as jest.MockedFunction<typeof updateVehicle>;
const mockSetVehiclePhotoUri = setVehiclePhotoUri as jest.MockedFunction<typeof setVehiclePhotoUri>;
const mockDeleteVehicle = deleteVehicle as jest.MockedFunction<typeof deleteVehicle>;
const mockInitiateTransfer = initiateTransfer as jest.MockedFunction<typeof initiateTransfer>;
const mockCancelTransfer = cancelTransfer as jest.MockedFunction<typeof cancelTransfer>;
const mockCreateLogEntry = createLogEntry as jest.MockedFunction<typeof createLogEntry>;
const mockUpdateLogEntry = updateLogEntry as jest.MockedFunction<typeof updateLogEntry>;
const mockDeleteLogEntry = deleteLogEntry as jest.MockedFunction<typeof deleteLogEntry>;
const mockDeleteVehiclePhoto = deleteVehiclePhoto as jest.MockedFunction<typeof deleteVehiclePhoto>;
const mockOpenVehiclePhotoFile = openVehiclePhotoFile as jest.MockedFunction<typeof openVehiclePhotoFile>;
const fakeClient = {} as HttpClient;

const createPayload = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
};

const stablePhoto = { uri: 'file:///documents/vehicle-photos/v1.jpg', name: 'photo.jpg', type: 'image/jpeg' };
const createPayloadWithPhoto = { ...createPayload, photo: stablePhoto };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeOpenedFile = { name: 'v1.jpg', type: 'image/jpeg', bytes: jest.fn() } as any;

const payload = { vehicleId: 'v1', nickname: 'Blackbird', make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 };
const payloadWithPhoto = { ...payload, photo: stablePhoto };

describe('outboxHandlers.CREATE_VEHICLE', () => {
  afterEach(() => jest.clearAllMocks());

  it('POSTs the vehicle with the id included, so the server row matches the local one', async () => {
    mockCreateVehicle.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.CREATE_VEHICLE!(createPayload);

    expect(mockCreateVehicle).toHaveBeenCalledWith(fakeClient, createPayload);
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockCreateVehicle.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_VEHICLE!(createPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockCreateVehicle.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_VEHICLE!(createPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError propagate as permanent, not wrapped', async () => {
    const badRequest = new ApiError(400, { error: 'Invalid input' });
    mockCreateVehicle.mockRejectedValue(badRequest);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_VEHICLE!(createPayload)).rejects.toBe(badRequest);
  });

  it('when a photo is present, opens a File handle on the stable path and uploads via createVehicleWithPhotoUri', async () => {
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockCreateVehicleWithPhotoUri.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.CREATE_VEHICLE!(createPayloadWithPhoto);

    expect(mockOpenVehiclePhotoFile).toHaveBeenCalledWith(stablePhoto.uri);
    expect(mockCreateVehicleWithPhotoUri).toHaveBeenCalledWith(fakeClient, createPayload, fakeOpenedFile);
    expect(mockCreateVehicle).not.toHaveBeenCalled();
  });

  it('deletes the local photo file after a successful upload', async () => {
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockCreateVehicleWithPhotoUri.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.CREATE_VEHICLE!(createPayloadWithPhoto);

    expect(mockDeleteVehiclePhoto).toHaveBeenCalledWith(stablePhoto.uri);
  });

  it('deletes the local photo file after a permanent (4xx) failure', async () => {
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockCreateVehicleWithPhotoUri.mockRejectedValue(new ApiError(400, { error: 'Invalid input' }));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_VEHICLE!(createPayloadWithPhoto)).rejects.toBeInstanceOf(ApiError);
    expect(mockDeleteVehiclePhoto).toHaveBeenCalledWith(stablePhoto.uri);
  });

  it('keeps the local photo file after a retryable failure, for the next flush attempt to find', async () => {
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockCreateVehicleWithPhotoUri.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_VEHICLE!(createPayloadWithPhoto)).rejects.toBeInstanceOf(RetryableOutboxError);
    expect(mockDeleteVehiclePhoto).not.toHaveBeenCalled();
  });
});

describe('outboxHandlers.UPDATE_VEHICLE', () => {
  afterEach(() => jest.clearAllMocks());

  it('PATCHes the vehicle with the payload minus vehicleId', async () => {
    mockUpdateVehicle.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.UPDATE_VEHICLE!(payload);

    expect(mockUpdateVehicle).toHaveBeenCalledWith(fakeClient, 'v1', {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2020,
      mileage: 5000,
    });
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockUpdateVehicle.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_VEHICLE!(payload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockUpdateVehicle.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_VEHICLE!(payload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError propagate as permanent, not wrapped', async () => {
    const notFound = new ApiError(404, { error: 'Vehicle not found' });
    mockUpdateVehicle.mockRejectedValue(notFound);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_VEHICLE!(payload)).rejects.toBe(notFound);
  });

  it('does not call setVehiclePhotoUri when no photo is present', async () => {
    mockUpdateVehicle.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.UPDATE_VEHICLE!(payload);

    expect(mockSetVehiclePhotoUri).not.toHaveBeenCalled();
  });

  it('when a photo is present, PATCHes the fields then opens a File handle and uploads via setVehiclePhotoUri', async () => {
    mockUpdateVehicle.mockResolvedValue(undefined);
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockSetVehiclePhotoUri.mockResolvedValue({ photoUrl: 'https://cdn.example.com/v1.jpg' });
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.UPDATE_VEHICLE!(payloadWithPhoto);

    expect(mockUpdateVehicle).toHaveBeenCalledWith(fakeClient, 'v1', {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2020,
      mileage: 5000,
    });
    expect(mockOpenVehiclePhotoFile).toHaveBeenCalledWith(stablePhoto.uri);
    expect(mockSetVehiclePhotoUri).toHaveBeenCalledWith(fakeClient, 'v1', fakeOpenedFile);
  });

  it('deletes the local photo file after a successful upload', async () => {
    mockUpdateVehicle.mockResolvedValue(undefined);
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockSetVehiclePhotoUri.mockResolvedValue({ photoUrl: 'https://cdn.example.com/v1.jpg' });
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.UPDATE_VEHICLE!(payloadWithPhoto);

    expect(mockDeleteVehiclePhoto).toHaveBeenCalledWith(stablePhoto.uri);
  });

  it('deletes the local photo file after a permanent (4xx) failure of the field PATCH', async () => {
    mockUpdateVehicle.mockRejectedValue(new ApiError(400, { error: 'Validation error' }));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_VEHICLE!(payloadWithPhoto)).rejects.toBeInstanceOf(ApiError);
    expect(mockDeleteVehiclePhoto).toHaveBeenCalledWith(stablePhoto.uri);
    expect(mockSetVehiclePhotoUri).not.toHaveBeenCalled();
  });

  it('deletes the local photo file after a permanent (4xx) failure of the photo upload', async () => {
    mockUpdateVehicle.mockResolvedValue(undefined);
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockSetVehiclePhotoUri.mockRejectedValue(new ApiError(400, { error: 'Invalid input' }));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_VEHICLE!(payloadWithPhoto)).rejects.toBeInstanceOf(ApiError);
    expect(mockDeleteVehiclePhoto).toHaveBeenCalledWith(stablePhoto.uri);
  });

  it('keeps the local photo file after a retryable failure, for the next flush attempt to find', async () => {
    mockUpdateVehicle.mockResolvedValue(undefined);
    mockOpenVehiclePhotoFile.mockReturnValue(fakeOpenedFile);
    mockSetVehiclePhotoUri.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_VEHICLE!(payloadWithPhoto)).rejects.toBeInstanceOf(RetryableOutboxError);
    expect(mockDeleteVehiclePhoto).not.toHaveBeenCalled();
  });
});

describe('outboxHandlers.DELETE_VEHICLE', () => {
  afterEach(() => jest.clearAllMocks());

  it('DELETEs the vehicle by id', async () => {
    mockDeleteVehicle.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.DELETE_VEHICLE!({ vehicleId: 'v1' });

    expect(mockDeleteVehicle).toHaveBeenCalledWith(fakeClient, 'v1');
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockDeleteVehicle.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.DELETE_VEHICLE!({ vehicleId: 'v1' })).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockDeleteVehicle.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.DELETE_VEHICLE!({ vehicleId: 'v1' })).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError propagate as permanent, not wrapped', async () => {
    const notFound = new ApiError(404, { error: 'Vehicle not found' });
    mockDeleteVehicle.mockRejectedValue(notFound);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.DELETE_VEHICLE!({ vehicleId: 'v1' })).rejects.toBe(notFound);
  });
});

describe('outboxHandlers.INITIATE_TRANSFER', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls initiateTransfer with the vehicleId and recipientEmail', async () => {
    mockInitiateTransfer.mockResolvedValue({ id: 't1', status: 'PENDING', recipientEmail: 'buyer@example.com', expiresAt: '2026-07-12T00:00:00.000Z' });
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.INITIATE_TRANSFER!({ vehicleId: 'v1', recipientEmail: 'buyer@example.com' });

    expect(mockInitiateTransfer).toHaveBeenCalledWith(fakeClient, 'v1', 'buyer@example.com');
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockInitiateTransfer.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(
      handlers.INITIATE_TRANSFER!({ vehicleId: 'v1', recipientEmail: 'buyer@example.com' }),
    ).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockInitiateTransfer.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(
      handlers.INITIATE_TRANSFER!({ vehicleId: 'v1', recipientEmail: 'buyer@example.com' }),
    ).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError (e.g. "cannot transfer to yourself") propagate as permanent, not wrapped', async () => {
    const badRequest = new ApiError(400, { error: 'Cannot transfer to yourself' });
    mockInitiateTransfer.mockRejectedValue(badRequest);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(
      handlers.INITIATE_TRANSFER!({ vehicleId: 'v1', recipientEmail: 'buyer@example.com' }),
    ).rejects.toBe(badRequest);
  });
});

describe('outboxHandlers.CANCEL_TRANSFER', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls cancelTransfer with the vehicleId', async () => {
    mockCancelTransfer.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.CANCEL_TRANSFER!({ vehicleId: 'v1' });

    expect(mockCancelTransfer).toHaveBeenCalledWith(fakeClient, 'v1');
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockCancelTransfer.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CANCEL_TRANSFER!({ vehicleId: 'v1' })).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockCancelTransfer.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CANCEL_TRANSFER!({ vehicleId: 'v1' })).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError propagate as permanent, not wrapped', async () => {
    const notFound = new ApiError(404, { error: 'No pending transfer for this vehicle' });
    mockCancelTransfer.mockRejectedValue(notFound);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CANCEL_TRANSFER!({ vehicleId: 'v1' })).rejects.toBe(notFound);
  });
});

describe('outboxHandlers.CREATE_LOG_ENTRY', () => {
  afterEach(() => jest.clearAllMocks());

  const logEntryPayload = {
    vehicleId: 'v1',
    typeId: 'MAINTENANCE',
    title: 'Oil & filter change',
    date: '2026-07-04',
    mileage: 12400,
    notes: null,
    items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }],
  };

  it('POSTs to /vehicles/:vehicleId/log with time null and sortOrder assigned by array index', async () => {
    mockCreateLogEntry.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.CREATE_LOG_ENTRY!(logEntryPayload);

    expect(mockCreateLogEntry).toHaveBeenCalledWith(fakeClient, 'v1', {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-07-04',
      mileage: 12400,
      notes: null,
      time: null,
      items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99, sortOrder: 0 }],
    });
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockCreateLogEntry.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_LOG_ENTRY!(logEntryPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockCreateLogEntry.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_LOG_ENTRY!(logEntryPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError propagate as permanent, not wrapped', async () => {
    const badRequest = new ApiError(400, { error: 'Invalid input' });
    mockCreateLogEntry.mockRejectedValue(badRequest);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_LOG_ENTRY!(logEntryPayload)).rejects.toBe(badRequest);
  });
});

describe('outboxHandlers.UPDATE_LOG_ENTRY', () => {
  afterEach(() => jest.clearAllMocks());

  const updateLogEntryPayload = {
    vehicleId: 'v1',
    entryId: 'e1',
    typeId: 'REPAIR',
    title: 'Front brake pads',
    date: '2026-07-04',
    mileage: 12500,
    notes: 'New pads',
    items: [{ categoryId: 'PART', description: 'Brake pads', quantity: 1, unitCost: 45 }],
  };

  it('PATCHes /vehicles/:vehicleId/log/:entryId with time null and sortOrder assigned by array index', async () => {
    mockUpdateLogEntry.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.UPDATE_LOG_ENTRY!(updateLogEntryPayload);

    expect(mockUpdateLogEntry).toHaveBeenCalledWith(fakeClient, 'v1', 'e1', {
      typeId: 'REPAIR',
      title: 'Front brake pads',
      date: '2026-07-04',
      mileage: 12500,
      notes: 'New pads',
      time: null,
      items: [{ categoryId: 'PART', description: 'Brake pads', quantity: 1, unitCost: 45, sortOrder: 0 }],
    });
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockUpdateLogEntry.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_LOG_ENTRY!(updateLogEntryPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockUpdateLogEntry.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_LOG_ENTRY!(updateLogEntryPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError propagate as permanent, not wrapped', async () => {
    const notFound = new ApiError(404, { error: 'Log entry not found' });
    mockUpdateLogEntry.mockRejectedValue(notFound);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.UPDATE_LOG_ENTRY!(updateLogEntryPayload)).rejects.toBe(notFound);
  });
});

describe('outboxHandlers.DELETE_LOG_ENTRY', () => {
  afterEach(() => jest.clearAllMocks());

  const deleteLogEntryPayload = { vehicleId: 'v1', entryId: 'e1' };

  it('DELETEs /vehicles/:vehicleId/log/:entryId', async () => {
    mockDeleteLogEntry.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.DELETE_LOG_ENTRY!(deleteLogEntryPayload);

    expect(mockDeleteLogEntry).toHaveBeenCalledWith(fakeClient, 'v1', 'e1');
  });

  it('wraps a 5xx ApiError as retryable', async () => {
    mockDeleteLogEntry.mockRejectedValue(new ApiError(500, {}));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.DELETE_LOG_ENTRY!(deleteLogEntryPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('wraps a raw network failure as retryable', async () => {
    mockDeleteLogEntry.mockRejectedValue(new TypeError('Network request failed'));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.DELETE_LOG_ENTRY!(deleteLogEntryPayload)).rejects.toBeInstanceOf(RetryableOutboxError);
  });

  it('lets a 4xx ApiError propagate as permanent, not wrapped', async () => {
    const notFound = new ApiError(404, { error: 'Log entry not found' });
    mockDeleteLogEntry.mockRejectedValue(notFound);
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.DELETE_LOG_ENTRY!(deleteLogEntryPayload)).rejects.toBe(notFound);
  });
});
