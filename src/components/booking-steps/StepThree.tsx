import React, { useMemo, useState } from "react";
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
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

import { BookingFormData } from "@/components/BookingForm";
import {
  MessageSquare,
  Zap,
  ChevronLeft,
  Mail,
  Phone as PhoneIcon,
  Loader2,
  CreditCard,
  Banknote,
  Clock3,
  Landmark, // 🏦 bank icon
} from "lucide-react";

/* 🔶 Stripe */
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";

/** ✅ Keep labels EXACTLY as backend expects */
const WASTE_TYPES = [
  "Mixed builders waste",
  "Hardcore/soil",
  "Mixed furniture",
  "General waste",
  "Garden waste",
  "Food waste",
  "Wood",
  "Green waste",
  "Cardboard",
  "Bathroom strip out",
  "Kitchen strip out",
] as const;

const notificationOptions = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: PhoneIcon },
];

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "bank", label: "Bank Transfer", icon: Landmark },
];

/** ⏱️ Time slot rules — SAME as backend (Apps Script) */
const SLOT_RULES: Record<
  string,
  { display: string; surcharge: number; min: number }
> = {
  ANY: { display: "Any time", surcharge: 0, min: 0 },
  "6_9_AM": { display: "06:00–09:00", surcharge: 29, min: 0 },
  "9_12_AM": { display: "09:00–12:00", surcharge: 0, min: 0 },
  "12_3_PM": { display: "12:00–15:00", surcharge: 0, min: 0 },
  "3_6_PM": { display: "15:00–18:00", surcharge: 29, min: 0 },
  "6_9_PM": { display: "18:00–21:00", surcharge: 39, min: 0 },
  AFTER_9PM: { display: "After 21:00", surcharge: 0, min: 179 },
};

// Map UI ids -> API values expected by backend
const toApiMethods = (vals: string[]) =>
  vals.map((v) =>
    v === "whatsapp" ? "WhatsApp" : v === "email" ? "Email" : v === "sms" ? "SMS" : v
  );

const formSchema = z.object({
  notificationMethods: z.array(z.string()).min(1, "Select at least one notification method"),
  wasteTypes: z.array(z.string()).min(1, "Select at least one waste type"),
  specialInstructions: z.string().optional(),
  urgentJob: z.boolean().default(false),
  paymentMethod: z.string().min(1, "Select a payment method"),
});

interface StepThreeProps {
  initialData: BookingFormData;
  onSubmit: (data: Partial<BookingFormData>) => Promise<void> | void;
  onBack: () => void;
}

export const StepThree = ({ initialData, onSubmit, onBack }: StepThreeProps) => {
  const [submitting, setSubmitting] = useState(false);

  /* 🔶 Stripe hooks */
  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notificationMethods: initialData.notificationMethods?.map((m) => m.toLowerCase()) || [],
      wasteTypes: initialData.wasteTypes || [],
      specialInstructions: initialData.specialInstructions || "",
      urgentJob: Boolean(initialData.urgentJob),
      paymentMethod: (initialData as any).paymentMethod || "",
    },
    mode: "onChange",
  });

  /** 💰 Calculate payable amount from selected time slot */
  const slotKey = initialData.collectionTimeSlot || "";
  const slotRule = SLOT_RULES[slotKey] || SLOT_RULES["ANY"];
  const { amountGBP, note } = useMemo(() => {
    if (slotKey === "AFTER_9PM") {
      return { amountGBP: slotRule.min, note: "Minimum charge applies" };
    }
    return { amountGBP: slotRule.surcharge, note: slotRule.surcharge > 0 ? "Time-slot surcharge" : "No extra charge" };
  }, [slotKey, slotRule]);

  const paymentLabel =
    PAYMENT_METHODS.find((m) => m.id === form.watch("paymentMethod"))?.label || "";

  /* 🔶 Create PaymentIntent via Apps Script (uses your .env key) *//* 🔶 Create PaymentIntent via Apps Script (uses your .env URL) */
async function createPaymentIntentOnServer(amount: number) {
  const url = import.meta.env.VITE_SHEETS_WEB_APP_URL; // already set in your .env
  if (!url) throw new Error("Web App URL missing");

  // Make it a "simple" CORS request (no preflight)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "createPaymentIntent",
      amountPence: Math.round(amount * 100),
      refHint: initialData?.contactName || "Plus Vans",
      email: (initialData as any)?.email,
      name: initialData?.contactName,
    }),
    redirect: "follow",
  });

  // Helpful diagnostics if GAS throws HTML or empty text
  const raw = await res.text();
  let json: any;
  try { json = JSON.parse(raw); } catch {
    throw new Error(`Server returned non-JSON:\n${raw?.slice(0,300) || "(empty)"}`);
  }
  if (!json.ok) throw new Error(json.error || "Failed to create PaymentIntent");
  return json.client_secret as string;
}

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSubmitting(true);

      // 🔶 Card flow → pre-charge
      if (values.paymentMethod === "card") {
        if (!stripe || !elements) throw new Error("Stripe not ready");

        const clientSecret = await createPaymentIntentOnServer(amountGBP);

        const card = elements.getElement(CardElement);
        if (!card) throw new Error("Card element missing");

        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card,
            billing_details: {
              name: initialData.contactName,
              email: (initialData as any)?.email,
              phone: (initialData as any)?.phoneNumber,
            },
          },
        });

        if (error) throw new Error(error.message || "Payment failed");
        if (paymentIntent?.status !== "succeeded") throw new Error("Payment not completed");

        const normalized: Partial<BookingFormData> = {
          notificationMethods: toApiMethods(values.notificationMethods),
          wasteTypes: values.wasteTypes ?? [],
          // @ts-expect-error allow passthrough
          wasteTypesSelected: values.wasteTypes ?? [],
          specialInstructions: values.specialInstructions?.trim() || undefined,
          urgentJob: values.urgentJob,
          // extra fields for backend/Sheets
          // @ts-expect-error extra fields allowed
          paymentMethod: "card",
          // @ts-expect-error extra fields allowed
          paymentStatus: "Paid",
          // @ts-expect-error extra fields allowed
          paymentIntentId: paymentIntent.id,
        };
        await onSubmit(normalized);
        return;
      }

      // 🔶 Non-card → just store choice
      const normalized: Partial<BookingFormData> = {
        notificationMethods: toApiMethods(values.notificationMethods),
        wasteTypes: values.wasteTypes ?? [],
        // @ts-expect-error allow passthrough
        wasteTypesSelected: values.wasteTypes ?? [],
        specialInstructions: values.specialInstructions?.trim() || undefined,
        urgentJob: values.urgentJob,
        // @ts-expect-error extra fields allowed
        paymentMethod: values.paymentMethod,
        // @ts-expect-error extra fields allowed
        paymentStatus: "Unpaid",
      };
      await onSubmit(normalized);
    } catch (err: any) {
      alert(err.message || "Payment error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Final details</h2>
        <p className="text-muted-foreground">
          Tell us about the waste and how we should notify you.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Waste Selection */}
          <fieldset className="rounded-xl border bg-card/50 p-4 sm:p-5">
            <legend className="px-2 text-sm font-semibold">Select waste types *</legend>

            <FormField
              control={form.control}
              name="wasteTypes"
              render={({ field }) => (
                <FormItem className="mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {WASTE_TYPES.map((label) => {
                      const checked = field.value?.includes(label) ?? false;
                      return (
                        <label
                          key={label}
                          htmlFor={`waste-${label}`}
                          className={[
                            "flex items-center justify-between rounded-lg border px-4 py-3 bg-background",
                            "transition-all cursor-pointer",
                            checked
                              ? "border-[3px] border-primary ring-2 ring-primary/20 bg-primary/[0.04]"
                              : "hover:bg-accent hover:text-accent-foreground",
                          ].join(" ")}
                        >
                          <span className="text-sm font-medium">{label}</span>
                          <FormControl>
                            <Checkbox
                              id={`waste-${label}`}
                              className="peer sr-only"
                              checked={checked}
                              onCheckedChange={(isChecked) => {
                                if (isChecked) {
                                  field.onChange([...(field.value || []), label]);
                                } else {
                                  field.onChange(
                                    (field.value || []).filter((v: string) => v !== label)
                                  );
                                }
                              }}
                              disabled={submitting}
                            />
                          </FormControl>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {/* 📋 Mini summary: Time slot + Payable + Method (PLACED JUST ABOVE PAYMENT METHOD) */}
          <div className="rounded-xl border bg-card/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <p className="text-sm">
                  <span className="font-semibold">Time slot:</span>{" "}
                  {slotRule.display}
                </p>
              </div>
              <p className="text-sm">
                <span className="font-semibold">Amount due:</span>{" "}
                £{amountGBP.toFixed(2)}{" "}
                <span className="text-muted-foreground">({note})</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Payment method:</span>{" "}
                {paymentLabel || "—"}
              </p>
            </div>
          </div>

          {/* Payment Method Section */}
          <div>
            <h3 className="text-base font-bold mb-2">Payment Method *</h3>
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {PAYMENT_METHODS.map((method) => {
                      const Icon = method.icon;
                      const selected = field.value === method.id;
                      return (
                        <div
                          key={method.id}
                          onClick={() => field.onChange(method.id)}
                          className={[
                            "flex flex-col items-center justify-center rounded-lg border-2 p-4 bg-card transition-all cursor-pointer",
                            selected
                              ? "border-[3px] border-primary ring-2 ring-primary/20 bg-primary/[0.04]"
                              : "border-muted hover:bg-accent hover:text-accent-foreground",
                          ].join(" ")}
                        >
                          <Icon className="w-6 h-6 mb-2" />
                          <span className="text-sm font-medium">{method.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 🔶 Show Stripe CardElement ONLY when Card selected */}
            {form.watch("paymentMethod") === "card" && (
              <div className="mt-4 rounded-lg border p-4 bg-card">
                <p className="text-sm font-medium mb-2">Enter card details</p>
                <div className="rounded-md border px-3 py-2">
                  <CardElement
                    options={{
                      hidePostalCode: true,
                      style: { base: { fontSize: "16px" } },
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You will be charged <b>£{amountGBP.toFixed(2)}</b> for this time slot.
                </p>
              </div>
            )}

            {/* 🔶 Show Bank details panel ONLY when Bank Transfer selected */}
            {form.watch("paymentMethod") === "bank" && (
              <div className="mt-4 rounded-lg border p-4 bg-card">
                <p className="text-sm font-medium mb-2">Bank transfer details</p>
                <div className="rounded-md border px-4 py-3 bg-background">
                  <p className="text-sm"><b>Account Name:</b> Plus Vans Group Ltd</p>
                  <p className="text-sm"><b>Account Number:</b> 23594402</p>
                  <p className="text-sm"><b>Sortcode:</b> 230801</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Please complete the transfer and include your name as reference.
                </p>
              </div>
            )}

            {/* 🔶 Show Cash info panel ONLY when Cash selected */}
            {form.watch("paymentMethod") === "cash" && (
              <div className="mt-4 rounded-lg border p-4 bg-card">
                <p className="text-sm font-medium mb-2">Cash on Delivery Selected</p>
                <div className="rounded-md border px-4 py-3 bg-background">
                  <p className="text-sm">
                    We will collect payment in cash when we arrive. Your booking is confirmed.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Special instructions (optional) */}
          <div>
            <h3 className="text-base font-bold mb-2">Special instructions (optional)</h3>
            <FormField
              control={form.control}
              name="specialInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Gate code, parking info, floor, lift access, etc."
                      className="resize-none"
                      rows={3}
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Urgent toggle */}
          <FormField
            control={form.control}
            name="urgentJob"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 bg-secondary/50">
                <div className="space-y-0.5">
                  <FormLabel className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Mark as urgent
                  </FormLabel>
                  <FormDescription>Prioritise this collection</FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={submitting}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Notification preferences */}
          <div>
            <h3 className="text-base font-bold mb-2">How should we notify you?</h3>
            <FormField
              control={form.control}
              name="notificationMethods"
              render={() => (
                <FormItem>
                  <FormDescription className="mb-3">
                    Choose how you'd like to receive booking updates
                  </FormDescription>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {notificationOptions.map((option) => (
                      <FormField
                        key={option.id}
                        control={form.control}
                        name="notificationMethods"
                        render={({ field }) => {
                          const Icon = option.icon;
                          const checked = field.value?.includes(option.id);
                          return (
                            <FormItem key={option.id}>
                              <FormControl>
                                <div
                                  className={[
                                    "flex flex-col items-center justify-center rounded-lg border-2 p-4 bg-card transition-all",
                                    checked
                                      ? "border-[3px] border-primary ring-2 ring-primary/20 bg-primary/[0.04]"
                                      : "border-muted hover:bg-accent hover:text-accent-foreground",
                                  ].join(" ")}
                                  onClick={() => {
                                    if (checked) {
                                      field.onChange((field.value || []).filter((v: string) => v !== option.id));
                                    } else {
                                      field.onChange([...(field.value || []), option.id]);
                                    }
                                  }}
                                >
                                  <Icon className="w-6 h-6 mb-2" />
                                  <span className="text-sm font-medium">{option.label}</span>
                                </div>
                              </FormControl>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
              size="lg"
              disabled={submitting}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Button
              type="submit"
              size="lg"
              className="flex-1 bg-gradient-success hover:opacity-90 transition-opacity"
              disabled={submitting || !form.formState.isValid}
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Booking…
                </span>
              ) : (
                <>
                  {form.watch("paymentMethod") === "card" ? "Pay & Confirm" : "Confirm booking"}
                  {" — £"}{amountGBP.toFixed(2)}
                  {paymentLabel ? ` via ${paymentLabel}` : ""}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      {submitting && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm grid place-items-center rounded-xl">
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Submitting your booking…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepThree;
