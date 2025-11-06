import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { BookingFormData } from "@/components/BookingForm";
import { User, Building2, Phone, Mail } from "lucide-react";

/* ✅ Phone + Email validators */
import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/min";
import isEmail from "validator/es/lib/isEmail";

/* ---- small disposable-domain guard (optional) ---- */
const DISPOSABLE = new Set([
  "yopmail.com",
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "sharklasers.com",
  "tempmail.com",
]);

/* ---- helpers ---- */
const looksSequentialOrRepeated = (digits: string) => {
  // strip non-digits then check patterns like 000000..., 111111..., 123456..., 987654...
  const d = digits.replace(/\D/g, "");
  if (!d) return false;
  if (/^(\d)\1{5,}$/.test(d)) return true;
  const seq = "01234567890123456789";
  const rseq = "98765432109876543210";
  return seq.includes(d) || rseq.includes(d);
};

/* ---------- PHONE: UK mobile only (07… / +447…) ---------- */
const ukMobile = z
  .string()
  .trim()
  .refine((v) => {
    const raw = v.replace(/\s+/g, "");
    const e164 = raw.startsWith("+")
      ? raw
      : raw.startsWith("0")
      ? "+44" + raw.slice(1)
      : "+44" + raw; // fallback

    // Must be UK mobile format
    const isGbMobilePattern = /^\+447\d{9}$/.test(e164);
    if (!isGbMobilePattern) return false;

    // Structure-valid per libphonenumber
    if (!isValidPhoneNumber(e164, "GB")) return false;

    // Reject obvious dummy patterns
    const national = e164.replace(/^\+44/, "0");
    if (looksSequentialOrRepeated(national)) return false;

    // Optionally ensure it's classified as MOBILE by lib
    const parsed = parsePhoneNumberFromString(e164);
    if (!parsed) return false;
    const t = parsed.getType?.(); // 'MOBILE', 'FIXED_LINE', etc.
    if (t && t !== "MOBILE") return false;

    return true;
  }, "Enter a valid UK mobile number");

/* ---------- EMAIL ---------- */
const emailSchema = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine(
    (v) =>
      isEmail(v, {
        allow_display_name: false,
        require_tld: true,
        domain_specific_validation: true,
      }),
    "Please enter a valid email"
  )
  .refine((v) => {
    const domain = v.split("@")[1] || "";
    return !DISPOSABLE.has(domain);
  }, "Disposable email domains are not allowed");

const formSchema = z.object({
  contactName: z.string().min(2, "Contact name must be at least 2 characters"),
  companyName: z.string().optional(),
  phoneNumber: ukMobile,   // ✅ strict UK mobile validation
  email: emailSchema,      // ✅ robust email validation
});

interface StepOneProps {
  initialData: BookingFormData;
  onNext: (data: Partial<BookingFormData>) => void;
}

export const StepOne = ({ initialData, onNext }: StepOneProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactName: initialData.contactName,
      companyName: initialData.companyName,
      phoneNumber: initialData.phoneNumber,
      email: initialData.email,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onNext(values);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Customer Information
        </h2>
        <p className="text-muted-foreground">
          Let's start with your contact details
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contact Name *
                </FormLabel>
                <FormControl>
                  <Input placeholder="John Smith" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Name (Optional)
                </FormLabel>
                <FormControl>
                  <Input placeholder="ABC Company Ltd" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number *
                </FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+441234567890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address *
                </FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            Continue
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default StepOne;
