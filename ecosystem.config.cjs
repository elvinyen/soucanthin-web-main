module.exports = {
  apps: [
    {
      name: 'soucanthin-web',
      script: 'server/index.mjs',
      cwd: '/var/www/soucanthin-web',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      max_memory_restart: '300M',
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
