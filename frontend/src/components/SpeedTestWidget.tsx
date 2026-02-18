import React, { useState } from 'react'
import { motion } from 'framer-motion'

const SpeedTestWidget: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState({
    download: 0,
    upload: 0,
    ping: 0,
    jitter: 0
  })

  const startTest = async () => {
    setIsTesting(true)
    setProgress(0)

    const phases = [
      { progress: 25 },
      { progress: 60 },
      { progress: 90 },
      { progress: 100 }
    ]

    for (const phase of phases) {
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= phase.progress) {
              clearInterval(interval)
              resolve(null)
              return phase.progress
            }
            return prev + 1
          })
        }, 30)
      })
    }

    setResults({
      download: Math.floor(Math.random() * 80) + 20,
      upload: Math.floor(Math.random() * 40) + 10,
      ping: Math.floor(Math.random() * 30) + 5,
      jitter: Math.random() * 5
    })

    setIsTesting(false)
  }

  return (
    <div className="text-center">
      <div className="relative mb-6 inline-block">
        <div className="relative h-32 w-32">
          <svg className="h-full w-full -rotate-90 transform">
            <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-700" />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray="352"
              strokeDashoffset={352 - (352 * progress) / 100}
              className="text-cyan-400 transition-all duration-300"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div>
              <div className="text-2xl font-bold text-white">{progress}%</div>
              <div className="text-sm text-slate-300">{isTesting ? 'Probando...' : 'Listo'}</div>
            </div>
          </div>
        </div>
      </div>

      {!isTesting && progress === 0 ? (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={startTest}
          className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-8 py-3 font-semibold text-slate-950 transition hover:brightness-110"
        >
          Iniciar prueba
        </motion.button>
      ) : null}

      {!isTesting && progress === 100 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 p-4">
              <div className="text-2xl font-bold text-cyan-100">{results.download} Mbps</div>
              <div className="text-sm text-cyan-200">Descarga</div>
            </div>
            <div className="rounded-lg border border-violet-300/25 bg-violet-400/10 p-4">
              <div className="text-2xl font-bold text-violet-100">{results.upload} Mbps</div>
              <div className="text-sm text-violet-200">Subida</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-300">Ping:</span>
              <span className="ml-2 font-semibold text-white">{results.ping} ms</span>
            </div>
            <div>
              <span className="text-slate-300">Jitter:</span>
              <span className="ml-2 font-semibold text-white">{results.jitter.toFixed(1)} ms</span>
            </div>
          </div>
          <button onClick={startTest} className="mt-4 text-sm font-medium text-cyan-300 hover:text-cyan-200">
            Realizar otra prueba
          </button>
        </motion.div>
      ) : null}

      {isTesting ? (
        <div className="mt-4">
          <div className="flex justify-center space-x-3">
            {['Ping', 'Descarga', 'Subida'].map((text, i) => (
              <div key={text} className="flex items-center space-x-1 text-sm text-slate-300">
                <span className={`h-2 w-2 rounded-full ${progress > i * 30 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SpeedTestWidget
