// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/image',],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      title: 'Your Name — Portfolio',
      meta: [{ name: 'description', content: 'Creative front-end portfolio — bordered minimalism design', },],
    },
  },

  css: ['~/assets/css/main.css',],

  build: {
    transpile: ['three', 'gsap', 'animejs',],
  },

  routeRules: {
    '/': { prerender: true, },
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'always', braceStyle: '1tbs',
      },
    },
  },
},)
