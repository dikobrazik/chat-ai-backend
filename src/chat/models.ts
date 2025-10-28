export const PROVIDERS = {
  openai: {
    provider: 'openai',
    models: [
      {
        id: 'gpt-4o-mini',
        description:
          'A smaller, faster version of GPT-4o optimized for chat applications.',
      },
      {
        id: 'gpt-4o',
        description: 'GPT-4o is an omnidirectional, multimodal AI model',
      },
    ],
  },
  google: {
    provider: 'google',
    models: [
      {
        id: 'gemini-2.5-flash',
        description:
          'Google Gemini 2.5 Flash model for advanced content generation.',
      },
    ],
  },
} as const;

// INSERT INTO model_provider VALUES(1, 'openai'), (2, 'google');
// INSERT INTO model VALUES(1, 1, 'gpt-4o-mini', 'A smaller, faster version of GPT-4o optimized for chat applications.', 'guest'), (2, 2, 'gemini-2.5-flash', 'Google Gemini 2.5 Flash model for advanced content generation.', 'active');
