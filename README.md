# JayT Nova Defense (JayT 新星防御)

A classic Missile Command style tower defense game built with React, Tailwind CSS, and Canvas API.

## Features
- **Defend Cities**: Protect your 6 cities and 3 missile batteries from incoming enemy rockets.
- **Resource Management**: Each battery has limited ammo. Use it wisely!
- **Cool Visuals**: Sci-fi turret designs, glowing missile trails, pulsing explosions, and a dynamic starfield background.
- **Bilingual Support**: Toggle between English and Chinese.
- **Responsive Design**: Playable on both desktop and mobile devices.

## Tech Stack
- **Framework**: React 19
- **Styling**: Tailwind CSS 4
- **Animations**: Motion (formerly Framer Motion)
- **Icons**: Lucide React
- **Rendering**: HTML5 Canvas API

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/jayt-nova-defense.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Deployment to Vercel
1. Push your code to a GitHub repository.
2. Connect your repository to [Vercel](https://vercel.com).
3. Vercel will automatically detect the Vite configuration and deploy your app.

## How to Play
- **Aim**: Click or touch anywhere on the screen to launch an interceptor missile.
- **Explosions**: Interceptors create explosions that destroy any enemy rockets they touch.
- **Prediction**: Enemy rockets move constantly, so aim where they *will be*, not where they are.
- **Winning**: Reach 500 points to win.
- **Losing**: If all 3 batteries are destroyed, the game is over.

## License
Apache-2.0
