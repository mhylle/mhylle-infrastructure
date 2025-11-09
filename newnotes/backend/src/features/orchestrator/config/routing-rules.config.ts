import { RoutingRule } from '../types/intent.types';

export const ROUTING_RULES: RoutingRule[] = [
  // Task Creation (Priority: 100)
  {
    intent: 'task_creation',
    confidence: 0.95,
    priority: 100,
    patterns: {
      keywords: [
        'create task',
        'add task',
        'new task',
        'todo',
        'to-do',
        'remind me',
        'need to',
        'have to',
        'must',
        'should',
        "don't forget",
        'remember to',
      ],
      regex: [
        /(?:I|we) (?:need|have|must|should) (?:to|do)/i,
        /(?:tomorrow|next week|this week).+(?:do|complete|finish)/i,
      ],
      negativeKeywords: ['how to', 'what is', 'tell me about'],
    },
    examples: [
      'Create task to clear surfaces',
      'Remind me to call mom tomorrow',
      'I need to prepare for the meeting',
      "Don't forget to buy groceries",
    ],
  },

  // Information Seeking - Web (Priority: 90)
  {
    intent: 'information_seeking_web',
    confidence: 0.9,
    priority: 90,
    patterns: {
      keywords: [
        'latest',
        'recent',
        'current',
        'news',
        'today',
        'now',
        "what's happening",
        'updates on',
        'current status',
      ],
      regex: [
        /(?:latest|recent|current|today's).+(?:news|information|update)/i,
        /what.+(?:happening|going on)/i,
      ],
    },
    examples: [
      "What's the latest news about AI?",
      'Current status of SpaceX launch',
      'Recent developments in quantum computing',
    ],
  },

  // Information Seeking - Notes (Priority: 85)
  {
    intent: 'information_seeking_notes',
    confidence: 0.9,
    priority: 85,
    patterns: {
      keywords: [
        'my notes',
        'I wrote',
        'I saved',
        'show me notes',
        'from my notes',
        'in my notes',
        'what did I write',
      ],
      regex: [
        /(?:find|show|get).+(?:notes|wrote|saved)/i,
        /what did I.+(?:write|note|save)/i,
      ],
    },
    examples: [
      'Show me my notes about project planning',
      'What did I write about LLM finetuning?',
      'Find notes from last week',
    ],
  },

  // Information Seeking - General (Priority: 80)
  {
    intent: 'information_seeking',
    confidence: 0.85,
    priority: 80,
    patterns: {
      keywords: [
        'how to',
        'what is',
        'explain',
        'tell me about',
        'information about',
        'learn about',
        'understand',
      ],
      regex: [
        /(?:how|what|why|when|where).+\?$/i,
        /(?:explain|tell me|teach me).+(?:about|how)/i,
      ],
      negativeKeywords: ['create task', 'remind me'],
    },
    examples: [
      'How to finetune an LLM?',
      'What are my options for deployment?',
      'Explain transformer architecture',
    ],
  },

  // Analytical (Priority: 75)
  {
    intent: 'analytical',
    confidence: 0.9,
    priority: 75,
    patterns: {
      keywords: [
        'analyze',
        'summarize',
        'show all',
        'list all',
        'find all',
        'trends',
        'patterns',
        'insights',
      ],
      regex: [
        /(?:analyze|summarize|review).+(?:notes|tasks|data)/i,
        /(?:show|list|find) all.+(?:about|related to)/i,
      ],
    },
    examples: [
      'Analyze my notes about machine learning',
      'Summarize all tasks from this month',
      'Show me trends in my productivity',
    ],
  },

  // Conversational (Priority: 70)
  {
    intent: 'conversational',
    confidence: 0.95,
    priority: 70,
    patterns: {
      keywords: [
        'thanks',
        'thank you',
        'great',
        'perfect',
        'awesome',
        'hi',
        'hello',
        'hey',
        'good morning',
        'good evening',
        'bye',
        'goodbye',
        'see you',
        'got it',
        'ok',
        'okay',
      ],
      regex: [
        /^(?:hi|hello|hey|thanks|thank you)[\s!.]*$/i,
        /^(?:ok|okay|got it|perfect|great)[\s!.]*$/i,
      ],
    },
    examples: ['Thanks!', 'Hello', "That's perfect", 'Got it, thanks'],
  },

  // Task Query (Priority: 85)
  {
    intent: 'task_query',
    confidence: 0.9,
    priority: 85,
    patterns: {
      keywords: [
        'show tasks',
        'list tasks',
        'my tasks',
        'what tasks',
        'task status',
        'pending tasks',
        'completed tasks',
      ],
      regex: [
        /(?:show|list|get).+tasks/i,
        /what.+tasks.+(?:have|do I have)/i,
      ],
    },
    examples: [
      'Show my pending tasks',
      'What tasks do I have today?',
      'List all completed tasks',
    ],
  },
];
