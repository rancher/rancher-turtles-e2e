import tls from 'tls';

interface CertInfo {
  fingerprint: string;
  valid_to: string;
  subject: tls.PeerCertificate['subject'];
  issuer: tls.PeerCertificate['issuer'];
}

const getCertInfo = (host: string): Promise<CertInfo> => {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(443, host, { servername: host, rejectUnauthorized: false }, () => {
        rejectUnauthorized: false
        const cert = socket.getPeerCertificate();
      if (!cert || !cert.fingerprint256) {
        reject(new Error('No certificate or fingerprint available'));
        socket.end();
        return;
      }

      resolve({
        fingerprint: cert.fingerprint256,
        valid_to: cert.valid_to,
        subject: cert.subject,
        issuer: cert.issuer,
      });

      socket.end();
    });

    socket.on('error', reject);
  });
};

export const registerTlsMonitor = (on: any): void => {
  on('task', {
    getCertInfo({ host }: { host: string }) {
      return getCertInfo(host);
    },
  });
};
