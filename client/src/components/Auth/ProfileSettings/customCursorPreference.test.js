import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_CURSOR_STORAGE_KEY,
  CUSTOM_CURSOR_THEME_CLASS,
  getStoredCustomCursorPreference,
  syncCustomCursorPreference,
} from './customCursorPreference.js'

const createStorage = (initialValue = null) => {
  const values = new Map()

  if (initialValue !== null) {
    values.set(CUSTOM_CURSOR_STORAGE_KEY, initialValue)
  }

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

const createClassList = () => {
  const classes = new Set()

  return {
    add: (className) => classes.add(className),
    remove: (className) => classes.delete(className),
    contains: (className) => classes.has(className),
  }
}

test('getStoredCustomCursorPreference defaults to disabled', () => {
  assert.equal(getStoredCustomCursorPreference(createStorage()), false)
})

test('getStoredCustomCursorPreference restores a saved enabled preference', () => {
  assert.equal(getStoredCustomCursorPreference(createStorage('true')), true)
})

test('syncCustomCursorPreference enables themed cursors and persists the choice', () => {
  const storage = createStorage()
  const classList = createClassList()

  syncCustomCursorPreference(true, { storage, classList })

  assert.equal(storage.getItem(CUSTOM_CURSOR_STORAGE_KEY), 'true')
  assert.equal(classList.contains(CUSTOM_CURSOR_THEME_CLASS), true)
})

test('syncCustomCursorPreference disables themed cursors and persists the choice', () => {
  const storage = createStorage('true')
  const classList = createClassList()
  classList.add(CUSTOM_CURSOR_THEME_CLASS)

  syncCustomCursorPreference(false, { storage, classList })

  assert.equal(storage.getItem(CUSTOM_CURSOR_STORAGE_KEY), 'false')
  assert.equal(classList.contains(CUSTOM_CURSOR_THEME_CLASS), false)
})
