#!/usr/bin/env tsx
/**
 * EMBED VECTORS
 *
 * Generates embeddings for component documents and stores them.
 * Uses the same EmbeddingService pattern from world-seed-extraction-shooter.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx tsx bend/src/genesis/embed-vectors.ts
 *
 * Output:
 *   data/embeddings.json - Vector documents with embeddings
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vector document type
interface VectorDocument {
  id: string;
  namespace: string;
  content: string;
  metadata: {
    name: string;
    level: string;
    prime: number;
    variant?: string;
    tags: string[];
    physics_summary: string;
  };
  embedding?: number[];
}

/**
 * EmbeddingService - Converts text into vectors using Gemini
 */
class EmbeddingService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    if (!text || !text.trim()) return [];

    const cleanText = text.replace(/\n/g, ' ').trim();

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: cleanText }] }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini Embedding Error: ${response.status}`);
      }

      const data = await response.json() as { embedding: { values: number[] } };
      return data.embedding.values;

    } catch (e) {
      console.error('[EMBED] Failed to generate vector:', e);
      return [];
    }
  }

  /**
   * Embed multiple texts with rate limiting
   */
  async embedBatch(texts: string[], delayMs: number = 100): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const embedding = await this.embed(texts[i]);
      embeddings.push(embedding);

      // Progress
      if ((i + 1) % 10 === 0) {
        console.log(`  Embedded ${i + 1}/${texts.length}`);
      }

      // Rate limiting
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

/**
 * Search for similar documents
 */
function semanticSearch(
  query: number[],
  documents: VectorDocument[],
  threshold: number = 0.6,
  limit: number = 10
): { doc: VectorDocument; score: number }[] {
  return documents
    .filter(doc => doc.embedding && doc.embedding.length > 0)
    .map(doc => ({
      doc,
      score: EmbeddingService.cosineSimilarity(query, doc.embedding!)
    }))
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable not set');
    console.log('\nTo run this script:');
    console.log('GEMINI_API_KEY=xxx npx tsx bend/src/genesis/embed-vectors.ts');

    // Generate placeholder file without embeddings
    console.log('\nGenerating placeholder file without embeddings...');
    await generatePlaceholder();
    return;
  }

  const embeddingService = new EmbeddingService(apiKey);

  console.log('Loading vector documents...\n');

  const dataDir = path.join(__dirname, '..', '..', '..', 'data');
  const vectorsPath = path.join(dataDir, 'vectors.json');

  const documents: VectorDocument[] = JSON.parse(
    fs.readFileSync(vectorsPath, 'utf-8')
  );

  console.log(`Loaded ${documents.length} documents\n`);
  console.log('Generating embeddings (this may take a minute)...\n');

  const texts = documents.map(d => d.content);
  const embeddings = await embeddingService.embedBatch(texts, 50);

  // Attach embeddings to documents
  for (let i = 0; i < documents.length; i++) {
    documents[i].embedding = embeddings[i];
  }

  // Count successful embeddings
  const successCount = embeddings.filter(e => e.length > 0).length;
  console.log(`\nGenerated ${successCount}/${documents.length} embeddings`);

  // Write output
  const embeddingsPath = path.join(dataDir, 'embeddings.json');
  fs.writeFileSync(embeddingsPath, JSON.stringify(documents, null, 2));
  console.log(`\nWrote embeddings to ${embeddingsPath}`);

  // Demo search
  if (successCount > 0) {
    console.log('\n--- Demo Search ---');

    const queryText = 'interactive button for dangerous actions';
    console.log(`Query: "${queryText}"`);

    const queryEmbedding = await embeddingService.embed(queryText);
    const results = semanticSearch(queryEmbedding, documents, 0.5, 5);

    console.log('\nResults:');
    for (const { doc, score } of results) {
      console.log(`  ${score.toFixed(3)}: ${doc.metadata.name}${doc.metadata.variant ? '.' + doc.metadata.variant : ''}`);
    }
  }

  console.log('\nEmbedding complete!');
}

async function generatePlaceholder() {
  const dataDir = path.join(__dirname, '..', '..', '..', 'data');
  const vectorsPath = path.join(dataDir, 'vectors.json');

  const documents: VectorDocument[] = JSON.parse(
    fs.readFileSync(vectorsPath, 'utf-8')
  );

  // Add empty embeddings
  for (const doc of documents) {
    doc.embedding = [];
  }

  const embeddingsPath = path.join(dataDir, 'embeddings.json');
  fs.writeFileSync(embeddingsPath, JSON.stringify(documents, null, 2));
  console.log(`Wrote placeholder to ${embeddingsPath}`);
  console.log('Run with GEMINI_API_KEY to generate real embeddings.');
}

main();
