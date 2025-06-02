
import { GoogleGenAI } from "@google/genai";

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Use the provided API key
    this.ai = new GoogleGenAI({ 
      apiKey: "AIzaSyDGf7Gl5VDY6LHPsMbzD6-mvVVytof0GJ4" 
    });
  }

  async generateResponse(userInput: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: userInput,
        config: {
          systemInstruction: "You are a helpful humanoid robot assistant. Always respond in 50 words or less. Be friendly, concise, and engaging. Focus on brief, helpful answers.",
        },
      });
      
      return response.text || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('Gemini API error:', error);
      return "I'm having trouble connecting to my AI brain right now. Please try again.";
    }
  }
}

export const geminiService = new GeminiService();
