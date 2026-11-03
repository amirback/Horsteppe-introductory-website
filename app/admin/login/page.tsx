import type { Metadata } from "next";
import { LoginForm } from "../../../components/admin/LoginForm.tsx";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return <LoginForm />;
}
