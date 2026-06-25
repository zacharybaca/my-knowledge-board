export const CUSTOM_CURSOR_STORAGE_KEY = 'customCursor'
export const CUSTOM_CURSOR_THEME_CLASS = 'theme-custom-cursor'

export const getStoredCustomCursorPreference = (storage = localStorage) =>
  storage.getItem(CUSTOM_CURSOR_STORAGE_KEY) === 'true'

export const syncCustomCursorPreference = (
  isEnabled,
  { storage = localStorage, classList = document.body.classList } = {},
) => {
  if (isEnabled) {
    classList.add(CUSTOM_CURSOR_THEME_CLASS)
    storage.setItem(CUSTOM_CURSOR_STORAGE_KEY, 'true')
    return
  }

  classList.remove(CUSTOM_CURSOR_THEME_CLASS)
  storage.setItem(CUSTOM_CURSOR_STORAGE_KEY, 'false')
}
