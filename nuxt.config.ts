// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/image',],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      title: 'Iman Mohammadi — Portfolio',
      meta: [{ name: 'description', content: 'Iman Mohammadi is a creative front-end developer and UI designer with a passion for creating beautiful and functional web applications.', },],
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
