const { Constants, ForkOptions } = require('librechat-data-provider');

jest.mock('~/models/Conversation', () => ({
  getConvo: jest.fn(),
  bulkSaveConvos: jest.fn(),
}));

jest.mock('~/models/Message', () => ({
  getMessages: jest.fn(),
  bulkSaveMessages: jest.fn(),
}));

let mockIdCounter = 0;
jest.mock('uuid', () => {
  return {
    v4: jest.fn(() => {
      mockIdCounter++;
      return mockIdCounter.toString();
    }),
  };
});

const {
  forkConversation,
  splitAtTargetLevel,
  getAllMessagesUpToParent,
  getMessagesUpToTargetLevel,
} = require('./fork');
const { getConvo, bulkSaveConvos } = require('~/models/Conversation');
const { getMessages, bulkSaveMessages } = require('~/models/Message');
const BaseClient = require('~/app/clients/BaseClient');

/**
 *
 * @param {TMessage[]} messages - The list of messages to visualize.
 * @param {string | null} parentId - The parent message ID.
 * @param {string} prefix - The prefix to use for each line.
 * @returns
 */
function printMessageTree(messages, parentId = Constants.NO_PARENT, prefix = '') {
  let treeVisual = '';

  const childMessages = messages.filter((msg) => msg.parentMessageId === parentId);
  for (let index = 0; index < childMessages.length; index++) {
    const msg = childMessages[index];
    const isLast = index === childMessages.length - 1;
    const connector = isLast ? '└── ' : '├── ';

    treeVisual += `${prefix}${connector}[${msg.messageId}]: ${
      msg.parentMessageId !== Constants.NO_PARENT ? `Child of ${msg.parentMessageId}` : 'Root'
    }\n`;
    treeVisual += printMessageTree(messages, msg.messageId, prefix + (isLast ? '    ' : '|   '));
  }

  return treeVisual;
}

const mockMessages = [
  {
    messageId: '0',
    parentMessageId: Constants.NO_PARENT,
    text: 'Root message 1',
    createdAt: '2021-01-01',
  },
  {
    messageId: '1',
    parentMessageId: Constants.NO_PARENT,
    text: 'Root message 2',
    createdAt: '2021-01-01',
  },
  { messageId: '2', parentMessageId: '1', text: 'Child of 1', createdAt: '2021-01-02' },
  { messageId: '3', parentMessageId: '1', text: 'Child of 1', createdAt: '2021-01-03' },
  { messageId: '4', parentMessageId: '2', text: 'Child of 2', createdAt: '2021-01-04' },
  { messageId: '5', parentMessageId: '2', text: 'Child of 2', createdAt: '2021-01-05' },
  { messageId: '6', parentMessageId: '3', text: 'Child of 3', createdAt: '2021-01-06' },
  { messageId: '7', parentMessageId: '3', text: 'Child of 3', createdAt: '2021-01-07' },
  { messageId: '8', parentMessageId: '7', text: 'Child of 7', createdAt: '2021-01-07' },
];

const mockConversation = { convoId: 'abc123', title: 'Original Title' };

describe('forkConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIdCounter = 0;
    getConvo.mockResolvedValue(mockConversation);
    getMessages.mockResolvedValue(mockMessages);
    bulkSaveConvos.mockResolvedValue(null);
    bulkSaveMessages.mockResolvedValue(null);
  });

  test('should fork conversation without branches', async () => {
    const result = await forkConversation({
      originalConvoId: 'abc123',
      targetMessageId: '3',
      requestUserId: 'user1',
      option: ForkOptions.DIRECT_PATH,
    });
    console.debug('forkConversation: direct path\n', printMessageTree(result.messages));

    // Reversed order due to setup in function
    const expectedMessagesTexts = ['Child of 1', 'Root message 2'];
    expect(getMessages).toHaveBeenCalled();
    expect(bulkSaveMessages).toHaveBeenCalledWith(
      expect.arrayContaining(
        expectedMessagesTexts.map((text) => expect.objectContaining({ text })),
      ),
    );
  });

  test('should fork conversation without branches (deeper)', async () => {
    const result = await forkConversation({
      originalConvoId: 'abc123',
      targetMessageId: '8',
      requestUserId: 'user1',
      option: ForkOptions.DIRECT_PATH,
    });
    console.debug('forkConversation: direct path (deeper)\n', printMessageTree(result.messages));

    const expectedMessagesTexts = ['Child of 7', 'Child of 3', 'Child of 1', 'Root message 2'];
    expect(getMessages).toHaveBeenCalled();
    expect(bulkSaveMessages).toHaveBeenCalledWith(
      expect.arrayContaining(
        expectedMessagesTexts.map((text) => expect.objectContaining({ text })),
      ),
    );
  });

  test('should fork conversation with branches', async () => {
    const result = await forkConversation({
      originalConvoId: 'abc123',
      targetMessageId: '3',
      requestUserId: 'user1',
      option: ForkOptions.INCLUDE_BRANCHES,
    });

    console.debug('forkConversation: include branches\n', printMessageTree(result.messages));

    const expectedMessagesTexts = ['Root message 2', 'Child of 1', 'Child of 1'];
    expect(getMessages).toHaveBeenCalled();
    expect(bulkSaveMessages).toHaveBeenCalledWith(
      expect.arrayContaining(
        expectedMessagesTexts.map((text) => expect.objectContaining({ text })),
      ),
    );
  });

  test('should fork conversation up to target level', async () => {
    const result = await forkConversation({
      originalConvoId: 'abc123',
      targetMessageId: '3',
      requestUserId: 'user1',
      option: ForkOptions.TARGET_LEVEL,
    });

    console.debug('forkConversation: target level\n', printMessageTree(result.messages));

    const expectedMessagesTexts = ['Root message 1', 'Root message 2', 'Child of 1', 'Child of 1'];
    expect(getMessages).toHaveBeenCalled();
    expect(bulkSaveMessages).toHaveBeenCalledWith(
      expect.arrayContaining(
        expectedMessagesTexts.map((text) => expect.objectContaining({ text })),
      ),
    );
  });

  test('should handle errors during message fetching', async () => {
    getMessages.mockRejectedValue(new Error('Failed to fetch messages'));

    await expect(
      forkConversation({
        originalConvoId: 'abc123',
        targetMessageId: '3',
        requestUserId: 'user1',
      }),
    ).rejects.toThrow('Failed to fetch messages');
  });
});

const mockMessagesComplex = [
  { messageId: '7', parentMessageId: Constants.NO_PARENT, text: 'Message 7' },
  { messageId: '8', parentMessageId: Constants.NO_PARENT, text: 'Message 8' },
  { messageId: '5', parentMessageId: '7', text: 'Message 5' },
  { messageId: '6', parentMessageId: '7', text: 'Message 6' },
  { messageId: '9', parentMessageId: '8', text: 'Message 9' },
  { messageId: '2', parentMessageId: '5', text: 'Message 2' },
  { messageId: '3', parentMessageId: '5', text: 'Message 3' },
  { messageId: '1', parentMessageId: '6', text: 'Message 1' },
  { messageId: '4', parentMessageId: '6', text: 'Message 4' },
  { messageId: '10', parentMessageId: '3', text: 'Message 10' },
];

describe('getMessagesUpToTargetLevel', () => {
  test('should get all messages up to target level', async () => {
    const result = getMessagesUpToTargetLevel(mockMessagesComplex, '5');
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      '[getMessagesUpToTargetLevel] should get all messages up to target level\n',
      mappedResult,
    );
    console.debug('mockMessages\n', printMessageTree(mockMessagesComplex));
    console.debug('result\n', printMessageTree(result));
    expect(mappedResult).toEqual(['7', '8', '5', '6', '9']);
  });

  test('should get all messages if target is deepest level', async () => {
    const result = getMessagesUpToTargetLevel(mockMessagesComplex, '10');
    expect(result.length).toEqual(mockMessagesComplex.length);
  });

  test('should return target if only message', async () => {
    const result = getMessagesUpToTargetLevel(
      [mockMessagesComplex[mockMessagesComplex.length - 1]],
      '10',
    );
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      '[getMessagesUpToTargetLevel] should return target if only message\n',
      mappedResult,
    );
    console.debug('mockMessages\n', printMessageTree(mockMessages));
    console.debug('result\n', printMessageTree(result));
    expect(mappedResult).toEqual(['10']);
  });

  test('should return empty array if target message ID does not exist', async () => {
    const result = getMessagesUpToTargetLevel(mockMessagesComplex, '123');
    expect(result).toEqual([]);
  });

  test('should return correct messages when target is a root message', async () => {
    const result = getMessagesUpToTargetLevel(mockMessagesComplex, '7');
    const mappedResult = result.map((msg) => msg.messageId);
    expect(mappedResult).toEqual(['7', '8']);
  });

  test('should correctly handle single message with non-matching ID', async () => {
    const singleMessage = [
      { messageId: '30', parentMessageId: Constants.NO_PARENT, text: 'Message 30' },
    ];
    const result = getMessagesUpToTargetLevel(singleMessage, '31');
    expect(result).toEqual([]);
  });

  test('should correctly handle case with circular dependencies', async () => {
    const circularMessages = [
      { messageId: '40', parentMessageId: '42', text: 'Message 40' },
      { messageId: '41', parentMessageId: '40', text: 'Message 41' },
      { messageId: '42', parentMessageId: '41', text: 'Message 42' },
    ];
    const result = getMessagesUpToTargetLevel(circularMessages, '40');
    const mappedResult = result.map((msg) => msg.messageId);
    expect(new Set(mappedResult)).toEqual(new Set(['40', '41', '42']));
  });

  test('should return all messages when all are interconnected and target is deep in hierarchy', async () => {
    const interconnectedMessages = [
      { messageId: '50', parentMessageId: Constants.NO_PARENT, text: 'Root Message' },
      { messageId: '51', parentMessageId: '50', text: 'Child Level 1' },
      { messageId: '52', parentMessageId: '51', text: 'Child Level 2' },
      { messageId: '53', parentMessageId: '52', text: 'Child Level 3' },
    ];
    const result = getMessagesUpToTargetLevel(interconnectedMessages, '53');
    const mappedResult = result.map((msg) => msg.messageId);
    expect(mappedResult).toEqual(['50', '51', '52', '53']);
  });
});

describe('getAllMessagesUpToParent', () => {
  const mockMessages = [
    { messageId: '11', parentMessageId: Constants.NO_PARENT, text: 'Message 11' },
    { messageId: '12', parentMessageId: Constants.NO_PARENT, text: 'Message 12' },
    { messageId: '13', parentMessageId: '11', text: 'Message 13' },
    { messageId: '14', parentMessageId: '12', text: 'Message 14' },
    { messageId: '15', parentMessageId: '13', text: 'Message 15' },
    { messageId: '16', parentMessageId: '13', text: 'Message 16' },
    { messageId: '21', parentMessageId: '13', text: 'Message 21' },
    { messageId: '17', parentMessageId: '14', text: 'Message 17' },
    { messageId: '18', parentMessageId: '16', text: 'Message 18' },
    { messageId: '19', parentMessageId: '18', text: 'Message 19' },
    { messageId: '20', parentMessageId: '19', text: 'Message 20' },
  ];

  test('should handle empty message list', async () => {
    const result = getAllMessagesUpToParent([], '10');
    expect(result).toEqual([]);
  });

  test('should handle target message not found', async () => {
    const result = getAllMessagesUpToParent(mockMessages, 'invalid-id');
    expect(result).toEqual([]);
  });

  test('should handle single level tree (no parents)', async () => {
    const result = getAllMessagesUpToParent(
      [
        { messageId: '11', parentMessageId: Constants.NO_PARENT, text: 'Message 11' },
        { messageId: '12', parentMessageId: Constants.NO_PARENT, text: 'Message 12' },
      ],
      '11',
    );
    const mappedResult = result.map((msg) => msg.messageId);
    expect(mappedResult).toEqual(['11']);
  });

  test('should correctly retrieve messages in a deeply nested structure', async () => {
    const result = getAllMessagesUpToParent(mockMessages, '20');
    const mappedResult = result.map((msg) => msg.messageId);
    expect(mappedResult).toContain('11');
    expect(mappedResult).toContain('13');
    expect(mappedResult).toContain('16');
    expect(mappedResult).toContain('18');
    expect(mappedResult).toContain('19');
    expect(mappedResult).toContain('20');
  });

  test('should return only the target message if it has no parent', async () => {
    const result = getAllMessagesUpToParent(mockMessages, '11');
    const mappedResult = result.map((msg) => msg.messageId);
    expect(mappedResult).toEqual(['11']);
  });

  test('should handle messages without a parent ID defined', async () => {
    const additionalMessages = [
      ...mockMessages,
      { messageId: '22', text: 'Message 22' }, // No parentMessageId field
    ];
    const result = getAllMessagesUpToParent(additionalMessages, '22');
    const mappedResult = result.map((msg) => msg.messageId);
    expect(mappedResult).toEqual(['22']);
  });

  test('should retrieve all messages from the target to the root (including indirect ancestors)', async () => {
    const result = getAllMessagesUpToParent(mockMessages, '18');
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      '[getAllMessagesUpToParent] should retrieve all messages from the target to the root\n',
      mappedResult,
    );
    console.debug('mockMessages\n', printMessageTree(mockMessages));
    console.debug('result\n', printMessageTree(result));
    expect(mappedResult).toEqual(['11', '13', '15', '16', '21', '18']);
  });

  test('should handle circular dependencies gracefully', () => {
    const mockMessages = [
      { messageId: '1', parentMessageId: '2' },
      { messageId: '2', parentMessageId: '3' },
      { messageId: '3', parentMessageId: '1' },
    ];

    const targetMessageId = '1';
    const result = getAllMessagesUpToParent(mockMessages, targetMessageId);

    const uniqueIds = new Set(result.map((msg) => msg.messageId));
    expect(uniqueIds.size).toBe(result.length);
    expect(result.map((msg) => msg.messageId).sort()).toEqual(['1', '2', '3'].sort());
  });

  test('should return target if only message', async () => {
    const result = getAllMessagesUpToParent([mockMessages[mockMessages.length - 1]], '20');
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      '[getAllMessagesUpToParent] should return target if only message\n',
      mappedResult,
    );
    console.debug('mockMessages\n', printMessageTree(mockMessages));
    console.debug('result\n', printMessageTree(result));
    expect(mappedResult).toEqual(['20']);
  });
});

describe('getMessagesForConversation', () => {
  const mockMessages = [
    { messageId: '11', parentMessageId: Constants.NO_PARENT, text: 'Message 11' },
    { messageId: '12', parentMessageId: Constants.NO_PARENT, text: 'Message 12' },
    { messageId: '13', parentMessageId: '11', text: 'Message 13' },
    { messageId: '14', parentMessageId: '12', text: 'Message 14' },
    { messageId: '15', parentMessageId: '13', text: 'Message 15' },
    { messageId: '16', parentMessageId: '13', text: 'Message 16' },
    { messageId: '21', parentMessageId: '13', text: 'Message 21' },
    { messageId: '17', parentMessageId: '14', text: 'Message 17' },
    { messageId: '18', parentMessageId: '16', text: 'Message 18' },
    { messageId: '19', parentMessageId: '18', text: 'Message 19' },
    { messageId: '20', parentMessageId: '19', text: 'Message 20' },
  ];

  test('should provide the direct path to the target without branches', async () => {
    const result = BaseClient.getMessagesForConversation({
      messages: mockMessages,
      parentMessageId: '18',
    });
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      '[getMessagesForConversation] should provide the direct path to the target without branches\n',
      mappedResult,
    );
    console.debug('mockMessages\n', printMessageTree(mockMessages));
    console.debug('result\n', printMessageTree(result));
    expect(mappedResult).toEqual(['11', '13', '16', '18']);
  });

  test('should return target if only message', async () => {
    const result = BaseClient.getMessagesForConversation({
      messages: [mockMessages[mockMessages.length - 1]],
      parentMessageId: '20',
    });
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      '[getMessagesForConversation] should return target if only message\n',
      mappedResult,
    );
    console.debug('mockMessages\n', printMessageTree(mockMessages));
    console.debug('result\n', printMessageTree(result));
    expect(mappedResult).toEqual(['20']);
  });
});

describe('splitAtTargetLevel', () => {
  /* const mockMessagesComplex = [
    { messageId: '7', parentMessageId: Constants.NO_PARENT, text: 'Message 7' },
    { messageId: '8', parentMessageId: Constants.NO_PARENT, text: 'Message 8' },
    { messageId: '5', parentMessageId: '7', text: 'Message 5' },
    { messageId: '6', parentMessageId: '7', text: 'Message 6' },
    { messageId: '9', parentMessageId: '8', text: 'Message 9' },
    { messageId: '2', parentMessageId: '5', text: 'Message 2' },
    { messageId: '3', parentMessageId: '5', text: 'Message 3' },
    { messageId: '1', parentMessageId: '6', text: 'Message 1' },
    { messageId: '4', parentMessageId: '6', text: 'Message 4' },
    { messageId: '10', parentMessageId: '3', text: 'Message 10' },
  ];

     mockMessages
    ├── [7]: Root
    |   ├── [5]: Child of 7
    |   |   ├── [2]: Child of 5
    |   |   └── [3]: Child of 5
    |   |       └── [10]: Child of 3
    |   └── [6]: Child of 7
    |       ├── [1]: Child of 6
    |       └── [4]: Child of 6
    └── [8]: Root
        └── [9]: Child of 8
  */
  test('should include target message level and all descendants (1/2)', () => {
    console.debug('splitAtTargetLevel: mockMessages\n', printMessageTree(mockMessagesComplex));
    const result = splitAtTargetLevel(mockMessagesComplex, '2');
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      'splitAtTargetLevel: include target message level and all descendants (1/2)\n',
      printMessageTree(result),
    );
    expect(mappedResult).toEqual(['2', '3', '1', '4', '10']);
  });

  test('should include target message level and all descendants (2/2)', () => {
    console.debug('splitAtTargetLevel: mockMessages\n', printMessageTree(mockMessagesComplex));
    const result = splitAtTargetLevel(mockMessagesComplex, '5');
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      'splitAtTargetLevel: include target message level and all descendants (2/2)\n',
      printMessageTree(result),
    );
    expect(mappedResult).toEqual(['5', '6', '9', '2', '3', '1', '4', '10']);
  });

  test('should handle when target message is root', () => {
    const result = splitAtTargetLevel(mockMessagesComplex, '7');
    console.debug('splitAtTargetLevel: target level is root message\n', printMessageTree(result));
    expect(result.length).toBe(mockMessagesComplex.length);
  });

  test('should handle when target message is deepest, lonely child', () => {
    const result = splitAtTargetLevel(mockMessagesComplex, '10');
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      'splitAtTargetLevel: target message is deepest, lonely child\n',
      printMessageTree(result),
    );
    expect(mappedResult).toEqual(['10']);
  });

  test('should handle when target level is last with many neighbors', () => {
    const mockMessages = [
      ...mockMessagesComplex,
      { messageId: '11', parentMessageId: '10', text: 'Message 11' },
      { messageId: '12', parentMessageId: '10', text: 'Message 12' },
      { messageId: '13', parentMessageId: '10', text: 'Message 13' },
      { messageId: '14', parentMessageId: '10', text: 'Message 14' },
      { messageId: '15', parentMessageId: '4', text: 'Message 15' },
      { messageId: '16', parentMessageId: '15', text: 'Message 15' },
    ];
    const result = splitAtTargetLevel(mockMessages, '11');
    const mappedResult = result.map((msg) => msg.messageId);
    console.debug(
      'splitAtTargetLevel: should handle when target level is last with many neighbors\n',
      printMessageTree(result),
    );
    expect(mappedResult).toEqual(['11', '12', '13', '14', '16']);
  });

  test('should handle non-existent target message', () => {
    // Non-existent message ID
    const result = splitAtTargetLevel(mockMessagesComplex, '99');
    expect(result.length).toBe(0);
  });
});
