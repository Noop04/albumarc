# Albumarc

Substack for album-first music discovery communities.

## AI-Powered Album Recommendations

Albumarc leverages AI to provide album recommendations based on community trends. Discover new music tailored to what the community is listening to and discussing, powered by intelligent algorithms that surface trending albums and hidden gems.

## Technical Details: AI-Powered Recommendation System

The album recommendation system is designed to surface trending albums based on community listening and discussion patterns. Here’s how it works:

- **API Endpoint:**
  - The `/api/recommend` endpoint (see `src/app/api/recommend/route.ts`) provides album recommendations.
  - Currently, it returns a mock list of trending albums, simulating AI-driven community trend analysis.
  - The endpoint responds with a JSON object containing recommended albums, artists, and a community score.

- **Recommendation Logic:**
  - The backend uses a placeholder array (`mockCommunityTrends`) to represent albums trending in the community.
  - In a production system, this would be replaced by a machine learning model or integration with external APIs to analyze real user activity and community discussions.

- **Frontend Integration:**
  - The main page (`src/app/page.tsx`) fetches recommendations from `/api/recommend` and displays them in a styled card list.
  - Users can interact with recommendations (e.g., rate albums), and the UI updates accordingly.

- **Extensibility:**
  - The system is structured to allow easy replacement of the mock logic with real AI/ML models or data sources in the future.
  - Potential enhancements include personalized recommendations, collaborative filtering, and real-time trend analysis.

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [Shadcn UI](https://ui.shadcn.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

- `src/app/page.tsx` - Main page
- `src/app/layout.tsx` - Root layout
- `src/components/ui/` - Shadcn UI components
- `src/lib/utils.ts` - Utility functions
