import { MediaPipeDetail } from '@/app/components/mediapipe-detail';
import { TensorFlowDetail } from '@/app/components/tensorflow-detail';
import { PyTorchDetail } from '@/app/components/pytorch-detail';
import { OpenCVDetail } from '@/app/components/opencv-detail';
import { AuthLayout } from '@/app/components/auth/AuthLayout';
import { SignInForm } from '@/app/components/auth/SignInForm';
import { SignUpForm } from '@/app/components/auth/SignUpForm';
import { ProfilePage } from '@/app/components/ProfilePage';
import { TranslatorPage } from '@/app/components/TranslatorPage';
import { DictionaryPage } from '@/app/components/DictionaryPage';
import { AslLabPage } from '@/app/components/AslLabPage';
import { RecognizerPage } from '@/app/components/RecognizerPage';
import { StudioPage } from '@/app/components/StudioPage';
import { TsonPage } from '@/app/components/TsonPage';
import { Landing } from '@/app/components/landing/Landing';
import { canRecordGestures } from '@/lib/studioAccess';
import { ThemeProvider } from '@/app/context/ThemeContext';
import { I18nProvider, useT } from '@/i18n';
import { AuthProvider, useAuth } from '@/app/context/AuthContext';
import { useState } from 'react';

type View = 'home' | 'mediapipe' | 'tensorflow' | 'pytorch' | 'opencv' | 'signin' | 'signup' | 'profile' | 'translator' | 'recognizer' | 'studio' | 'dictionary' | 'asl' | 'tson';

/** Dev-only: /?view=translator|recognizer|studio выбирает СТАРТОВЫЙ экран. */
function initialView(): View {
  const v = new URLSearchParams(window.location.search).get('view');
  // Публичные страницы-витрины, доступны по прямой ссылке и в проде.
  if (v === 'dictionary') return 'dictionary';
  if (v === 'asl') return 'asl';
  if (v === 'tson') return 'tson';
  if (!import.meta.env.DEV) return 'home';
  return v === 'translator' || v === 'recognizer' || v === 'studio' ? v : 'home';
}

function AppContent() {
  const { user, loading } = useAuth();
  const t = useT();
  const [currentView, setCurrentView] = useState<View>(initialView);
  /** Студия записи жестов открыта не всем — см. src/lib/studioAccess.ts. */
  const mayRecord = canRecordGestures(user);

  // Loading splash
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--grad-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 22,
              color: 'var(--bg)',
              letterSpacing: '-0.04em',
            }}
          >
            Q
          </div>
          <div style={{ width: 140, height: 3, background: 'color-mix(in srgb, var(--text) 10%, transparent)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: '40%',
                background: 'var(--grad-brand)',
                borderRadius: 'var(--r-pill)',
                animation: 'qa-load 1.2s ease-in-out infinite',
              }}
            />
          </div>
          <style>{`@keyframes qa-load { 0%,100% { transform: translateX(-100%); } 50% { transform: translateX(250%); } }`}</style>
        </div>
      </div>
    );
  }

  // Dev-only: рабочие экраны доступны без входа, но навигация между ними
  // обычная — стартовый экран задаётся через ?view=... в initialView().
  //
  // Студия здесь тоже открыта — это удобно при разработке и в собранный сайт
  // не попадает: import.meta.env.DEV в проде равен false, и весь блок
  // выбрасывается сборщиком. В проде студию пускает только список почт.
  if (import.meta.env.DEV && !user) {
    if (currentView === 'translator') {
      return (
        <TranslatorPage
          onBack={() => setCurrentView('home')}
          onSwitchToRecognizer={() => setCurrentView('recognizer')}
          onOpenStudio={() => setCurrentView('studio')}
          onOpenDictionary={() => setCurrentView('dictionary')}
        />
      );
    }
    if (currentView === 'recognizer') {
      return <RecognizerPage onBack={() => setCurrentView('home')} />;
    }
    if (currentView === 'studio') {
      return <StudioPage onBack={() => setCurrentView('home')} />;
    }
  }

  // Словарь жестов публичный: витрина корпуса, логин не нужен.
  if (currentView === 'dictionary') {
    return <DictionaryPage onBack={() => setCurrentView('home')} />;
  }

  // Окно ЦОН — публичный экран для окна госуслуг: оператор ↔ глухой гражданин, только проверенные жесты.
  if (currentView === 'tson') {
    return <TsonPage onBack={() => setCurrentView('home')} />;
  }

  // Лаборатория ASL-дактиля — публичный стенд «показал букву — увидел строку».
  if (currentView === 'asl') {
    return <AslLabPage onBack={() => setCurrentView('home')} />;
  }

  // Not authenticated
  if (!user) {
    if (currentView === 'signup') {
      return (
        <AuthLayout
          title={t('account.signUp.title')}
          subtitle={t('account.signUp.eyebrow')}
          onBack={() => setCurrentView('home')}
        >
          <SignUpForm onSignIn={() => setCurrentView('signin')} />
        </AuthLayout>
      );
    }

    if (currentView === 'signin') {
      return (
        <AuthLayout
          title={t('account.signIn.title')}
          subtitle={t('account.signIn.eyebrow')}
          onBack={() => setCurrentView('home')}
        >
          <SignInForm onSignUp={() => setCurrentView('signup')} />
        </AuthLayout>
      );
    }

    return (
      <Landing
        isAuthenticated={false}
        onOpenTranslator={() => setCurrentView('signin')}
        onOpenRecognizer={() => setCurrentView('signin')}
        onSignIn={() => setCurrentView('signin')}
        onProfile={() => setCurrentView('signin')}
        onNavigateToTech={(tech) => setCurrentView(tech)}
      />
    );
  }

  // Authenticated views
  if (currentView === 'translator') {
    return (
      <TranslatorPage
        onBack={() => setCurrentView('home')}
        onSwitchToRecognizer={() => setCurrentView('recognizer')}
        // Кнопки «Записать жест» просто нет у тех, кому студия не открыта.
        onOpenStudio={mayRecord ? () => setCurrentView('studio') : undefined}
        onOpenDictionary={() => setCurrentView('dictionary')}
      />
    );
  }

  if (currentView === 'recognizer') {
    return <RecognizerPage onBack={() => setCurrentView('home')} />;
  }

  // Ссылку можно набрать руками, поэтому доступ проверяется и на самом экране.
  // Кому нельзя — проваливается дальше, на обычную главную.
  if (currentView === 'studio' && mayRecord) {
    return <StudioPage onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'profile') {
    return <ProfilePage onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'mediapipe') {
    return <MediaPipeDetail onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'tensorflow') {
    return <TensorFlowDetail onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'pytorch') {
    return <PyTorchDetail onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'opencv') {
    return <OpenCVDetail onBack={() => setCurrentView('home')} />;
  }

  // Authenticated home — Landing
  const fullName = user.user_metadata?.full_name || 'User';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Landing
      isAuthenticated
      userInitials={initials}
      userName={fullName}
      onOpenTranslator={() => setCurrentView('translator')}
      onOpenRecognizer={() => setCurrentView('recognizer')}
      onSignIn={() => setCurrentView('signin')}
      onProfile={() => setCurrentView('profile')}
      onNavigateToTech={(tech) => setCurrentView(tech)}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
