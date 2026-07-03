import { ApiError, type HttpClient } from '@maintenance-log/api-client';
import { RetryableOutboxError } from './SyncService';
import { createOutboxHandlers } from './outboxHandlers';

jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  createVehicle: jest.fn(),
  createVehicleWithPhotoUri: jest.fn(),
  updateVehicle: jest.fn(),
}));
jest.mock('@/infrastructure/storage/photoStorage', () => ({ deleteVehiclePhoto: jest.fn() }));

import { createVehicle, createVehicleWithPhotoUri, updateVehicle } from '@maintenance-log/api-client';
import { deleteVehiclePhoto } from '@/infrastructure/storage/photoStorage';

const mockCreateVehicle = createVehicle as jest.MockedFunction<typeof createVehicle>;
const mockCreateVehicleWithPhotoUri = createVehicleWithPhotoUri as jest.MockedFunction<typeof createVehicleWithPhotoUri>;
const mockUpdateVehicle = updateVehicle as jest.MockedFunction<typeof updateVehicle>;
const mockDeleteVehiclePhoto = deleteVehiclePhoto as jest.MockedFunction<typeof deleteVehiclePhoto>;
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

const payload = { vehicleId: 'v1', nickname: 'Blackbird', make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 };

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

  it('when a photo is present, uploads via createVehicleWithPhotoUri instead of createVehicle', async () => {
    mockCreateVehicleWithPhotoUri.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.CREATE_VEHICLE!(createPayloadWithPhoto);

    expect(mockCreateVehicleWithPhotoUri).toHaveBeenCalledWith(fakeClient, createPayload, stablePhoto);
    expect(mockCreateVehicle).not.toHaveBeenCalled();
  });

  it('deletes the local photo file after a successful upload', async () => {
    mockCreateVehicleWithPhotoUri.mockResolvedValue(undefined);
    const handlers = createOutboxHandlers(fakeClient);

    await handlers.CREATE_VEHICLE!(createPayloadWithPhoto);

    expect(mockDeleteVehiclePhoto).toHaveBeenCalledWith(stablePhoto.uri);
  });

  it('deletes the local photo file after a permanent (4xx) failure', async () => {
    mockCreateVehicleWithPhotoUri.mockRejectedValue(new ApiError(400, { error: 'Invalid input' }));
    const handlers = createOutboxHandlers(fakeClient);

    await expect(handlers.CREATE_VEHICLE!(createPayloadWithPhoto)).rejects.toBeInstanceOf(ApiError);
    expect(mockDeleteVehiclePhoto).toHaveBeenCalledWith(stablePhoto.uri);
  });

  it('keeps the local photo file after a retryable failure, for the next flush attempt to find', async () => {
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
});
