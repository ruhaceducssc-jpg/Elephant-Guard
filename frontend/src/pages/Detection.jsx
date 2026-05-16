import React, { useRef, useEffect, useState } from 'react';
import { Camera, MapPin, AlertTriangle, ShieldCheck, RefreshCw, Upload, Image as ImageIcon, X, Zap, Search, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

const Detection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [model, setModel] = useState(null);
  const [activeMode, setActiveMode] = useState('camera'); 
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [location, setLocation] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [detectionResult, setDetectionResult] = useState(null);
  const [debugLog, setDebugLog] = useState([]);
  
  const lastAlertTime = useRef(0);
  const detectionBuffer = useRef(0);

  // Initialize AI Model
  useEffect(() => {
    const initAI = async () => {
      try {
        if (!window.tf) {
          const tfScript = document.createElement('script');
          tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs';
          document.body.appendChild(tfScript);
          await new Promise(r => tfScript.onload = r);
        }
        
        if (!window.cocoSsd) {
          const cocoScript = document.createElement('script');
          cocoScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd';
          document.body.appendChild(cocoScript);
          await new Promise(r => cocoScript.onload = r);
        }

        // Load model with MobileNetV2 for better accuracy/speed balance
        // @ts-ignore
        const loadedModel = await window.cocoSsd.load({ base: 'mobilenet_v2' });
        setModel(loadedModel);
        toast.success('AI Sentinel Active');
      } catch (error) {
        toast.error('AI Core Failure. Please refresh.');
      }
    };

    initAI();
    getGPSLocation();
    return () => stopCamera();
  }, []);

  const getGPSLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Browser does not support GPS');
      return;
    }

    // Security check: GPS requires HTTPS or localhost
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.error('Security Error: Geolocation requires HTTPS or localhost');
      toast.error('GPS blocked: Use HTTPS or localhost');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        console.log('GPS Lock Established:', pos.coords.latitude, pos.coords.longitude);
      },
      (error) => {
        let errorMsg = 'GPS Link Failed';
        switch(error.code) {
          case 1: 
            errorMsg = 'Location permission denied. Check browser settings.'; 
            break;
          case 2: 
            errorMsg = 'Location unavailable (Hardware/Signal issue).'; 
            break;
          case 3: 
            errorMsg = 'Location request timed out. Retrying...'; 
            break;
        }
        toast.error(errorMsg);
        console.warn('GPS Error Details:', error.message);
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setIsCameraReady(true);
      }
    } catch (err) {
      toast.error('Camera restricted');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setIsCameraReady(false);
    }
  };

  useEffect(() => {
    if (activeMode === 'camera') startCamera();
    else stopCamera();
  }, [activeMode]);

  // Main Detection Processing
  const processFrame = async (sourceElement) => {
    if (!model || !sourceElement) return;

    // Run inference with low threshold to catch all possibilities
    const predictions = await model.detect(sourceElement, 20, 0.20);
    
    // Log for debugging
    if (predictions.length > 0) {
      const logs = predictions.map(p => `${p.class} (${Math.round(p.score * 100)}%)`);
      setDebugLog(logs);
    }

    // Identify elephant OR related confusion classes (Asian elephants are sometimes misclassified)
    const elephant = predictions.find(p => 
      p.class === 'elephant' || 
      (p.class === 'cow' && p.score > 0.8) || // Buffalo/Elephant confusion
      (p.class === 'truck' && p.score > 0.9)  // Large grey mass confusion
    );

    drawBoundingBoxes(predictions, sourceElement);

    if (elephant && elephant.score > 0.35) {
      // If it was a 'cow' or 'truck' but high confidence, we force it as 'elephant' for our system
      const finalizedElephant = { ...elephant, class: 'elephant' };
      return finalizedElephant;
    }
    return null;
  };

  const drawBoundingBoxes = (predictions, source) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = source.videoWidth || source.naturalWidth || source.width;
    canvas.height = source.videoHeight || source.naturalHeight || source.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    predictions.forEach(p => {
      const isElephant = p.class === 'elephant';
      const [x, y, w, h] = p.bbox;
      
      ctx.strokeStyle = isElephant ? '#ef4444' : '#ffffff44';
      ctx.lineWidth = canvas.width / 150;
      ctx.setLineDash(isElephant ? [] : [5, 5]);
      ctx.strokeRect(x, y, w, h);
      
      if (isElephant || p.score > 0.5) {
        ctx.fillStyle = isElephant ? '#ef4444' : '#ffffff44';
        ctx.font = `bold ${canvas.width / 35}px sans-serif`;
        ctx.fillText(`${p.class} ${Math.round(p.score * 100)}%`, x, y > 40 ? y - 12 : 40);
      }
    });
  };

  // Camera Loop
  useEffect(() => {
    let frameId;
    const loop = async () => {
      if (activeMode === 'camera' && model && isCameraReady && !isProcessing) {
        const elephant = await processFrame(videoRef.current);
        if (elephant) {
          detectionBuffer.current++;
          if (detectionBuffer.current > 3) {
            handleAlert(elephant, videoRef.current);
          }
        } else {
          detectionBuffer.current = 0;
        }
      }
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [model, isCameraReady, isProcessing, activeMode]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setDetectionResult(null);
    setDebugLog([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        setUploadedImage(event.target.result);
        
        // Use a high-quality normalization canvas
        const normCanvas = document.createElement('canvas');
        const maxDim = 1280; // High res for analysis
        let w = img.width;
        let h = img.height;
        
        if (w > h && w > maxDim) { h = (h * maxDim) / w; w = maxDim; }
        else if (h > maxDim) { w = (w * maxDim) / h; h = maxDim; }
        
        normCanvas.width = w;
        normCanvas.height = h;
        const ctx = normCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const elephant = await processFrame(normCanvas);

        if (elephant) {
          setDetectionResult({ success: true, confidence: elephant.score });
          toast.success('Elephant Confirmed');
          await handleAlert(elephant, normCanvas, file);
        } else {
          setDetectionResult({ success: false });
          toast.error('No elephant identified');
        }
        setIsProcessing(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleAlert = async (detection, source, originalFile = null) => {
    const now = Date.now();
    if (activeMode === 'camera' && now - lastAlertTime.current < 45000) return;
    
    lastAlertTime.current = now;
    setIsProcessing(true);

    try {
      // Attempt to get fresh GPS location with longer timeout
      let currentLat = location?.lat;
      let currentLng = location?.lng;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              timeout: 10000, 
              enableHighAccuracy: true,
              maximumAge: 0
            });
          });
          currentLat = pos.coords.latitude;
          currentLng = pos.coords.longitude;
          setLocation({ lat: currentLat, lng: currentLng });
          console.log('GPS Lock Acquired:', currentLat, currentLng);
        } catch (gpsError) {
          console.warn('GPS refresh failed or timed out, using last known position:', gpsError.message);
        }
      }

      // If still missing, use Sri Lanka center as safe fallback
      const finalLat = currentLat || 7.8731;
      const finalLng = currentLng || 80.7718;

      if (!currentLat || !currentLng) {
        toast('GPS unavailable. Using fallback location.', { icon: '📍' });
      }

      let blob;
      if (originalFile && activeMode === 'upload') {
        blob = originalFile;
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = source.width || source.videoWidth;
        canvas.height = source.height || source.videoHeight;
        canvas.getContext('2d').drawImage(source, 0, 0);
        blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      }

      const formData = new FormData();
      formData.append('image', blob, 'alert.jpg');
      formData.append('longitude', finalLng);
      formData.append('latitude', finalLat);
      formData.append('locationName', activeMode === 'camera' ? 'Live Patrol Scan' : 'Analyzed Gallery Upload');
      formData.append('confidence', detection.score);

      const { data } = await api.post('/alerts', formData);
      console.log('Alert stored:', data);
      toast.success('Alert Broadcasted Successfully');
    } catch (error) {
      console.error('Alert failure:', error);
      toast.error(`Sync failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsProcessing(false);
      detectionBuffer.current = 0;
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* HUD Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-600 rounded-3xl flex items-center justify-center shadow-lg shadow-primary-200 animate-pulse">
            <ShieldCheck className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">AI Sentinel <span className="text-primary-600">v2.0</span></h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Elephant Early Warning System • Sri Lanka</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-2 rounded-[2rem] w-full lg:w-auto">
          <button 
            onClick={() => { setActiveMode('camera'); setUploadedImage(null); setDetectionResult(null); }}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeMode === 'camera' ? 'bg-white shadow-xl text-primary-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Camera size={18} /> Live Scan
          </button>
          <button 
            onClick={() => { setActiveMode('upload'); setIsCameraReady(false); }}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeMode === 'upload' ? 'bg-white shadow-xl text-primary-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Upload size={18} /> Deep Analysis
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Main Viewport */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative aspect-video bg-black rounded-[4rem] overflow-hidden shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border-[12px] border-white group">
            {activeMode === 'camera' ? (
              <>
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                {!isCameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-3xl text-white">
                    <RefreshCw size={64} className="animate-spin text-primary-500 mb-6" />
                    <p className="font-black text-lg uppercase tracking-[0.5em]">Synchronizing Sensors...</p>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 relative">
                {uploadedImage ? (
                  <>
                    <img src={uploadedImage} className="w-full h-full object-contain" alt="Target" />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                    <button 
                      onClick={() => { setUploadedImage(null); setDetectionResult(null); setDebugLog([]); }}
                      className="absolute top-10 right-10 p-4 bg-black/40 backdrop-blur-2xl text-white rounded-full hover:bg-black/60 transition-transform hover:scale-110 active:scale-90 shadow-2xl"
                    >
                      <X size={28} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center p-12">
                    <div className="w-40 h-40 bg-white border border-gray-100 text-primary-600 rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl shadow-primary-50 group-hover:scale-105 transition-transform duration-500">
                      <ImageIcon size={80} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-3 uppercase tracking-tight">Process Field Data</h2>
                    <p className="text-gray-500 max-w-sm mb-10 font-medium text-lg leading-relaxed">Neural analysis for high-resolution gallery photos and screenshots.</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-16 py-5 bg-primary-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-primary-700 transition-all hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] hover:-translate-y-1 active:translate-y-0"
                    >
                      Browse Files
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                  </div>
                )}
              </div>
            )}

            {/* AI HUD Status */}
            {isProcessing && (
              <div className="absolute inset-0 bg-primary-950/60 backdrop-blur-xl flex flex-col items-center justify-center z-[100]">
                <div className="relative">
                  <div className="w-32 h-32 border-[6px] border-white/10 border-t-white rounded-full animate-spin"></div>
                  <Zap className="absolute inset-0 m-auto text-white animate-pulse" size={48} />
                </div>
                <h2 className="mt-8 text-white font-black uppercase tracking-[0.5em] text-2xl">Pattern Matching...</h2>
              </div>
            )}

            {/* Detailed Result Card */}
            {detectionResult && (
              <div className={`absolute bottom-10 left-10 right-10 p-8 rounded-[2.5rem] backdrop-blur-3xl border ${detectionResult.success ? 'bg-green-600/20 border-green-500/50 text-white' : 'bg-red-600/20 border-red-500/50 text-white shadow-2xl'}`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-2xl ${detectionResult.success ? 'bg-green-600' : 'bg-red-600'}`}>
                      {detectionResult.success ? <ShieldCheck size={40} /> : <AlertTriangle size={40} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1">Inference Engine Result</p>
                      <h4 className="text-3xl font-black uppercase leading-none">
                        {detectionResult.success ? `Elephant Found (${Math.round(detectionResult.confidence * 100)}%)` : 'Clear: No Elephant'}
                      </h4>
                    </div>
                  </div>
                  {detectionResult.success && (
                    <div className="flex items-center gap-3 px-6 py-3 bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/20">
                      <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                      Broadcast Active
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Diagnostics */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
              <MapPin size={18} className="text-primary-600" />
              Satellite Lock
            </h3>
            {location ? (
              <div className="space-y-6">
                <div className="space-y-4">
                   <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 flex justify-between items-center group hover:bg-white transition-colors">
                      <p className="text-[10px] font-black text-gray-400 uppercase">Latitude</p>
                      <p className="font-mono font-black text-gray-800 tracking-tight">{location.lat.toFixed(6)}</p>
                   </div>
                   <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 flex justify-between items-center group hover:bg-white transition-colors">
                      <p className="text-[10px] font-black text-gray-400 uppercase">Longitude</p>
                      <p className="font-mono font-black text-gray-800 tracking-tight">{location.lng.toFixed(6)}</p>
                   </div>
                </div>
                <div className="flex items-center justify-center gap-3 py-4 bg-green-50 text-green-700 rounded-3xl border border-green-100">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Active Tracking</span>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100 text-center">
                <p className="text-xs font-black text-amber-800 uppercase tracking-widest animate-pulse">Searching Satellites...</p>
              </div>
            )}
          </div>

          {/* Inference Logs */}
          <div className="bg-gray-950 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <h3 className="font-black text-sm uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
              <Search size={16} /> Inference Log
            </h3>
            <div className="space-y-3 font-mono text-[10px] h-32 overflow-y-auto pr-2 custom-scrollbar">
              {debugLog.length > 0 ? debugLog.map((log, i) => (
                <div key={i} className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/60">ENTRY_{i+1}</span>
                  <span className="text-primary-400 font-bold">{log}</span>
                </div>
              )) : (
                <p className="text-white/20 italic">Awaiting pattern match...</p>
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <Info size={14} />
              </div>
              <p className="text-[9px] font-bold text-white/50 uppercase leading-relaxed">System handles buffalo confusion via high-score heuristics.</p>
            </div>
            <ShieldCheck size={180} className="absolute -right-20 -bottom-20 text-white/5 group-hover:text-white/10 transition-all duration-1000 group-hover:scale-110 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detection;
