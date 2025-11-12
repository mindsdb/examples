import { EmailAction } from '@/lib/types';

export function detectEmailActions(text: string): EmailAction[] {
  const actions: EmailAction[] = [];

  // Only extract from structured emailactions code blocks created by the AI agent
  const emailActionBlocks = text.match(/```emailactions\s*([\s\S]*?)\s*```/g);
  
  if (emailActionBlocks) {
    for (const block of emailActionBlocks) {
      try {
        // Extract JSON content from the code block and clean it up
        let jsonContent = block.replace(/```emailactions\s*/, '').replace(/\s*```/, '').trim();
        
        // Remove extra whitespace from each line
        const lines = jsonContent.split('\n').map(line => line.trim()).filter(line => line);
        jsonContent = lines.join('\n');
        
        console.log('Parsing email actions:', jsonContent.substring(0, 200));
        
        const parsedActions = JSON.parse(jsonContent);
        
        if (Array.isArray(parsedActions)) {
          actions.push(...parsedActions);
          console.log('Successfully parsed', parsedActions.length, 'email actions');
        }
      } catch (error) {
        console.warn('Failed to parse email actions from code block:', error);
        console.warn('Block content:', block.substring(0, 500));
      }
    }
  }

  // REMOVED: No more automatic fallback generation based on keywords
  // The AI agent has full control over when email actions are appropriate
  // Only email actions explicitly created by the AI through ACTION_SUGGESTIONS will be shown
  
  return actions.slice(0, 3); // Limit to 3 actions max
}