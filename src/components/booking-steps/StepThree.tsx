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
  Smartphone,
  Clock3,
} from "lucide-react";

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
  { id: "online", label: "Online Transfer", icon: Smartphone },
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

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSubmitting(true);
      const normalized: Partial<BookingFormData> = {
        notificationMethods: toApiMethods(values.notificationMethods),
        wasteTypes: values.wasteTypes ?? [],
        // for Sheets + email compatibility
        // @ts-expect-error allow passthrough
        wasteTypesSelected: values.wasteTypes ?? [],
        specialInstructions: values.specialInstructions?.trim() || undefined,
        urgentJob: values.urgentJob,
        // ⬇️ save payment method
        // @ts-expect-error back-compat on interface
        paymentMethod: values.paymentMethod,
      };
      await onSubmit(normalized);
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
                  Confirm booking — £{amountGBP.toFixed(2)}
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
