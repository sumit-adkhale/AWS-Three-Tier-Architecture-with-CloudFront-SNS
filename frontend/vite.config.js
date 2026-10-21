import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, forward /api calls to the Node backend on port 4000
export default defineConfig({
  plugins: [react()],
  server: {
    // proxy: { '/api': 'http://localhost:4000' } 
     proxy: {
    '/api': {
      target: 'http://shop-public-alb-5905135.ap-south-1.elb.amazonaws.com',
      changeOrigin: true,
    },
  },


    },
});
