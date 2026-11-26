import { Bot, Send } from 'lucide-react';
import { useState } from 'react';
import type { ChatResponse, HouseholdProfile } from '@shared/types.ts';
import { sendChatQuestion } from '../api/client.ts';

interface GenAiCoachProps {
  profile: HouseholdProfile;
  selectedActionIds: string[];
  city: string;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  takeaways?: string[];
  impactNote?: string;
  followUps?: string[];
}

const STARTER_PROMPTS = [
  'When is the safest time to open windows today?',
  'How do I build a $60 Corsi-Rosenthal filter?',
  'Does cooking on gas affect indoor PM2.5 and NO₂?',
  'How can our school or apartment reduce winter smog together?',
];

export function GenAiCoach({
  profile,
  selectedActionIds,
  city,
}: GenAiCoachProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hi! I am AeroGuide, your family air-quality assistant for ${city}. Ask me about safe outdoor windows, DIY clean-air room hacks, cooking/heating impacts, or neighborhood carpool ideas.`,
      followUps: STARTER_PROMPTS.slice(0, 3),
    },
  ]);

  const askQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (trimmed.length < 2 || sending) return;

    const userMsg: MessageItem = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const response: ChatResponse = await sendChatQuestion({
        message: trimmed,
        profile,
        selectedActionIds,
      });

      const assistantMsg: MessageItem = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: response.answer,
        takeaways: response.keyTakeaways,
        impactNote: response.directImpactNote,
        followUps: response.suggestedFollowUps,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach AeroGuide right now.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="coach-heading" className="card">
      <h2 id="coach-heading" className="section-heading">
        <Bot size={20} aria-hidden="true" />
        Ask AeroGuide — GenAI Family & Community Coach
      </h2>

      <div style={{ marginBottom: '0.75rem' }}>
        <span className="muted-text" style={{ display: 'block', marginBottom: '0.35rem' }}>
          Quick questions:
        </span>
        <div className="preset-chips">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip-btn"
              disabled={sending}
              onClick={() => void askQuestion(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div
        className="chat-history"
        role="log"
        aria-live="polite"
        aria-label="Conversation with AeroGuide"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${
              msg.role === 'user' ? 'chat-user' : 'chat-assistant'
            }`}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.8, marginBottom: '0.2rem' }}>
              {msg.role === 'user' ? 'You' : 'AeroGuide'}
            </div>
            <p style={{ margin: 0 }}>{msg.text}</p>

            {msg.takeaways && msg.takeaways.length > 0 && (
              <ul className="steps-list" style={{ marginTop: '0.45rem' }}>
                {msg.takeaways.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            )}

            {msg.impactNote && (
              <div className="impact-callout" style={{ marginTop: '0.5rem' }}>
                <strong>Direct Impact:</strong> {msg.impactNote}
              </div>
            )}

            {msg.followUps && msg.followUps.length > 0 && (
              <div className="preset-chips" style={{ marginTop: '0.55rem' }}>
                {msg.followUps.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="chip-btn"
                    disabled={sending}
                    onClick={() => void askQuestion(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="muted-text" aria-live="polite">
            AeroGuide is synthesizing tailored air-quality guidance...
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="alert-banner" style={{ marginTop: '0.75rem' }}>
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void askQuestion(input);
        }}
        style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem' }}
      >
        <label htmlFor="coach-question" className="sr-only">
          Ask AeroGuide a question about winter smog or indoor air quality
        </label>
        <input
          id="coach-question"
          type="text"
          className="input"
          value={input}
          maxLength={1000}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about school walks, HEPA sizing, masks, or neighborhood actions..."
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || input.trim().length < 2}
        >
          <Send size={16} aria-hidden="true" />
          <span>Ask</span>
        </button>
      </form>
    </section>
  );
}
