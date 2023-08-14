const _ = require('lodash');
const { getAzureCredentials } = require('../utils/');
const { OpenAIClient } = require('./clients');

const titleConvo = async ({ text, response, openAIApiKey, azure = false }) => {
  let title = 'New Chat';

  try {
    const instructionsPayload = {
      role: 'system',
      content: `Detect user language and write in the same language an extremely concise title for this conversation, which you must accurately detect. Write in the detected language. Title in 5 Words or Less. No Punctuation or Quotation. All first letters of every word should be capitalized and complete only the title in User Language only.

    ||>User:
    "${text}"
    ||>Response:
    "${JSON.stringify(response?.text)}"
    
    ||>Title:`,
    };

    const options = {
      azure,
      reverseProxyUrl: process.env.OPENAI_REVERSE_PROXY || null,
      proxy: process.env.PROXY || null,
    };

    const titleGenClientOptions = JSON.parse(JSON.stringify(options));

    titleGenClientOptions.modelOptions = {
      model: 'gpt-3.5-turbo',
      temperature: 0,
      presence_penalty: 0,
      frequency_penalty: 0,
    };

    let apiKey = openAIApiKey ?? process.env.OPENAI_API_KEY;

    if (azure) {
      titleGenClientOptions.azure = getAzureCredentials();
      apiKey = titleGenClientOptions.azure.azureOpenAIApiKey;
    }

    const titleGenClient = new OpenAIClient(apiKey, titleGenClientOptions);
    const result = await titleGenClient.getCompletion([instructionsPayload], null);
    title = result.choices[0].message.content.replace(/\s+/g, ' ').replaceAll('"', '').trim();
  } catch (e) {
    console.error(e);
    console.log('There was an issue generating title, see error above');
  }

  console.log('CONVERSATION TITLE', title);
  return title;
};

const throttledTitleConvo = _.throttle(titleConvo, 1000);

module.exports = throttledTitleConvo;
