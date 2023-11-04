const { PluginsClient } = require('../../../../app');
const { isEnabled } = require('../../../utils');
const { getAzureCredentials, sanitizeModelName } = require('../../../../utils');
const { getUserKey, checkUserKeyExpiry } = require('../../../services/UserService');

const initializeClient = async ({ req, res, endpointOption }) => {
  const {
    PROXY,
    OPENAI_API_KEY,
    AZURE_API_KEY,
    PLUGINS_USE_AZURE,
    OPENAI_REVERSE_PROXY,
    OPENAI_SUMMARIZE,
    DEBUG_PLUGINS,
  } = process.env;
  const { key: expiresAt } = req.body;
  const contextStrategy = isEnabled(OPENAI_SUMMARIZE) ? 'summarize' : null;
  const clientOptions = {
    contextStrategy,
    debug: isEnabled(DEBUG_PLUGINS),
    reverseProxyUrl: OPENAI_REVERSE_PROXY ?? null,
    proxy: PROXY ?? null,
    req,
    res,
    ...endpointOption,
  };

  const isUserProvided = PLUGINS_USE_AZURE
    ? AZURE_API_KEY === 'user_provided'
    : OPENAI_API_KEY === 'user_provided';

  let userKey = null;
  if (expiresAt && isUserProvided) {
    checkUserKeyExpiry(
      expiresAt,
      'Your OpenAI API key has expired. Please provide your API key again.',
    );
    userKey = await getUserKey({
      userId: req.user.id,
      name: PLUGINS_USE_AZURE ? 'azureOpenAI' : 'openAI',
    });
  }

  let apiKey = isUserProvided ? userKey : OPENAI_API_KEY;

  if (PLUGINS_USE_AZURE || (apiKey && apiKey.includes('azure') && !clientOptions.azure)) {
    clientOptions.azure = isUserProvided ? JSON.parse(userKey) : getAzureCredentials();
    clientOptions.azure.azureOpenAIApiDeploymentName = sanitizeModelName(
      clientOptions.modelOptions.model,
    );
    apiKey = clientOptions.azure.azureOpenAIApiKey;
  }

  const client = new PluginsClient(apiKey, clientOptions);
  return {
    client,
    azure: clientOptions.azure,
    openAIApiKey: apiKey,
  };
};

module.exports = initializeClient;
