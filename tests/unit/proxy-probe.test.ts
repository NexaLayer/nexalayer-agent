import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { probeProxyEndpoint } from '../../src/modules/session/proxy-probe';

const servers: net.Server[] = [];
afterEach(() => servers.splice(0).forEach((server) => server.close()));

describe('proxy readiness probe', () => {
  it('accepts a TCP endpoint', async () => {
    const server = net.createServer(); servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as net.AddressInfo;
    await expect(probeProxyEndpoint({ host: '127.0.0.1', port: address.port, protocol: 'http' }, 500)).resolves.toBeUndefined();
  });

  it('requires a valid SOCKS5 greeting', async () => {
    const server = net.createServer((socket) => socket.once('data', () => socket.write(Buffer.from([0x05, 0x02]))));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as net.AddressInfo;
    await expect(probeProxyEndpoint({ host: '127.0.0.1', port: address.port, protocol: 'socks5', username: 'u', password: 'p' }, 500)).resolves.toBeUndefined();
  });
});
