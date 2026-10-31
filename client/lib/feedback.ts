/** Feedback from the thank-you letter on the home page: anyone may send it; a signed-in student's token links their account. */
import { send } from "./api/http";

export type FeedbackRole = "student" | "judge" | "faculty" | "parent" | "guest" | "other";

export type FeedbackInput = {
  name: string;
  email: string;
  phone: string;
  role: FeedbackRole;
  institution: string;
  rating: number;
  liked: string;
  improve: string;
};

export async function sendFeedback(input: FeedbackInput, token?: string): Promise<void> {
  await send("POST", "/feedback", { token, body: { ...input } });
}
