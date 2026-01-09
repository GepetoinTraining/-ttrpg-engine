/**
 * TOPOLOGY-FIRST AUTHENTICATION
 * ==============================
 *
 * φ + ζ = π
 *
 * Authentication without passwords, tokens, or sessions.
 * Just: same seed + same math = same answer.
 *
 * The security is the unreproducibility of the enrollment moment.
 * You cannot be at that place at that time again.
 * Your spacetime coordinate becomes your cryptographic anchor.
 */

// Core math
export {
  PHI,
  CHALLENGE_N_MIN,
  CHALLENGE_N_MAX,
  createSeed,
  createSeedCommitment,
  computeZeta,
  createZetaCommitment,
  createM,
  matrixMultiply,
  matrixPower,
  trajectoryHash,
  generateChallengeN,
  computeTrajectory,
  verifyTrajectory,
  createCertificate,
  serializeCertificate,
  parseCertificate,
  getCertificateHash,
  extractSeedFromCertificate,
  type Matrix2x2,
  type GeoLocation,
  type EnrollmentMoment,
  type Challenge,
  type Certificate,
} from './math';

// Enrollment
export {
  requestEnrollment,
  getEnrollmentRequest,
  getPendingEnrollments,
  vouchEnrollment,
  approveEnrollment,
  rejectEnrollment,
  getSeed,
  getSeedByUserId,
  getCertificateByHash,
  getCertificatesForSeed,
  touchCertificate,
  type EnrollmentRequest,
  type TopologySeed,
  type TopologyCertificate,
} from './enrollment';

// Challenge/response
export {
  createChallenge,
  getChallenge,
  verifyChallenge,
  verifyChallengeWithSeed,
  cleanupExpiredChallenges,
  type TopologyChallenge,
  type ChallengeResponse,
  type VerificationResult,
} from './challenge';

// Verification (main entry point)
export {
  verifyTopologyAuth,
  verifyTopologyAuthQuick,
  topologyToSessionAuth,
} from './verify';

// Revocation
export {
  revokeSeed,
  revokeCertificate,
  isUserRevoked,
  getRevocationInfo,
  getRevokedSeeds,
} from './revocation';
