import { DynamoDBClient, PutItemCommand, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PROMPTS_TABLE = process.env.PROMPTS_TABLE || 'domain-generator-prompts';
const REGION = process.env.AWS_REGION || 'us-east-1';

const dynamodb = new DynamoDBClient({ region: REGION });

function parsePromptsFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const prompts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, headers (starting with **), and parse list items
    if (!trimmed || trimmed.startsWith('**')) {
      continue;
    }
    // Extract prompt from list items like: - "prompt text"
    const match = trimmed.match(/^-\s*"(.+)"$/);
    if (match) {
      prompts.push(match[1]);
    }
  }

  return prompts;
}

async function clearTable(): Promise<void> {
  console.log('Clearing existing prompts...');
  let count = 0;

  try {
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const scanCommand = new ScanCommand({
        TableName: PROMPTS_TABLE,
        ExclusiveStartKey: lastEvaluatedKey,
      });
      const response = await dynamodb.send(scanCommand);

      if (response.Items) {
        for (const item of response.Items) {
          const deleteCommand = new DeleteItemCommand({
            TableName: PROMPTS_TABLE,
            Key: { id: item.id },
          });
          await dynamodb.send(deleteCommand);
          count++;
        }
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Deleted ${count} existing prompts`);
  } catch (error) {
    console.error('Error clearing table:', error);
  }
}

async function seedPrompts(prompts: string[]): Promise<void> {
  console.log(`Seeding ${prompts.length} prompts...`);
  let successCount = 0;

  for (const prompt of prompts) {
    try {
      const command = new PutItemCommand({
        TableName: PROMPTS_TABLE,
        Item: {
          id: { S: randomUUID() },
          prompt: { S: prompt },
        },
      });
      await dynamodb.send(command);
      successCount++;

      if (successCount % 50 === 0) {
        console.log(`  Inserted ${successCount}/${prompts.length}...`);
      }
    } catch (error) {
      console.error(`Error inserting prompt "${prompt}":`, error);
    }
  }

  console.log(`Successfully seeded ${successCount} prompts`);
}

async function main() {
  const promptsFilePath = path.resolve(__dirname, '../../example prompts.txt');

  if (!fs.existsSync(promptsFilePath)) {
    console.error(`Prompts file not found: ${promptsFilePath}`);
    process.exit(1);
  }

  const prompts = parsePromptsFile(promptsFilePath);
  console.log(`Parsed ${prompts.length} prompts from file`);

  if (prompts.length === 0) {
    console.error('No prompts found in file');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const shouldClear = args.includes('--clear');

  if (shouldClear) {
    await clearTable();
  }

  await seedPrompts(prompts);
}

main().catch(console.error);
