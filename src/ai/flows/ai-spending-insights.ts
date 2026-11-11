
'use server';
/**
 * @fileOverview An AI agent that analyzes spending habits and provides personalized tips.
 *
 * - aiSpendingInsights - A function that handles the generation of spending insights.
 * - AiSpendingInsightsInput - The input type for the aiSpendingInsights function.
 * - AiSpendingInsightsOutput - The return type for the aiSpendingInsights function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TransactionSchema = z.object({
  id: z.string().describe('Unique identifier for the transaction.'),
  description: z.string().describe('Description of the transaction.'),
  amount: z.number().describe('The amount of the transaction.'),
  category: z.string().describe('The category of the transaction (e.g., "Groceries", "Rent", "Salary").'),
  type: z.enum(['expense', 'income']).describe('Type of transaction: "expense" or "income".'),
  date: z.string().describe('Date of the transaction in YYYY-MM-DD format.'),
});

const AiSpendingInsightsInputSchema = z.object({
  transactions: z.array(TransactionSchema).describe('A list of financial transactions.'),
  summary: z.object({
    totalIncome: z.number(),
    totalExpense: z.number(),
    savings: z.number(),
  }).optional(),
});
export type AiSpendingInsightsInput = z.infer<typeof AiSpendingInsightsInputSchema>;

const AiSpendingInsightsOutputSchema = z.object({
  insights: z.string().describe('Conversational tips and insights about spending habits, potential savings, or anomalies.'),
});
export type AiSpendingInsightsOutput = z.infer<typeof AiSpendingInsightsOutputSchema>;

export async function aiSpendingInsights(input: AiSpendingInsightsInput): Promise<AiSpendingInsightsOutput> {
  return aiSpendingInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiSpendingInsightsPrompt',
  input: { schema: AiSpendingInsightsInputSchema },
  output: { schema: AiSpendingInsightsOutputSchema },
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
  prompt: `You are a premium AI financial advisor for Nik Finance Tracker. Your goal is to provide a short, intelligent, and actionable financial insight based on the user's real data.

Analysis Rules:
1. If totalIncome is 0 and totalExpense > 0: Suggest adding income entries for better insights.
2. If totalIncome is 0 and totalExpense is 0: Encourage adding first entries.
3. If savings is positive: Provide positive reinforcement and mention the expense ratio (Expense/Income).
4. If savings is negative: Provide a professional warning and suggest reviewing top categories.
5. High Expense Ratio (>80%): Suggest reviewing non-essential spending.
6. Moderate Ratio (50-80%): Suggest continued tracking.
7. Low Ratio (<50%): Commend the healthy savings margin.

Context:
Total Income: ₹{{{summary.totalIncome}}}
Total Expense: ₹{{{summary.totalExpense}}}
Net Savings: ₹{{{summary.savings}}}

Recent Transactions:
{{#each transactions}}
- {{{date}}}: {{{description}}} ({{{category}}}) - ₹{{{amount}}} [{{{type}}}]
{{/each}}

Identify the highest spending category and provide a conversational, premium tip. Use Indian Rupee (₹) symbol. Keep it concise (max 3 sentences).`,
});

const aiSpendingInsightsFlow = ai.defineFlow(
  {
    name: 'aiSpendingInsightsFlow',
    inputSchema: AiSpendingInsightsInputSchema,
    outputSchema: AiSpendingInsightsOutputSchema,
  },
  async (input) => {
    try {
      console.log('Generating AI Insights for input summary:', input.summary);
      const { output } = await prompt(input);
      
      if (!output) {
        console.error('AI Model returned empty output');
        throw new Error('AI Model returned empty output');
      }
      
      return output;
    } catch (error: any) {
      console.error('Genkit Flow Error:', error);
      throw new Error(`Failed to generate spending insights: ${error.message}`);
    }
  }
);
