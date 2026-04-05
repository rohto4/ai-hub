import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAdminApiPath,
  getAdminPagePath,
  normalizeAdminBasePath,
} from '@/lib/admin-path'

test('normalizeAdminBasePath falls back to /admin when env is empty', () => {
  assert.equal(normalizeAdminBasePath(''), '/admin')
  assert.equal(normalizeAdminBasePath(null), '/admin')
})

test('normalizeAdminBasePath normalizes slashes', () => {
  assert.equal(normalizeAdminBasePath('internal-secret/'), '/internal-secret')
  assert.equal(normalizeAdminBasePath('/internal-secret/'), '/internal-secret')
})

test('admin path helpers append suffixes predictably', () => {
  const previous = process.env.NEXT_PUBLIC_ADMIN_PATH_PREFIX
  process.env.NEXT_PUBLIC_ADMIN_PATH_PREFIX = '/internal-secret'

  try {
    assert.equal(getAdminPagePath(), '/internal-secret')
    assert.equal(getAdminPagePath('/login'), '/internal-secret/login')
    assert.equal(getAdminApiPath('/jobs'), '/internal-secret/api/jobs')
  } finally {
    process.env.NEXT_PUBLIC_ADMIN_PATH_PREFIX = previous
  }
})
