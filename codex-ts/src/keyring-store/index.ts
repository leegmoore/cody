/**
 * Credential storage abstraction for keyring-backed implementations.
 *
 * This module provides a platform-agnostic interface for secure credential storage,
 * similar to the Rust keyring-store crate.
 */

/**
 * Error thrown by credential store operations.
 */
export class CredentialStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialStoreError";
  }
}

/**
 * Interface for keyring-backed credential storage.
 *
 * Provides methods to load, save, and delete credentials from a secure store.
 */
export interface KeyringStore {
  /**
   * Load a credential from the store.
   *
   * @param service - The service name (e.g., "codex")
   * @param account - The account identifier (e.g., "api-key")
   * @returns The credential value if found, undefined otherwise
   * @throws {CredentialStoreError} If the operation fails
   */
  load(service: string, account: string): Promise<string | undefined>;

  /**
   * Save a credential to the store.
   *
   * @param service - The service name
   * @param account - The account identifier
   * @param value - The credential value to store
   * @throws {CredentialStoreError} If the operation fails
   */
  save(service: string, account: string, value: string): Promise<void>;

  /**
   * Delete a credential from the store.
   *
   * @param service - The service name
   * @param account - The account identifier
   * @returns true if a credential was deleted, false if it didn't exist
   * @throws {CredentialStoreError} If the operation fails
   */
  delete(service: string, account: string): Promise<boolean>;
}

/**
 * Internal credential state for MockKeyringStore.
 */
interface MockCredential {
  value?: string;
  error?: CredentialStoreError;
}

/**
 * Mock implementation of KeyringStore for testing.
 *
 * This implementation stores credentials in memory and supports error simulation
 * for testing error handling paths.
 */
export class MockKeyringStore implements KeyringStore {
  private credentials: Map<string, MockCredential>;

  constructor() {
    this.credentials = new Map();
  }

  /**
   * Get or create a credential entry for an account.
   */
  private getCredential(account: string): MockCredential {
    if (!this.credentials.has(account)) {
      this.credentials.set(account, {});
    }
    return this.credentials.get(account)!;
  }

  async load(_service: string, account: string): Promise<string | undefined> {
    const credential = this.credentials.get(account);

    if (!credential) {
      return undefined;
    }

    if (credential.error) {
      throw credential.error;
    }

    return credential.value;
  }

  async save(_service: string, account: string, value: string): Promise<void> {
    const credential = this.getCredential(account);

    if (credential.error) {
      throw credential.error;
    }

    credential.value = value;
  }

  async delete(_service: string, account: string): Promise<boolean> {
    const credential = this.credentials.get(account);

    if (!credential) {
      return false;
    }

    if (credential.error) {
      throw credential.error;
    }

    // Check if credential had a value before deletion
    const hadValue = credential.value !== undefined;

    // Remove the credential from the store
    this.credentials.delete(account);

    return hadValue;
  }

  /**
   * Get the saved value for an account (test helper).
   *
   * @param account - The account identifier
   * @returns The saved value if it exists
   */
  savedValue(account: string): string | undefined {
    const credential = this.credentials.get(account);
    return credential?.value;
  }

  /**
   * Check if an account exists in the store (test helper).
   *
   * @param account - The account identifier
   * @returns true if the account exists
   */
  contains(account: string): boolean {
    return this.credentials.has(account);
  }

  /**
   * Set an error to be thrown for a specific account (test helper).
   *
   * This allows testing error handling paths.
   *
   * @param account - The account identifier
   * @param error - The error to throw on next operation
   */
  setError(account: string, error: CredentialStoreError): void {
    const credential = this.getCredential(account);
    credential.error = error;
  }
}
