import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './SidePanel.vue'
import '../style.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
