import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  recordAccessTokenExpiry,
  clearAccessTokenExpiry,
  isAccessTokenExpired,
} from "./tokenExpiry";

const STORAGE_KEY = "auth.access_token_exp";

describe("tokenExpiry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("stores a valid expiry", () => {
    recordAccessTokenExpiry(9999999999);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("9999999999");
  });

  it("clears storage when expiry is null", () => {
    localStorage.setItem(STORAGE_KEY, "12345");
    recordAccessTokenExpiry(null);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears storage when expiry is undefined", () => {
    localStorage.setItem(STORAGE_KEY, "12345");
    recordAccessTokenExpiry(undefined);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears storage when expiry is NaN", () => {
    localStorage.setItem(STORAGE_KEY, "12345");
    recordAccessTokenExpiry(NaN);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clearAccessTokenExpiry removes the key", () => {
    localStorage.setItem(STORAGE_KEY, "99999");
    clearAccessTokenExpiry();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("isAccessTokenExpired returns false when no hint stored", () => {
    expect(isAccessTokenExpired()).toBe(false);
  });

  it("isAccessTokenExpired returns false for a future expiry", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 86400;
    localStorage.setItem(STORAGE_KEY, String(farFuture));
    expect(isAccessTokenExpired()).toBe(false);
  });

  it("isAccessTokenExpired returns true for a past expiry", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    localStorage.setItem(STORAGE_KEY, String(past));
    expect(isAccessTokenExpired()).toBe(true);
  });

  it("isAccessTokenExpired returns false when storage is unavailable", () => {
    localStorage.clear();
    expect(isAccessTokenExpired()).toBe(false);
  });
});
