import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('GEMINI_API_KEY is missing')
  process.exit(1)
}

// NOTE: Since the standard gemini-1.5-flash doesn't support direct image generation via this SDK yet in a stable way for all keys without Vertex,
// we will simulate the image generation or use a placeholder approach if the image generation endpoint isn't fully available on the free tier.
// Wait, the user wants me to *generate* the images. I should use `imagen-3.0-generate-001` model or similar if available, 
// but the @google/generative-ai SDK doesn't directly support `imagen` model generation natively in the same `generateContent` way easily.
// Let's check if we can fetch it via fetch API to the new endpoint.

async function generateImage(prompt: string, outputPath: string) {
  console.log(`Generating image for: ${outputPath}`)
  console.log(`Prompt: ${prompt}`)
  
  // Note: Standard Gemini API key might not have access to Imagen 3 yet via the public endpoint, 
  // but let's try the gemini-2.5-flash image generation capability or use a fallback.
  // Actually, Gemini CLI has access to tools. Can I just write a script that calls the REST API?
  // Let's write a script that hits the HTTP endpoint for Image Generation if possible, or just generate placeholders for now to prove the pipeline.
  // Wait, the user explicitly asked ME (the AI) to "read it and generate images".
  // Let's create a script that calls the Gemini API's Imagen endpoint.
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [
          { prompt: prompt }
        ],
        parameters: {
          sampleCount: 1,
          outputOptions: {
            mimeType: "image/png"
          }
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Error generating image for ${outputPath}: ${response.status} ${response.statusText}`, errorText)
      return false
    }

    const data = await response.json()
    if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
      const buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64')
      fs.writeFileSync(outputPath, buffer)
      console.log(`✅ Saved: ${outputPath}`)
      return true
    } else {
      console.error('No image data returned', data)
      return false
    }
  } catch (error) {
    console.error(`Failed to generate:`, error)
    return false
  }
}

async function main() {
  const text = fs.readFileSync('artifacts/thumbnail-prompts.md', 'utf8')
  const blocks = text.split('---')
  
  const tags: { key: string, prompt: string }[] = []
  
  for (const block of blocks) {
    const keyMatch = block.match(/## .*? \(\`([^`]+)\`\)/)
    const promptMatch = block.match(/### Gemini Prompt\n> (.*)/)
    
    if (keyMatch && promptMatch) {
      tags.push({ key: keyMatch[1], prompt: promptMatch[1].trim() })
    }
  }
  
  console.log(`Found ${tags.length} prompts.`)
  
  const outDir = join(__dirname, '../public/thumbs/assets')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  
  // To avoid hitting rate limits, let's just do top 15 for now
  const limit = 15
  let count = 0
  
  for (const tag of tags) {
    if (count >= limit) break
    const outputPath = join(outDir, `${tag.key}.png`)
    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      console.log(`Skipping ${tag.key}, already exists.`)
      count++
      continue
    }
    
    await generateImage(tag.prompt, outputPath)
    // Sleep to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 3000))
    count++
  }
}

main().catch(console.error)
