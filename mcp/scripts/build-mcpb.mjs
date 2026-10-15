import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'mcpb', 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const registryMetadata = JSON.parse(fs.readFileSync(path.join(root, 'server.json'), 'utf8'));

if (manifest.version !== packageJson.version) {
  throw new Error(`MCPB manifest ${manifest.version} does not match package ${packageJson.version}`);
}
if (registryMetadata.version !== packageJson.version || registryMetadata.packages?.[0]?.version !== packageJson.version) {
  throw new Error('Official Registry metadata does not match package version');
}

const build = path.join(root, '.mcpb-build');
const server = path.join(build, 'server');
const output = path.join(root, `nexalayer-${packageJson.version}.mcpb`);

fs.rmSync(build, { recursive: true, force: true });
fs.mkdirSync(server, { recursive: true });
fs.copyFileSync(path.join(root, 'mcpb', 'manifest.json'), path.join(build, 'manifest.json'));
fs.cpSync(path.join(root, 'dist'), path.join(server, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'package.json'), path.join(server, 'package.json'));
fs.copyFileSync(path.join(root, 'package-lock.json'), path.join(server, 'package-lock.json'));

const builtServer = fs.readFileSync(path.join(server, 'dist', 'index.js'), 'utf8');
if (!builtServer.includes(`version: '${packageJson.version}'`)) {
  throw new Error('Built MCP server does not report the package version');
}

execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: server, stdio: 'inherit' });
execFileSync('npx', ['--yes', '@anthropic-ai/mcpb@2.1.2', 'validate', path.join(build, 'manifest.json')], { stdio: 'inherit' });
execFileSync('npx', ['--yes', '@anthropic-ai/mcpb@2.1.2', 'pack', build, output], { stdio: 'inherit' });
console.log(output);
