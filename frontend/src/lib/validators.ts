import { z } from "zod";

/**
 * Validates a 13-digit Thai National Citizen ID using Modulo-11 checksum.
 * Algorithm:
 * 1. Clean digits, check length is 13, and ensure not all identical repeated digits.
 * 2. Sum d[i] * (13 - i) for i = 0 to 11.
 * 3. checkDigit = (11 - (sum % 11)) % 10.
 * 4. Compare checkDigit === d[12].
 */
export function isValidThaiNationalId(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 13) return false;

  // Reject repeated identical digits (e.g. 0000000000000, 1111111111111)
  if (/^(\d)\1{12}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(digits[12], 10);
}

export const localizedTextSchema = z.object({
  th: z.string().trim().min(1, "Thai text is required"),
  en: z.string().trim().min(1, "English text is required"),
});

export type LocalizedTextSchemaValues = z.infer<typeof localizedTextSchema>;

export const optionalLocalizedTextSchema = z.object({
  th: z.string().trim().optional(),
  en: z.string().trim().optional(),
});

export type OptionalLocalizedTextSchemaValues = z.infer<typeof optionalLocalizedTextSchema>;

export const thaiNationalIdSchema = z.string().refine((val) => isValidThaiNationalId(val), {
  message: "Invalid Thai National ID",
});

export const identityDocumentSchema = z
  .string()
  .trim()
  .min(5, "ID or Passport must be at least 5 characters");

export const thaiPhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+66|0)[689]\d{8}$|^0\d{8,9}$/, "Invalid Thai phone number format");

export const licensePlateSchema = z
  .string()
  .trim()
  .min(2, "Invalid license plate format");

export const moneyAmountSchema = z
  .number()
  .finite("Amount must be a finite number")
  .nonnegative("Amount cannot be negative")
  .refine(
    (val) => {
      const rounded = Math.round(val * 100) / 100;
      return Math.abs(val - rounded) < 0.0001;
    },
    { message: "Amount cannot exceed 2 decimal places" }
  );

export const positiveMoneySchema = z
  .number()
  .finite("Amount must be a finite number")
  .positive("Amount must be greater than 0")
  .refine(
    (val) => {
      const rounded = Math.round(val * 100) / 100;
      return Math.abs(val - rounded) < 0.0001;
    },
    { message: "Amount cannot exceed 2 decimal places" }
  );
