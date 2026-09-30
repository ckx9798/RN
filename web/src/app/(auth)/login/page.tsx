import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>이메일로 로그인</h1>
      <p className={styles.description}>
        이메일로 받은 6자리 코드를 입력하면 로그인돼요.
      </p>
      <LoginForm />
    </div>
  );
}
