// Simple client-side admin auth (no backend).
// Stores admins and session in localStorage/sessionStorage.
// Passwords are hashed using SHA-256.

export type AdminUser = {
  username: string;
  passwordHash: string;
};

type AdminConfig = {
  // bidang yang bisa dipilih anggota
  bidangOptions: string[];
  // mapping bidang -> penyelenggara/instansi (opsional)
  bidangToPenyelenggara?: Record<string, string>;
};

const ADMINS_KEY = 'spj_admins_v1';
const SESSION_KEY = 'spj_admin_session_v1';
const ADMIN_CONFIG_KEY = 'spj_admin_config_v1';

// Default admin per request
const DEFAULT_ADMIN: AdminUser = {
  username: 'admin',
  passwordHash: '',
};

const DEFAULT_CONFIG: AdminConfig = {
  bidangOptions: ['Bidang 1', 'Bidang 2'],
  bidangToPenyelenggara: {},
};

// helper field terhubung ke UI
export function getBidangOptions(): string[] {
  return getAdminConfig().bidangOptions;
}

export function getPenyelenggaraByBidang(bidang: string): string {
  const cfg = getAdminConfig();
  if (cfg.bidangToPenyelenggara && cfg.bidangToPenyelenggara[bidang]) {
    return cfg.bidangToPenyelenggara[bidang];
  }
  return '';
}



async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeUsername(u: string) {
  return (u || '').trim().toLowerCase();
}

export async function ensureDefaultAdminSet(): Promise<void> {
  const rawAdmins = localStorage.getItem(ADMINS_KEY);
  if (!rawAdmins) {
    const defaultPassword = 'admin123';
    const passwordHash = await sha256Hex(defaultPassword);
    const admins: AdminUser[] = [{ username: DEFAULT_ADMIN.username, passwordHash }];
    localStorage.setItem(ADMINS_KEY, JSON.stringify(admins));
  }

  const rawConfig = localStorage.getItem(ADMIN_CONFIG_KEY);
  if (!rawConfig) {
    localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
  }
}

export function getAdminConfig(): AdminConfig {
  const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
  if (!raw) return DEFAULT_CONFIG;
  try {
    return JSON.parse(raw) as AdminConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function updateAdminConfig(next: AdminConfig): Promise<void> {
  localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(next));
}


export function getAdmins(): AdminUser[] {
  const raw = localStorage.getItem(ADMINS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AdminUser[];
  } catch {
    return [];
  }
}

export function getSessionUsername(): string | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { username?: string };
    if (!parsed.username) return null;
    return parsed.username;
  } catch {
    return null;
  }
}

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  const admins = getAdmins();
  const u = normalizeUsername(username);
  const pHash = await sha256Hex(password);

  const found = admins.find((a) => normalizeUsername(a.username) === u);
  if (!found) return false;
  if (found.passwordHash !== pHash) return false;

  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: found.username }));
  return true;
}

export function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function addAdmin(newUsername: string, newPassword: string): Promise<{ ok: boolean; reason?: string }> {
  const u = normalizeUsername(newUsername);
  if (!u) return { ok: false, reason: 'Username wajib diisi.' };
  if (!newPassword || newPassword.length < 6) return { ok: false, reason: 'Password minimal 6 karakter.' };

  const admins = getAdmins();
  const exists = admins.some((a) => normalizeUsername(a.username) === u);
  if (exists) return { ok: false, reason: 'Username admin sudah ada.' };

  const passwordHash = await sha256Hex(newPassword);
  admins.push({ username: u, passwordHash });
  localStorage.setItem(ADMINS_KEY, JSON.stringify(admins));
  return { ok: true };
}

