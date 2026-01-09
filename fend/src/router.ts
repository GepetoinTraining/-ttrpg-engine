import { createRouter, createWebHistory } from 'vue-router'

// Auth guard - checks for certificate in localStorage
function requiresAuth() {
  const cert = localStorage.getItem('topology-cert')
  return !!cert
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/Home.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
    },
    {
      path: '/enroll',
      name: 'enroll',
      component: () => import('@/views/Enroll.vue'),
    },
    {
      path: '/campaigns',
      name: 'campaigns',
      component: () => import('@/views/Campaigns.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/campaign/:id',
      name: 'campaign',
      component: () => import('@/views/Campaign.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'campaign-overview',
          component: () => import('@/views/campaign/Overview.vue'),
        },
        {
          path: 'characters',
          name: 'campaign-characters',
          component: () => import('@/views/campaign/Characters.vue'),
        },
        {
          path: 'characters/new',
          name: 'campaign-characters-new',
          component: () => import('@/views/campaign/CharacterNew.vue'),
        },
        {
          path: 'world',
          name: 'campaign-world',
          component: () => import('@/views/campaign/World.vue'),
        },
        {
          path: 'session',
          name: 'campaign-session',
          component: () => import('@/views/campaign/Session.vue'),
        },
      ],
    },
  ],
})

// Navigation guard for protected routes
router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth && !requiresAuth()) {
    next({ name: 'login' })
  } else {
    next()
  }
})

export { router }
