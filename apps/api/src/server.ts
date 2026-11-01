import { app } from './app.js';
const port = Number(process.env.PORT || 4000);
app.listen(port, '0.0.0.0', () => console.log(`GUTECH API listening on port ${port}`));
