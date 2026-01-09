<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Form state
const email = ref('')
const error = ref('')
const step = ref<'email' | 'waiting' | 'complete'>('email')

// Polling interval for checking enrollment status
let pollInterval: ReturnType<typeof setInterval> | null = null

const isSubmitting = computed(() => authStore.isLoading)

async function handleSubmit() {
  if (!email.value) {
    error.value = 'Email is required'
    return
  }

  error.value = ''

  try {
    await authStore.requestEnrollment(email.value)
    step.value = 'waiting'
    startPolling()
  } catch (e: any) {
    error.value = e.message || 'Failed to request enrollment'
  }
}

function startPolling() {
  // Poll every 3 seconds for enrollment approval
  pollInterval = setInterval(async () => {
    const approved = await authStore.checkEnrollmentStatus()
    if (approved) {
      stopPolling()
      step.value = 'complete'
      // Redirect after short delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  }, 3000)
}

async function handleBootstrap() {
  if (!authStore.pendingEnrollment) return

  error.value = ''

  try {
    const { trpc } = await import('@/api/trpc')
    const result = await trpc.auth.bootstrapEnrollment.mutate({
      requestId: authStore.pendingEnrollment.id,
    })

    // Store the certificate
    authStore.certificate = result.certificate
    localStorage.setItem('topology-cert', result.certificate)

    // Set user info
    authStore.user = {
      id: result.userId,
      email: email.value,
    }
    localStorage.setItem('topology-user', JSON.stringify(authStore.user))

    stopPolling()
    step.value = 'complete'

    setTimeout(() => {
      router.push('/')
    }, 2000)
  } catch (e: any) {
    error.value = e.message || 'Bootstrap failed'
  }
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

onMounted(() => {
  // If already authenticated, redirect
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="enroll-container">
    <div class="enroll-card">
      <h1>Topology Enrollment</h1>
      <p class="subtitle">No passwords. No external services. Just math.</p>

      <!-- Step 1: Email -->
      <div v-if="step === 'email'" class="step">
        <p class="description">
          Enter your email to request enrollment. Another player will need to vouch for you.
        </p>

        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="your@email.com"
              :disabled="isSubmitting"
              autocomplete="email"
            />
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <button type="submit" :disabled="isSubmitting" class="submit-btn">
            {{ isSubmitting ? 'Requesting...' : 'Request Enrollment' }}
          </button>
        </form>

        <p class="note">
          Your location and device will be captured to generate your unique topology seed.
        </p>
      </div>

      <!-- Step 2: Waiting for vouch -->
      <div v-if="step === 'waiting'" class="step">
        <div class="waiting-indicator">
          <div class="spinner"></div>
        </div>

        <h2>Waiting for Verification</h2>
        <p class="description">
          Your enrollment request has been submitted. Another player needs to vouch for you before your certificate is issued.
        </p>

        <p class="request-id" v-if="authStore.pendingEnrollment">
          Request ID: {{ authStore.pendingEnrollment.id.slice(0, 8) }}...
        </p>

        <p class="note">
          Ask another player to approve your enrollment from their dashboard.
        </p>

        <!-- Bootstrap option for first user / dev mode -->
        <div class="bootstrap-section">
          <p class="bootstrap-note">First user or dev mode?</p>
          <button @click="handleBootstrap" class="bootstrap-btn">
            Bootstrap (Self-Approve)
          </button>
          <p v-if="error" class="error">{{ error }}</p>
        </div>
      </div>

      <!-- Step 3: Complete -->
      <div v-if="step === 'complete'" class="step">
        <div class="success-indicator">
          <svg viewBox="0 0 24 24" class="checkmark">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>

        <h2>Enrollment Complete</h2>
        <p class="description">
          Your topology certificate has been issued. You're now authenticated.
        </p>

        <p class="user-info" v-if="authStore.user">
          Welcome, {{ authStore.user.displayName || authStore.user.email }}
        </p>

        <p class="redirect-note">Redirecting to home...</p>
      </div>
    </div>

    <div class="topology-visual">
      <div class="phi-symbol">phi</div>
      <div class="plus">+</div>
      <div class="zeta-symbol">zeta</div>
      <div class="equals">=</div>
      <div class="pi-symbol">pi</div>
    </div>
  </div>
</template>

<style scoped>
.enroll-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.enroll-card {
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

.description {
  color: #aaa;
  font-size: 0.875rem;
  line-height: 1.5;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  color: #ccc;
  font-size: 0.875rem;
}

input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus {
  border-color: rgba(255, 255, 255, 0.4);
}

input::placeholder {
  color: #666;
}

.error {
  color: #ff6b6b;
  font-size: 0.875rem;
}

.submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.note {
  color: #666;
  font-size: 0.75rem;
  text-align: center;
  font-style: italic;
}

.waiting-indicator {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

h2 {
  color: #e0e0e0;
  font-size: 1.25rem;
  text-align: center;
}

.request-id {
  color: #888;
  font-family: monospace;
  font-size: 0.875rem;
  text-align: center;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.success-indicator {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.checkmark {
  width: 48px;
  height: 48px;
  fill: #4ade80;
}

.user-info {
  color: #e0e0e0;
  text-align: center;
  font-weight: 500;
}

.redirect-note {
  color: #888;
  font-size: 0.875rem;
  text-align: center;
}

.bootstrap-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bootstrap-note {
  color: #666;
  font-size: 0.75rem;
  text-align: center;
}

.bootstrap-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed rgba(255, 255, 255, 0.3);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  color: #888;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.bootstrap-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
  color: #ccc;
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
</style>
