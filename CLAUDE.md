# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered domain name generator using Gemini AI with real-time availability checking via DNS/RDAP.

**Architecture:** Next.js frontend (Vercel) → API Gateway → Lambda functions → DNS/RDAP + DynamoDB

## Development Commands

### Frontend (`/frontend`)
```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint with Next.js core web vitals
```

### Backend (`/backend`)
```bash
npm run build              # Compile TypeScript to dist/
npm run package            # Build + create function.zip for Lambda deployment
npm run deploy             # Deploy CloudFormation stack to AWS
npm run seed-prompts       # Load prompts from example prompts.txt to DynamoDB
npm run seed-prompts:clear # Clear and reseed DynamoDB prompts table
```

## Architecture

### Frontend (Next.js 16 / React 19)
- `src/app/page.tsx` - Main client component: generates 15 names/batch (max 5 batches), parallel availability checking
- `src/app/api/generate/` - POST endpoint wrapping Gemini API for domain name generation
- `src/app/api/placeholder-prompts/` - GET endpoint for UI prompt suggestions
- `src/components/` - SearchBar, TldSelector, DomainCard, DomainList
- `src/lib/gemini.ts` - Gemini API wrapper
- `src/lib/whois.ts` - WHOIS API client (calls backend Lambda)

### Backend (Node.js 20 Lambda)
- `src/handlers/whois.ts` - Two-stage availability check: fast DNS (NS record) then RDAP confirmation
- `src/handlers/prompts.ts` - Fetch random prompts from DynamoDB
- `scripts/seed-prompts.ts` - Seed DynamoDB from `example prompts.txt`
- `cloudformation.yaml` - Full IaC: Lambda, API Gateway, DynamoDB, IAM roles

### Supported TLDs
.com, .net, .org, .io, .ai, .dev, .app, .co, .xyz, .tech

## Key Patterns

- **Path aliases**: `@/*` maps to `src/*` in frontend
- **TypeScript targets**: Frontend ES2017/esnext, Backend ES2020/commonjs
- **Styling**: Tailwind CSS 4 (utility classes only)
- **Environment variables**:
  - Frontend: `NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_WHOIS_API_URL`
  - Backend: `PROMPTS_TABLE`, `GEMINI_API_KEY`

## Deployment

- **Frontend**: Auto-deploys to Vercel on push to main
- **Backend**: Run `npm run package` then `npm run deploy` to update Lambda via CloudFormation
