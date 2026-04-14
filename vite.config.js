import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // 告诉打包员，咱们有两个入口文件需要打包
        main: 'index.html',
        login: 'login_demo.html'
      }
    }
  }
})