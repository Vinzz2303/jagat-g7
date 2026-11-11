import { redirect } from "next/navigation";

// JAGAT dipakai sendiri — tidak perlu login. Langsung bypass ke console.
export default function LoginPage() {
  redirect("/console");
}
