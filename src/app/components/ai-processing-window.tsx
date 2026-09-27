import { motion } from 'motion/react';
import { Video, Zap, CheckCircle2, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

const signs = ['Hello', 'Thank You', 'Please', 'Yes', 'Help'];

export function AIProcessingWindow() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedSign, setDetectedSign] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setIsProcessing(true);
      setTimeout(() => {
        setDetectedSign(signs[Math.floor(Math.random() * signs.length)]);
        setIsProcessing(false);
      }, 800);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-black/40">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Real-Time AI Processing
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Watch our neural network recognize sign language in milliseconds
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Main processing window */}
          <div className="relative rounded-2xl border-2 border-orange-500/50 bg-gradient-to-br from-black/50 to-black/60 p-1 shadow-[0_0_50px_rgba(249,115,22,0.3)]">
            <div className="rounded-xl bg-black/40 overflow-hidden">
              {/* Window header */}
              <div className="flex items-center justify-between p-4 border-b border-orange-500/30 bg-gradient-to-r from-black/50 to-black/60">
                <div className="flex items-center gap-3">
                  <Video className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-semibold text-white">Live Recognition</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                </div>
              </div>

              {/* Video mockup */}
              <div className="relative aspect-video bg-gradient-to-br from-black/50 to-black/60 p-8">
                <div className="absolute inset-0 flex items-center justify-center">
                  <img 
                    src="https://images.unsplash.com/photo-1739630405609-fd438c446f62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWduJTIwbGFuZ3VhZ2UlMjBoYW5kc3xlbnwxfHx8fDE3Njg5OTc4Mzl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Sign language"
                    className="w-full h-full object-cover rounded-lg opacity-60"
                  />
                </div>

                {/* Detection overlay */}
                <div className="absolute inset-8 border-2 border-yellow-400/60 rounded-lg">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400" />
                  
                  {/* Scanning line */}
                  <motion.div
                    className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
                    animate={{ top: ['0%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>

                {/* Status indicators */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40/80 backdrop-blur-sm border border-orange-500/30">
                    <Activity className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-white">Neural Network Active</span>
                  </div>
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40/80 backdrop-blur-sm border border-yellow-400/30"
                    >
                      <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                      <span className="text-xs text-white">Processing...</span>
                    </motion.div>
                  )}
                </div>

                {/* Detection result */}
                {detectedSign && !isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute bottom-4 left-4 right-4"
                  >
                    <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 border border-yellow-400/50 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-6 h-6 text-yellow-400" />
                          <div>
                            <div className="text-xs text-gray-300 mb-1">Detected Sign</div>
                            <div className="text-2xl font-bold text-white">{detectedSign}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-300 mb-1">Confidence</div>
                          <div className="text-xl font-bold text-yellow-400">98.7%</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Processing stats */}
              <div className="grid grid-cols-3 gap-4 p-4 border-t border-orange-500/30 bg-gradient-to-r from-black/50 to-black/60">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Frame Rate</div>
                  <div className="text-lg font-bold text-orange-500">60 FPS</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Latency</div>
                  <div className="text-lg font-bold text-yellow-400">42ms</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Model Size</div>
                  <div className="text-lg font-bold text-orange-500">12.4 MB</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}