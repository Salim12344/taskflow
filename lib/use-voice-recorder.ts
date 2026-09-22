"use client";

import { useRef, useState } from "react";

/** Records a single voice note via the browser mic. Lets the recorder pick its own mimeType — forcing audio/webm breaks on iOS Safari, which only supports audio/mp4. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const mimeTypeRef = useRef<string | null>(null);
    const stopResolveRef = useRef<((b: Blob | null) => void) | null>(null);
    // Tracks live recording state synchronously so event handlers that close over
    // stale React state (e.g. onPointerUp firing before a setRecording re-render)
    // can still correctly detect whether a recording is in progress.
    const isRecordingRef = useRef(false);
    const startingRef = useRef(false);

  async function start() {
    if (isRecordingRef.current || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick a mimeType that's supported by the browser. Avoid forcing webm on iOS.
      const candidateTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/m4a",
        "audio/ogg;codecs=opus",
      ];
      let mimeType: string | null = null;
      try {
        for (const t of candidateTypes) {
          if (typeof (MediaRecorder as any).isTypeSupported === "function" && (MediaRecorder as any).isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }
      } catch {
        // ignore detection errors
      }
      mimeTypeRef.current = mimeType;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      // Request frequent dataavailable events so chunks accumulate reliably across browsers.
      // Smaller timeslice reduces the risk of losing the tail of the recording.
      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }
      recorderRef.current = recorder;
      isRecordingRef.current = true;
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable.");
    } finally {
      startingRef.current = false;
    }
  }

  async function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(null);
      // Store resolver so cancel() can resolve the pending promise.
      stopResolveRef.current = resolve;
      const onstop = () => {
        try {
          recorder.stream.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
        isRecordingRef.current = false;
        setRecording(false);
        const type = mimeTypeRef.current ?? (recorder as any).mimeType ?? "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        // clear refs
        recorderRef.current = null;
        chunksRef.current = [];
        mimeTypeRef.current = null;
        stopResolveRef.current = null;
        resolve(blob);
      };
      // Wrap onstop to clear a fallback timer if we use it below.
      let timer: ReturnType<typeof setTimeout> | null = null;
      const wrappedOnstop = (_ev: Event) => {
        try { if (timer) { clearTimeout(timer); timer = null; } } catch {}
        try { onstop(); } catch {}
      };
      recorder.onstop = wrappedOnstop;
      try {
        // Ask the recorder to emit any buffered dataavailable events, then call stop
        // shortly after so the final samples are captured without using `await` inside
        // the Promise executor (avoids parsing errors in build).
        try { recorder.requestData?.(); } catch {}
        // Call stop after a short delay to give the UA time to queue final dataavailable.
        setTimeout(() => {
          try { recorder.stop(); } catch (e) {
            // If stop throws synchronously, cleanup and resolve null.
            try { recorder.onstop = null; } catch {}
            try { recorder.stream.getTracks().forEach((t) => t.stop()); } catch {}
            recorderRef.current = null;
            chunksRef.current = [];
            mimeTypeRef.current = null;
            stopResolveRef.current = null;
            isRecordingRef.current = false;
            setRecording(false);
            try { resolve(null); } catch {}
          }
        }, 180);
        // Fallback: some browsers delay final dataavailable/onstop; resolve after a short grace period if onstop doesn't fire.
        const grace = 220;
        timer = setTimeout(() => {
          if (stopResolveRef.current) {
            try {
              const type = mimeTypeRef.current ?? (recorder as any).mimeType ?? "audio/webm";
              const blob = new Blob(chunksRef.current, { type });
              recorderRef.current = null;
              chunksRef.current = [];
              mimeTypeRef.current = null;
              stopResolveRef.current = null;
              isRecordingRef.current = false;
              setRecording(false);
              try { resolve(blob); } catch {}
            } catch {
              try { resolve(null); } catch {}
            }
          }
        }, grace);
      } catch (e) {
        // If stop() throws, attempt to cleanup and resolve null.
        try { recorder.onstop = null; } catch {}
        try { recorder.stream.getTracks().forEach((t) => t.stop()); } catch {}
        recorderRef.current = null;
        chunksRef.current = [];
        mimeTypeRef.current = null;
        stopResolveRef.current = null;
        isRecordingRef.current = false;
        setRecording(false);
        resolve(null);
      }
    });
  }

  function cancel() {
    const recorder = recorderRef.current;
    if (recorder) {
      // If a stop() promise is pending, resolve it with null so callers don't hang.
      if (stopResolveRef.current) {
        try { stopResolveRef.current(null); } catch {}
        stopResolveRef.current = null;
      }
      try { recorder.onstop = null; } catch {}
      try { recorder.stop(); } catch {}
      try { recorder.stream.getTracks().forEach((t) => t.stop()); } catch {}
      recorderRef.current = null;
      chunksRef.current = [];
      mimeTypeRef.current = null;
    }
    isRecordingRef.current = false;
    setRecording(false);
  }

  return { recording, isRecordingRef, error, start, stop, cancel };
}
