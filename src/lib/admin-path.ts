const DEFAULT_ADMIN_BASE_PATH = '/admin'

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}

function trimTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/+$/, '') : value
}

export function normalizeAdminBasePath(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return DEFAULT_ADMIN_BASE_PATH
  }

  const normalized = trimTrailingSlash(ensureLeadingSlash(trimmed))
  return normalized === '/' ? DEFAULT_ADMIN_BASE_PATH : normalized
}

export function getAdminBasePath(): string {
  return normalizeAdminBasePath(
    process.env.ADMIN_PATH_PREFIX ?? process.env.NEXT_PUBLIC_ADMIN_PATH_PREFIX,
  )
}

function normalizeSuffix(suffix?: string): string {
  if (!suffix || suffix === '/') {
    return ''
  }

  return ensureLeadingSlash(suffix)
}

export function getAdminPagePath(suffix?: string): string {
  return `${getAdminBasePath()}${normalizeSuffix(suffix)}`
}

export function getAdminApiPath(suffix?: string): string {
  const normalizedSuffix = normalizeSuffix(suffix)
  return `${getAdminBasePath()}/api${normalizedSuffix}`
}

export function toInternalAdminPagePath(externalPathname: string): string | null {
  const basePath = getAdminBasePath()
  if (externalPathname !== basePath && !externalPathname.startsWith(`${basePath}/`)) {
    return null
  }

  const suffix = externalPathname.slice(basePath.length)
  return suffix ? `/admin${suffix}` : '/admin'
}

export function toInternalAdminApiPath(externalPathname: string): string | null {
  const apiBasePath = `${getAdminBasePath()}/api`
  if (externalPathname !== apiBasePath && !externalPathname.startsWith(`${apiBasePath}/`)) {
    return null
  }

  const suffix = externalPathname.slice(apiBasePath.length)
  return suffix ? `/api/admin${suffix}` : '/api/admin'
}

export function isPublicAdminAliasPath(pathname: string): boolean {
  const basePath = getAdminBasePath()
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

export function isHiddenInternalAdminPath(pathname: string): boolean {
  const basePath = getAdminBasePath()
  if (basePath === DEFAULT_ADMIN_BASE_PATH) {
    return false
  }

  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/')
  )
}

export function isSafeAdminRedirectPath(pathname: string): boolean {
  const basePath = getAdminBasePath()
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}
