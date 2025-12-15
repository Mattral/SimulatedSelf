import Groq from 'groq-sdk';

class GroqService {
  private groq: Groq;

  constructor() {
    this.groq = new Groq({ 
      apiKey: "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",
      dangerouslyAllowBrowser: true
    });
  }

  async generateResponse(userInput: string): Promise<string> {
    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a helpful humanoid robot assistant. Always respond in 50 words or less. Be friendly, concise, and engaging. Focus on brief, helpful answers."
          },
          {
            role: "user",
            content: userInput
          }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
      });
      
      return chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('Groq API error:', error);
      return "I'm having trouble connecting to my AI brain right now. Please try again.";
    }
  }
}

export const geminiService = new GroqService();
