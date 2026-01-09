<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.user)
</script>

<template>
  <div class="home">
    <header class="hero">
      <h1>TTRPG Engine</h1>
      <p class="tagline">Your world. Your rules. Your story.</p>
    </header>

    <!-- Authenticated user -->
    <div v-if="isAuthenticated" class="auth-status">
      <p class="welcome">Welcome back, {{ user?.displayName || user?.email }}</p>
      <nav class="actions">
        <RouterLink to="/campaigns" class="btn btn-primary">
          View Campaigns
        </RouterLink>
        <button @click="authStore.logout()" class="btn btn-secondary">
          Logout
        </button>
      </nav>
    </div>

    <!-- Not authenticated -->
    <nav v-else class="actions">
      <RouterLink to="/login" class="btn btn-primary">
        Login
      </RouterLink>
      <RouterLink to="/enroll" class="btn btn-secondary">
        New? Enroll
      </RouterLink>
    </nav>

    <div class="topology-badge">
      <span class="phi"></span>
      <span class="label">Topology-First Auth</span>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tagline {
  font-size: 1.25rem;
  color: #888;
}

.auth-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.welcome {
  color: #4ade80;
  font-size: 1rem;
}

.actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease-out;
  text-decoration: none;
  border: none;
  font-size: 1rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.topology-badge {
  position: fixed;
  bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.75rem;
}

.phi::before {
  content: '\03C6';
  font-family: 'Times New Roman', serif;
  font-size: 1rem;
}

.label {
  font-family: monospace;
}
</style>
