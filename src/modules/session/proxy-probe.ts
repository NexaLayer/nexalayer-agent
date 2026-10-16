import net from 'node:net';

export type ProxyEndpoint = {
  host: string;
  port: number;
  protocol: string;
  username?: string | null;
  password?: string | null;
};

export function probeProxyEndpoint(proxy: ProxyEndpoint, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: proxy.host, port: proxy.port });
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(timeoutMs, () => fail(new Error('Proxy readiness probe timed out')));
    socket.once('error', fail);
    socket.once('connect', () => {
      if (proxy.protocol !== 'socks5') {
        socket.destroy();
        resolve();
        return;
      }
      const method = proxy.username || proxy.password ? 0x02 : 0x00;
      socket.write(Buffer.from([0x05, 0x01, method]));
      socket.once('data', (data) => {
        socket.destroy();
        if (data.length >= 2 && data[0] === 0x05 && data[1] !== 0xff) resolve();
        else reject(new Error('SOCKS5 readiness handshake failed'));
      });
    });
  });
}
