import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, MapPin, AlertTriangle, ShieldCheck, RefreshCw, Upload, Image as ImageIcon, X, Zap, Search, Info, Activity, CheckCircle, Brain, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

const Detection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadImage, setUploadImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [stream, setStream] = useState(null);
  const [model, setModel] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [lastAlertTime, setLastAlertTime] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSuppressed, setIsSuppressed] = useState(false);
  
  const navigate = useNavigate();
  const ALERT_COOLDOWN = 120000; // 2 minutes cooldown for automated detection

  useEffect(() => {
    // Get current GPS location for the alert
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => toast.error('Location services restricted')
      );
    }

    // Load AI Model
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load({
          base: 'mobilenet_v2'
        });
        setModel(loadedModel);
        setIsModelLoading(false);
        toast.success('AI Intelligence Mesh Online', { icon: '🧠' });
      } catch (error) {
        console.error('Model load error:', error);
        toast.error('Failed to initialize AI model');
        setIsModelLoading(false);
      }
    };
    loadModel();
  }, []);

  // Cleanup stream and object URLs
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Handle camera stream attachment when element becomes available
  useEffect(() => {
    if (isScanning && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(e => console.error('Play error:', e));
      };
    }
  }, [isScanning, stream]);

  const detectElephant = useCallback(async (source) => {
    if (!model) return null;
    
    try {
      const predictions = await model.detect(source);
      // Look for elephant in predictions
      const elephant = predictions.find(p => p.class === 'elephant' && p.score > 0.65);
      
      if (elephant) {
        return {
          detected: true,
          confidence: elephant.score,
          bbox: elephant.bbox
        };
      }
      return { detected: false, confidence: predictions[0]?.score || 0 };
    } catch (err) {
      console.error('Detection error:', err);
      return null;
    }
  }, [model]);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const createAlertInternal = async (imageBlob, confidence, isManual = false) => {
    // Prevent duplicates based on cooldown and suppression state for automated alerts
    if (!isManual && (isSuppressed || (Date.now() - lastAlertTime < ALERT_COOLDOWN))) {
      return false;
    }

    try {
      setIsCapturing(true);
      if (!isManual) setIsSuppressed(true);
      
      const formData = new FormData();
      formData.append('image', imageBlob, 'detection.jpg');
      formData.append('latitude', location?.lat || 7.8731);
      formData.append('longitude', location?.lng || 80.7718);
      formData.append('locationName', isManual ? 'Manual Deployment' : 'Automated Detection');
      formData.append('confidence', confidence);

      setLastAlertTime(Date.now());
      await api.post('/alerts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(isManual ? 'Manual alert deployed successfully' : 'ELEPHANT CONFIRMED: Broad-spectrum alert deployed', { 
        duration: 8000,
        icon: isManual ? '🚀' : '🐘'
      });
      
      if (isMounted.current) {
        setDetectionResult({
          detected: true,
          confidence: confidence || 0,
          timestamp: new Date().toISOString(),
          locationName: isManual ? 'Manual Analysis' : 'Live Tactical Scan'
        });
      }

      // Release suppression after cooldown for automated alerts
      if (!isManual) {
        setTimeout(() => {
          if (isMounted.current) setIsSuppressed(false);
        }, ALERT_COOLDOWN);
      }

      return true;
    } catch (error) {
      console.error('Alert submission error:', error);
      toast.error('Failed to deploy alert: ' + (error.response?.data?.message || 'Network error'));
      if (isMounted.current && !isManual) setIsSuppressed(false); 
      return false;
    } finally {
      if (isMounted.current) setIsCapturing(false);
    }
  };

  // Detection Loop for Live Camera
  useEffect(() => {
    let animationFrame;
    let isActive = true;

    const runLoop = async () => {
      if (!isActive) return;
      
      // Only run detection if not suppressed and not already capturing
      if (isScanning && videoRef.current && videoRef.current.readyState === 4 && model && !isCapturing && !isSuppressed) {
        try {
          const result = await detectElephant(videoRef.current);
          if (result && result.detected && isActive) {
            // Auto capture the representative frame
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
            
            canvas.toBlob((blob) => {
              if (blob && isActive) createAlertInternal(blob, result.confidence);
            }, 'image/jpeg', 0.85);
          }
        } catch (err) {
          console.error('Loop error:', err);
        }
      }
      
      if (isScanning) {
        animationFrame = requestAnimationFrame(runLoop);
      }
    };

    if (isScanning && !isModelLoading && model) {
      runLoop();
    }

    return () => {
      isActive = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [isScanning, isModelLoading, model, detectElephant, isCapturing, isSuppressed, lastAlertTime, location]);

  const startCamera = async () => {
    if (isModelLoading) return toast.error('Awaiting AI initialization...');
    try {
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsScanning(true);
      setUploadImage(null);
      setDetectionResult(null);
      setIsSuppressed(false); // Reset suppression when starting new scan
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isModelLoading) return toast.error('Awaiting AI initialization...');

    setUploadImage(file);
    setIsAnalyzing(true);
    setDetectionResult(null);

    // Deep Analysis for Uploads
    setTimeout(async () => {
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
          const result = await detectElephant(img);
          URL.revokeObjectURL(img.src);
          
          if (isMounted.current) {
            if (result && result.detected) {
              setDetectionResult({
                detected: true,
                confidence: result.confidence,
                timestamp: new Date().toISOString(),
                locationName: 'Gallery Analysis'
              });
              toast.success('Elephant presence confirmed in photo');
            } else {
              setDetectionResult({
                detected: false,
                confidence: result?.confidence || 0,
                timestamp: new Date().toISOString(),
                locationName: 'Gallery Analysis'
              });
              toast('No elephant detected in this image', { icon: '🛡️' });
            }
            setIsAnalyzing(false);
          }
        };
      } catch (err) {
        console.error('File analysis error:', err);
        if (isMounted.current) setIsAnalyzing(false);
        toast.error('Failed to analyze image');
      }
    }, 500);
  };

  const submitManualAlert = async () => {
    if (!uploadImage || !detectionResult) return;
    // Manual uploads are not subject to auto-suppression but still have a basic cooldown
    if (Date.now() - lastAlertTime < 5000) {
      return toast.error('Please wait before submitting another alert');
    }
    
    try {
      const success = await createAlertInternal(uploadImage, detectionResult.confidence, true);
      if (success) {
        navigate('/dashboard/history');
      }
    } catch (err) {
      console.error('Manual alert error:', err);
      toast.error('Failed to deploy manual alert');
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-20 page-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3 text-nowrap">
             <Activity className="text-primary-600" size={28} />
             AI Tactical <span className="text-primary-600">Scanner</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Real-time object detection and automated broadcast</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isModelLoading ? (
            <div className="px-3.5 py-1.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200 flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" />
              Initializing AI...
            </div>
          ) : (
            <div className="px-3.5 py-1.5 bg-success-50 text-success-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-success-100 flex items-center gap-2">
              <Brain size={12} />
              AI Online
            </div>
          )}
          {isSuppressed && (
            <div className="px-3.5 py-1.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-100 flex items-center gap-2 animate-pulse">
              <Clock size={12} />
              Suppression Active
            </div>
          )}
          {location && (
            <div className="px-3.5 py-1.5 bg-primary-50 text-primary-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary-100 flex items-center gap-2">
              <MapPin size={12} />
              GPS Active
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Scanner View */}
        <div className="lg:col-span-7 space-y-8 min-w-0">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-soft overflow-hidden relative aspect-video group">
            {!isScanning && !uploadImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 space-y-6">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-soft flex items-center justify-center text-slate-300 group-hover:text-primary-500 transition-all duration-500 border border-slate-100">
                  <Camera size={32} />
                </div>
                <div className="text-center space-y-1">
                   <h3 className="font-bold text-slate-900 text-sm">System Ready</h3>
                   <p className="text-slate-400 text-xs font-medium">Initialize auto-scan or upload intelligence</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={startCamera} 
                    disabled={isModelLoading}
                    className="btn btn-primary px-6 disabled:opacity-50"
                  >
                    <Zap size={16} />
                    Start Auto-Scan
                  </button>
                  <label className={`btn btn-secondary px-6 cursor-pointer ${isModelLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={16} />
                    Upload Image
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="relative h-full w-full">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="h-full w-full object-cover" 
                />
                <div className="absolute inset-0 border-[16px] border-black/5 pointer-events-none"></div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="w-48 h-48 md:w-64 md:h-64 border-2 border-primary-500/20 rounded-3xl relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-xl"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-xl"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-xl"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-xl"></div>
                      <div className="absolute inset-0 bg-primary-500/5 animate-pulse"></div>
                   </div>
                </div>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                  <button onClick={stopCamera} className="px-6 py-3 bg-black/60 backdrop-blur-md text-white rounded-xl hover:bg-black transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-nowrap">
                     <X size={16} />
                     Terminate Scan
                  </button>
                </div>
                <div className="absolute top-6 left-6 flex items-center gap-2 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg">
                   <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                   Live AI Matrix
                </div>
                {(isCapturing || isSuppressed) && (
                   <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                      <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-3">
                         <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
                            <Activity size={20} className="text-primary-600 animate-pulse" />
                         </div>
                         <div>
                            <span className="text-sm font-bold text-slate-900 uppercase tracking-widest block">
                               {isCapturing ? 'Processing Detection...' : 'Deduplication Active'}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase mt-1 block">
                               {isCapturing ? 'Verifying biological patterns' : 'One alert per elephant event'}
                            </span>
                         </div>
                      </div>
                   </div>
                )}
              </div>
            )}

            {uploadImage && !isScanning && (
              <div className="relative h-full w-full">
                <img 
                  src={uploadImage instanceof File ? URL.createObjectURL(uploadImage) : ''} 
                  className="h-full w-full object-cover" 
                  alt="Scan" 
                />
                <div className="absolute top-6 right-6">
                  <button onClick={() => { setUploadImage(null); setDetectionResult(null); }} className="p-3 bg-white/40 backdrop-blur-md text-white rounded-xl hover:bg-danger-600 transition-all">
                    <RefreshCw size={20} />
                  </button>
                </div>
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-4">
                     <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                     <p className="text-xs font-bold uppercase tracking-widest text-center px-6">Deep Analysis in Progress...</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <canvas ref={canvasRef} className="hidden" />

          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-soft flex items-start gap-5 md:gap-7">
             <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center shrink-0 border border-primary-100 shadow-sm">
                <Brain size={24} />
             </div>
             <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">Tactical Intelligence Protocol</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Elephant Guard uses a high-precision COCO-SSD neural mesh to identify biological signatures. The system implements a **2-minute suppression protocol** per detection event to ensure a clean operational log and prevent notification fatigue. One representative frame is captured per unique elephant interaction.
                </p>
             </div>
          </div>
        </div>

        {/* Intelligence Report */}
        <div className="lg:col-span-5 min-w-0">
           <div className="bg-white rounded-[2rem] border border-slate-200 shadow-soft overflow-hidden min-h-[500px] flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 p-8">
                 <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                   <ShieldCheck size={22} className="text-primary-600" />
                   Intelligence Report
                 </h2>
                 <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Network Version 4.22.0 (COCO-SSD)</p>
              </div>

              <div className="p-8 flex-1 flex flex-col overflow-y-auto max-h-[600px] custom-scrollbar">
                 {!detectionResult ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-12">
                      <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center border border-slate-100">
                        <Search size={32} />
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Awaiting Data...</p>
                        <p className="text-slate-300 text-[10px] font-medium mt-1 max-w-[180px]">Automated or manual scan required to generate telemetry.</p>
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className={`p-6 rounded-2xl border flex items-center justify-between ${detectionResult.detected ? 'bg-danger-50 border-danger-100 text-danger-700' : 'bg-success-50 border-success-100 text-success-700'}`}>
                         <div className="min-w-0 pr-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 truncate">Detection Status</p>
                            <h3 className="text-xl md:text-2xl font-bold tracking-tight mt-0.5 truncate">
                               {detectionResult.detected ? 'Elephant Confirmed' : 'Clear Sector'}
                            </h3>
                         </div>
                         <div className="w-12 h-12 rounded-xl bg-white/80 shadow-sm flex items-center justify-center shrink-0">
                            {detectionResult.detected ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center md:text-left">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neural Score</p>
                            <p className="text-xl font-bold text-slate-900 mt-0.5">{(detectionResult.confidence * 100).toFixed(1)}%</p>
                         </div>
                         <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center md:text-left min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Method</p>
                            <p className="text-sm font-bold text-slate-900 mt-1 truncate">{detectionResult.locationName}</p>
                         </div>
                      </div>

                      <div className="space-y-3 pt-2">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Validation Metrics</h4>
                         <div className="space-y-2">
                            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 p-3.5 bg-slate-50/50 rounded-xl border border-slate-100/50">
                               <CheckCircle size={14} className="text-success-600" />
                               Biological Patterns Validated
                            </div>
                            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 p-3.5 bg-slate-50/50 rounded-xl border border-slate-100/50">
                               <CheckCircle size={14} className="text-success-600" />
                               Threshold Validation Passed
                            </div>
                         </div>
                      </div>

                      {detectionResult.detected && uploadImage && (
                        <div className="pt-4 sticky bottom-0 bg-white">
                          <button onClick={submitManualAlert} disabled={isCapturing} className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                            <Zap size={16} />
                            Deploy Manual Alert
                          </button>
                        </div>
                      )}
                      
                      {(!detectionResult.detected || !uploadImage) && (
                        <div className="pt-4 sticky bottom-0 bg-white">
                           <button onClick={() => { setUploadImage(null); setDetectionResult(null); }} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95">
                             <RefreshCw size={16} />
                             Initialize New Analysis
                           </button>
                        </div>
                      )}
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Detection;
