module.exports = {
  apps: [
    {
      name: 'jagat-ui',
      script: 'c:/JAGAT/jagat-ui/node_modules/next/dist/bin/next',
      args: 'start -p 50012',
      cwd: 'c:/JAGAT/jagat-ui',
      interpreter: 'C:/Program Files/nodejs/node.exe',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
