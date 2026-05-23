export const IPC_CHANNELS = {
  APP: {
    OPEN_WINDOW: 'app:open-window',
    QUIT: 'app:quit',
    GET_VERSION: 'app:get-version',
    GET_PLATFORM: 'app:get-platform',
    GET_MESSAGE_COUNT: 'app:get-message-count',
    GET_RECENT_MESSAGES: 'app:get-recent-messages',
    GET_SYNC_STATUS: 'app:get-sync-status',
    OPEN_USERDATA_FOLDER: 'app:open-userdata-folder',
    ON_MESSAGES_BATCH: 'app:on-messages-batch',
    ON_SYNC_STATE_CHANGED: 'app:on-sync-state-changed',
    ON_ERROR: 'app:on-error',
  },
  SETTINGS: {
    GET: 'settings:get',
    SET: 'settings:set',
    DB_STATS: 'db:stats',
  },
  SEARCH: {
    QUERY: 'search:query',
    ON_MODEL_PROGRESS: 'search:on-model-progress',
  },
  EXPORT: {
    IMPORT: 'export:import',
    ON_PROGRESS: 'export:on-progress',
  },
  WA: {
    GET_CONNECTION_STATE: 'wa:get-connection-state',
    GET_CURRENT_QR: 'wa:get-current-qr',
    REQUEST_QR: 'wa:request-qr',
    LOGOUT: 'wa:logout',
    ON_CONNECTION_STATE: 'wa:on-connection-state',
    ON_QR: 'wa:on-qr',
    ON_LOGGED_OUT: 'wa:on-logged-out',
  },
  AI: {
    GET_CONFIG: 'ai:get-config',
    SET_CONFIG: 'ai:set-config',
    SEND: 'ai:send',
  }
} as const
