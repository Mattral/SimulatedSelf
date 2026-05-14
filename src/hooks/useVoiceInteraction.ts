import { useState, useRef, useCallback } from 'react';
import { geminiService, GroqServiceError } from '../services/geminiService';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type VoiceChatStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'streaming'
  | 'speaking'
  | 'error';

export interface VoiceChatError {
  code: GroqServiceError['code'];
  message: string;
  retryable: boolean;
}

/**
 * useVoiceInteraction
 * -------------------
 *  - Web Speech API for capture + synthesis.
 *  - Streams Groq tokens into `partialResponse` so the UI updates in real time.
 *  - Surfaces explicit `status` plus a `lastError` with retry support.
 *  - Speaks the full reply once the stream terminates (avoids choppy TTS).
 */
export const useVoiceInteraction = () => {
  const [status, setStatus] = useState<VoiceChatStatus>('idle');
  const [transcribedText, setTranscribedText] = useState('');
  const [partialResponse, setPartialResponse] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [lastError, setLastError] = useState<VoiceChatError | null>(null);

  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>('');

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 0.9;
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');
    utterance.onerror = () => setStatus('idle');
    speechSynthesis.speak(utterance);
  }, []);

  const runConversation = useCallback(
    async (userInput: string) => {
      lastPromptRef.current = userInput;
      setLastError(null);
      setPartialResponse('');
      setLastResponse('');
      setStatus('processing');

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      let acc = '';
      try {
        for await (const chunk of geminiService.generateResponseStream(userInput, {
          signal: controller.signal,
          timeoutMs: 15_000,
          maxRetries: 2,
        })) {
          if (status !== 'streaming') setStatus('streaming');
          acc += chunk;
          setPartialResponse(acc);
        }
        const final = acc.trim() || "I'm sorry, I couldn't generate a response.";
        setLastResponse(final);
        setPartialResponse('');
        speak(final);
      } catch (err) {
        const e =
          err instanceof GroqServiceError
            ? { code: err.code, message: err.message, retryable: err.retryable }
            : { code: 'UNKNOWN' as const, message: 'Unexpected error.', retryable: false };
        console.error('[useVoiceInteraction]', e);
        setLastError(e);
        setStatus('error');
      }
    },
    [speak, status],
  );

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setLastError({
        code: 'NOT_CONFIGURED',
        message: 'Speech recognition is not supported in this browser.',
        retryable: false,
      });
      setStatus('error');
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setStatus('listening');
      setLastError(null);
    };
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) {
        setTranscribedText(finalTranscript);
        recognition.stop();
        runConversation(finalTranscript);
      }
    };
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setLastError({
        code: 'NETWORK',
        message: `Microphone error: ${event.error}`,
        retryable: true,
      });
      setStatus('error');
    };
    recognition.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [runConversation]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    speechSynthesis?.cancel?.();
    setStatus('idle');
    setPartialResponse('');
  }, []);

  const retry = useCallback(() => {
    if (!lastPromptRef.current) return;
    runConversation(lastPromptRef.current);
  }, [runConversation]);

  return {
    // status
    status,
    isListening: status === 'listening',
    isProcessing: status === 'processing',
    isStreaming: status === 'streaming',
    isSpeaking: status === 'speaking',
    isConfigured: geminiService.isConfigured,
    // text
    transcribedText,
    partialResponse,
    lastResponse,
    lastError,
    // actions
    startListening,
    stopListening,
    cancel,
    retry,
    speak,
  };
};
