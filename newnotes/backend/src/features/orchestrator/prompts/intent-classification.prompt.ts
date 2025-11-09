export const INTENT_CLASSIFICATION_PROMPT = (
  message: string,
  contextMessages: Array<{ role: string; content: string }>,
) => `
You are an intent classifier for a personal AI assistant with note-taking and task management capabilities.

Analyze the user's message and classify it into ONE of these intents:

1. **task_creation** - User wants to create a new task or reminder
2. **task_query** - User wants to see or check existing tasks
3. **information_seeking** - User wants information (from notes, web, or both)
4. **analytical** - User wants analysis, summary, or insights from their data
5. **conversational** - Casual conversation, greetings, acknowledgments

USER MESSAGE: "${message}"

CONVERSATION CONTEXT:
${contextMessages.length > 0 ? contextMessages.map((m) => `${m.role}: ${m.content}`).join('\n') : 'No previous context'}

Respond with JSON ONLY:
{
  "intent": "task_creation|task_query|information_seeking|analytical|conversational",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "requires_clarification": true|false,
  "clarification_questions": ["question1", "question2"],
  "suggested_search_scope": "notes|web|both"
}

Examples:

Input: "I need to prepare for the meeting tomorrow"
Output: {"intent":"task_creation","confidence":0.95,"reasoning":"Clear actionable task with timeframe","requires_clarification":false,"clarification_questions":[],"suggested_search_scope":"notes"}

Input: "What are my options for finetuning LLMs?"
Output: {"intent":"information_seeking","confidence":0.9,"reasoning":"Seeking information/knowledge","requires_clarification":true,"clarification_questions":["Do you want techniques, tools, or both?","Should I search your notes or the web?"],"suggested_search_scope":"both"}

Input: "Show me all notes about machine learning"
Output: {"intent":"analytical","confidence":0.95,"reasoning":"Requesting aggregation/summary of data","requires_clarification":false,"clarification_questions":[],"suggested_search_scope":"notes"}
`.trim();
