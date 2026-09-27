import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TechDetailPage } from '@/app/components/shared/TechDetailPage';
import { useT } from '@/i18n';

interface Props { onBack: () => void }

const performanceData = [
  { time: '0ms', accuracy: 0 },
  { time: '10ms', accuracy: 75 },
  { time: '20ms', accuracy: 87 },
  { time: '30ms', accuracy: 92 },
  { time: '40ms', accuracy: 96 },
  { time: '50ms', accuracy: 98 },
];

const latencyData = [
  { frame: 1, latency: 45 },
  { frame: 2, latency: 38 },
  { frame: 3, latency: 42 },
  { frame: 4, latency: 35 },
  { frame: 5, latency: 40 },
  { frame: 6, latency: 37 },
];

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-btn)',
  color: 'var(--text)',
  fontFamily: 'Geist Mono, monospace',
  fontSize: 12,
};

const HandIcon = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" /><path d="M15 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1.2a4 4 0 0 1-3.6-2.2L5 14a1.4 1.4 0 0 1 2.4-1.4L9 14V7a1.5 1.5 0 0 1 3 0" />
  </svg>
);

const SmallIcon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

export function MediaPipeDetail({ onBack }: Props) {
  const t = useT();

  return (
    <TechDetailPage
      onBack={onBack}
      name="MediaPipe"
      tagline={t('tech.mediapipe.tagline')}
      badge={t('tech.mediapipe.badge')}
      heroIcon={HandIcon}
      description={t('tech.mediapipe.description')}
      features={[
        { title: t('tech.mediapipe.f1.title'), description: t('tech.mediapipe.f1.desc'), metric: t('tech.mediapipe.f1.metric'), icon: <SmallIcon d='<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1.2a4 4 0 0 1-3.6-2.2L5 14a1.4 1.4 0 0 1 2.4-1.4L9 14V7a1.5 1.5 0 0 1 3 0"/>' /> },
        { title: t('tech.mediapipe.f2.title'), description: t('tech.mediapipe.f2.desc'), metric: t('tech.mediapipe.f2.metric'), icon: <SmallIcon d='<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2"/>' /> },
        { title: t('tech.mediapipe.f3.title'), description: t('tech.mediapipe.f3.desc'), metric: t('tech.mediapipe.f3.metric'), icon: <SmallIcon d='<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/>' /> },
        { title: t('tech.mediapipe.f4.title'), description: t('tech.mediapipe.f4.desc'), metric: t('tech.mediapipe.f4.metric'), icon: <SmallIcon d='<circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="22"/><path d="M2 12h20"/>' /> },
      ]}
      primaryMetric={{ value: '98%', label: t('tech.mediapipe.metric.primary') }}
      secondaryMetric={{ value: '37ms', label: t('tech.mediapipe.metric.secondary') }}
      performanceChart={
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={performanceData}>
            <defs>
              <linearGradient id="mp-perf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" stroke="var(--text-mute)" fontSize={11} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="accuracy" name={t('tech.mediapipe.series.accuracy')} stroke="var(--accent)" strokeWidth={2} fill="url(#mp-perf)" />
          </AreaChart>
        </ResponsiveContainer>
      }
      latencyChart={
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={latencyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="frame" stroke="var(--text-mute)" fontSize={11} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="latency" name={t('tech.mediapipe.series.latency')} stroke="var(--warm)" strokeWidth={2.5} dot={{ fill: 'var(--warm)', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      }
      codeSnippet={`import mediapipe as mp
import cv2

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5
)

# Process video frame
def process_frame(frame):
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb_frame)

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            landmarks = hand_landmarks.landmark
            gesture = qyran_model.predict(landmarks)
    return gesture`}
      steps={[
        { num: '01', title: t('tech.mediapipe.s1.title'), body: t('tech.mediapipe.s1.body') },
        { num: '02', title: t('tech.mediapipe.s2.title'), body: t('tech.mediapipe.s2.body') },
        { num: '03', title: t('tech.mediapipe.s3.title'), body: t('tech.mediapipe.s3.body') },
      ]}
      outroParagraphs={[
        <>
          {t('tech.mediapipe.outro1.pre')}
          <span className="grad-text" style={{ fontWeight: 600 }}>{t('tech.mediapipe.outro1.hl')}</span>
          {t('tech.mediapipe.outro1.post')}
        </>,
        <>
          {t('tech.mediapipe.outro2.pre')}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('tech.mediapipe.outro2.hl')}</span>
          {t('tech.mediapipe.outro2.post')}
        </>,
        <>
          {t('tech.mediapipe.outro3.pre')}
          <span className="grad-text" style={{ fontWeight: 600 }}>{t('tech.mediapipe.outro3.hl')}</span>
          {t('tech.mediapipe.outro3.post')}
        </>,
      ]}
    />
  );
}
