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

    // Simular prueba de velocidad
    const phases = [
      { name: 'ping', duration: 2000, progress: 25 },
      { name: 'download', duration: 4000, progress: 60 },
      { name: 'upload', duration: 3000, progress: 90 },
      { name: 'complete', duration: 1000, progress: 100 }
    ]

    for (const phase of phases) {
      await new Promise(resolve => {
        const interval = setInterval(() => {
          setProgress(prev => {
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

    // Resultados simulados
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
      {/* Progress Circle */}
      <div className="relative inline-block mb-6">
        <div className="w-32 h-32 relative">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray="352"
              strokeDashoffset={352 - (352 * progress) / 100}
              className="text-blue-600 transition-all duration-300"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{progress}%</div>
              <div className="text-sm text-gray-600">
                {isTesting ? 'Probando...' : 'Listo'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Button */}
      {!isTesting && progress === 0 && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={startTest}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          🚀 Iniciar Prueba 4K
        </motion.button>
      )}

      {/* Results */}
      {!isTesting && progress === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{results.download} Mbps</div>
              <div className="text-sm text-blue-700">Descarga</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">{results.upload} Mbps</div>
              <div className="text-sm text-purple-700">Subida</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Ping:</span>
              <span className="font-semibold ml-2">{results.ping} ms</span>
            </div>
            <div>
              <span className="text-gray-600">Jitter:</span>
              <span className="font-semibold ml-2">{results.jitter.toFixed(1)} ms</span>
            </div>
          </div>
          <button
            onClick={startTest}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Realizar otra prueba
          </button>
        </motion.div>
      )}

      {/* Testing Indicator */}
      {isTesting && (
        <div className="mt-4">
          <div className="flex justify-center space-x-2">
            {['Ping', 'Descarga', 'Subida'].map((text, i) => (
              <div
                key={text}
                className="flex items-center space-x-1 text-sm text-gray
