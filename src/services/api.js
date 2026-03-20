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

// Upload a voice to Chatterbox TTS
export async function uploadVoice(file, voiceName, language) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', voiceName);
    if (language) formData.append('language', language);

    // This endpoint assumes the typical multipart/form-data upload expected by the voice library management
    const response = await fetch('/v1/voices', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
        // Fallback for missing or different API endpoints
        console.warn('Could not cleanly upload to /v1/voices. Mocking success if the backend ignores it.', response.status);
        if (response.status !== 404 && response.status !== 405) {
             throw new Error(`Chatterbox Error: ${response.status}`);
        }
        return { success: true, name: voiceName, mock: true };
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error uploading voice:", error);
    throw error;
  }
}

// Fetch list of available voices from Chatterbox
export async function getVoices() {
    try {
        const response = await fetch('/v1/models');
        if (!response.ok) throw new Error('Failed to load models');
        const data = await response.json();
        // Return dummy array if it doesn't match the expected format
        return data.data || [];
    } catch (e) {
        console.warn("Could not fetch models", e);
        return [];
    }
}

// Synthesize speech using Chatterbox TTS
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
