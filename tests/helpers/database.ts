import mongoose from 'mongoose';

import {
  assertSafeTestDatabaseName,
  connectDatabase,
  disconnectDatabase,
  initializeDatabase,
} from '../../src/config/database';
import { env } from '../../src/config/env';
import { clearFaultInjection } from '../../src/common/utils/faultInjection';

function assertTestDatabaseSafety(): void {
  if (env.NODE_ENV !== 'test') {
    throw new Error(`Database tests require NODE_ENV=test, received ${env.NODE_ENV}`);
  }
  assertSafeTestDatabaseName(env.MONGODB_DB_NAME);
}

beforeAll(async () => {
  assertTestDatabaseSafety();
  await connectDatabase();
  if (mongoose.connection.name !== env.MONGODB_DB_NAME) {
    throw new Error(
      `Connected to ${mongoose.connection.name}, expected test database ${env.MONGODB_DB_NAME}`,
    );
  }
  await initializeDatabase();
});

beforeEach(() => {
  clearFaultInjection();
});

afterEach(async () => {
  clearFaultInjection();
  assertTestDatabaseSafety();
  if (mongoose.connection.readyState === 1) {
    if (mongoose.connection.name !== env.MONGODB_DB_NAME) {
      throw new Error(`Refusing cleanup for unexpected database ${mongoose.connection.name}`);
    }
    await mongoose.connection.dropDatabase();
    await initializeDatabase();
  }
});

afterAll(async () => {
  await disconnectDatabase();
});
