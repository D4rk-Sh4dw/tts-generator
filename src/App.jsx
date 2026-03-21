import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { chatOllama, uploadVoice, deleteVoice, synthesizeSpeech, synthesizeWithUpload, getVoices, getQwenVoices, synthesizeQwen } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'chat', 'privacy', 'qwen'

  // Voice Management State
  const [voiceName, setVoiceName] = useState('');
  const [voiceFile, setVoiceFile] = useState(null);
  const [uploadLanguage, setUploadLanguage] = useState('en');
  const [availableVoices, setAvailableVoices] = useState([{ id: 'alloy', name: 'Default (alloy)' }]);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [isUploading, setIsUploading] = useState(false);

  // Chat/LLM State
  const SYSTEM_PROMPT = 'You are a helpful AI assistant that collaboratively writes text with the user. The text will later be synthesized into speech. Provide clear, well-structured drafts and suggestions. Answer in the language the user writes in.';
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: "Hello! I'm your AI co-pilot powered by local Ollama. Tell me what text you'd like to create — I'll remember our full conversation!" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [ollamaModel, setOllamaModel] = useState('gpt-oss');
  const [isGeneratingLLM, setIsGeneratingLLM] = useState(false);
  const chatEndRef = useRef(null);

  // TTS Editor State
  const [ttsText, setTtsText] = useState('');
  const [ttsLanguage, setTtsLanguage] = useState('en');
  const [exaggeration, setExaggeration] = useState(0.7);
  const [cfgWeight, setCfgWeight] = useState(0.5);
  const [temperature, setTemperature] = useState(0.8);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  // Privacy Mode State
  const [privacyFile, setPrivacyFile] = useState(null);
  const [privacyText, setPrivacyText] = useState('');
  const [privacyLanguage, setPrivacyLanguage] = useState('en');
  const [privacyExagg, setPrivacyExagg] = useState(0.7);
  const [privacyCfg, setPrivacyCfg] = useState(0.5);
  const [privacyTemp, setPrivacyTemp] = useState(0.8);
  const [isGeneratingPrivacy, setIsGeneratingPrivacy] = useState(false);
  const [privacyAudioUrl, setPrivacyAudioUrl] = useState(null);

  // Qwen-TTS State
  const [qwenMode, setQwenMode] = useState('preset'); // 'preset', 'clone'
  const [qwenPresetVoices, setQwenPresetVoices] = useState(['vivian', 'ryan', 'serena', 'dylan', 'eric', 'aiden', 'ono_anna', 'sohee', 'uncle_fu']);
  const [qwenSelectedVoice, setQwenSelectedVoice] = useState('vivian');
  const [qwenCloneProfile, setQwenCloneProfile] = useState('');
  const [qwenText, setQwenText] = useState('');
  const [qwenSpeed, setQwenSpeed] = useState(1.0);
  const [isGeneratingQwen, setIsGeneratingQwen] = useState(false);
  const [qwenAudioUrl, setQwenAudioUrl] = useState(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Fetch available voices on mount
  useEffect(() => {
    async function fetchVoices() {
      try {
        const voices = await getVoices();
        if (voices && voices.length > 0) {
          const mapped = voices.map(v => ({
            id: typeof v === 'string' ? v : (v.name || v.voice_name || v.id),
            name: typeof v === 'string' ? v : (v.name || v.voice_name || v.id),
          }));
          setAvailableVoices([{ id: 'alloy', name: 'Default (alloy)' }, ...mapped]);
        }
      } catch (e) {
        // Silently ignore if Chatterbox is not yet running
      }
    }
    fetchVoices();
    getQwenVoices().then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        setQwenPresetVoices(data.map(v => v.name || v.id || v));
      }
    }).catch(() => {/* Qwen not available yet */});
  }, []);

  const handleVoiceUpload = async () => {
    if (!voiceFile || !voiceName.trim()) {
      alert("Please provide a voice name and an audio file.");
      return;
    }
    
    setIsUploading(true);
    try {
      await uploadVoice(voiceFile, voiceName.trim(), uploadLanguage);
      // Add to local list of voices
      const newVoice = { id: voiceName.trim(), name: voiceName.trim() };
      setAvailableVoices(prev => [...prev, newVoice]);
      setSelectedVoice(voiceName.trim());
      setVoiceName('');
      setVoiceFile(null);
      alert("Voice uploaded successfully!");
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', text: userMsg }];
    setChatMessages(newMessages);
    
    setIsGeneratingLLM(true);
    try {
      // Build Ollama message history from our chat state
      const ollamaMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...newMessages
          .filter(m => m.role === 'user' || m.role === 'ai')
          .map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text,
          }))
      ];
      
      const response = await chatOllama(ollamaMessages, ollamaModel);
      setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error: Could not reach Ollama model '${ollamaModel}'. Check if it's running locally.` }]);
    } finally {
      setIsGeneratingLLM(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([
      { role: 'ai', text: "Context cleared! Let's start fresh. What text would you like to create?" }
    ]);
  };

  const moveChatToEditor = (text) => {
    setTtsText(text);
    setActiveTab('editor');
  };

  const handleDeleteVoice = async () => {
    if (selectedVoice === 'alloy') {
      alert('The default voice cannot be deleted.');
      return;
    }
    if (!confirm(`Delete voice "${selectedVoice}"?`)) return;

    try {
      await deleteVoice(selectedVoice);
      setAvailableVoices(prev => prev.filter(v => v.id !== selectedVoice));
      setSelectedVoice('alloy');
    } catch (err) {
      alert(`Could not delete voice: ${err.message}`);
    }
  };

  const handleSynthesize = async () => {
    if (!ttsText.trim()) return;

    setIsGeneratingTTS(true);
    setAudioUrl(null);
    try {
      const blobUrl = await synthesizeSpeech(ttsText, selectedVoice, exaggeration, cfgWeight, temperature, ttsLanguage);
      setAudioUrl(blobUrl);
    } catch (err) {
      alert(`TTS Generation failed: ${err.message}`);
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const handlePrivacySynthesize = async () => {
    if (!privacyFile || !privacyText.trim()) {
      alert('Please provide both a voice file and text to synthesize.');
      return;
    }
    setIsGeneratingPrivacy(true);
    setPrivacyAudioUrl(null);
    try {
      const blobUrl = await synthesizeWithUpload(privacyText, privacyFile, privacyExagg, privacyCfg, privacyTemp, privacyLanguage);
      setPrivacyAudioUrl(blobUrl);
    } catch (err) {
      alert(`Privacy TTS failed: ${err.message}`);
    } finally {
      setIsGeneratingPrivacy(false);
    }
  };

  const handleQwenSynthesize = async () => {
    if (!qwenText.trim()) return;
    let voice;
    if (qwenMode === 'preset') voice = qwenSelectedVoice;
    else voice = `clone:${qwenCloneProfile}`;

    if (!voice || !voice.trim()) {
      alert('Please select a voice or enter a clone profile name.');
      return;
    }

    setIsGeneratingQwen(true);
    setQwenAudioUrl(null);
    try {
      const blobUrl = await synthesizeQwen(qwenText, voice, qwenSpeed);
      setQwenAudioUrl(blobUrl);
    } catch (err) {
      alert(`Qwen TTS failed: ${err.message}`);
    } finally {
      setIsGeneratingQwen(false);
    }
  };

  return (
    <>
      <header className="app-header">
        <h1 className="gradient-text">Chatterbox Synth</h1>
        <p>Premium Voice Cloning & AI Text Co-Creation</p>
      </header>
      
      <main className="app-container">
        
        {/* Sidebar: Voice Management & Settings */}
        <aside className="sidebar">
          <div className="glass-panel">
            <h3>Voice Library</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem', marginTop: '0.5rem' }}>
              Upload a voice sample to clone.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Voice Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. my-awesome-voice" 
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Audio Sample (.mp3, .wav)</label>
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={(e) => setVoiceFile(e.target.files[0])}
                  style={{ background: 'transparent', padding: '0.5rem 0' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Language</label>
                <select value={uploadLanguage} onChange={(e) => setUploadLanguage(e.target.value)}>
                  <option value="en">English (en)</option>
                  <option value="de">German (de)</option>
                  <option value="fr">French (fr)</option>
                  <option value="es">Spanish (es)</option>
                  <option value="it">Italian (it)</option>
                  <option value="pt">Portuguese (pt)</option>
                  <option value="pl">Polish (pl)</option>
                  <option value="hi">Hindi (hi)</option>
                </select>
              </div>
              
              <button 
                className="btn btn-secondary" 
                onClick={handleVoiceUpload}
                disabled={isUploading}
              >
                {isUploading ? <div className="loader"></div> : (
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                {isUploading ? 'Uploading...' : 'Upload Voice'}
              </button>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '1.5rem 0' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem' }}>Select Voice for TTS</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} style={{ flex: 1 }}>
                  {availableVoices.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {selectedVoice !== 'alloy' && (
                  <button 
                    className="btn" 
                    onClick={handleDeleteVoice}
                    title="Delete selected voice"
                    style={{ padding: '0.5rem', color: 'var(--danger)' }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content: LLM Chat & TTS Editor */}
        <section className="main-content">
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '-1rem', zIndex: 10, flexWrap: 'wrap' }}>
            <button 
              className={`btn ${activeTab === 'editor' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('editor')}
              style={{ borderRadius: '16px 16px 0 0', padding: '0.75rem 2rem' }}
            >
              TTS Editor
            </button>
            <button 
              className={`btn ${activeTab === 'privacy' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('privacy')}
              style={{ borderRadius: '16px 16px 0 0', padding: '0.75rem 2rem' }}
            >
              🔒 Privacy Mode
            </button>
            <button 
              className={`btn ${activeTab === 'qwen' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('qwen')}
              style={{ borderRadius: '16px 16px 0 0', padding: '0.75rem 2rem' }}
            >
              🧠 Qwen TTS
            </button>
            <button 
              className={`btn ${activeTab === 'chat' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('chat')}
              style={{ borderRadius: '16px 16px 0 0', padding: '0.75rem 2rem' }}
            >
              AI Co-Pilot (Ollama)
            </button>
          </div>

          <div className="glass-panel" style={{ borderTopLeftRadius: activeTab === 'editor' ? '0' : '16px' }}>
            
            {activeTab === 'chat' && (
              <div className="ai-chat-section">
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ollama Model:</label>
                    <input 
                      type="text" 
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="e.g. gpt-oss, llama3..."
                      style={{ width: '200px', padding: '0.4rem', fontSize: '0.9rem' }}
                    />
                  </div>
                  <button className="btn" onClick={handleClearChat} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    🗑️ Clear Context
                  </button>
                </div>
                
                <div className="chat-container">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`message ${msg.role === 'ai' ? 'message-ai' : 'message-user'}`}>
                      <div style={{ marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {msg.role === 'ai' ? '🤖 AI Assistant' : '👤 You'}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                      {msg.role === 'ai' && i > 0 && (
                        <button 
                          className="btn" 
                          style={{ marginTop: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => moveChatToEditor(msg.text)}
                        >
                          Use in Editor ➔
                        </button>
                      )}
                    </div>
                  ))}
                  {isGeneratingLLM && (
                    <div className="message message-ai" style={{ width: 'fit-content' }}>
                      <div className="loader"></div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Prompt the AI (e.g., 'Write a short intro...')" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    disabled={isGeneratingLLM}
                  />
                  <button className="btn btn-secondary" onClick={handleSendChat} disabled={isGeneratingLLM}>
                    Send
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="tts-editor-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <textarea 
                  placeholder="Enter the final text you want to synthesize..."
                  style={{ minHeight: '200px', fontSize: '1.1rem', lineHeight: '1.6' }}
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Language</label>
                      <select 
                        value={ttsLanguage} onChange={(e) => setTtsLanguage(e.target.value)}
                        style={{ width: '120px', padding: '0.5rem' }} 
                      >
                        <option value="en">English</option>
                        <option value="de">German</option>
                        <option value="fr">French</option>
                        <option value="es">Spanish</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="pl">Polish</option>
                        <option value="hi">Hindi</option>
                      </select>
                    </div>                  
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Emotionale Intensität: höher = aufgeregter, dramatischer">🎭 Emotion</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="range" min="0.25" max="2.0" step="0.05" value={exaggeration}
                          onChange={(e) => setExaggeration(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                        <input type="number" min="0.25" max="2.0" step="0.05" value={exaggeration}
                          onChange={(e) => setExaggeration(Math.min(2.0, Math.max(0.25, parseFloat(e.target.value) || 0.25)))}
                          style={{ width: '60px', padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Sprechtempo: 0 = schnell/dynamisch, 1 = langsam/kontrolliert">🏃 Pace</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="range" min="0" max="1.0" step="0.05" value={cfgWeight}
                          onChange={(e) => setCfgWeight(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                        <input type="number" min="0" max="1.0" step="0.05" value={cfgWeight}
                          onChange={(e) => setCfgWeight(Math.min(1.0, Math.max(0, parseFloat(e.target.value) || 0)))}
                          style={{ width: '60px', padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Variabilität: höher = zufälliger/natürlicher, niedriger = konsistenter">🎲 Variability</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="range" min="0.05" max="5.0" step="0.05" value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                        <input type="number" min="0.05" max="5.0" step="0.05" value={temperature}
                          onChange={(e) => setTemperature(Math.min(5.0, Math.max(0.05, parseFloat(e.target.value) || 0.05)))}
                          style={{ width: '60px', padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <button 
                      className="btn" 
                      onClick={() => { setExaggeration(0.7); setCfgWeight(0.5); setTemperature(0.8); }}
                      title="Auf Neutralwerte zurücksetzen"
                      style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                    >
                      ↺ Reset
                    </button>
                    <button 
                      className={`btn btn-primary ${isGeneratingTTS ? '' : 'pulse'}`} 
                      onClick={handleSynthesize}
                      disabled={isGeneratingTTS || !ttsText.trim()}
                    >
                      {isGeneratingTTS ? <div className="loader"></div> : (
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {isGeneratingTTS ? 'Synthesizing...' : 'Synthesize Speech'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="privacy-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
                  🔒 <strong>Privacy Mode</strong> — Your voice file is sent directly for synthesis and is <em>not</em> stored on the server.
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Voice File (.mp3, .wav)</label>
                  <input 
                    type="file" accept="audio/*" 
                    onChange={(e) => setPrivacyFile(e.target.files[0])}
                    style={{ background: 'transparent', padding: '0.5rem 0' }} 
                  />
                </div>

                <textarea 
                  placeholder="Enter the text to synthesize with the uploaded voice..."
                  style={{ minHeight: '160px', fontSize: '1.1rem', lineHeight: '1.6' }}
                  value={privacyText}
                  onChange={(e) => setPrivacyText(e.target.value)}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Language</label>
                      <select value={privacyLanguage} onChange={(e) => setPrivacyLanguage(e.target.value)} style={{ width: '120px', padding: '0.5rem' }}>
                        <option value="en">English</option>
                        <option value="de">German</option>
                        <option value="fr">French</option>
                        <option value="es">Spanish</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="pl">Polish</option>
                        <option value="hi">Hindi</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Emotionale Intensität: höher = aufgeregter, dramatischer">🎭 Emotion</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="range" min="0.25" max="2.0" step="0.05" value={privacyExagg}
                          onChange={(e) => setPrivacyExagg(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                        <input type="number" min="0.25" max="2.0" step="0.05" value={privacyExagg}
                          onChange={(e) => setPrivacyExagg(Math.min(2.0, Math.max(0.25, parseFloat(e.target.value) || 0.25)))}
                          style={{ width: '60px', padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Sprechtempo: 0 = schnell/dynamisch, 1 = langsam/kontrolliert">🏃 Pace</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="range" min="0" max="1.0" step="0.05" value={privacyCfg}
                          onChange={(e) => setPrivacyCfg(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                        <input type="number" min="0" max="1.0" step="0.05" value={privacyCfg}
                          onChange={(e) => setPrivacyCfg(Math.min(1.0, Math.max(0, parseFloat(e.target.value) || 0)))}
                          style={{ width: '60px', padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Variabilität: höher = zufälliger/natürlicher, niedriger = konsistenter">🎲 Variability</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="range" min="0.05" max="5.0" step="0.05" value={privacyTemp}
                          onChange={(e) => setPrivacyTemp(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                        <input type="number" min="0.05" max="5.0" step="0.05" value={privacyTemp}
                          onChange={(e) => setPrivacyTemp(Math.min(5.0, Math.max(0.05, parseFloat(e.target.value) || 0.05)))}
                          style={{ width: '60px', padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <button 
                      className="btn" 
                      onClick={() => { setPrivacyExagg(0.7); setPrivacyCfg(0.5); setPrivacyTemp(0.8); }}
                      title="Auf Neutralwerte zurücksetzen"
                      style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                    >
                      ↺ Reset
                    </button>
                    <button 
                      className={`btn btn-primary ${isGeneratingPrivacy ? '' : 'pulse'}`}
                      onClick={handlePrivacySynthesize}
                      disabled={isGeneratingPrivacy || !privacyText.trim() || !privacyFile}
                    >
                      {isGeneratingPrivacy ? <div className="loader"></div> : '🔒'}
                      {isGeneratingPrivacy ? 'Synthesizing...' : 'Synthesize (Private)'}
                    </button>
                  </div>
                </div>

                {privacyAudioUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <audio controls src={privacyAudioUrl} style={{ flex: 1 }} />
                    <a href={privacyAudioUrl} download="private_output.wav" className="btn">
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'qwen' && (
              <div className="qwen-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
                  🧠 <strong>Qwen3-TTS</strong> — 9 Premium-Stimmen oder Stimm-Klone aus dem Voice Studio.
                </div>

                {/* Mode Selector */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[['preset', '🎵 Preset'], ['clone', '📎 Clone']].map(([mode, label]) => (
                    <button key={mode} className={`btn ${qwenMode === mode ? 'btn-primary' : ''}`}
                      onClick={() => setQwenMode(mode)}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Preset Mode */}
                {qwenMode === 'preset' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Voice</label>
                    <select value={qwenSelectedVoice} onChange={(e) => setQwenSelectedVoice(e.target.value)}>
                      {qwenPresetVoices.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Clone Mode */}
                {qwenMode === 'clone' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Clone Profile Name</label>
                    <input
                      type="text"
                      placeholder="e.g. MyVoiceProfile (saved in Voice Studio)"
                      value={qwenCloneProfile}
                      onChange={(e) => setQwenCloneProfile(e.target.value)}
                    />
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
                      Create profiles via <a href="/qwen/voice-studio" target="_blank" rel="noopener" style={{ color: 'var(--accent-primary)' }}>Voice Studio</a> (Port 8880)
                    </p>
                  </div>
                )}

                <textarea
                  placeholder="Enter the text to synthesize with Qwen TTS..."
                  style={{ minHeight: '140px', fontSize: '1.1rem', lineHeight: '1.6' }}
                  value={qwenText}
                  onChange={(e) => setQwenText(e.target.value)}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="Sprechgeschwindigkeit: 0.25 = langsam, 4.0 = schnell">⚡ Speed</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="range" min="0.25" max="4.0" step="0.05" value={qwenSpeed}
                          onChange={(e) => setQwenSpeed(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                        <input type="number" min="0.25" max="4.0" step="0.05" value={qwenSpeed}
                          onChange={(e) => setQwenSpeed(Math.min(4.0, Math.max(0.25, parseFloat(e.target.value) || 1.0)))}
                          style={{ width: '60px', padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center' }} />
                      </div>
                    </div>
                    <button className="btn" onClick={() => setQwenSpeed(1.0)}
                      title="Speed zurücksetzen" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>
                      ↺ Reset
                    </button>
                  </div>

                  <button
                    className={`btn btn-primary ${isGeneratingQwen ? '' : 'pulse'}`}
                    onClick={handleQwenSynthesize}
                    disabled={isGeneratingQwen || !qwenText.trim()}
                  >
                    {isGeneratingQwen ? <div className="loader"></div> : '🧠'}
                    {isGeneratingQwen ? 'Synthesizing...' : 'Synthesize (Qwen)'}
                  </button>
                </div>

                {qwenAudioUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <audio controls src={qwenAudioUrl} style={{ flex: 1 }} />
                    <a href={qwenAudioUrl} download="qwen_output.wav" className="btn">
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                )}
              </div>
            )}
            
          </div>

          {/* Results Section */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Output
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              {audioUrl ? (
                <>
                  <audio controls src={audioUrl} style={{ flex: 1 }} />
                  <a href={audioUrl} download={`${voiceName || 'synthesized'}_output.wav`} className="btn">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </a>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', width: '100%', textAlign: 'center' }}>
                  No audio generated yet.
                </div>
              )}
            </div>
          </div>
          
        </section>
      </main>
    </>
  );
}

export default App;
