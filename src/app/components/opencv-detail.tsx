import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TechDetailPage } from '@/app/components/shared/TechDetailPage';
import { useT } from '@/i18n';

interface Props { onBack: () => void }

/** Названия ступеней конвейера — подписи оси, их читает человек. */
const noiseReduction = (t: (key: string) => string) => [
  { stage: t('tech.opencv.stage.raw'), noise: 100 },
  { stage: t('tech.opencv.stage.crop'), noise: 72 },
  { stage: t('tech.opencv.stage.norm'), noise: 45 },
  { stage: t('tech.opencv.stage.smooth'), noise: 18 },
  { stage: t('tech.opencv.stage.out'), noise: 8 },
];

const fpsByDevice = (t: (key: string) => string) => [
  { device: 'iPhone 14', fps: 60 },
  { device: 'Pixel 7', fps: 58 },
  { device: t('tech.opencv.device.midAndroid'), fps: 42 },
  { device: t('tech.opencv.device.oldAndroid'), fps: 30 },
];

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-btn)',
  color: 'var(--text)',
  fontFamily: 'Geist Mono, monospace',
  fontSize: 12,
};

const CamIcon = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="14" height="12" rx="2" />
    <path d="M17 10l4-2v8l-4-2" />
  </svg>
);

const SmallIcon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

export function OpenCVDetail({ onBack }: Props) {
  const t = useT();

  return (
    <TechDetailPage
      onBack={onBack}
      name="OpenCV"
      tagline={t('tech.opencv.tagline')}
      badge={t('tech.opencv.badge')}
      heroIcon={CamIcon}
      description={t('tech.opencv.description')}
      features={[
        { title: t('tech.opencv.f1.title'), description: t('tech.opencv.f1.desc'), metric: t('tech.opencv.f1.metric'), icon: <SmallIcon d='<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8"/>' /> },
        { title: t('tech.opencv.f2.title'), description: t('tech.opencv.f2.desc'), metric: t('tech.opencv.f2.metric'), icon: <SmallIcon d='<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' /> },
        { title: t('tech.opencv.f3.title'), description: t('tech.opencv.f3.desc'), metric: t('tech.opencv.f3.metric'), icon: <SmallIcon d='<path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9c-2 0-4-.5-5.5-2"/>' /> },
        { title: t('tech.opencv.f4.title'), description: t('tech.opencv.f4.desc'), metric: t('tech.opencv.f4.metric'), icon: <SmallIcon d='<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="none"/>' /> },
      ]}
      primaryMetric={{ value: '92%', label: t('tech.opencv.metric.primary') }}
      secondaryMetric={{ value: '60 FPS', label: t('tech.opencv.metric.secondary') }}
      performanceChart={
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={noiseReduction(t)}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="stage" stroke="var(--text-mute)" fontSize={11} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="noise" name={t('tech.opencv.series.noise')} fill="var(--accent)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      }
      latencyChart={
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={fpsByDevice(t)}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="device" stroke="var(--text-mute)" fontSize={10} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="fps" name="FPS" stroke="var(--warm)" strokeWidth={2.5} dot={{ fill: 'var(--warm)', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      }
      codeSnippet={`import cv2
import numpy as np

def preprocess(frame, hand_bbox):
    # 1) Crop to hand bounding box, with 10% padding
    x, y, w, h = hand_bbox
    pad = int(0.1 * max(w, h))
    crop = frame[max(0, y-pad):y+h+pad, max(0, x-pad):x+w+pad]

    # 2) Normalise lighting via CLAHE
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[..., 0] = clahe.apply(lab[..., 0])
    norm = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 3) Light gaussian blur, then bilateral to keep edges sharp
    smoothed = cv2.bilateralFilter(norm, d=5, sigmaColor=50, sigmaSpace=50)

    # 4) Resize to model input
    return cv2.resize(smoothed, (224, 224))`}
      steps={[
        { num: '01', title: t('tech.opencv.s1.title'), body: t('tech.opencv.s1.body') },
        { num: '02', title: t('tech.opencv.s2.title'), body: t('tech.opencv.s2.body') },
        { num: '03', title: t('tech.opencv.s3.title'), body: t('tech.opencv.s3.body') },
      ]}
      outroParagraphs={[
        <>{t('tech.opencv.outro1')}</>,
        <>
          {t('tech.opencv.outro2.pre')}
          <span className="grad-text" style={{ fontWeight: 600 }}>{t('tech.opencv.outro2.hl')}</span>
          {t('tech.opencv.outro2.post')}
        </>,
      ]}
    />
  );
}
