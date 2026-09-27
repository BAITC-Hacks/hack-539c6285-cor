import { motion } from 'motion/react';
import { Brain, Zap, Globe, Shield, Cpu, Sparkles } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Deep Learning',
    description: 'Advanced neural networks trained on millions of sign language gestures',
    size: 'large',
    gradient: 'from-orange-500 to-amber-500'
  },
  {
    icon: Zap,
    title: 'Real-Time Processing',
    description: 'Sub-50ms latency for seamless communication',
    size: 'small',
    gradient: 'from-yellow-400 to-amber-400'
  },
  {
    icon: Globe,
    title: 'Multi-Language Support',
    description: 'ASL, BSL, and 15+ regional sign languages',
    size: 'small',
    gradient: 'from-red-400 to-orange-400'
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'On-device processing with zero data collection',
    size: 'medium',
    gradient: 'from-orange-500 to-red-400'
  },
  {
    icon: Cpu,
    title: 'Edge Computing',
    description: 'Optimized for mobile and embedded devices',
    size: 'medium',
    gradient: 'from-yellow-400 to-orange-500'
  },
  {
    icon: Sparkles,
    title: 'Continuous Learning',
    description: 'AI model improves with every interaction',
    size: 'small',
    gradient: 'from-amber-500 to-orange-500'
  }
];

export function BentoFeatures() {
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-black/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Powered by Advanced AI
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Cutting-edge technology meets human-centered design
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[200px]">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const gridClass =
              feature.size === 'large' ? 'md:col-span-2 md:row-span-2' :
              feature.size === 'medium' ? 'md:col-span-1 md:row-span-2' :
              'md:col-span-1 md:row-span-1';

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`group relative ${gridClass}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl blur-xl`} />

                <div className="relative h-full p-6 rounded-2xl bg-gradient-to-br from-black/50 to-black/70 border border-orange-500/20 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-orange-400/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] flex flex-col">
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(249, 115, 22, 0.15) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(249, 115, 22, 0.15) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                  }} />

                  <div className={`relative mb-4 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-black" />
                  </div>

                  <h3 className="relative text-xl font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className={`relative text-gray-400 ${feature.size === 'large' ? 'text-lg' : 'text-sm'}`}>
                    {feature.description}
                  </p>

                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
