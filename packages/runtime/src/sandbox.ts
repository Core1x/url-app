const POLICY = [
  "default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'",
  'img-src data: blob:', 'font-src data:', "connect-src 'none'", "object-src 'none'",
  "base-uri 'none'", "form-action 'none'", "frame-src 'none'", "worker-src 'none'",
].join('; ');

export function createSandbox(html: string, owner: Document = document): HTMLIFrameElement {
  const frame = owner.createElement('iframe');
  frame.title = 'URL App 应用';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  // Install CSP before the very first supplied token. Do not DOM-parse untrusted
  // content in the host: even an inert document can initiate resource loads.
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${POLICY}"><meta name="referrer" content="no-referrer"></head>${html}</html>`;
  return frame;
}
