import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Mail, ArrowRight, RefreshCw, Lock, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const VerifyEmail = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    const data = sessionStorage.getItem('pendingVerification');
    if (!data) {
      toast.error('No pending registration found');
      navigate('/register');
      return;
    }
    const parsedData = JSON.parse(data);
    setSessionData(parsedData);
    setTimeLeft(parsedData.expiresInSeconds);
    setResendCooldown(parsedData.resendAvailableInSeconds);
  }, [navigate]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    inputRefs[Math.min(pastedData.length, 5)].current.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      return toast.error('Please enter the complete 6-digit code');
    }

    setIsLoading(true);
    try {
      await verifyOtp({
        verificationSessionId: sessionData.verificationSessionId,
        otp: otpCode
      });
      toast.success('Email verified successfully. Welcome to the network.');
      sessionStorage.removeItem('pendingVerification');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed');
      // If session expired, redirect back
      if (error.response?.status === 404) {
        navigate('/register');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const data = await resendOtp(sessionData.verificationSessionId);
      toast.success('New verification code sent to your email');
      setResendCooldown(data.resendAvailableInSeconds || 60);
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current.focus();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!sessionData) return null;

  return (
    <div className="min-h-screen bg-[#f5f8fc] flex items-center justify-center p-6 font-sans">
      <div className="max-w-[500px] w-full space-y-8">
        <div className="text-center space-y-4">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-[#0b2d63] rounded-[5px] shadow-xl shadow-[#0b2d63]/10 mb-2">
            <img src="/lanka-beacon-icon.svg" alt="Lanka Beacon" className="w-10 h-10" />
          </Link>
          <div className="space-y-1">
             <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight leading-none">
               Verify <span className="text-[#1768d1]">Email Link</span>
             </h1>
             <p className="text-[#64748b] text-[12px] font-[700] uppercase tracking-widest">Network Access Authorization</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[5px] shadow-md border border-[#dfe7f1] relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-[#1768d1]"></div>
          
          <div className="mb-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-[#f4f8ff] text-[#1768d1] rounded-full flex items-center justify-center mb-6 border border-[#eaf2ff]">
              <Mail size={32} />
            </div>
            <h2 className="text-[16px] font-[800] text-[#0f172a] uppercase tracking-widest">Check Your Inbox</h2>
            <p className="text-[#64748b] text-[13px] font-[500] mt-3 leading-relaxed">
              A 6-digit verification code was sent to<br/>
              <span className="text-[#0f172a] font-[700]">{sessionData.maskedEmail}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-8">
            <div className="flex justify-between gap-2 max-w-[320px] mx-auto">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-11 h-14 text-center text-[24px] font-[800] text-[#1768d1] bg-[#f8fafc] border border-[#dfe7f1] rounded-[5px] outline-none focus:border-[#1768d1] focus:ring-1 focus:ring-[#1768d1] transition-all"
                />
              ))}
            </div>

            <div className="space-y-6">
              <button 
                type="submit"
                disabled={isLoading || otp.join('').length !== 6 || timeLeft <= 0}
                className="w-full h-14 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/20 hover:bg-[#0f56b3] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>
                    Verifying Identity...
                  </>
                ) : (
                  <>
                    Verify Account
                    <CheckCircle size={20} />
                  </>
                )}
              </button>

              <div className="flex flex-col items-center gap-4">
                {timeLeft > 0 ? (
                  <div className="flex items-center gap-2 text-[#64748b] text-[11px] font-[700] uppercase tracking-wider">
                    <RefreshCw size={12} className="animate-spin text-[#94a3b8]" />
                    Code expires in <span className="text-[#ef3535]">{formatTime(timeLeft)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#ef3535] text-[11px] font-[800] uppercase tracking-wider">
                    <AlertTriangle size={12} />
                    Code has expired
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                  className="text-[11px] font-[800] text-[#1768d1] uppercase tracking-[0.1em] hover:underline disabled:text-[#94a3b8] disabled:no-underline flex items-center gap-2"
                >
                  {resending ? 'Resending...' : resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Verification Code'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="text-center pt-2">
           <button 
             onClick={() => navigate('/register')}
             className="inline-flex items-center gap-2 text-[12px] font-[700] text-[#64748b] uppercase tracking-widest hover:text-[#0f172a] transition-colors"
           >
             <ArrowLeft size={14} />
             Back to registration
           </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
