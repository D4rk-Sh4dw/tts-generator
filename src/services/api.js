/**
 * API Service for Chatterbox Synth
 */

// Generate text using Ollama
export async function generateOllamaText(prompt, model = 'gpt-oss') {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Error calling Ollama:", error);
    throw error;
  }
}

// Upload a voice to the Chatterbox Voice Library
// Endpoint: POST /voices  (multipart: voice_file, voice_name, language)
export async function uploadVoice(file, voiceName, language) {
  try {
    const formData = new FormData();
    formData.append('voice_file', file);
    formData.append('voice_name', voiceName);
    if (language) formData.append('language', language);

    const response = await fetch('/voices', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voice upload failed (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error uploading voice:", error);
    throw error;
  }
}

// Fetch list of available voices from Chatterbox
// Endpoint: GET /voices
export async function getVoices() {
  try {
    const response = await fetch('/voices');
    if (!response.ok) throw new Error('Failed to load voices');
    const data = await response.json();
    return data.voices || data || [];
  } catch (e) {
    console.warn("Could not fetch voices", e);
    return [];
  }
}

// Synthesize speech using Chatterbox TTS (JSON mode - uses voice library name)
// Endpoint: POST /v1/audio/speech
export async function synthesizeSpeech(text, voiceName, exaggeration = 0.7, temperature = 0.8, language) {
  try {
    const bodyArgs = {
      input: text,
      voice: voiceName || 'alloy',
      exaggeration: parseFloat(exaggeration),
      temperature: parseFloat(temperature),
    };
    if (language) bodyArgs.language = language;

    const response = await fetch('/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyArgs),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS Error: ${response.status} ${errorText}`);
    }
    
    // Return Blob URL for the audio
    const blob = await response.blob();
    return window.URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error synthesizing speech:", error);
    throw error;
  }
}

// Quick synthesize with inline voice upload (no library needed)
// Endpoint: POST /v1/audio/speech/upload
export async function synthesizeWithUpload(text, voiceFile, exaggeration = 0.7, temperature = 0.8, language) {
  try {
    const formData = new FormData();
    formData.append('input', text);
    formData.append('voice_file', voiceFile);
    formData.append('exaggeration', String(exaggeration));
    formData.append('temperature', String(temperature));
    if (language) formData.append('language', language);

    const response = await fetch('/v1/audio/speech/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS Upload Error: ${response.status} ${errorText}`);
    }

    const blob = await response.blob();
    return window.URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error synthesizing with upload:", error);
    throw error;
  }
}
