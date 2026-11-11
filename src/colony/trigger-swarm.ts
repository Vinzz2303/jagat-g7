import { runSwarmCycle } from './revenue-swarm.js';

console.log("🔥 TRIGGERING SWARM FROM TELEGRAM COMMAND 🔥");
runSwarmCycle().then(() => {
    console.log("Swarm triggered successfully.");
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
