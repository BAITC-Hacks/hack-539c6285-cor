import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TechDetailPage } from '@/app/components/shared/TechDetailPage';
import { useT } from '@/i18n';

interface Props { onBack: () => void }

const accuracyOverEpochs = [
  { epoch: 1, train: 62, val: 58 },
  { epoch: 5, train: 78, val: 74 },
  { epoch: 10, train: 88, val: 85 },
  { epoch: 15, train: 93, val: 90 },
  { epoch: 20, train: 96, val: 94 },
  { epoch: 25, train: 98, val: 96 },
];

/** Подписи устройств переводимы только там, где это слово, а не название модели. */
const inferenceMs = (t: (key: string) => string) => [
  { device: 'iPhone 14', ms: 18 },
  { device: 'Pixel 7', ms: 22 },
  { device: 'M2 Mac', ms: 9 },
  { device: t('tech.tensorflow.device.desktop'), ms: 7 },
];

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-btn)',
  color: 'var(--text)',
  fontFamily: 'Geist Mono, monospace',
  fontSize: 12,
};

const TFIcon = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z" opacity=".55" />
    <path d="M6.5 6.5h1v1h-1zm0 11h1v1h-1zm11-11h1v1h-1zm0 11h1v1h-1z" />
  </svg>
);

const SmallIcon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

export function TensorFlowDetail({ onBack }: Props) {
  const t = useT();

  return (
    <TechDetailPage
      onBack={onBack}
      name="TensorFlow.js"
      tagline={t('tech.tensorflow.tagline')}
      badge={t('tech.tensorflow.badge')}
      heroIcon={TFIcon}
      description={t('tech.tensorflow.description')}
      features={[
        { title: t('tech.tensorflow.f1.title'), description: t('tech.tensorflow.f1.desc'), metric: t('tech.tensorflow.f1.metric'), icon: <SmallIcon d='<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/>' /> },
        { title: t('tech.tensorflow.f2.title'), description: t('tech.tensorflow.f2.desc'), metric: t('tech.tensorflow.f2.metric'), icon: <SmallIcon d='<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' /> },
        { title: t('tech.tensorflow.f3.title'), description: t('tech.tensorflow.f3.desc'), metric: t('tech.tensorflow.f3.metric'), icon: <SmallIcon d='<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="none"/>' /> },
        { title: t('tech.tensorflow.f4.title'), description: t('tech.tensorflow.f4.desc'), metric: t('tech.tensorflow.f4.metric'), icon: <SmallIcon d='<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/>' /> },
      ]}
      primaryMetric={{ value: '96%', label: t('tech.tensorflow.metric.primary') }}
      secondaryMetric={{ value: '14ms', label: t('tech.tensorflow.metric.secondary') }}
      performanceChart={
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={accuracyOverEpochs}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="epoch" stroke="var(--text-mute)" fontSize={11} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="train" name={t('tech.tensorflow.series.train')} stroke="var(--accent)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="val" name={t('tech.tensorflow.series.val')} stroke="var(--warm)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      }
      latencyChart={
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={inferenceMs(t)}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="device" stroke="var(--text-mute)" fontSize={10} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="ms" name={t('tech.tensorflow.series.ms')} fill="var(--accent)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      }
      codeSnippet={`import * as tf from '@tensorflow/tfjs';

// Load the quantised sign classifier
const model = await tf.loadGraphModel(
  '/models/sign_classifier_int8/model.json'
);

// Predict from MediaPipe landmarks
function classifySign(landmarks /* Float32Array(63) */) {
  const input = tf.tensor(landmarks).reshape([1, 21, 3]);
  const logits = model.predict(input);
  const probs = tf.softmax(logits);
  const top = probs.argMax(-1).dataSync()[0];

  input.dispose();
  logits.dispose();
  probs.dispose();
  return SIGN_LABELS[top];
}`}
      steps={[
        { num: '01', title: t('tech.tensorflow.s1.title'), body: t('tech.tensorflow.s1.body') },
        { num: '02', title: t('tech.tensorflow.s2.title'), body: t('tech.tensorflow.s2.body') },
        { num: '03', title: t('tech.tensorflow.s3.title'), body: t('tech.tensorflow.s3.body') },
      ]}
      outroParagraphs={[
        <>
          {t('tech.tensorflow.outro1.pre')}
          <span className="grad-text" style={{ fontWeight: 600 }}>{t('tech.tensorflow.outro1.hl')}</span>
          {t('tech.tensorflow.outro1.post')}
        </>,
        <>{t('tech.tensorflow.outro2')}</>,
      ]}
    />
  );
}
