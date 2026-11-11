const PLACEHOLDER_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'yourdomain.com',
  'yourcompany.com', 'perusahaan.com', 'domain.com', 'getanyname.com',
]);
const PLACEHOLDER_LOCALS = new Set([
  'nama', 'name', 'username', 'user', 'email', 'example', 'test',
  'yourname', 'your-email', 'your_email',
]);

export function isPlausibleOutreachEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const [local, domain, ...extra] = email.split('@');
  return extra.length === 0 && Boolean(local && domain) &&
    !PLACEHOLDER_DOMAINS.has(domain) && !PLACEHOLDER_LOCALS.has(local);
}
