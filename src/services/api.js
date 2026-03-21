/**
 * API Service for Chatterbox Synth
 */

// Generate text using Ollama (with full conversation history)
// messages: array of { role: 'user'|'assistant'|'system', content: string }
export async function chatOllama(messages, model = 'gpt-oss') {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.message?.content || data.response || '';
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

// Delete a voice from the Chatterbox Voice Library
// Endpoint: DELETE /voices/{voice_name}
export async function deleteVoice(voiceName) {
  try {
    const response = await fetch(`/voices/${encodeURIComponent(voiceName)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Delete failed (${response.status}): ${errorText}`);
    }
    return true;
  } catch (error) {
    console.error("Error deleting voice:", error);
    throw error;
  }
}

// Synthesize speech using Chatterbox TTS (JSON mode - uses voice library name)
// Endpoint: POST /v1/audio/speech
export async function synthesizeSpeech(text, voiceName, exaggeration = 0.7, cfgWeight = 0.5, temperature = 0.8, language) {
  try {
    const bodyArgs = {
      input: text,
      voice: voiceName || 'alloy',
      exaggeration: parseFloat(exaggeration),
      cfg_weight: parseFloat(cfgWeight),
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
export async function synthesizeWithUpload(text, voiceFile, exaggeration = 0.7, cfgWeight = 0.5, temperature = 0.8, language) {
  try {
    const formData = new FormData();
    formData.append('input', text);
    formData.append('voice_file', voiceFile);
    formData.append('exaggeration', String(exaggeration));
    formData.append('cfg_weight', String(cfgWeight));
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

// ── Qwen-TTS API (Native Python Endpoints) ────────────────────

export async function synthesizeQwenCustom(text, speaker, instruct = '') {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('language', 'Auto');
  formData.append('speaker', speaker);
  if (instruct) formData.append('instruct', instruct);

  const response = await fetch('/api/qwen/custom-voice', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Custom Voice Error: ${response.status} ${errorText}`);
  }

  const blob = await response.blob();
  return window.URL.createObjectURL(blob);
}

export async function synthesizeQwenDesign(text, instruct) {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('language', 'Auto');
  formData.append('instruct', instruct);

  const response = await fetch('/api/qwen/voice-design', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voice Design Error: ${response.status} ${errorText}`);
  }

  const blob = await response.blob();
  return window.URL.createObjectURL(blob);
}

export async function synthesizeQwenClone(text, refAudioFile, refText) {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('language', 'Auto');
  formData.append('ref_audio', refAudioFile);
  formData.append('ref_text', refText);

  const response = await fetch('/api/qwen/voice-clone', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voice Clone Error: ${response.status} ${errorText}`);
  }

  const blob = await response.blob();
  return window.URL.createObjectURL(blob);
}
