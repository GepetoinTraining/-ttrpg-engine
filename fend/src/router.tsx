import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'

// Import route components
import { RootLayout } from '@routes/__root'
import { IndexPage } from '@routes/index'
import { LoginPage } from '@routes/login'
import { InvitePage } from '@routes/invite.$code'

// Campaign routes
import { CampaignLayout } from '@routes/campaign/$id'
import { CampaignDashboard } from '@routes/campaign/$id.dashboard'
import { CampaignWorld } from '@routes/campaign/$id.world'
import { CampaignCharacters } from '@routes/campaign/$id.characters'
import { CampaignNpcs } from '@routes/campaign/$id.npcs'
import { CampaignFactions } from '@routes/campaign/$id.factions'

// Session routes
import { SessionNew } from '@routes/campaign/session/new'
import { SessionLive } from '@routes/campaign/session/$sessionId'
import { SessionEnd } from '@routes/campaign/session/$sessionId.end'

// Downtime routes
import { DowntimeGM } from '@routes/campaign/downtime/index'
import { DowntimePlayer } from '@routes/campaign/downtime/player'

// Player routes
import { PlayerLayout } from '@routes/player/$campaignId'
import { PlayerCharacter } from '@routes/player/$campaignId.character'
import { PlayerSession } from '@routes/player/$campaignId.session'
import { PlayerDowntime } from '@routes/player/$campaignId.downtime'

// ============================================
// ROUTE TREE
// ============================================

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$code',
  component: InvitePage,
})

// Campaign routes
const campaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/campaign/$id',
  component: CampaignLayout,
})

const campaignDashboardRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/',
  component: CampaignDashboard,
})

const campaignWorldRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/world',
  component: CampaignWorld,
})

const campaignCharactersRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/characters',
  component: CampaignCharacters,
})

const campaignNpcsRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/npcs',
  component: CampaignNpcs,
})

const campaignFactionsRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/factions',
  component: CampaignFactions,
})

// Session routes
const sessionNewRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/session/new',
  component: SessionNew,
})

const sessionLiveRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/session/$sessionId',
  component: SessionLive,
})

const sessionEndRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/session/$sessionId/end',
  component: SessionEnd,
})

// Downtime routes
const downtimeGMRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/downtime',
  component: DowntimeGM,
})

const downtimePlayerRoute = createRoute({
  getParentRoute: () => campaignRoute,
  path: '/downtime/player',
  component: DowntimePlayer,
})

// Player routes
const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/player/$campaignId',
  component: PlayerLayout,
})

const playerCharacterRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/character',
  component: PlayerCharacter,
})

const playerSessionRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/session',
  component: PlayerSession,
})

const playerDowntimeRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/downtime',
  component: PlayerDowntime,
})

// ============================================
// BUILD ROUTE TREE
// ============================================

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  inviteRoute,
  campaignRoute.addChildren([
    campaignDashboardRoute,
    campaignWorldRoute,
    campaignCharactersRoute,
    campaignNpcsRoute,
    campaignFactionsRoute,
    sessionNewRoute,
    sessionLiveRoute,
    sessionEndRoute,
    downtimeGMRoute,
    downtimePlayerRoute,
  ]),
  playerRoute.addChildren([
    playerCharacterRoute,
    playerSessionRoute,
    playerDowntimeRoute,
  ]),
])

// ============================================
// CREATE ROUTER
// ============================================

export const router = createRouter({ routeTree })

// Type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
