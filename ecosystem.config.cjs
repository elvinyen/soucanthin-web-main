module.exports = {
  apps: [
    {
      name: 'soucanthin-api',
      script: 'node_modules/.bin/tsx',
      args: 'server/index.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3001',
        ENV_FILE: '.env.production',
      },
    },
  ],
};
