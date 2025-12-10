# Domain Generator

AI-powered domain name generator with availability checking. Uses Gemini AI to generate creative domain names and WHOIS protocol to check availability.

## Architecture

```
Frontend (Next.js/Vercel) → AWS API Gateway → Lambda → WHOIS Servers
       ↓
   Gemini API
```

## Project Structure

```
domain-generator/
├── frontend/           # Next.js app (deploy to Vercel)
│   ├── src/
│   │   ├── app/       # Next.js app router pages
│   │   ├── components/ # React components
│   │   └── lib/       # API clients (Gemini, WHOIS)
│   └── .env.local     # Environment variables
│
└── backend/           # AWS Lambda (deploy with CloudFormation)
    ├── src/handlers/  # Lambda function code
    └── cloudformation.yaml
```

## Setup

### 1. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Edit `.env.local` and add your Gemini API key:
```
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here
NEXT_PUBLIC_WHOIS_API_URL=  # Add after deploying backend
```

Run locally:
```bash
npm run dev
```

### 2. Backend Setup

```bash
cd backend
npm install
npm run build
```

### 3. Deploy Backend to AWS

Build and package the Lambda:
```bash
cd backend
npm run build
cd dist && zip -r ../function.zip . && cd ..
```

Create an S3 bucket for the Lambda code:
```bash
aws s3 mb s3://domain-generator-lambda-code
aws s3 cp function.zip s3://domain-generator-lambda-code/
```

Update `cloudformation.yaml` to use S3 instead of inline code:
```yaml
# In WhoisLookupFunction, replace ZipFile with:
Code:
  S3Bucket: domain-generator-lambda-code
  S3Key: function.zip
```

Deploy:
```bash
aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name domain-generator-api \
  --capabilities CAPABILITY_IAM
```

Get the API URL:
```bash
aws cloudformation describe-stacks \
  --stack-name domain-generator-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

### 4. Update Frontend Environment

Add the API Gateway URL to frontend `.env.local`:
```
NEXT_PUBLIC_WHOIS_API_URL=https://xxx.execute-api.region.amazonaws.com/prod/whois
```

### 5. Deploy Frontend to Vercel

```bash
cd frontend
vercel
```

Or connect your Git repository to Vercel for automatic deployments.

Add environment variables in Vercel dashboard:
- `NEXT_PUBLIC_GEMINI_API_KEY`
- `NEXT_PUBLIC_WHOIS_API_URL`

## Features

- AI-generated domain names using Gemini
- Real-time WHOIS availability checking
- Selectable TLDs (.com, .net, .org, .io, .ai, .dev, .app, .co, .xyz, .tech)
- Dark theme UI inspired by Instant Domain Search
- Responsive design

## Development

### Frontend
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run linter
```

### Backend
```bash
cd backend
npm run build    # Compile TypeScript
npm run package  # Build and create zip for Lambda
```

## API

### GET /whois

Check domain availability.

Query parameters:
- `domain` (required): Full domain name (e.g., `example.com`)

Response:
```json
{
  "domain": "example.com",
  "available": false
}
```

Supported TLDs: .com, .net, .org, .io, .ai, .dev, .app, .co, .xyz, .tech
