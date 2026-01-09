/**
 * CAMPAIGN STORE
 * ===============
 *
 * Manages the current campaign context.
 * This ID is sent with every API request to scope operations to the campaign.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Storage key for persisting current campaign
const STORAGE_KEY_CAMPAIGN = 'current-campaign-id';

export const useCampaignStore = defineStore('campaign', () => {
  // State
  const currentCampaignId = ref<string | null>(null);

  // Computed
  const hasCampaign = computed(() => !!currentCampaignId.value);

  /**
   * Set the current campaign context
   * Called when navigating to /campaign/:id
   */
  function setCampaign(campaignId: string | null) {
    currentCampaignId.value = campaignId;

    // Persist to localStorage
    if (campaignId) {
      localStorage.setItem(STORAGE_KEY_CAMPAIGN, campaignId);
    } else {
      localStorage.removeItem(STORAGE_KEY_CAMPAIGN);
    }
  }

  /**
   * Clear the current campaign context
   * Called when navigating away from a campaign
   */
  function clearCampaign() {
    setCampaign(null);
  }

  /**
   * Initialize from localStorage
   */
  function initialize() {
    const stored = localStorage.getItem(STORAGE_KEY_CAMPAIGN);
    if (stored) {
      currentCampaignId.value = stored;
    }
  }

  // Initialize on store creation
  initialize();

  return {
    // State
    currentCampaignId,

    // Computed
    hasCampaign,

    // Actions
    setCampaign,
    clearCampaign,
    initialize,
  };
});
