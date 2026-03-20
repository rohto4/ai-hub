import OpenAI from 'openai'

const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

export interface TextEmbeddingInput {
  id: string
  text: string
}

export interface TextEmbeddingResult {
  id: string
  embedding: number[] | null
  model: string | null
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export async function generateTextEmbeddings(
  inputs: TextEmbeddingInput[],
): Promise<TextEmbeddingResult[]> {
  const normalizedInputs = inputs
    .map((input) => ({
      id: String(input.id),
      text: normalizeText(input.text),
    }))
    .filter((input) => input.text.length > 0)

  if (normalizedInputs.length === 0 || !process.env.OPENAI_API_KEY) {
    return inputs.map((input) => ({
      id: String(input.id),
      embedding: null,
      model: null,
    }))
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: normalizedInputs.map((input) => input.text),
  })

  const embeddings = new Map(
    response.data.map((item, index) => [
      normalizedInputs[index]?.id,
      item.embedding,
    ]),
  )

  return inputs.map((input) => ({
    id: String(input.id),
    embedding: embeddings.get(String(input.id)) ?? null,
    model: embeddings.has(String(input.id)) ? OPENAI_EMBEDDING_MODEL : null,
  }))
}
