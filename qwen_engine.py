import torch
import gc
import logging

logger = logging.getLogger(__name__)

class QwenEngine:
    _instance = None
    
    def __init__(self):
        self.current_model_id = None
        self.model = None
        
        if torch.cuda.is_available():
            self.device = "cuda:0"
            self.dtype = torch.bfloat16
        else:
            self.device = "cpu"
            self.dtype = torch.float32

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = QwenEngine()
        return cls._instance

    def _load_model(self, model_id: str):
        from qwen_tts import Qwen3TTSModel
        if self.current_model_id == model_id and self.model is not None:
            return self.model
            
        logger.info(f"Switching model: {self.current_model_id} -> {model_id}")
        
        # Unload previous model
        if self.model is not None:
            del self.model
            self.model = None
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                gc.collect()
                
        # Load new model
        logger.info(f"Loading {model_id} on {self.device}...")
        try:
            self.model = Qwen3TTSModel.from_pretrained(
                model_id,
                device_map=self.device,
                dtype=self.dtype,
                attn_implementation="sdpa", # More stable fallback if flash_attn isn't perfectly configured
            )
        except Exception as e:
            logger.warning(f"Failed loading with sdpa, falling back to eager: {e}")
            self.model = Qwen3TTSModel.from_pretrained(
                model_id,
                device_map=self.device,
                dtype=self.dtype,
                attn_implementation="eager",
            )
            
        self.current_model_id = model_id
        return self.model

    def custom_voice(self, text, language, speaker, instruct=""):
        model = self._load_model("Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice")
        wavs, sr = model.generate_custom_voice(
            text=text,
            language=language or "Auto",
            speaker=speaker,
            instruct=instruct or ""
        )
        return wavs[0], sr

    def voice_design(self, text, language, instruct):
        model = self._load_model("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
        wavs, sr = model.generate_voice_design(
            text=text,
            language=language or "Auto",
            instruct=instruct
        )
        return wavs[0], sr

    def voice_clone(self, text, language, ref_audio, ref_text):
        model = self._load_model("Qwen/Qwen3-TTS-12Hz-1.7B-Base")
        # ref_audio can be a file path, tuple, or bytes. We will pass a numpy array from soundfile
        wavs, sr = model.generate_voice_clone(
            text=text,
            language=language or "Auto",
            ref_audio=ref_audio,
            ref_text=ref_text
        )
        return wavs[0], sr

qwen_engine = QwenEngine.get_instance()
