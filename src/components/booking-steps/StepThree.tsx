import React, { useState } from "react";
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

// Map UI ids -> API values expected by backend ("WhatsApp", "Email", "SMS")
const toApiMethods = (vals: string[]) =>
  vals.map((v) =>
    v === "whatsapp" ? "WhatsApp" : v === "email" ? "Email" : v === "sms" ? "SMS" : v
  );

const formSchema = z.object({
  notificationMethods: z.array(z.string()).min(1, "Select at least one notification method"),
  wasteTypes: z.array(z.string()).optional(),
  jobDescription: z.string().min(10, "Job description must be at least 10 characters"),
  specialInstructions: z.string().optional(),
  urgentJob: z.boolean().default(false),
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
      jobDescription: initialData.jobDescription || "",
      specialInstructions: initialData.specialInstructions || "",
      urgentJob: Boolean(initialData.urgentJob),
    },
    mode: "onChange",
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSubmitting(true);
      const normalized: Partial<BookingFormData> = {
        notificationMethods: toApiMethods(values.notificationMethods),
        // send both keys so Apps Script can read either
        wasteTypes: values.wasteTypes ?? [],
        // 👇 important for the “Waste Types (selected)” column
        // @ts-expect-error allow passthrough
        wasteTypesSelected: values.wasteTypes ?? [],
        jobDescription: values.jobDescription,
        specialInstructions: values.specialInstructions?.trim() || undefined,
        urgentJob: values.urgentJob,
      };
      await onSubmit(normalized);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative space-y-6">
      {/* Header — mirror Index.html tone */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Final details</h2>
        <p className="text-muted-foreground">
          Tell us about the waste and how we should notify you.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">

          {/* 🆕 Boxed Waste Section (like textarea card) */}
          <fieldset className="rounded-xl border bg-card/50 p-4 sm:p-5">
            <legend className="px-2 text-sm font-semibold">Waste description</legend>

            <FormField
              control={form.control}
              name="wasteTypes"
              render={({ field }) => (
                <FormItem className="mt-2">
                  <FormDescription className="mb-3">
                    Select all that apply for this job
                  </FormDescription>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                          {/* peer trick for nice selected styles */}
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
                </FormItem>
              )}
            />
          </fieldset>

          {/* Job description (helpful notes) — already boxed by default textarea styling */}
          <div>
            <h3 className="text-base font-bold mb-2">Job description (helpful notes)</h3>
            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., 15–20 bags mixed waste, old sofa, some wood…"
                      className="resize-none"
                      rows={4}
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
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

          {/* Urgent toggle — mirrors Index.html “Mark as urgent” */}
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
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={submitting} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* How should we notify you? */}
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
              aria-busy={submitting}
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Booking…
                </span>
              ) : (
                "Submit booking"
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Optional dim overlay while submitting */}
      {submitting && (
        <div
          className="absolute inset-0 bg-background/60 backdrop-blur-sm grid place-items-center rounded-xl"
          role="status"
          aria-live="polite"
        >
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
