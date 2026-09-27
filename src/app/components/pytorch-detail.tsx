import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TechDetailPage } from '@/app/components/shared/TechDetailPage';
import { useT } from '@/i18n';

interface Props { onBack: () => void }

const lossCurve = [
  { epoch: 1, loss: 1.42 },
  { epoch: 5, loss: 0.92 },
  { epoch: 10, loss: 0.48 },
  { epoch: 15, loss: 0.27 },
  { epoch: 20, loss: 0.16 },
  { epoch: 25, loss: 0.09 },
];

/** Подписи месяцев на оси — их видит человек, поэтому берём из словаря. */
const datasetGrowth = (t: (key: string) => string) => [
  { month: t('tech.pytorch.month.jan'), samples: 2400 },
  { month: t('tech.pytorch.month.feb'), samples: 5800 },
  { month: t('tech.pytorch.month.mar'), samples: 11200 },
  { month: t('tech.pytorch.month.apr'), samples: 18900 },
  { month: t('tech.pytorch.month.may'), samples: 27600 },
  { month: t('tech.pytorch.month.jun'), samples: 38400 },
];

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-btn)',
  color: 'var(--text)',
  fontFamily: 'Geist Mono, monospace',
  fontSize: 12,
};

const FlameIcon = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c0 4-3 5-3 9 0 3 2 5 3 5s3-2 3-5c0-2-1-3-1-5 0-1.5.5-3 1-4-1 0-3 0-3 0z" />
    <path d="M9 14c-1 1-2 2-2 4 0 2.5 2 4 5 4s5-1.5 5-4c0-2-1-3-2-4-1 1.5-2 2-3 2s-2-.5-3-2z" opacity=".6" />
  </svg>
);

const SmallIcon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

export function PyTorchDetail({ onBack }: Props) {
  const t = useT();

  return (
    <TechDetailPage
      onBack={onBack}
      name="PyTorch"
      tagline={t('tech.pytorch.tagline')}
      badge={t('tech.pytorch.badge')}
      heroIcon={FlameIcon}
      description={t('tech.pytorch.description')}
      features={[
        { title: t('tech.pytorch.f1.title'), description: t('tech.pytorch.f1.desc'), metric: t('tech.pytorch.f1.metric'), icon: <SmallIcon d='<path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9c-2 0-4-.5-5.5-2"/><polyline points="3 12 7 8 11 12"/>' /> },
        { title: t('tech.pytorch.f2.title'), description: t('tech.pytorch.f2.desc'), metric: t('tech.pytorch.f2.metric'), icon: <SmallIcon d='<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h14v14"/>' /> },
        { title: t('tech.pytorch.f3.title'), description: t('tech.pytorch.f3.desc'), metric: t('tech.pytorch.f3.metric'), icon: <SmallIcon d='<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><line x1="12" y1="10" x2="12" y2="14"/>' /> },
        { title: t('tech.pytorch.f4.title'), description: t('tech.pytorch.f4.desc'), metric: t('tech.pytorch.f4.metric'), icon: <SmallIcon d='<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' /> },
      ]}
      primaryMetric={{ value: '0.09', label: t('tech.pytorch.metric.primary') }}
      secondaryMetric={{ value: '38.4K', label: t('tech.pytorch.metric.secondary') }}
      performanceChart={
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lossCurve}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="epoch" stroke="var(--text-mute)" fontSize={11} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="loss" name={t('tech.pytorch.series.loss')} stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      }
      latencyChart={
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datasetGrowth(t)}>
            <defs>
              <linearGradient id="pt-data" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--warm)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--warm)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" stroke="var(--text-mute)" fontSize={11} />
            <YAxis stroke="var(--text-mute)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="samples" name={t('tech.pytorch.series.samples')} stroke="var(--warm)" strokeWidth={2} fill="url(#pt-data)" />
          </AreaChart>
        </ResponsiveContainer>
      }
      codeSnippet={`import torch, torch.nn as nn

class SignTransformer(nn.Module):
    def __init__(self, n_classes=200, d_model=128, nhead=8, n_layers=6):
        super().__init__()
        self.proj = nn.Linear(63, d_model)  # 21 landmarks × 3
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=512,
            dropout=0.1, batch_first=True
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.head = nn.Linear(d_model, n_classes)

    def forward(self, x):
        # x: [B, T, 63] — landmark sequence
        h = self.proj(x)
        h = self.encoder(h)
        return self.head(h.mean(dim=1))`}
      steps={[
        { num: '01', title: t('tech.pytorch.s1.title'), body: t('tech.pytorch.s1.body') },
        { num: '02', title: t('tech.pytorch.s2.title'), body: t('tech.pytorch.s2.body') },
        { num: '03', title: t('tech.pytorch.s3.title'), body: t('tech.pytorch.s3.body') },
      ]}
      outroParagraphs={[
        <>{t('tech.pytorch.outro1')}</>,
        <>
          {t('tech.pytorch.outro2.pre')}
          <span className="grad-text" style={{ fontWeight: 600 }}>{t('tech.pytorch.outro2.hl')}</span>
          {t('tech.pytorch.outro2.post')}
        </>,
      ]}
    />
  );
}
