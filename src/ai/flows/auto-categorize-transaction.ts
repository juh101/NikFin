'use server';
/**
 * @fileOverview A Genkit flow to automatically categorize financial transactions.
 *
 * - autoCategorizeTransaction - A function that handles the transaction categorization process.
 * - AutoCategorizeTransactionInput - The input type for the autoCategorizeTransaction function.
 * - AutoCategorizeTransactionOutput - The return type for the autoCategorizeTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutoCategorizeTransactionInputSchema = z.object({
  transactionDescription: z.string().describe('The description of the financial transaction.'),
  availableCategories: z.array(z.string()).describe('A list of available categories for the transaction.'),
});
export type AutoCategorizeTransactionInput = z.infer<typeof AutoCategorizeTransactionInputSchema>;

const AutoCategorizeTransactionOutputSchema = z.object({
  suggestedCategory: z.string().describe('The most appropriate category for the transaction based on the description.'),
});
export type AutoCategorizeTransactionOutput = z.infer<typeof AutoCategorizeTransactionOutputSchema>;

const categorizePrompt = ai.definePrompt({
  name: 'categorizeTransactionPrompt',
  input: { schema: AutoCategorizeTransactionInputSchema },
  output: { schema: AutoCategorizeTransactionOutputSchema },
  prompt: `You are a helpful assistant that categorizes financial transactions.
Given a transaction description and a list of available categories, suggest the single most appropriate category for the transaction.
The suggested category MUST be one of the provided available categories or 'Other' if none fit well.

Transaction Description: {{{transactionDescription}}}
Available Categories: {{#each availableCategories}} "{{this}}" {{/each}}

Please respond with ONLY the suggested category in the specified JSON format.`,
});

const autoCategorizeTransactionFlow = ai.defineFlow(
  {
    name: 'autoCategorizeTransactionFlow',
    inputSchema: AutoCategorizeTransactionInputSchema,
    outputSchema: AutoCategorizeTransactionOutputSchema,
  },
  async (input) => {
    const { output } = await categorizePrompt(input);
    return output!;
  }
);

export async function autoCategorizeTransaction(
  input: AutoCategorizeTransactionInput
): Promise<AutoCategorizeTransactionOutput> {
  return autoCategorizeTransactionFlow(input);
}
