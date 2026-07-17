import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { Sun, Moon, Monitor, Eye, EyeOff, Loader2 } from 'lucide-react';
import styles from './Login.module.css';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const { user, login, signup, resetPassword, signInWithGoogle, loading, error } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setSuccessMsg('Password reset email sent! Check your inbox.');
        // Optionally switch back to login after a delay, or let the user click back
      } else if (isLogin) {
        await login(email, password);
        navigate('/');
      } else {
        await signup(email, password, businessName);
        navigate('/');
      }
    } catch (err) {
      // Error is handled in store
    }
  };

  const handleGoogleSignIn = async () => {
    setSuccessMsg('');
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      // Error is handled in store
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.themeBtn} onClick={toggleTheme} title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}>
        {theme === 'light' && <Sun size={20} />}
        {theme === 'dark' && <Moon size={20} />}
        {theme === 'system' && <Monitor size={20} />}
      </button>

      <div className={`${styles.card} glass-panel animate-fade-in`}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store" aria-hidden="true"><path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"></path><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"></path><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"></path></svg>
          </div>
          <h1 className="heading-1">
            {isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
          </h1>
          <p className={styles.subtitle}>
            {isForgotPassword 
              ? 'Enter your email to receive a password reset link' 
              : (isLogin ? 'Enter your details to access your account' : 'Setup your billing system in seconds')}
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {successMsg && <div className={styles.successMessage}>{successMsg}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {!isLogin && !isForgotPassword && (
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input 
                type="text" 
                className="input-field" 
                required 
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

          {!isForgotPassword && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className={styles.passwordWrapper}>
                <input 
                  type={showPassword ? "text" : "password"}
                  className="input-field" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
                <button 
                  type="button" 
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {isLogin && (
                <button 
                  type="button" 
                  className={styles.forgotPassword}
                  onClick={() => { setIsForgotPassword(true); setSuccessMsg(''); }}
                >
                  Forgot Password?
                </button>
              )}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading && <Loader2 size={18} className={styles.loadingSpinner} />}
            {loading ? 'Processing...' : (isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Sign Up'))}
          </button>
        </form>

        {!isForgotPassword && (
          <>
            <div className={styles.divider}>or</div>
            
            <button 
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading && <Loader2 size={18} className={styles.loadingSpinner} />}
              <GoogleIcon />
              Continue with Google
            </button>
          </>
        )}

        <div className={styles.footer}>
          {isForgotPassword ? (
            <p>
              Remember your password?{' '}
              <button 
                type="button" 
                className={styles.linkBtn}
                onClick={() => { setIsForgotPassword(false); setSuccessMsg(''); }}
              >
                Back to Login
              </button>
            </p>
          ) : (
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button 
                type="button" 
                className={styles.linkBtn}
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
