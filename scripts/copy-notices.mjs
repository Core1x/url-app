import { copyFile } from 'node:fs/promises';
await copyFile('apps/runtime-web/public/THIRD_PARTY_NOTICES.txt', 'dist-cli/THIRD_PARTY_NOTICES.txt');
await copyFile('LICENSE', 'dist-cli/LICENSE');
