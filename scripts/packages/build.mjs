import esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const banner = readFileSync(resolve(root, 'src/userscript.meta.js'), 'utf8').trim() + '\n';

export async function buildUserscript() {
    const result = await esbuild.build({
        absWorkingDir: root,
        entryPoints: ['src/main.js'],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        charset: 'utf8',
        legalComments: 'none',
        minify: false,
        banner: { js: banner },
        outfile: 'dist/pt-bluray-assistant.user.js',
        logLevel: 'info'
    });
    return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    buildUserscript().catch(function (err) {
        console.error(err);
        process.exit(1);
    });
}
