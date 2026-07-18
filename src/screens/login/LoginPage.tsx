"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./LoginPage.css";
import { login, requestAccess } from "../../services/authService";
import { saveSession } from "../../services/session";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@risansi\.com$/;
const MIN_PASSWORD_LENGTH = 6;

type Mode = "login" | "request";

const errorMessage = (err: unknown, fallback: string): string => {
  const response = (err as { response?: { data?: { error?: string } } })
    ?.response;
  return response?.data?.error ?? fallback;
};

const LoginPage = () => {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setEmailError("");
    setPasswordError("");
    setNameError("");
    setConfirmPasswordError("");
    setFormError("");
    setFormSuccess("");
  };

  const validateCommon = () => {
    let valid = true;
    const trimmedEmail = email.trim();

    setEmailError("");
    setPasswordError("");
    setFormError("");

    if (!trimmedEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Please enter a valid @risansi.com email.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      valid = false;
    }

    return valid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;
    if (!validateCommon()) return;

    setIsSubmitting(true);
    const trimmedEmail = email.trim();

    try {
      const result = await login(trimmedEmail, password);
      saveSession(result.user);
      router.push("/dashboard");
    } catch (err) {
      setFormError(errorMessage(err, "Unable to sign in. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    let valid = validateCommon();
    setNameError("");
    setConfirmPasswordError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Name is required.");
      valid = false;
    }

    if (confirmPassword !== password) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    }

    if (!valid) return;

    setIsSubmitting(true);
    const trimmedEmail = email.trim();

    try {
      await requestAccess(trimmedName, trimmedEmail, password);
      setFormSuccess(
        "Request submitted — an admin will approve your account before you can sign in."
      );
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (err) {
      setFormError(
        errorMessage(err, "Unable to submit your request. Please try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="branding-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Risansi Industries" className="company-logo" />

        <div className="branding-content">
          <h1>
            Pump Selection
            <br />
            & Testing Portal
          </h1>

          <p>
            Intelligent pump recommendation platform for sales engineers with
            integrated testing reports and project management.
          </p>
        </div>

        <span className="branding-footer">Version 1.0</span>
      </div>

      <div className="login-form-container">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Risansi Industries" className="form-logo" />

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "request"}
            className={mode === "request" ? "active" : ""}
            onClick={() => switchMode("request")}
          >
            Request Access
          </button>
        </div>

        {formSuccess && (
          <div className="form-success" role="status">
            {formSuccess}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} noValidate>
            <h2>Sign In</h2>
            <p>Login with your company credentials</p>

            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}

            <label htmlFor="email">Company Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@risansi.com"
              value={email}
              autoComplete="username"
              aria-invalid={!!emailError}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
                if (formError) setFormError("");
              }}
            />

            {emailError && (
              <span className="error-text" role="alert">
                {emailError}
              </span>
            )}

            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                autoComplete="current-password"
                aria-invalid={!!passwordError}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                  if (formError) setFormError("");
                }}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {passwordError && (
              <span className="error-text" role="alert">
                {passwordError}
              </span>
            )}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestAccess} noValidate>
            <h2>Request Access</h2>
            <p>Submit your details — an admin will review and approve you</p>

            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}

            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="Jane Doe"
              value={name}
              autoComplete="name"
              aria-invalid={!!nameError}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
                if (formError) setFormError("");
              }}
            />

            {nameError && (
              <span className="error-text" role="alert">
                {nameError}
              </span>
            )}

            <label htmlFor="request-email">Company Email</label>
            <input
              id="request-email"
              type="email"
              placeholder="you@risansi.com"
              value={email}
              autoComplete="username"
              aria-invalid={!!emailError}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
                if (formError) setFormError("");
              }}
            />

            {emailError && (
              <span className="error-text" role="alert">
                {emailError}
              </span>
            )}

            <label htmlFor="request-password">Password</label>
            <input
              id="request-password"
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="new-password"
              aria-invalid={!!passwordError}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
                if (formError) setFormError("");
              }}
            />

            {passwordError && (
              <span className="error-text" role="alert">
                {passwordError}
              </span>
            )}

            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              autoComplete="new-password"
              aria-invalid={!!confirmPasswordError}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError("");
                if (formError) setFormError("");
              }}
            />

            {confirmPasswordError && (
              <span className="error-text" role="alert">
                {confirmPasswordError}
              </span>
            )}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Request Access"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
