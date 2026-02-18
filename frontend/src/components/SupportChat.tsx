import React, { useMemo, useState } from 'react'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: number
  role: ChatRole
  text: string
}

const quickReplies = [
  'Tengo internet lento',
  'No puedo navegar',
  'Quiero cambiar mi plan',
  'Necesito soporte tecnico'
]

const buildAssistantReply = (input: string) => {
  const text = input.toLowerCase()
  if (text.includes('lento')) return 'Recomiendo reiniciar tu router y ejecutar una prueba de velocidad. Si persiste, abrimos ticket.'
  if (text.includes('navegar') || text.includes('sin internet')) return 'Verifica que las luces WAN e Internet esten activas. Puedo guiarte en un diagnostico rapido.'
  if (text.includes('plan')) return 'Puedo ayudarte a revisar planes disponibles y costos. Indica la velocidad que buscas.'
  return 'Recibido. Estoy registrando tu consulta y te conecto con soporte si hace falta.'
}

const SupportChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', text: 'Hola, soy el asistente de soporte. ¿En que puedo ayudarte hoy?' }
  ])
  const [draft, setDraft] = useState('')

  const nextId = useMemo(() => messages.length + 1, [messages.length])

  const sendMessage = (content: string) => {
    const text = content.trim()
    if (!text) return

    setMessages((prev) => [
      ...prev,
      { id: nextId, role: 'user', text },
      { id: nextId + 1, role: 'assistant', text: buildAssistantReply(text) }
    ])
    setDraft('')
  }

  return (
    <div className="space-y-3">
      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="space-y-2">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickReplies.map((reply) => (
          <button
            key={reply}
            onClick={() => sendMessage(reply)}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            {reply}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') sendMessage(draft)
          }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Escribe tu consulta..."
        />
        <button onClick={() => sendMessage(draft)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Enviar
        </button>
      </div>
    </div>
  )
}

export default SupportChat
