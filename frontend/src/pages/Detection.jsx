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
  
  // Refs for immediate duplicate prevention
  const isProcessingRef = useRef(false);
  const activeDetectionRef = useRef(false);
  const lastAlertTimeRef = useRef(0);
  const lastElephantSeenRef = useRef(0);
  const detectionSessionIdRef = useRef(null);

  const navigate = useNavigate();
  
  // Configuration
  const ALERT_COOLDOWN_MS = parseInt(import.meta.env.VITE_ALERT_COOLDOWN_MS) || 60000;
  const ELEPHANT_ABSENCE_RESET_MS = parseInt(import.meta.env.VITE_ELEPHANT_ABSENCE_RESET_MS) || 15000;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => toast.error('Location services restricted')
      );
    }

    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load({
          base: 'mobilenet_v2'
        });
        setModel(loadedModel);
        setIsModelLoading(false);
        toast.success('AI Detection Model Online', { icon: '🤖' });
      } catch (error) {
        console.error('Model load error:', error);
        toast.error('Failed to initialize AI model');
        setIsModelLoading(false);
      }
    };
    loadModel();
  }, []);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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
    if (isManual && isProcessingRef.current) return false;

    const latitude = Number(location?.lat);
    const longitude = Number(location?.lng);
    const hasValidLocation = Number.isFinite(latitude)
      && latitude >= -90
      && latitude <= 90
      && Number.isFinite(longitude)
      && longitude >= -180
      && longitude <= 180;

    if (!hasValidLocation) {
      toast.error('A valid live GPS location is required to create a detection');
      return false;
    }
    
    if (!isManual && (Date.now() - lastAlertTimeRef.current < ALERT_COOLDOWN_MS)) {
      isProcessingRef.current = false;
      return false;
    }

    if (isManual) isProcessingRef.current = true;
    
    try {
      if (isMounted.current) {
        setIsCapturing(true);
        if (!isManual) setIsSuppressed(true);
      }
      
      const formData = new FormData();
      formData.append('image', imageBlob, 'detection.jpg');
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('locationName', isManual ? 'Manual Upload' : 'Automated Detection');
      formData.append('confidence', confidence);
      formData.append('source', isManual ? 'manual' : 'camera');
      
      if (detectionSessionIdRef.current) {
        formData.append('detectionSessionId', detectionSessionIdRef.current);
      }

      const response = await api.post('/detections', formData);
      
      const isDuplicate = response.data?.duplicate;
      
      if (!isDuplicate) {
        lastAlertTimeRef.current = Date.now();
        if (isMounted.current) setLastAlertTime(Date.now());
        
        const alertsSent = Number(response.data?.notificationStatus === 'completed');
        toast.success(isManual
          ? 'Manual detection record created'
          : alertsSent
            ? 'Elephant detected. Eligible residents were evaluated.'
            : 'Elephant detected. No automatic resident alert was eligible.', {
          duration: 8000,
          icon: isManual ? '✅' : '🐘'
        });
      }
      
      if (isMounted.current) {
        setDetectionResult({
          detected: true,
          confidence: confidence || 0,
          timestamp: new Date().toISOString(),
          locationName: isManual ? 'Manual Analysis' : (isDuplicate ? 'Duplicate Detection' : 'Live Camera Scan')
        });
      }

      return true;
    } catch (error) {
      console.error('Detection submission error:', error);
      const responseData = error.response?.data;
      const errorMessage = responseData?.message || 'Failed to create detection record';
      const details = responseData?.details ? `\n${responseData.details.join('\n')}` : '';
      
      if (error.response?.status !== 200 || !responseData?.duplicate) {
        toast.error(`${errorMessage}${details}`, { duration: 6000 });
      }
      return false;
    } finally {
      isProcessingRef.current = false;
      if (isMounted.current) setIsCapturing(false);
      
      if (!isManual) {
        setTimeout(() => {
          if (isMounted.current) setIsSuppressed(false);
        }, ALERT_COOLDOWN_MS);
      }
    }
  };

  useEffect(() => {
    let animationFrame;
    let isActive = true;

    const runLoop = async () => {
      if (!isActive) return;
      
      if (activeDetectionRef.current && (Date.now() - lastElephantSeenRef.current > ELEPHANT_ABSENCE_RESET_MS)) {
        activeDetectionRef.current = false;
        detectionSessionIdRef.current = null;
      }

      if (isScanning && videoRef.current && videoRef.current.readyState === 4 && model && !isProcessingRef.current) {
        try {
          const result = await detectElephant(videoRef.current);
          
          if (result && result.detected && isActive) {
            lastElephantSeenRef.current = Date.now();
            
            if (!activeDetectionRef.current) {
              const cooldownRemaining = Date.now() - lastAlertTimeRef.current;
              
              if (cooldownRemaining >= ALERT_COOLDOWN_MS) {
                activeDetectionRef.current = true;
                detectionSessionIdRef.current = `cam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                isProcessingRef.current = true;

                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
                
                canvas.toBlob((blob) => {
                  if (blob && isActive) {
                    createAlertInternal(blob, result.confidence);
                  } else {
                    isProcessingRef.current = false;
                  }
                }, 'image/jpeg', 0.85);
              }
            }
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
  }, [isScanning, isModelLoading, model, detectElephant, location]);

  const startCamera = async () => {
    if (isModelLoading) return toast.error('Awaiting AI initialization...');
    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsScanning(true);
      setUploadImage(null);
      setDetectionResult(null);
      setIsSuppressed(false);
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
                locationName: 'Gallery Image'
              });
              toast.success('Elephant detected in photo');
            } else {
              setDetectionResult({
                detected: false,
                confidence: result?.confidence || 0,
                timestamp: new Date().toISOString(),
                locationName: 'Gallery Image'
              });
              toast('No elephant detected in this image');
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
    if (Date.now() - lastAlertTime < 5000) {
      return toast.error('Please wait before submitting another record');
    }
    
    try {
      const success = await createAlertInternal(uploadImage, detectionResult.confidence, true);
      if (success) {
        navigate('/dashboard/history');
      }
    } catch (err) {
      console.error('Manual alert error:', err);
      toast.error('Failed to save detection');
    }
  };

  return (
    <div className="space-y-[22px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight">
            Lanka Beacon <span className="text-[#1768d1]">AI Scanner</span>
          </h1>
          <p className="text-[#64748b] text-[11px] font-[700] mt-1.5 uppercase tracking-widest">Real-time Elephant detection terminal</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isModelLoading ? (
            <div className="badge badge-slate animate-pulse bg-[#f1f5f9] text-[#64748b] border-[#dbe4ef] rounded-[5px]">
              <RefreshCw size={12} className="animate-spin mr-2" />
              Initializing AI Model...
            </div>
          ) : (
            <div className="badge badge-success bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf] rounded-[5px]">
              <Brain size={12} className="mr-2" />
              AI Model Ready
            </div>
          )}
          {isSuppressed && (
            <div className="badge badge-warning bg-[#fff9e8] text-[#b76300] border-[#f8d68a] rounded-[5px] animate-pulse">
              <Clock size={12} className="mr-2" />
              Notification Cooldown
            </div>
          )}
          {location && (
            <div className="badge badge-primary bg-[#eaf2ff] text-[#1768d1] border-[#1768d1]/20 rounded-[5px]">
              <MapPin size={12} className="mr-2" />
              GPS Active
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px]">
        <div className="lg:col-span-8 flex flex-col gap-[14px]">
          <div className={`monitor-panel overflow-hidden relative aspect-video flex flex-col border-2 transition-colors duration-500 rounded-[5px] ${
            detectionResult?.detected ? 'border-[#ef3535]' : isScanning ? 'border-[#18b866]' : 'border-[#223247]'
          }`}>
            <div className="px-6 py-4 border-b border-[#223247] flex items-center justify-between bg-black/40 shrink-0 z-10">
               <div className="flex items-center gap-3">
                  <Activity size={16} className={`${isScanning ? 'text-[#18b866] animate-pulse' : 'text-[#475569]'}`} />
                  <span className="text-[11px] font-[800] uppercase tracking-[0.2em] text-[#f1f5f9]">Camera Feed :: {isScanning ? 'LIVE' : 'STANDBY'}</span>
               </div>
               {isScanning && (
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-[#ef3535] rounded-full animate-pulse shadow-[0_0_8px_rgba(239,53,53,0.6)]"></div>
                    <span className="text-[10px] font-[800] uppercase tracking-widest text-[#ef3535]">Scanning</span>
                 </div>
               )}
            </div>

            {!isScanning && !uploadImage && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-8 bg-[#07111f]">
                <div className="w-24 h-24 rounded-[5px] border border-[#223247] flex items-center justify-center text-[#1e293b] bg-[#0d1a2a] shadow-inner">
                  <Camera size={40} />
                </div>
                <div className="text-center space-y-3">
                   <h3 className="font-[800] text-[#f1f5f9] text-[14px] uppercase tracking-[0.2em]">Scanner Standby</h3>
                   <p className="text-[#475569] text-[11px] font-[700] uppercase tracking-widest max-w-[280px] leading-relaxed">Initialize camera for automatic elephant detection or upload an image for analysis</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={startCamera} disabled={isModelLoading} className="h-12 px-8 bg-[#1768d1] text-white rounded-[5px] font-[700] text-[12px] uppercase tracking-widest shadow-xl shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-all flex items-center gap-2">
                    <Zap size={18} />
                    Start Auto-Scan
                  </button>
                  <label className={`h-12 px-8 bg-[#0d1a2a] text-[#f1f5f9] border border-[#223247] rounded-[5px] cursor-pointer font-[700] text-[12px] uppercase tracking-widest hover:bg-[#1e293b] transition-all flex items-center gap-2 ${isModelLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={18} />
                    Upload Photo
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="relative flex-1 bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between z-10">
                   <div className="flex justify-between items-start">
                      <div className="w-16 h-16 border-t-[2px] border-l-[2px] border-white/30 rounded-tl-[5px]"></div>
                      <div className="w-16 h-16 border-t-[2px] border-r-[2px] border-white/30 rounded-tr-[5px]"></div>
                   </div>
                   <div className="flex items-center justify-center">
                      <div className="w-72 h-72 border border-[#18b866]/20 rounded-full relative flex items-center justify-center">
                         <div className="w-6 h-6 border-2 border-[#18b866] rounded-full animate-ping opacity-60"></div>
                         <div className="absolute inset-0 border-t-2 border-[#18b866]/50 rounded-full animate-spin duration-3000"></div>
                      </div>
                   </div>
                   <div className="flex justify-between items-end">
                      <div className="w-16 h-16 border-b-[2px] border-l-[2px] border-white/30 rounded-bl-[5px]"></div>
                      <div className="w-16 h-16 border-b-[2px] border-r-[2px] border-white/30 rounded-br-[5px]"></div>
                   </div>
                </div>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
                  <button onClick={stopCamera} className="h-12 px-8 bg-black/80 backdrop-blur-xl text-white rounded-[5px] border border-white/10 hover:bg-black transition-all font-[800] text-[11px] uppercase tracking-[0.2em] flex items-center gap-2 shadow-2xl">
                     <X size={18} className="text-[#ef3535]" />
                     Stop Scanner
                  </button>
                </div>
                {(isCapturing || isSuppressed) && (
                   <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-30">
                      <div className="bg-[#0f172a]/95 border border-white/10 p-10 rounded-[5px] shadow-2xl flex flex-col items-center gap-5 max-w-sm text-center">
                         <div className="w-14 h-14 bg-[#1768d1]/20 rounded-[5px] flex items-center justify-center border border-[#1768d1]/30">
                            <Activity size={28} className="text-[#2878e8] animate-pulse" />
                         </div>
                         <div className="space-y-3">
                            <span className="text-[14px] font-[800] text-white uppercase tracking-[0.1em] block">
                               {isCapturing ? 'Analyzing Image' : 'Notification Cooldown'}
                            </span>
                            <span className="text-[11px] font-[700] text-[#94a3b8] uppercase tracking-widest mt-2 block leading-relaxed">
                               {isCapturing ? 'Verifying detection result...' : 'Preventing duplicate community alerts'}
                            </span>
                         </div>
                      </div>
                   </div>
                )}
              </div>
            )}

            {uploadImage && !isScanning && (
              <div className="relative flex-1 bg-[#07111f]">
                <img src={uploadImage instanceof File ? URL.createObjectURL(uploadImage) : ''} className="h-full w-full object-contain" alt="Upload" />
                <div className="absolute top-6 right-6">
                  <button onClick={() => { setUploadImage(null); setDetectionResult(null); }} className="w-12 h-12 bg-black/40 backdrop-blur-md text-white rounded-[5px] border border-white/10 hover:bg-[#ef3535] transition-all flex items-center justify-center">
                    <RefreshCw size={20} />
                  </button>
                </div>
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-[#07111f]/80 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-4">
                     <div className="w-14 h-14 border-[3px] border-white/10 border-t-[#1768d1] rounded-full animate-spin"></div>
                     <p className="text-[11px] font-[800] uppercase tracking-[0.3em]">Analyzing Image...</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
        </div>

        <div className="lg:col-span-4 flex flex-col gap-[14px]">
           <div className="card h-full flex flex-col">
              <div className="px-6 py-[18px] border-b border-[#dfe7f1] bg-[#f8fafc] flex justify-between items-center shrink-0">
                 <h2 className="text-[13px] font-[800] text-[#0f172a] uppercase tracking-widest flex items-center gap-2">
                   <ShieldCheck size={18} className="text-[#1768d1]" />
                   Detection Report
                 </h2>
              </div>

              <div className="p-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                 {!detectionResult ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 py-16 opacity-40">
                      <div className="w-20 h-20 rounded-[5px] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-[#94a3b8]">
                        <Search size={40} />
                      </div>
                      <p className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b]">Awaiting Feed Analysis</p>
                   </div>
                 ) : (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className={`p-6 rounded-[5px] border-2 flex items-center justify-between ${detectionResult.detected ? 'bg-[#fff1f1] border-[#facaca] text-[#c81e1e]' : 'bg-[#edfcf4] border-[#b7efcf] text-[#0e7a42]'}`}>
                         <div className="space-y-1">
                            <p className="text-[10px] font-[800] uppercase tracking-widest opacity-80">AI Result</p>
                            <h3 className="text-[20px] font-[800] tracking-tight leading-none uppercase">
                               {detectionResult.detected ? 'Positive Match' : 'Sector Clear'}
                            </h3>
                         </div>
                         <div className="w-14 h-14 rounded-[5px] bg-white/60 shadow-sm flex items-center justify-center shrink-0 border border-white/20">
                            {detectionResult.detected ? <AlertTriangle size={32} /> : <ShieldCheck size={32} />}
                         </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                         <div className="p-5 bg-[#f8fafc] rounded-[5px] border border-[#dfe7f1]">
                            <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest">Detection Type</p>
                            <p className={`text-[13px] font-[800] mt-2 uppercase tracking-widest truncate ${detectionResult.locationName.includes('Duplicate') ? 'text-[#1768d1]' : 'text-[#0f172a]'}`}>
                               {detectionResult.locationName}
                            </p>
                         </div>
                      </div>

                      {detectionResult.detected && (
                        <div className="p-5 bg-[#0f172a] rounded-[5px] border border-white/10 shadow-xl space-y-4">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Community Alert</span>
                              <div className="w-2 h-2 bg-[#18b866] rounded-full animate-pulse"></div>
                           </div>
                           <p className="text-[12.5px] text-[#cbd5e1] font-[500] leading-relaxed">
                              {detectionResult.locationName.includes('Duplicate') 
                                ? 'Detection synchronized with active event. Community alert suppressed to prevent fatigue.'
                                : 'Elephant detection confirmed. Community notification nodes are being evaluated based on geofence rules.'}
                           </p>
                        </div>
                      )}

                      <div className="pt-6 mt-auto">
                        {detectionResult.detected && uploadImage ? (
                          <button onClick={submitManualAlert} disabled={isCapturing} className="w-full h-14 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-all flex items-center justify-center gap-3">
                            <Zap size={20} />
                            Save Detection Record
                          </button>
                        ) : (
                           <button onClick={() => { setUploadImage(null); setDetectionResult(null); }} className="w-full h-14 bg-white text-[#334155] rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] border border-[#dfe7f1] hover:bg-[#f8fafc] transition-all flex items-center justify-center gap-3">
                             <RefreshCw size={20} />
                             New Analysis
                           </button>
                        )}
                      </div>
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
