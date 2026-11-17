import { spawn } from 'child_process';

console.log('[PM2 Wrapper] Starting JAGAT Autonomous Swarm...');
const child = spawn('npm.cmd', ['run', 'swarm:start'], { 
    stdio: 'inherit', 
    shell: true 
});

child.on('close', (code) => { 
    console.log(`[PM2 Wrapper] Swarm process exited with code ${code}`);
    process.exit(code); 
});

child.on('error', (err) => {
    console.error(`[PM2 Wrapper] Failed to start swarm:`, err);
    process.exit(1);
});
