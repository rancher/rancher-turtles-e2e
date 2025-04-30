import tls from 'tls';

interface CertInfo {
  fingerprint: string;
  valid_to: string;
}

const monitors: Record<string, NodeJS.Timeout> = {};

const getCertInfo = (host: string): Promise<CertInfo> => {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      443,
      host,
      { servername: host, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.fingerprint256) {
          reject(new Error('No certificate or fingerprint available'));
          socket.end();
          return;
        }

        resolve({
          fingerprint: cert.fingerprint256,
          valid_to: cert.valid_to,
        });

        socket.end();
      }
    );

    socket.on('error', (err) => {
      reject(new Error(`TLS connection error: ${err.message}`));
    });
  });
};

export const registerTlsMonitor = (on: any): void => {
  on('task', {
    startCertMonitor({ host, intervalMs }: { host: string; intervalMs: number }) {
      if (monitors[host]) {
        throw new Error(`[TLS MONITOR] Monitor already running for host: ${host}`);
      }

      let lastFingerprint: string | null = null;

      monitors[host] = setInterval(async () => {
        try {
          const certInfo = await getCertInfo(host);
          if (lastFingerprint && certInfo.fingerprint !== lastFingerprint) {
            console.log(`[TLS MONITOR] TLS cert ${certInfo.fingerprint} changed for ${host}.`);
            lastFingerprint = certInfo.fingerprint;
          } else {
            lastFingerprint = certInfo.fingerprint;
            console.log(`[TLS MONITOR] TLS cert ${lastFingerprint} is valid for ${host}.`);
          }
        } catch (err) {
          console.error(`[TLS MONITOR] Error monitoring ${host}:`, err.message);
        }
      }, intervalMs);

      console.log(`[TLS MONITOR] Started for ${host} with interval ${intervalMs}ms.`);
      return null;
    },

    stopCertMonitor({ host }: { host: string }) {
      if (monitors[host]) {
        clearInterval(monitors[host]);
        delete monitors[host];
        console.log(`[TLS MONITOR] Stopped for ${host}.`);
      } else {
        console.log(`[TLS MONITOR] No monitor running for ${host}.`);
      }
      return null;
    },
  });
};