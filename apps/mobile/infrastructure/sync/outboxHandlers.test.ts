import { ApiError, type HttpClient } from '@maintenance-log/api-client';
import { RetryableOutboxError } from './SyncService';
import { createOutboxHandlers } from './outboxHandlers';

jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  createVehicle: jest.fn(),
  updateVehicle: jest.fn(),
}));

import { createVehicle, updateVehicle } from '@maintenance-log/api-client';

const mockCreateVehicle = createVehicle as jest.MockedFunction<typeof createVehicle>;
const mockUpdateVehicle = updateVehicle as jest.MockedFunction<typeof updateVehicle>;
const fakeClient = {} as HttpClient;

const createPayload = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
};

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
