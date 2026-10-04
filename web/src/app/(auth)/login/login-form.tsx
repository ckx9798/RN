"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { normalizeEmail, normalizeOtp } from "@/lib/auth/otp";
import styles from "./login.module.css";

const RESEND_COOLDOWN_SECONDS = 60;

type Step = "email" | "code";

const EMAIL_SEND_ERROR = "코드를 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
const CODE_VERIFY_ERROR = "코드를 확인하지 못했어요. 코드를 다시 확인해 주세요.";

export function LoginForm() {
  const router = useRouter();
  const supabase = useRef(createBrowserSupabase()).current;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  async function sendCode(targetEmail: string) {
    setIsSubmitting(true);
    setError(null);

    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: true },
    });

    setIsSubmitting(false);

    if (sendError) {
      setError(EMAIL_SEND_ERROR);
      return false;
    }

    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setError("올바른 이메일 주소를 입력해 주세요.");
      return;
    }

    setEmail(normalizedEmail);

    const sent = await sendCode(normalizedEmail);

    if (sent) {
      setStep("code");
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedOtp = normalizeOtp(code);

    if (!normalizedOtp) {
      setError("6자리 숫자 코드를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: normalizedOtp,
      type: "email",
    });

    setIsSubmitting(false);

    if (verifyError) {
      setError(CODE_VERIFY_ERROR);
      return;
    }

    router.replace("/");
  }

  async function handleResend() {
    if (cooldown > 0 || isSubmitting) {
      return;
    }

    await sendCode(email);
  }

  if (step === "email") {
    return (
      <form className={styles.form} onSubmit={handleEmailSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          코드 받기
        </button>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleCodeSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="code">
          인증 코드
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className={`${styles.input} ${styles.codeInput}`}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={isSubmitting}
          required
        />
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
        로그인
      </button>
      <div className={styles.secondaryRow}>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          disabled={isSubmitting}
        >
          이메일 다시 입력
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={handleResend}
          disabled={cooldown > 0 || isSubmitting}
        >
          {cooldown > 0 ? `코드 재전송 (${cooldown}초)` : "코드 재전송"}
        </button>
      </div>
    </form>
  );
}
