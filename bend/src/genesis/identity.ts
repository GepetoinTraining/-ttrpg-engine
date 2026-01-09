/**
 * IDENTITY - Self-Sovereign Birth Certificates
 *
 * Identity is not granted. Identity is BORN.
 *
 * A player's identity comes from:
 * - WHERE they were (geolocation)
 * - WHEN they were (timestamp)
 * - WHAT chaos surrounded them (entropy)
 *
 * This creates an unforgeable origin point.
 * No server owns you. You own yourself.
 */

import { compose } from './elements';

// Web Crypto API types for Node.js compatibility
type JsonWebKey = {
  kty?: string;
  use?: string;
  key_ops?: string[];
  alg?: string;
  ext?: boolean;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  n?: string;
  e?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
  k?: string;
};

// Birth data - the origin of identity
export interface BirthData {
  coordinates: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
  entropy: string;
  userAgent: string;
}

// The certificate metadata
export interface CertificateMetadata {
  uid: string;
  displayName: string;
  birthData: BirthData;
  createdAt: number;
  version: string;
}

// A player's certificate
export interface PlayerCertificate {
  metadata: CertificateMetadata;
  publicKeyJWK: JsonWebKey;
  certificatePEM: string;
}

// Signed payload wrapper
export interface SignedPayload<T> {
  payload: T;
  signature: string;
  certUid: string;
  timestamp: number;
}

const CERT_VERSION = '1.0.0';

/**
 * Generate entropy from random bytes
 */
export function generateEntropy(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate UID from birth data
 * This is THE unforgeable identity hash
 */
export async function generateUID(birthData: BirthData): Promise<string> {
  const dataString = [
    birthData.coordinates.latitude.toFixed(6),
    birthData.coordinates.longitude.toFixed(6),
    birthData.timestamp.toString(),
    birthData.entropy,
    birthData.userAgent,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Format: gen_[first 8]_[timestamp base36]_[last 8]
  const timeComponent = birthData.timestamp.toString(36);
  return `gen_${hashHex.slice(0, 8)}_${timeComponent}_${hashHex.slice(-8)}`;
}

/**
 * Generate a seed from UID
 * Maps identity to the element system
 */
export function uidToSeed(uid: string): bigint {
  // Extract the hash portions
  const parts = uid.split('_');
  const hashStart = parts[1] || '00000000';
  const hashEnd = parts[3] || '00000000';

  // Convert hex to number and map to element composition
  const startNum = parseInt(hashStart, 16);
  const endNum = parseInt(hashEnd, 16);

  // Create a topology from the hash
  // This maps identity to element composition
  const topology = {
    H: (startNum % 7) + 1,        // 1-7 hydrogen
    C: ((startNum >> 4) % 5) + 1, // 1-5 carbon
    O: ((endNum) % 4) + 1,        // 1-4 oxygen
    N: ((endNum >> 4) % 3) + 1,   // 1-3 nitrogen
  };

  return compose(topology);
}

/**
 * Collect birth data (for browser environment)
 */
export async function collectBirthData(
  getUserAgent: () => string = () => 'unknown',
  getGeolocation?: () => Promise<{ latitude: number; longitude: number; accuracy: number }>
): Promise<BirthData> {
  let coordinates = { latitude: 0, longitude: 0, accuracy: 0 };

  if (getGeolocation) {
    try {
      coordinates = await getGeolocation();
    } catch {
      // Geolocation denied - use zeros
    }
  }

  return {
    coordinates,
    timestamp: Date.now(),
    entropy: generateEntropy(),
    userAgent: getUserAgent(),
  };
}

/**
 * Create a birth certificate
 */
export async function createCertificate(
  displayName: string,
  birthData: BirthData,
  keyPair: CryptoKeyPair
): Promise<{ certificate: PlayerCertificate; privateKeyJWK: JsonWebKey }> {
  const uid = await generateUID(birthData);

  const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const metadata: CertificateMetadata = {
    uid,
    displayName,
    birthData,
    createdAt: Date.now(),
    version: CERT_VERSION,
  };

  // Create certificate data
  const certData = {
    version: 3,
    serialNumber: uid,
    issuer: {
      commonName: `Genesis:Player:${displayName}`,
      organizationName: 'Self-Sovereign',
      uid,
    },
    subject: {
      commonName: `Genesis:Player:${displayName}`,
      organizationName: 'Self-Sovereign',
      uid,
    },
    validity: {
      notBefore: new Date(metadata.createdAt).toISOString(),
      notAfter: new Date(metadata.createdAt + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    extensions: {
      'genesis.birthCoords': `${birthData.coordinates.latitude},${birthData.coordinates.longitude}`,
      'genesis.birthTime': new Date(birthData.timestamp).toISOString(),
      'genesis.originHash': uid,
      'genesis.seed': uidToSeed(uid).toString(),
    },
    publicKey: publicKeyJWK,
  };

  // Sign the certificate
  const certString = JSON.stringify(certData);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    keyPair.privateKey,
    encoder.encode(certString)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const fullCert = {
    certificate: certData,
    signature: signatureB64,
  };

  const certificatePEM = `-----BEGIN GENESIS CERTIFICATE-----\n${btoa(JSON.stringify(fullCert))}\n-----END GENESIS CERTIFICATE-----`;

  return {
    certificate: {
      metadata,
      publicKeyJWK,
      certificatePEM,
    },
    privateKeyJWK,
  };
}

/**
 * Sign a payload with a private key
 */
export async function signPayload<T>(
  payload: T,
  certUid: string,
  privateKey: CryptoKey
): Promise<SignedPayload<T>> {
  const timestamp = Date.now();
  const dataToSign = JSON.stringify({ payload, timestamp });
  const encoder = new TextEncoder();

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    encoder.encode(dataToSign)
  );

  return {
    payload,
    signature: btoa(String.fromCharCode(...new Uint8Array(signature))),
    certUid,
    timestamp,
  };
}

/**
 * Verify a signed payload
 */
export async function verifyPayload<T>(
  signedPayload: SignedPayload<T>,
  publicKeyJWK: JsonWebKey
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJWK,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      true,
      ['verify']
    );

    const dataToVerify = JSON.stringify({
      payload: signedPayload.payload,
      timestamp: signedPayload.timestamp,
    });
    const encoder = new TextEncoder();

    const signatureBytes = Uint8Array.from(
      atob(signedPayload.signature),
      c => c.charCodeAt(0)
    );

    return await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signatureBytes,
      encoder.encode(dataToVerify)
    );
  } catch {
    return false;
  }
}

/**
 * Parse a PEM certificate
 */
export function parseCertificate(pem: string): PlayerCertificate | null {
  try {
    const b64 = pem
      .replace('-----BEGIN GENESIS CERTIFICATE-----', '')
      .replace('-----END GENESIS CERTIFICATE-----', '')
      .trim();

    const { certificate } = JSON.parse(atob(b64));

    const [lat, lng] = certificate.extensions['genesis.birthCoords'].split(',');

    return {
      metadata: {
        uid: certificate.serialNumber,
        displayName: certificate.subject.commonName.replace('Genesis:Player:', ''),
        birthData: {
          coordinates: {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            accuracy: 0,
          },
          timestamp: new Date(certificate.extensions['genesis.birthTime']).getTime(),
          entropy: '',
          userAgent: '',
        },
        createdAt: new Date(certificate.validity.notBefore).getTime(),
        version: CERT_VERSION,
      },
      publicKeyJWK: certificate.publicKey,
      certificatePEM: pem,
    };
  } catch {
    return null;
  }
}
