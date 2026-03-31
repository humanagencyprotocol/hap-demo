/**
 * GHCR update checker — compares running build against latest on GHCR.
 *
 * Checks on startup (30s delay) then once per day.
 *
 * If HAP_BUILD_SHA is 'dev' or not found on GHCR → update available.
 * If running digest differs from latest → update available.
 */

const IMAGE = 'humanagencyprotocol/hap-gateway';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const INITIAL_DELAY = 30_000; // 30 seconds after boot

let updateAvailable = false;
const buildSha = process.env.HAP_BUILD_SHA ?? 'dev';

export function getUpdateStatus() {
  return { updateAvailable, runningSha: buildSha };
}

async function getToken(): Promise<string> {
  const res = await fetch(
    `https://ghcr.io/token?scope=repository:${IMAGE}:pull`
  );
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function getDigest(tag: string, token: string): Promise<string | null> {
  const res = await fetch(
    `https://ghcr.io/v2/${IMAGE}/manifests/${tag}`,
    {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.oci.image.index.v1+json',
      },
    }
  );
  if (!res.ok) return null;
  return res.headers.get('docker-content-digest');
}

async function check(): Promise<void> {
  try {
    const token = await getToken();
    const latestDigest = await getDigest('latest', token);
    if (!latestDigest) return;

    if (buildSha === 'dev') {
      updateAvailable = true;
      return;
    }

    const runningDigest = await getDigest(buildSha.slice(0, 7), token);

    if (!runningDigest || runningDigest !== latestDigest) {
      updateAvailable = true;
    } else {
      updateAvailable = false;
    }
  } catch {
    // GHCR unreachable — skip
  }
}

export function startUpdateChecker(): void {
  setTimeout(() => {
    check().catch(() => {});
    setInterval(() => check().catch(() => {}), CHECK_INTERVAL);
  }, INITIAL_DELAY);
}
