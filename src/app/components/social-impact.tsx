import { motion } from 'motion/react';
import { Users, Heart, GraduationCap, Briefcase, Lightbulb, TrendingUp } from 'lucide-react';

const impacts = [
  { icon: Users, title: '70M+ People', description: 'Deaf individuals worldwide who can benefit', color: '#f97316' },
  { icon: Heart, title: 'Inclusion', description: 'Breaking down communication barriers', color: '#fbbf24' },
  { icon: GraduationCap, title: 'Education', description: 'Enhanced learning for deaf students', color: '#f59e0b' },
  { icon: Briefcase, title: 'Employment', description: 'Workplace accessibility and opportunities', color: '#f97316' },
  { icon: Lightbulb, title: 'Innovation', description: 'Pioneering accessible AI technology', color: '#fbbf24' },
  { icon: TrendingUp, title: 'Growth', description: 'Expanding sign language recognition globally', color: '#ef4444' }
];

export function SocialImpact({ onNavigateToTech }: { onNavigateToTech?: (tech: string) => void }) {
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-black/40">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-orange-500 rounded-full blur-[200px] opacity-10" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-300/30 backdrop-blur-sm mb-6">
            <Heart className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400">Making a Difference</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Social Impact & Vision
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Technology that empowers communities and creates meaningful change
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {impacts.map((impact, index) => {
            const Icon = impact.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative"
              >
                <div className="relative p-6 rounded-2xl bg-gradient-to-br from-black/50 to-black/70 border border-orange-500/20 backdrop-blur-sm hover:border-orange-400/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] h-full">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="mb-4 w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-yellow-400/10 border border-orange-500/30 flex items-center justify-center"
                  >
                    <Icon className="w-7 h-7" style={{ color: impact.color }} />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">{impact.title}</h3>
                  <p className="text-gray-400">{impact.description}</p>
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-yellow-400/20 rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative p-8 rounded-2xl bg-gradient-to-br from-black/50 to-black/70 border-2 border-orange-500/50 shadow-[0_0_50px_rgba(249,115,22,0.2)]"
        >
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-white mb-3">Technology Stack</h3>
            <p className="text-gray-400">Built with state-of-the-art machine learning frameworks</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'TensorFlow', desc: 'Neural Networks', id: 'tensorflow' },
              { name: 'MediaPipe', desc: 'Hand Tracking', id: 'mediapipe' },
              { name: 'PyTorch', desc: 'Model Training', id: 'pytorch' },
              { name: 'OpenCV', desc: 'Computer Vision', id: 'opencv' }
            ].map((tech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                onClick={() => onNavigateToTech?.(tech.id)}
                className="relative p-4 rounded-xl bg-black/40/50 border border-orange-500/30 text-center group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                <div className="relative">
                  <div className="text-lg font-bold text-white mb-1">{tech.name}</div>
                  <div className="text-xs text-gray-400">{tech.desc}</div>
                  <div className="mt-2 text-xs text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Learn more →
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
