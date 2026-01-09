<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const error = ref('')
const isLoading = ref(false)

// Check if user has a stored certificate
const hasCertificate = computed(() => !!authStore.certificate)

// Debug: check raw localStorage
const rawCert = localStorage.getItem('topology-cert')
console.log('[Login] Raw cert in localStorage:', rawCert ? rawCert.slice(0, 50) + '...' : 'null')
console.log('[Login] authStore.certificate:', authStore.certificate ? 'exists' : 'null')

onMounted(() => {
  // If already authenticated, redirect to home
  if (authStore.isAuthenticated) {
    router.push('/campaigns')
  }
})

async function handleLogin() {
  if (!authStore.certificate) {
    error.value = 'No certificate found. Please enroll first.'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    // Get a challenge and verify we can authenticate
    const challenge = await authStore.getChallenge()
    if (!challenge) {
      error.value = 'Failed to get authentication challenge'
      return
    }

    // Compute trajectory
    const trajectory = authStore.computeChallengeResponse(challenge)
    if (!trajectory) {
      error.value = 'Failed to compute trajectory'
      return
    }

    // Verify with server
    const { trpc } = await import('@/api/trpc')
    const result = await trpc.auth.verifyChallenge.mutate({
      challengeId: challenge.id,
      trajectory,
    })

    if (result.valid) {
      // Fetch user info
      try {
        const me = await trpc.auth.me.query()
        authStore.user = {
          id: me.userId,
          email: me.email,
          displayName: me.displayName,
        }
        // Persist the user info
        localStorage.setItem('topology-user', JSON.stringify(authStore.user))
        router.push('/campaigns')
      } catch (e) {
        // me endpoint requires auth context, try to proceed anyway
        router.push('/campaigns')
      }
    } else {
      error.value = 'Authentication failed. Your certificate may be invalid or revoked.'
    }
  } catch (e: any) {
    console.error('[Login] Error:', e)
    error.value = e.message || 'Authentication failed'
  } finally {
    isLoading.value = false
  }
}

function goToEnroll() {
  router.push('/enroll')
}

function clearCertificate() {
  authStore.clear()
  error.value = ''
}

function fullReset() {
  // Clear everything
  localStorage.removeItem('topology-cert')
  localStorage.removeItem('topology-user')
  authStore.clear()
  // Force reload to reset all state
  window.location.href = '/enroll'
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Welcome Back</h1>
      <p class="subtitle">Topology-First Authentication</p>

      <!-- Has certificate - can login -->
      <div v-if="hasCertificate" class="step">
        <div class="cert-status">
          <div class="cert-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </div>
          <span>Certificate detected</span>
        </div>

        <p class="description">
          Your topology certificate is stored locally. Click below to authenticate.
        </p>

        <p v-if="error" class="error">{{ error }}</p>

        <button
          @click="handleLogin"
          :disabled="isLoading"
          class="login-btn"
        >
          {{ isLoading ? 'Authenticating...' : 'Authenticate' }}
        </button>

        <button @click="clearCertificate" class="clear-btn">
          Use different certificate
        </button>
      </div>

      <!-- No certificate - needs to enroll -->
      <div v-else class="step">
        <div class="no-cert">
          <p class="description">
            No certificate found on this device. You need to enroll to get one.
          </p>

          <button @click="goToEnroll" class="enroll-btn">
            Request Enrollment
          </button>

          <p class="note">
            If you already have a certificate on another device, you'll need to request a new one for this device.
          </p>
        </div>
      </div>
    </div>

    <div class="topology-visual">
      <div class="phi-symbol"></div>
      <div class="plus">+</div>
      <div class="zeta-symbol"></div>
      <div class="equals">=</div>
      <div class="pi-symbol"></div>
    </div>

    <!-- Debug: Full reset -->
    <button @click="fullReset" class="reset-btn">
      Clear All & Start Over
    </button>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.login-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  backdrop-filter: blur(10px);
}

h1 {
  color: #e0e0e0;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  text-align: center;
}

.subtitle {
  color: #888;
  font-size: 0.875rem;
  text-align: center;
  margin-bottom: 2rem;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cert-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 0.5rem;
  color: #4ade80;
}

.cert-icon svg {
  width: 24px;
  height: 24px;
}

.description {
  color: #aaa;
  font-size: 0.875rem;
  line-height: 1.5;
}

.error {
  color: #ff6b6b;
  font-size: 0.875rem;
  padding: 0.5rem;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 0.25rem;
}

.login-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.login-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  color: #888;
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.clear-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: #ccc;
}

.enroll-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.enroll-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.note {
  color: #666;
  font-size: 0.75rem;
  text-align: center;
  font-style: italic;
}

.no-cert {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.topology-visual {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 3rem;
  font-family: 'Times New Roman', serif;
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.3);
}

.phi-symbol::before {
  content: '\03C6';
}

.zeta-symbol::before {
  content: '\03B6';
}

.pi-symbol::before {
  content: '\03C0';
}

.plus, .equals {
  font-family: monospace;
}

.reset-btn {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: rgba(255, 100, 100, 0.2);
  border: 1px dashed rgba(255, 100, 100, 0.5);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  color: #ff6b6b;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 100, 100, 0.3);
  border-color: rgba(255, 100, 100, 0.8);
}
</style>
