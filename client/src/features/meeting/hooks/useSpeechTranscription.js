import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

export function useSpeechTranscription({ roomId, participantName, socket }) {
    const transcriptRef = useRef('');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const isTranscribingRef = useRef(false);
    const recognitionRef = useRef(null);

    const toggleTranscription = useCallback(() => {
        if (isTranscribing) {
            recognitionRef.current?.stop();
            setIsTranscribing(false);
            isTranscribingRef.current = false;
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error('Speech recognition not supported in this browser');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + '. ';
                }
            }
            if (finalTranscript) {
                transcriptRef.current += `${participantName}: ${finalTranscript}\n`;
                socket?.emit('transcript:chunk', {
                    roomId,
                    text: finalTranscript,
                    speaker: participantName
                });
            }
        };

        recognition.onerror = (e) => {
            if (e.error !== 'no-speech') {
                console.error('Speech recognition error:', e.error);
            }
        };

        recognition.onend = () => {
            if (isTranscribingRef.current) {
                try { recognition.start(); } catch { /* ignore */ }
            }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsTranscribing(true);
        isTranscribingRef.current = true;
        toast.success('Transcription started');
    }, [isTranscribing, participantName, socket, roomId]);

    useEffect(() => {
        return () => {
            isTranscribingRef.current = false;
            recognitionRef.current?.stop();
        };
    }, []);

    return {
        transcriptRef,
        isTranscribing,
        toggleTranscription,
    };
}
