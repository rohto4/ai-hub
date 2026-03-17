#!/usr/bin/env node
/**
 * タグ + キーワード seed スクリプト
 * Usage: node scripts/seed-keywords.mjs
 *
 * 1. tags_master に全タグを upsert する
 * 2. tag_keywords に収集・検索用キーワードを upsert する
 *
 * タグ構造:
 *   Tier 1: トピック・ユースケース分類（llm, agent, coding-ai ...）
 *   Tier 2: 製品・企業・プラットフォーム（claude, openai, cursor ...）
 *
 * tag_aliases（表記ゆれ正規化）とは別物。自然言語の検索・マッチ語を登録する。
 */
import { Pool } from '@neondatabase/serverless'
import nextEnv from '@next/env'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const { loadEnvConfig } = nextEnv
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectDir = join(__dirname, '..')
loadEnvConfig(projectDir)

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.error('ERROR: DATABASE_URL_UNPOOLED is not configured')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED })

// ─── タグ定義 ─────────────────────────────────────────────────────────
// tier: 1=トピック分類, 2=製品・企業
const ALL_TAGS = [
  // ── Tier 1: トピック分類 ──────────────────────────────────────────
  { key: 'llm',            displayName: 'LLM',            trendKeyword: 'large language model',          tier: 1 },
  { key: 'agent',          displayName: 'Agent',           trendKeyword: 'AI agent',                      tier: 1 },
  { key: 'coding-ai',      displayName: 'Coding AI',       trendKeyword: 'AI coding assistant',           tier: 1 },
  { key: 'enterprise-ai',  displayName: 'Enterprise AI',   trendKeyword: 'enterprise AI',                 tier: 1 },
  { key: 'generative-ai',  displayName: 'Generative AI',   trendKeyword: 'generative AI',                 tier: 1 },
  { key: 'rag',            displayName: 'RAG',             trendKeyword: 'retrieval augmented generation', tier: 1 },
  { key: 'safety',         displayName: 'Safety',          trendKeyword: 'AI safety',                     tier: 1 },
  { key: 'voice-ai',       displayName: 'Voice AI',        trendKeyword: 'voice AI',                      tier: 1 },
  { key: 'policy',         displayName: 'Policy',          trendKeyword: 'AI policy',                     tier: 1 },
  { key: 'google-ai',      displayName: 'Google AI',       trendKeyword: 'google AI',                     tier: 1 },
  { key: 'paper',          displayName: 'Paper',           trendKeyword: 'research paper',                tier: 1 },

  // ── Tier 2: LLM / 基盤モデル ─────────────────────────────────────
  { key: 'claude',         displayName: 'Claude',          trendKeyword: 'Anthropic Claude',              tier: 2 },
  { key: 'chatgpt',        displayName: 'ChatGPT',         trendKeyword: 'ChatGPT',                       tier: 2 },
  { key: 'gpt-5',          displayName: 'GPT-5',           trendKeyword: 'GPT-5 OpenAI',                  tier: 2 },
  { key: 'gemini',         displayName: 'Gemini',          trendKeyword: 'Google Gemini',                 tier: 2 },
  { key: 'llama',          displayName: 'Llama',           trendKeyword: 'Meta Llama',                    tier: 2 },
  { key: 'mistral',        displayName: 'Mistral',         trendKeyword: 'Mistral model',                 tier: 2 },
  { key: 'grok',           displayName: 'Grok',            trendKeyword: 'xAI Grok',                      tier: 2 },
  { key: 'deepseek',       displayName: 'DeepSeek',        trendKeyword: 'DeepSeek AI',                   tier: 2 },
  { key: 'qwen',           displayName: 'Qwen',            trendKeyword: 'Alibaba Qwen',                  tier: 2 },
  { key: 'phi',            displayName: 'Phi',             trendKeyword: 'Microsoft Phi',                 tier: 2 },
  { key: 'gemma',          displayName: 'Gemma',           trendKeyword: 'Google Gemma',                  tier: 2 },
  { key: 'o1',             displayName: 'o1 / o3',         trendKeyword: 'OpenAI o1 reasoning',           tier: 2 },
  { key: 'perplexity',     displayName: 'Perplexity',      trendKeyword: 'Perplexity AI',                 tier: 2 },

  // ── Tier 2: コーディング AI ──────────────────────────────────────
  { key: 'cursor',         displayName: 'Cursor',          trendKeyword: 'Cursor IDE',                    tier: 2 },
  { key: 'claude-code',    displayName: 'Claude Code',     trendKeyword: 'Claude Code Anthropic',         tier: 2 },
  { key: 'antigravity',    displayName: 'Antigravity',     trendKeyword: 'Google Antigravity',            tier: 2 },
  { key: 'github-copilot', displayName: 'GitHub Copilot',  trendKeyword: 'GitHub Copilot',                tier: 2 },
  { key: 'devin',          displayName: 'Devin',           trendKeyword: 'Devin AI coding',               tier: 2 },
  { key: 'windsurf',       displayName: 'Windsurf',        trendKeyword: 'Windsurf IDE',                  tier: 2 },
  { key: 'cline',          displayName: 'Cline',           trendKeyword: 'Cline VS Code',                 tier: 2 },
  { key: 'roocode',        displayName: 'RooCode',         trendKeyword: 'RooCode AI',                    tier: 2 },
  { key: 'amazon-q',       displayName: 'Amazon Q',        trendKeyword: 'Amazon Q Developer',            tier: 2 },

  // ── Tier 2: 画像生成 AI ──────────────────────────────────────────
  { key: 'midjourney',        displayName: 'Midjourney',      trendKeyword: 'Midjourney',          tier: 2 },
  { key: 'stable-diffusion',  displayName: 'Stable Diffusion',trendKeyword: 'Stable Diffusion',    tier: 2 },
  { key: 'dall-e',            displayName: 'DALL-E',          trendKeyword: 'DALL-E OpenAI',       tier: 2 },
  { key: 'flux',              displayName: 'Flux',            trendKeyword: 'Flux image AI',       tier: 2 },
  { key: 'adobe-firefly',     displayName: 'Adobe Firefly',   trendKeyword: 'Adobe Firefly',       tier: 2 },
  { key: 'imagen',            displayName: 'Imagen',          trendKeyword: 'Google Imagen',       tier: 2 },

  // ── Tier 2: 動画生成 AI ──────────────────────────────────────────
  { key: 'sora',    displayName: 'Sora',    trendKeyword: 'OpenAI Sora',   tier: 2 },
  { key: 'runway',  displayName: 'Runway',  trendKeyword: 'Runway ML',     tier: 2 },
  { key: 'kling',   displayName: 'Kling',   trendKeyword: 'Kling AI video',tier: 2 },
  { key: 'heygen',  displayName: 'HeyGen',  trendKeyword: 'HeyGen avatar', tier: 2 },
  { key: 'pika',    displayName: 'Pika',    trendKeyword: 'Pika video AI', tier: 2 },
  { key: 'veo',     displayName: 'Veo',     trendKeyword: 'Google Veo',    tier: 2 },

  // ── Tier 2: 音声・音楽 AI ────────────────────────────────────────
  { key: 'elevenlabs',  displayName: 'ElevenLabs',  trendKeyword: 'ElevenLabs voice', tier: 2 },
  { key: 'suno',        displayName: 'Suno',        trendKeyword: 'Suno music AI',    tier: 2 },
  { key: 'udio',        displayName: 'Udio',        trendKeyword: 'Udio music AI',    tier: 2 },
  { key: 'notebooklm',  displayName: 'NotebookLM',  trendKeyword: 'Google NotebookLM',tier: 2 },

  // ── Tier 2: AI 企業 ──────────────────────────────────────────────
  { key: 'openai',        displayName: 'OpenAI',        trendKeyword: 'OpenAI',          tier: 2 },
  { key: 'anthropic',     displayName: 'Anthropic',     trendKeyword: 'Anthropic',       tier: 2 },
  { key: 'google-deepmind',displayName: 'Google DeepMind',trendKeyword: 'Google DeepMind',tier: 2 },
  { key: 'meta-ai',       displayName: 'Meta AI',       trendKeyword: 'Meta AI',         tier: 2 },
  { key: 'xai',           displayName: 'xAI',           trendKeyword: 'xAI Elon Musk',  tier: 2 },
  { key: 'mistral-ai',    displayName: 'Mistral AI',    trendKeyword: 'Mistral AI',      tier: 2 },
  { key: 'cohere',        displayName: 'Cohere',        trendKeyword: 'Cohere AI',       tier: 2 },
  { key: 'stability-ai',  displayName: 'Stability AI',  trendKeyword: 'Stability AI',   tier: 2 },

  // ── Tier 2: プラットフォーム・インフラ ──────────────────────────
  { key: 'huggingface',  displayName: 'Hugging Face', trendKeyword: 'HuggingFace',       tier: 2 },
  { key: 'langchain',    displayName: 'LangChain',    trendKeyword: 'LangChain',         tier: 2 },
  { key: 'llamaindex',   displayName: 'LlamaIndex',   trendKeyword: 'LlamaIndex RAG',    tier: 2 },
  { key: 'dify',         displayName: 'Dify',         trendKeyword: 'Dify AI platform',  tier: 2 },
  { key: 'replicate',    displayName: 'Replicate',    trendKeyword: 'Replicate AI',      tier: 2 },
  { key: 'vercel-ai',    displayName: 'Vercel AI',    trendKeyword: 'Vercel AI SDK',     tier: 2 },

  // ── Tier 2: エージェント ─────────────────────────────────────────
  { key: 'manus',    displayName: 'Manus',    trendKeyword: 'Manus AI agent',     tier: 2 },
  { key: 'crewai',   displayName: 'CrewAI',   trendKeyword: 'CrewAI agents',      tier: 2 },
  { key: 'autogen',  displayName: 'AutoGen',  trendKeyword: 'Microsoft AutoGen',  tier: 2 },

  // ── Tier 2: Enterprise AI ────────────────────────────────────────
  { key: 'microsoft-copilot', displayName: 'Microsoft Copilot', trendKeyword: 'Microsoft 365 Copilot', tier: 2 },
  { key: 'notion-ai',         displayName: 'Notion AI',         trendKeyword: 'Notion AI',             tier: 2 },
]

// ─── キーワード定義 ────────────────────────────────────────────────────
// use_for_collection=false の語は Web 検索サジェスト専用（収集フィルタには広すぎる）
const TAG_KEYWORDS = {
  // ── Tier 1 ──────────────────────────────────────────────────────
  llm: [
    { keyword: 'GPT' }, { keyword: 'ChatGPT' }, { keyword: 'Claude' },
    { keyword: 'Gemini' }, { keyword: 'Llama' }, { keyword: 'Mistral' },
    { keyword: 'Grok' }, { keyword: 'Phi' }, { keyword: 'Qwen' },
    { keyword: 'Command' }, { keyword: 'Perplexity' },
    { keyword: 'GPT-4' }, { keyword: 'GPT-5' }, { keyword: 'o1' }, { keyword: 'o3' },
    { keyword: 'OpenAI' }, { keyword: 'Anthropic' }, { keyword: 'DeepMind' },
    { keyword: 'xAI' }, { keyword: 'HuggingFace' }, { keyword: 'Hugging Face' },
    { keyword: 'Cohere' }, { keyword: 'AI21' }, { keyword: 'Inflection' },
    { keyword: 'DeepSeek' }, { keyword: 'Qwen' }, { keyword: 'Gemma' },
    { keyword: 'LLM' }, { keyword: 'transformer' }, { keyword: 'language model' },
    { keyword: 'foundation model' }, { keyword: 'multimodal' },
    { keyword: 'fine-tuning' }, { keyword: 'inference' }, { keyword: 'context window' },
    { keyword: 'machine learning', use_for_collection: false },
    { keyword: 'deep learning', use_for_collection: false },
    { keyword: 'neural network', use_for_collection: false },
    { keyword: 'artificial intelligence', use_for_collection: false },
  ],

  agent: [
    { keyword: 'AI agent' }, { keyword: 'autonomous agent' },
    { keyword: 'multi-agent' }, { keyword: 'agentic' },
    { keyword: 'Manus' }, { keyword: 'AutoGPT' }, { keyword: 'LangChain' },
    { keyword: 'LlamaIndex' }, { keyword: 'CrewAI' }, { keyword: 'AutoGen' },
    { keyword: 'tool use' }, { keyword: 'function calling' },
  ],

  'coding-ai': [
    { keyword: 'Claude' }, { keyword: 'Claude Code' }, { keyword: 'Cursor' },
    { keyword: 'Codex' }, { keyword: 'GitHub Copilot' }, { keyword: 'Copilot' },
    { keyword: 'Windsurf' }, { keyword: 'Cline' }, { keyword: 'Aider' },
    { keyword: 'Devin' }, { keyword: 'RooCode' }, { keyword: 'Antigravity' },
    { keyword: 'Gemini Code Assist' }, { keyword: 'Amazon CodeWhisperer' },
    { keyword: 'Amazon Q' }, { keyword: 'code generation' },
    { keyword: 'coding assistant' }, { keyword: 'code review' },
    { keyword: 'code completion' }, { keyword: 'pair programming' },
  ],

  'enterprise-ai': [
    { keyword: 'Microsoft Copilot' }, { keyword: 'Microsoft 365 Copilot' },
    { keyword: 'Copilot for Work' }, { keyword: 'Claude for Work' },
    { keyword: 'Claude for Teams' }, { keyword: 'Notion AI' },
    { keyword: 'Google Workspace AI' }, { keyword: 'Slack AI' },
    { keyword: 'enterprise AI' }, { keyword: 'AI productivity' },
    { keyword: 'workplace AI' }, { keyword: 'business AI' },
  ],

  'generative-ai': [
    { keyword: 'Midjourney' }, { keyword: 'Stable Diffusion' },
    { keyword: 'DALL-E' }, { keyword: 'Sora' }, { keyword: 'Runway' },
    { keyword: 'Flux' }, { keyword: 'Leonardo AI' }, { keyword: 'Adobe Firefly' },
    { keyword: 'ComfyUI' }, { keyword: 'ControlNet' }, { keyword: 'Imagen' },
    { keyword: 'image generation' }, { keyword: 'video generation' },
    { keyword: 'text-to-image' }, { keyword: 'text-to-video' },
    { keyword: 'diffusion model' }, { keyword: 'generative AI' },
    { keyword: 'Kling' }, { keyword: 'HeyGen' }, { keyword: 'Pika' },
    { keyword: 'Veo' }, { keyword: 'ElevenLabs' }, { keyword: 'Suno' },
  ],

  rag: [
    { keyword: 'RAG' }, { keyword: 'retrieval augmented generation' },
    { keyword: 'embedding' }, { keyword: 'vector database' },
    { keyword: 'vector search' }, { keyword: 'pgvector' },
    { keyword: 'Pinecone' }, { keyword: 'Weaviate' }, { keyword: 'Chroma' },
    { keyword: 'FAISS' }, { keyword: 'knowledge base' }, { keyword: 'semantic search' },
    { keyword: 'LlamaIndex' }, { keyword: 'Dify' },
  ],

  safety: [
    { keyword: 'RLHF' }, { keyword: 'alignment' }, { keyword: 'AI safety' },
    { keyword: 'AI risk' }, { keyword: 'red teaming' }, { keyword: 'jailbreak' },
    { keyword: 'prompt injection' }, { keyword: 'constitutional AI' },
    { keyword: 'guardrails' }, { keyword: 'hallucination' },
  ],

  'voice-ai': [
    { keyword: 'Whisper' }, { keyword: 'voice AI' }, { keyword: 'speech recognition' },
    { keyword: 'TTS' }, { keyword: 'STT' }, { keyword: 'text-to-speech' },
    { keyword: 'speech-to-text' }, { keyword: 'voice assistant' },
    { keyword: 'ElevenLabs' }, { keyword: 'Bark' }, { keyword: 'Suno' },
  ],

  policy: [
    { keyword: 'AI regulation' }, { keyword: 'AI policy' }, { keyword: 'AI governance' },
    { keyword: 'AI law' }, { keyword: 'EU AI Act' }, { keyword: 'AI Act' },
    { keyword: 'AI ethics' }, { keyword: 'responsible AI' }, { keyword: 'AI copyright' },
  ],

  'google-ai': [
    { keyword: 'Google AI' }, { keyword: 'Google DeepMind' }, { keyword: 'Gemini' },
    { keyword: 'Bard' }, { keyword: 'Vertex AI' }, { keyword: 'Google Cloud AI' },
    { keyword: 'TPU' }, { keyword: 'NotebookLM' }, { keyword: 'Imagen' },
    { keyword: 'Veo' }, { keyword: 'Antigravity' },
  ],

  nvidia: [
    { keyword: 'NVIDIA' }, { keyword: 'GPU' }, { keyword: 'CUDA' },
    { keyword: 'H100' }, { keyword: 'A100' }, { keyword: 'GeForce' },
    { keyword: 'RTX' }, { keyword: 'NIM' }, { keyword: 'TensorRT' },
    { keyword: 'Blackwell' }, { keyword: 'Grace Hopper' },
  ],

  // ── Tier 2: モデル ───────────────────────────────────────────────
  claude: [
    { keyword: 'Claude' }, { keyword: 'Claude 3' }, { keyword: 'Claude 4' },
    { keyword: 'Sonnet' }, { keyword: 'Opus' }, { keyword: 'Haiku' },
    { keyword: 'Anthropic Claude' },
  ],

  chatgpt: [
    { keyword: 'ChatGPT' }, { keyword: 'ChatGPT-4' }, { keyword: 'ChatGPT-5' },
    { keyword: 'ChatGPT Plus' }, { keyword: 'ChatGPT Enterprise' },
  ],

  'gpt-5': [
    { keyword: 'GPT-5' }, { keyword: 'GPT-4' }, { keyword: 'GPT-4o' },
    { keyword: 'GPT-5.4' }, { keyword: 'o1' }, { keyword: 'o3' },
    { keyword: 'OpenAI model' },
  ],

  gemini: [
    { keyword: 'Gemini' }, { keyword: 'Gemini Pro' }, { keyword: 'Gemini Flash' },
    { keyword: 'Gemini Ultra' }, { keyword: 'Gemini 2' }, { keyword: 'Gemini 3' },
  ],

  llama: [
    { keyword: 'Llama' }, { keyword: 'Llama 3' }, { keyword: 'Llama 4' },
    { keyword: 'Meta Llama' }, { keyword: 'Llama Scout' }, { keyword: 'Llama Maverick' },
  ],

  mistral: [
    { keyword: 'Mistral' }, { keyword: 'Mixtral' }, { keyword: 'Mistral Large' },
    { keyword: 'Le Chat' },
  ],

  grok: [
    { keyword: 'Grok' }, { keyword: 'Grok 3' }, { keyword: 'Grok 4' },
    { keyword: 'xAI Grok' },
  ],

  deepseek: [
    { keyword: 'DeepSeek' }, { keyword: 'DeepSeek-V3' }, { keyword: 'DeepSeek-R1' },
    { keyword: 'DeepSeek Coder' },
  ],

  qwen: [
    { keyword: 'Qwen' }, { keyword: 'Qwen 2' }, { keyword: 'Qwen 3' },
    { keyword: 'Alibaba Qwen' }, { keyword: 'Qwen-Max' },
  ],

  phi:   [{ keyword: 'Phi' }, { keyword: 'Phi-3' }, { keyword: 'Phi-4' }, { keyword: 'Microsoft Phi' }],
  gemma: [{ keyword: 'Gemma' }, { keyword: 'Gemma 2' }, { keyword: 'Gemma 3' }, { keyword: 'Google Gemma' }],
  o1:    [{ keyword: 'o1' }, { keyword: 'o3' }, { keyword: 'o1-preview' }, { keyword: 'reasoning model' }],

  perplexity: [
    { keyword: 'Perplexity' }, { keyword: 'Perplexity AI' }, { keyword: 'Sonar' },
    { keyword: 'AI search' },
  ],

  // ── Tier 2: コーディングツール ──────────────────────────────────
  cursor: [
    { keyword: 'Cursor' }, { keyword: 'Cursor IDE' }, { keyword: 'Cursor AI' },
    { keyword: 'Cursor editor' },
  ],

  'claude-code': [
    { keyword: 'Claude Code' }, { keyword: 'Claude Code CLI' },
    { keyword: 'Anthropic coding' },
  ],

  antigravity: [
    { keyword: 'Antigravity' }, { keyword: 'Google Antigravity' },
    { keyword: 'antigravity.google' },
  ],

  'github-copilot': [
    { keyword: 'GitHub Copilot' }, { keyword: 'Copilot' },
    { keyword: 'Copilot Chat' }, { keyword: 'Copilot Workspace' },
  ],

  devin: [
    { keyword: 'Devin' }, { keyword: 'Devin AI' }, { keyword: 'Cognition AI' },
    { keyword: 'autonomous coding' },
  ],

  windsurf: [{ keyword: 'Windsurf' }, { keyword: 'Codeium' }, { keyword: 'Windsurf IDE' }],
  cline:    [{ keyword: 'Cline' }, { keyword: 'Cline VS Code' }, { keyword: 'Cline extension' }],
  roocode:  [{ keyword: 'RooCode' }, { keyword: 'Roo Code' }, { keyword: 'RooCode AI' }],
  'amazon-q': [{ keyword: 'Amazon Q' }, { keyword: 'Amazon Q Developer' }, { keyword: 'CodeWhisperer' }],

  // ── Tier 2: 画像・動画・音声 ─────────────────────────────────────
  midjourney:        [{ keyword: 'Midjourney' }, { keyword: 'Midjourney V6' }, { keyword: 'Midjourney V7' }],
  'stable-diffusion':[{ keyword: 'Stable Diffusion' }, { keyword: 'SDXL' }, { keyword: 'SD3' }, { keyword: 'ComfyUI' }],
  'dall-e':          [{ keyword: 'DALL-E' }, { keyword: 'DALL-E 3' }, { keyword: 'GPT Image' }],
  flux:              [{ keyword: 'Flux' }, { keyword: 'Flux AI' }, { keyword: 'Black Forest Labs' }],
  'adobe-firefly':   [{ keyword: 'Adobe Firefly' }, { keyword: 'Firefly' }],
  imagen:            [{ keyword: 'Imagen' }, { keyword: 'Imagen 3' }, { keyword: 'Google Imagen' }],
  sora:              [{ keyword: 'Sora' }, { keyword: 'Sora 2' }, { keyword: 'OpenAI Sora' }],
  runway:            [{ keyword: 'Runway' }, { keyword: 'Runway ML' }, { keyword: 'Gen-4' }, { keyword: 'Gen-3' }],
  kling:             [{ keyword: 'Kling' }, { keyword: 'Kling AI' }, { keyword: 'Kuaishou AI' }],
  heygen:            [{ keyword: 'HeyGen' }, { keyword: 'HeyGen avatar' }, { keyword: 'AI avatar' }],
  pika:              [{ keyword: 'Pika' }, { keyword: 'Pika Labs' }, { keyword: 'Pika AI' }],
  veo:               [{ keyword: 'Veo' }, { keyword: 'Veo 2' }, { keyword: 'Veo 3' }, { keyword: 'Google Veo' }],
  elevenlabs:        [{ keyword: 'ElevenLabs' }, { keyword: 'voice cloning' }, { keyword: 'text to speech AI' }],
  suno:              [{ keyword: 'Suno' }, { keyword: 'Suno AI' }, { keyword: 'Suno music' }],
  udio:              [{ keyword: 'Udio' }, { keyword: 'Udio AI' }, { keyword: 'Udio music' }],
  notebooklm:        [{ keyword: 'NotebookLM' }, { keyword: 'Google NotebookLM' }, { keyword: 'AI podcast' }],

  // ── Tier 2: 企業 ────────────────────────────────────────────────
  openai:          [{ keyword: 'OpenAI' }, { keyword: 'Sam Altman' }],
  anthropic:       [{ keyword: 'Anthropic' }, { keyword: 'Dario Amodei' }],
  'google-deepmind':[{ keyword: 'Google DeepMind' }, { keyword: 'DeepMind' }, { keyword: 'Google Brain' }],
  'meta-ai':       [{ keyword: 'Meta AI' }, { keyword: 'Meta FAIR' }, { keyword: 'Facebook AI' }],
  xai:             [{ keyword: 'xAI' }, { keyword: 'Elon Musk AI' }],
  'mistral-ai':    [{ keyword: 'Mistral AI' }, { keyword: 'Mistral company' }],
  cohere:          [{ keyword: 'Cohere' }, { keyword: 'Command R' }, { keyword: 'Cohere AI' }],
  'stability-ai':  [{ keyword: 'Stability AI' }, { keyword: 'Stable Diffusion company' }],

  // ── Tier 2: プラットフォーム ────────────────────────────────────
  huggingface:  [{ keyword: 'Hugging Face' }, { keyword: 'HuggingFace' }, { keyword: 'HF Hub' }],
  langchain:    [{ keyword: 'LangChain' }, { keyword: 'LangGraph' }, { keyword: 'LangSmith' }],
  llamaindex:   [{ keyword: 'LlamaIndex' }, { keyword: 'LlamaCloud' }, { keyword: 'LlamaParse' }],
  dify:         [{ keyword: 'Dify' }, { keyword: 'Dify AI' }, { keyword: 'ディフィ' }],
  replicate:    [{ keyword: 'Replicate' }, { keyword: 'Replicate AI' }],
  'vercel-ai':  [{ keyword: 'Vercel AI' }, { keyword: 'Vercel AI SDK' }, { keyword: 'AI SDK' }],

  // ── Tier 2: エージェント ────────────────────────────────────────
  manus:    [{ keyword: 'Manus' }, { keyword: 'Manus AI' }, { keyword: 'Manus agent' }],
  crewai:   [{ keyword: 'CrewAI' }, { keyword: 'Crew AI' }, { keyword: 'CrewAI agents' }],
  autogen:  [{ keyword: 'AutoGen' }, { keyword: 'Microsoft AutoGen' }, { keyword: 'AG2' }],

  // ── Tier 2: Enterprise ─────────────────────────────────────────
  'microsoft-copilot': [
    { keyword: 'Microsoft Copilot' }, { keyword: 'Microsoft 365 Copilot' },
    { keyword: 'Copilot for M365' }, { keyword: 'Office AI' },
  ],
  'notion-ai': [
    { keyword: 'Notion AI' }, { keyword: 'Notion AI assistant' },
  ],
}

async function run() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // ── 1. tags_master に全タグを upsert ──────────────────────────
    let tagUpserted = 0
    for (const tag of ALL_TAGS) {
      await client.query(
        `
        INSERT INTO tags_master (tag_key, display_name, trend_keyword, is_active, article_count)
        VALUES ($1, $2, $3, true, 0)
        ON CONFLICT (tag_key) DO UPDATE SET
          display_name  = EXCLUDED.display_name,
          trend_keyword = EXCLUDED.trend_keyword,
          is_active     = EXCLUDED.is_active
        `,
        [tag.key, tag.displayName, tag.trendKeyword],
      )
      tagUpserted++
    }

    // ── 2. tag_keywords に各タグのキーワードを upsert ─────────────
    let kwInserted = 0
    for (const [tagKey, keywords] of Object.entries(TAG_KEYWORDS)) {
      const tagResult = await client.query(
        `SELECT tag_id FROM tags_master WHERE tag_key = $1`,
        [tagKey],
      )

      if (tagResult.rows.length === 0) {
        console.warn(`⚠ tag_key='${tagKey}' が tags_master に見つかりません。スキップします。`)
        continue
      }

      const tagId = tagResult.rows[0].tag_id

      for (const entry of keywords) {
        const useForCollection = entry.use_for_collection ?? true
        const useForSearch = entry.use_for_search ?? true
        const isCaseSensitive = entry.is_case_sensitive ?? false

        await client.query(
          `
          INSERT INTO tag_keywords (tag_id, keyword, use_for_collection, use_for_search, is_case_sensitive)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (tag_id, keyword) DO UPDATE SET
            use_for_collection = EXCLUDED.use_for_collection,
            use_for_search     = EXCLUDED.use_for_search,
            is_case_sensitive  = EXCLUDED.is_case_sensitive
          `,
          [tagId, entry.keyword, useForCollection, useForSearch, isCaseSensitive],
        )
        kwInserted++
      }
    }

    await client.query('COMMIT')

    const totalKw = Object.values(TAG_KEYWORDS).reduce((s, kws) => s + kws.length, 0)
    console.log(`tags_master: ${tagUpserted} タグ upsert 完了`)
    console.log(`tag_keywords: ${totalKw} 件処理 (inserted/updated=${kwInserted})`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
