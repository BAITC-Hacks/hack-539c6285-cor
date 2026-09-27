import { Nav } from './Nav';
import { Hero } from './Hero';
import { Mission } from './Mission';
import { HowItWorks } from './HowItWorks';
import { Features } from './Features';
import { Learn } from './Learn';
import { Tech } from './Tech';
import { Audience } from './Audience';
import { Impact } from './Impact';
import { FAQ } from './FAQ';
import { CTA } from './CTA';
import { LandingFooter } from './LandingFooter';

export type TechName = 'mediapipe' | 'tensorflow' | 'pytorch' | 'opencv';

interface LandingProps {
  isAuthenticated: boolean;
  userInitials?: string;
  userName?: string;
  onOpenTranslator: () => void;
  onOpenRecognizer: () => void;
  onSignIn: () => void;
  onProfile: () => void;
  onNavigateToTech: (tech: TechName) => void;
}

export function Landing({
  isAuthenticated,
  userInitials,
  userName,
  onOpenTranslator,
  onOpenRecognizer,
  onSignIn,
  onProfile,
  onNavigateToTech,
}: LandingProps) {
  const openApp = isAuthenticated ? onOpenTranslator : onSignIn;

  return (
    <div className="qyran-landing">
      <Nav
        isAuthenticated={isAuthenticated}
        userInitials={userInitials}
        userName={userName}
        onOpenApp={openApp}
        onSignIn={onSignIn}
        onProfile={onProfile}
      />
      <main id="main">
        <Hero
          onTryTranslator={openApp}
          onTryRecognizer={isAuthenticated ? onOpenRecognizer : onSignIn}
        />
        <Mission />
        <HowItWorks />
        <Features />
        <Learn onStartPracticing={isAuthenticated ? onOpenRecognizer : onSignIn} />
        <Tech onNavigateToTech={onNavigateToTech} />
        <Audience />
        <Impact />
        <FAQ />
        <CTA onOpenTranslator={openApp} />
      </main>
      <LandingFooter />
    </div>
  );
}
