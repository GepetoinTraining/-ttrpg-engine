/**
 * TOPOLOGY AUTH STORE
 * ====================
 *
 * Manages authentication state using topology-first auth.
 * No passwords, no external services - just math.
 *
 * Flow:
 * 1. User requests enrollment (captures geo + datetime)
 * 2. Another user vouches for them
 * 3. Certificate is issued and stored locally
 * 4. Each API request: get challenge, compute trajectory, send headers
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  computeTrajectory,
  extractSeedFromCertificate,
  getCertificateHash,
} from '@/lib/topology-math';

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  imageUrl?: string;
}

export interface EnrollmentRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
}

export interface AuthState {
  certificate: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingEnrollment: EnrollmentRequest | null;
}

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEY_CERT = 'topology-cert';
const STORAGE_KEY_USER = 'topology-user';

// ============================================
// STORE
// ============================================

export const useAuthStore = defineStore('auth', () => {
  // State
  const certificate = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const pendingEnrollment = ref<EnrollmentRequest | null>(null);
  const currentChallenge = ref<{ id: string; n: number } | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!certificate.value && !!user.value);
  const certificateHash = computed(() =>
    certificate.value ? getCertificateHash(certificate.value) : null
  );
  const seed = computed(() =>
    certificate.value ? extractSeedFromCertificate(certificate.value) : null
  );

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Load auth state from localStorage
   */
  function initialize() {
    try {
      const storedCert = localStorage.getItem(STORAGE_KEY_CERT);
      const storedUser = localStorage.getItem(STORAGE_KEY_USER);

      if (storedCert) {
        certificate.value = storedCert;
      }

      if (storedUser) {
        user.value = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('[Auth] Failed to load from storage:', error);
      clear();
    }
  }

  /**
   * Save auth state to localStorage
   */
  function persist() {
    try {
      if (certificate.value) {
        localStorage.setItem(STORAGE_KEY_CERT, certificate.value);
      } else {
        localStorage.removeItem(STORAGE_KEY_CERT);
      }

      if (user.value) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user.value));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (error) {
      console.error('[Auth] Failed to persist:', error);
    }
  }

  // ============================================
  // ENROLLMENT
  // ============================================

  /**
   * Request enrollment (new user or new device)
   */
  async function requestEnrollment(email: string): Promise<string> {
    isLoading.value = true;

    try {
      // Get geolocation
      const geo = await getGeolocation();

      // Generate device identifier
      const deviceIdentifier = await getDeviceIdentifier();

      // Call API
      const { trpc } = await import('@/api/trpc');
      const result = await trpc.auth.requestEnrollment.mutate({
        email,
        deviceIdentifier,
        geo,
      });

      // Store pending enrollment
      pendingEnrollment.value = {
        id: result.requestId,
        status: 'pending',
        expiresAt: new Date(result.expiresAt),
      };

      return result.requestId;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Check enrollment status and complete if approved
   */
  async function checkEnrollmentStatus(): Promise<boolean> {
    if (!pendingEnrollment.value) return false;

    try {
      const { trpc } = await import('@/api/trpc');

      // For now, we'll poll the backend for status
      // In production, you might use WebSocket or SSE
      const result = await trpc.auth.getEnrollmentStatus.query({
        requestId: pendingEnrollment.value.id,
      });

      if (result.status === 'approved' && result.certificate) {
        // Enrollment approved - store certificate
        certificate.value = result.certificate;
        user.value = result.user;
        pendingEnrollment.value = null;
        persist();
        return true;
      }

      if (result.status === 'rejected' || result.status === 'expired') {
        pendingEnrollment.value = null;
        return false;
      }

      return false;
    } catch (error) {
      console.error('[Auth] Failed to check enrollment:', error);
      return false;
    }
  }

  // ============================================
  // CHALLENGE/RESPONSE
  // ============================================

  /**
   * Get a fresh challenge from the server
   */
  async function getChallenge(): Promise<{ id: string; n: number } | null> {
    if (!certificateHash.value) return null;

    try {
      const { trpc } = await import('@/api/trpc');
      const result = await trpc.auth.requestChallenge.mutate({
        certificateHash: certificateHash.value,
      });

      currentChallenge.value = {
        id: result.challengeId,
        n: result.n,
      };

      return currentChallenge.value;
    } catch (error) {
      console.error('[Auth] Failed to get challenge:', error);
      return null;
    }
  }

  /**
   * Compute trajectory for current challenge
   */
  function computeChallengeResponse(challenge: { id: string; n: number }): string | null {
    if (!seed.value) return null;
    return computeTrajectory(seed.value, challenge.n);
  }

  /**
   * Get auth headers for API requests
   * This is called by the tRPC client on each request
   */
  async function getAuthHeaders(): Promise<Record<string, string>> {
    if (!certificate.value || !certificateHash.value) {
      return {};
    }

    // For quick auth, just send the certificate hash
    // The server will verify against the stored certificate
    return {
      'x-topology-cert': certificateHash.value,
    };
  }

  /**
   * Get full auth headers with challenge response
   * Used for sensitive operations
   */
  async function getFullAuthHeaders(): Promise<Record<string, string>> {
    if (!certificate.value || !certificateHash.value || !seed.value) {
      return {};
    }

    // Get fresh challenge
    const challenge = await getChallenge();
    if (!challenge) return {};

    // Compute trajectory
    const trajectory = computeTrajectory(seed.value, challenge.n);

    return {
      'x-topology-cert': certificateHash.value,
      'x-topology-challenge': challenge.id,
      'x-topology-trajectory': trajectory,
    };
  }

  // ============================================
  // LOGOUT / CLEAR
  // ============================================

  /**
   * Clear all auth state
   */
  function clear() {
    certificate.value = null;
    user.value = null;
    pendingEnrollment.value = null;
    currentChallenge.value = null;
    localStorage.removeItem(STORAGE_KEY_CERT);
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  /**
   * Logout - clear local state
   * Note: This doesn't revoke the certificate server-side
   */
  function logout() {
    clear();
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Get current geolocation
   */
  async function getGeolocation(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        // Fallback to default location
        resolve({ lat: 0, lon: 0 });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('[Auth] Geolocation error:', error);
          // Fallback to default location
          resolve({ lat: 0, lon: 0 });
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }

  /**
   * Generate a device identifier
   */
  async function getDeviceIdentifier(): Promise<string> {
    // Simple fingerprint based on available browser info
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
    ];

    const str = components.join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // Initialize on store creation
  initialize();

  return {
    // State
    certificate,
    user,
    isLoading,
    pendingEnrollment,
    currentChallenge,

    // Computed
    isAuthenticated,
    certificateHash,
    seed,

    // Actions
    initialize,
    requestEnrollment,
    checkEnrollmentStatus,
    getChallenge,
    computeChallengeResponse,
    getAuthHeaders,
    getFullAuthHeaders,
    logout,
    clear,
  };
});
