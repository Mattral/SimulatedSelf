import Groq from 'groq-sdk';

/**
 * Conversational AI service backed by Groq (Llama 3.1).
 * The API key is read from environment variables (VITE_GROQ_API_KEY) and
 * must never be hard-coded in the repository.
 *
 * NOTE: Because this client runs in the browser, any key shipped via
 * `VITE_*` will still be visible in the built bundle. For production,
 * proxy these requests through a backend (e.g. Lovable Cloud edge function)
 * and keep the key server-side.
 */
class GroqService {
  private groq: Groq | null = null;
  private readonly systemPrompt =
    "You are a friendly humanoid robot assistant created by Min Htet Myet. " +
    "Always respond in 50 words or less. Be warm, concise, and engaging.";

  constructor() {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

    if (!apiKey) {
      console.warn(
        '[GroqService] VITE_GROQ_API_KEY is not set. Add it to your .env.local file.'
      );
      return;
    }

    this.groq = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async generateResponse(userInput: string): Promise<string> {
    if (!this.groq) {
      return "AI is not configured. Please set VITE_GROQ_API_KEY in your environment.";
    }

    const trimmed = userInput?.trim();
    if (!trimmed) {
      return "I didn't catch that — could you say it again?";
    }

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: trimmed },
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.8,
        max_completion_tokens: 256,
        top_p: 1,
        stream: false,
      });

      return (
        completion.choices[0]?.message?.content?.trim() ||
        "I'm sorry, I couldn't generate a response."
      );
    } catch (error) {
      console.error('[GroqService] Request failed:', error);
      return "I'm having trouble reaching my AI brain right now. Please try again.";
    }
  }
}

// Keep the original export name for backward compatibility across the app.
export const geminiService = new GroqService();
