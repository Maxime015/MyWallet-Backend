import { resendClient, sender } from "../config/resend.js"
import { createWelcomeEmailTemplate } from "../emails/emailTemplates.js"

export const sendWelcomeEmail = async (email, name) => {
  const { data, error } = await resendClient.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: email,
    subject: "Welcome to MyWallet!",
    html: createWelcomeEmailTemplate(name),
  });

  if (error) {
    console.error("Error sending welcome email:", error);
    throw new Error("Failed to send welcome email");
  }

  console.log("Welcome Email sent successfully", data);
};
