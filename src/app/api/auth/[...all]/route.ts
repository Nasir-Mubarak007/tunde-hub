import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/features/auth/infrastructure/auth";

export const { GET, POST } = toNextJsHandler(auth);
