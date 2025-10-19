import { createApp } from './src/app.js';
import config from './config.js';

const app = createApp();

app.listen(config.server.port, () => {
    console.log(`Server is running on port ${config.server.port}`);
});
