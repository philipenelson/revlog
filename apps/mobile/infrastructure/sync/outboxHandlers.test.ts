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
}));
jest.mock('@/infrastructure/storage/photoStorage', () => ({
  deleteVehiclePhoto: jest.fn(),
  openVehiclePhotoFile: jest.fn(),
}));

import { createVehicle, createVehicleWithPhotoUri, updateVehicle, setVehiclePhotoUri, deleteVehicle } from '@maintenance-log/api-client';
import { deleteVehiclePhoto, openVehiclePhotoFile } from '@/infrastructure/storage/photoStorage';

const mockCreateVehicle = createVehicle as jest.MockedFunction<typeof createVehicle>;
const mockCreateVehicleWithPhotoUri = createVehicleWithPhotoUri as jest.MockedFunction<typeof createVehicleWithPhotoUri>;
const mockUpdateVehicle = updateVehicle as jest.MockedFunction<typeof updateVehicle>;
const mockSetVehiclePhotoUri = setVehiclePhotoUri as jest.MockedFunction<typeof setVehiclePhotoUri>;
const mockDeleteVehicle = deleteVehicle as jest.MockedFunction<typeof deleteVehicle>;
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
