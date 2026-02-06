<script setup lang="ts">
import { ref, inject, type Ref } from 'vue'
import GenesisViewport from '@/viewport/GenesisViewport.vue'

const campaignId = inject<Ref<string>>('campaignId')!

const isPlaying = ref(false)

function startSession() {
  isPlaying.value = true
}

function exitSession() {
  isPlaying.value = false
}

function handleError(error: Error) {
  console.error('Genesis error:', error)
  // Could show a toast notification here
}
</script>

<template>
  <div class="session">
    <!-- Pre-session: show start button -->
    <template v-if="!isPlaying">
      <div class="session-lobby">
        <h2>Game Session</h2>
        <p>Ready to play? Starting a session will launch the Genesis reality engine.</p>

        <div class="session-info">
          <div class="info-card">
            <h3>What happens in a session?</h3>
            <ul>
              <li>Scenes precipitate from probability space</li>
              <li>NPCs respond through phenomenological cognition</li>
              <li>The world simulates in real-time</li>
              <li>Your actions shape reality</li>
            </ul>
          </div>
        </div>

        <button class="btn btn-primary btn-large" @click="startSession">
          Start Session
        </button>
      </div>
    </template>

    <!-- Active session: Genesis viewport takes over -->
    <GenesisViewport
      v-else
      :campaign-id="campaignId"
      view="session"
      @exit="exitSession"
      @error="handleError"
    />
  </div>
</template>

<style scoped>
.session {
  min-height: 100%;
}

.session-lobby {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
  padding: 2rem 0;
}

.session-lobby h2 {
  margin-bottom: 1rem;
}

.session-lobby > p {
  color: var(--text-muted);
  margin-bottom: 2rem;
}

.session-info {
  margin-bottom: 2rem;
}

.info-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: left;
}

.info-card h3 {
  font-size: 1rem;
  margin: 0 0 1rem;
  color: var(--text-muted);
}

.info-card ul {
  margin: 0;
  padding-left: 1.5rem;
}

.info-card li {
  margin-bottom: 0.5rem;
  color: var(--text);
}

.info-card li:last-child {
  margin-bottom: 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.btn-primary {
  background: var(--energy-hot);
  color: var(--surface);
}

.btn-primary:hover {
  background: var(--energy-warm);
  transform: translateY(-2px);
}
</style>
