import { AnimatedShaderHero } from '@/app/components/ui/animated-shader-hero';

export function QyranHero({ onTranslate, onRecognize }: { onTranslate?: () => void; onRecognize?: () => void }) {
  return (
    <AnimatedShaderHero
      trustBadge={{
        icon: '✨',
        text: 'AI-Powered Sign Language Recognition',
      }}
      headline={{
        line1: 'Qyran',
        line2: 'Sign Language AI',
      }}
      subtitle="Breaking communication barriers with cutting-edge AI. Real-time sign language recognition for a more inclusive world."
      buttons={{
        primary: {
          text: 'Speech to Sign Language →',
          onClick: onTranslate,
        },
        secondary: {
          text: 'Sign Language to Speech →',
          onClick: onRecognize,
        },
      }}
      stats={[
        { value: '99.2%', label: 'Accuracy' },
        { value: '<50ms', label: 'Latency' },
        { value: '200+', label: 'Signs' },
      ]}
    />
  );
}
