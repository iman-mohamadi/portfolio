import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'
import { initAnalytics } from '../world/analytics.js'

initAnalytics()
createApp(App).mount('#app')
