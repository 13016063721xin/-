import { defineConfig } from 'vite';

export default defineConfig({
  // 强制给浏览器注入 Node.js 才会有的全局变量
  define: {
    global: 'window',
    'process.env': {}
  },
  resolve: {
    alias: {
      // 如果报错提示缺其他模块，可以在这里继续补
    }
  }
});