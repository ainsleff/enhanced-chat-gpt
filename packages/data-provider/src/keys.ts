export enum QueryKeys {
  messages = 'messages',
  allConversations = 'allConversations',
  searchConversations = 'searchConversations',
  conversation = 'conversation',
  searchEnabled = 'searchEnabled',
  user = 'user',
  name = 'name', // user key name
  models = 'models',
  balance = 'balance',
  endpoints = 'endpoints',
  presets = 'presets',
  searchResults = 'searchResults',
  tokenCount = 'tokenCount',
  availablePlugins = 'availablePlugins',
  startupConfig = 'startupConfig',
  assistants = 'assistants',
  assistant = 'assistant',
  endpointsConfigOverride = 'endpointsConfigOverride',
  files = 'files',
}

export enum MutationKeys {
  fileUpload = 'fileUpload',
  fileDelete = 'fileDelete',
  updatePreset = 'updatePreset',
  deletePreset = 'deletePreset',
  logoutUser = 'logoutUser',
  avatarUpload = 'avatarUpload',
}
