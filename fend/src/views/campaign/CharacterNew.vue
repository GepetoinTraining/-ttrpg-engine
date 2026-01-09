<script setup lang="ts">
/**
 * CHARACTER NEW - Genesis Viewport for Character Creation
 *
 * Opens the Genesis viewport with the character-builder view.
 * The viewport nucleates the world surface and displays the precipitated form.
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenesisViewport from '@/viewport/GenesisViewport.vue'

const route = useRoute()
const router = useRouter()

const campaignId = computed(() => route.params.id as string)

function handleExit() {
  router.push({ name: 'campaign-characters', params: { id: campaignId.value } })
}

function handleError(error: Error) {
  console.error('Genesis error:', error)
}
</script>

<template>
  <GenesisViewport
    :campaign-id="campaignId"
    view="character-builder"
    @exit="handleExit"
    @error="handleError"
  />
</template>
