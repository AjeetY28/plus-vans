import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
  FormMessage, FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, MapPin, Clock, User, Phone, ChevronLeft } from "lucide-react";
import { format, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { BookingFormData } from "@/components/BookingForm";

/* ===================== Phone validation ===================== */
import { isValidPhoneNumber } from "libphonenumber-js";

/* ===================== GAS helper (friendly errors) ===================== */
const FRIENDLY_ADDR_MSG =
  "Address Finder Temporarily Unavailable\nOur address finder is temporarily busy. Please complete your details below.";

function mapFriendlyError(rawText: string) {
  // Try JSON first
  try {
    const j = JSON.parse(rawText);
    const msg = (j && (j.error || j.message)) ? String(j.error || j.message) : "";
    if (/loqate|postcodeanywhere|addressnow|out of credit|quota|limit|temporarily/i.test(msg)) {
      return FRIENDLY_ADDR_MSG;
    }
    if (j?.ok === false && msg) return msg; // generic server error from backend
  } catch {
    /* ignore non-JSON */
  }
  // Raw text heuristics
  if (/loqate|postcodeanywhere|addressnow|out of credit|quota|limit|temporarily/i.test(rawText)) {
    return FRIENDLY_ADDR_MSG;
  }
  return "Postcode service error. Please type address manually.";
}

async function gasCall(payload: any) {
  const url = import.meta.env.VITE_SHEETS_WEB_APP_URL;
  if (!url) throw new Error("VITE_SHEETS_WEB_APP_URL missing");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();

  // Success path: valid JSON with ok !== false
  try {
    const json = JSON.parse(raw);
    if (json?.ok === false) {
      throw new Error(mapFriendlyError(raw));
    }
    return json;
  } catch {
    // Non-JSON error → friendly mapping
    throw new Error(mapFriendlyError(raw));
  }
}

/* ===================== Loqate helpers ===================== */
type LoqateItem = { Id?: string; id?: string; Type?: string };

async function resolveFirstAddressId(postcode: string): Promise<string | null> {
  // level 1: by postcode text
  const first = await gasCall({ action: "addressfind", query: postcode, country: "GB" });
  let items: LoqateItem[] = Array.isArray(first.items) ? first.items : [];
  if (!items.length) return null;

  // if already addresses
  let address = items.find((it) => (it.Type || "").toLowerCase() === "address");
  if (address?.Id || address?.id) return (address.Id || address.id)!;

  // level 2: inside first container
  const container1 = items[0]?.Id || items[0]?.id;
  if (!container1) return null;

  const second = await gasCall({ action: "addressfind", country: "GB", container: container1 });
  items = Array.isArray(second.items) ? second.items : [];
  if (!items.length) return null;

  address = items.find((it) => (it.Type || "").toLowerCase() === "address");
  if (address?.Id || address?.id) return (address.Id || address.id)!;

  // level 3: one more deep if needed
  const container2 = items[0]?.Id || items[0]?.id;
  if (!container2) return null;

  const third = await gasCall({ action: "addressfind", country: "GB", container: container2 });
  const items3: LoqateItem[] = Array.isArray(third.items) ? third.items : [];
  address = items3.find((it) => (it.Type || "").toLowerCase() === "address");
  return (address?.Id || address?.id) || null;
}

/* ===================== Time slots (24-hour) ===================== */
const TIME_SLOTS = [
  { key: "ANY", label: "Any time" },
  { key: "6_9_AM", label: "06:00–09:00" },
  { key: "9_12_AM", label: "09:00–12:00" },
  { key: "12_3_PM", label: "12:00–15:00" },
  { key: "3_6_PM", label: "15:00–18:00" },
  { key: "6_9_PM", label: "18:00–21:00" },
  { key: "AFTER_9PM", label: "After 21:00" },
] as const;

/* Legacy label → key mapping */
const LEGACY_LABEL_TO_KEY: Record<string, typeof TIME_SLOTS[number]["key"]> = {
  "any time": "ANY",
  "6-9am": "6_9_AM",
  "9-12am": "9_12_AM",
  "12-3pm": "12_3_PM",
  "3-6pm": "3_6_PM",
  "6-9pm": "6_9_PM",
  "after 9pm": "AFTER_9PM",
};

/* ===================== Validation ===================== */
const UK_PC_REGEX = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;

const ukPhone = z
  .string()
  .trim()
  .refine((v) => {
    if (!v) return false;
    const cleaned = v.replace(/\s+/g, "");
    const candidate = cleaned.startsWith("+")
      ? cleaned
      : cleaned.startsWith("0")
        ? "+44" + cleaned.slice(1)
        : "+44" + cleaned;
    try {
      return isValidPhoneNumber(candidate, "GB");
    } catch {
      return false;
    }
  }, "Please enter a valid UK phone number");

const formSchema = z
  .object({
    collectionDate: z.date({ required_error: "Collection date is required" }),
    collectionTimeSlot: z.string().min(1, "Please select a time slot"),
    postcode: z.string().regex(UK_PC_REGEX, "Please enter a valid UK postcode"),
    addressLine1: z.string().min(1, "Address line 1 is required"),
    addressLine2: z.string().optional(),
    town: z.string().min(1, "Town is required"),
    county: z.string().optional(),
    sameContact: z.boolean().default(true),
    collectionContactName: z.string().optional(),
    collectionPhoneNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sameContact) {
      if (!data.collectionContactName || data.collectionContactName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["collectionContactName"],
          message: "Contact name is required (min 2 chars)",
        });
      }
      const v = data.collectionPhoneNumber || "";
      const cleaned = v.replace(/\s+/g, "");
      const candidate = cleaned.startsWith("+")
        ? cleaned
        : cleaned.startsWith("0")
          ? "+44" + cleaned.slice(1)
          : "+44" + cleaned;
      const ok = (() => {
        try {
          return isValidPhoneNumber(candidate, "GB");
        } catch {
          return false;
        }
      })();
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["collectionPhoneNumber"],
          message: "Please enter a valid UK phone number",
        });
      }
    }
  });

interface StepTwoProps {
  initialData: BookingFormData;
  onNext: (data: Partial<BookingFormData>) => void;
  onBack: () => void;
}

/* ================ Loqate → UI field mapper ================ */
function mapLoqateToUi(raw: any) {
  return {
    line1: raw?.Line1 || raw?.Address1 || "",
    line2: raw?.Line2 || raw?.Address2 || "",
    town: raw?.PostTown || raw?.City || raw?.Town || "",
    county: raw?.ProvinceName || raw?.County || raw?.Province || "",
    postcode: (raw?.PostalCode || raw?.PostCode || raw?.Postcode || "").toUpperCase(),
  };
}

export const StepTwo: React.FC<StepTwoProps> = ({ initialData, onNext, onBack }) => {
  const [pcStatus, setPcStatus] = useState<null | "idle" | "loading" | "ok" | "notfound" | "error">(null);
  const debounceRef = useRef<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      collectionDate: initialData.collectionDate ?? startOfToday(),
      collectionTimeSlot:
        initialData.collectionTimeSlot ??
        ((): string => {
          const legacy = (initialData.collectionTime ?? "").toLowerCase().trim();
          if (legacy && LEGACY_LABEL_TO_KEY[legacy]) return LEGACY_LABEL_TO_KEY[legacy];
          const hit = Object.entries(LEGACY_LABEL_TO_KEY).find(([lbl]) => legacy.includes(lbl));
          return hit?.[1] ?? "";
        })(),
      postcode: (initialData.postcode ?? "").toUpperCase(),
      addressLine1: initialData.addressLine1 ?? "",
      addressLine2: initialData.addressLine2 ?? "",
      town: initialData.town ?? "",
      county: initialData.county ?? "",
      sameContact: initialData.sameContact ?? true,
      collectionContactName: initialData.collectionContactName ?? "",
      collectionPhoneNumber: initialData.collectionPhoneNumber ?? "",
    },
    mode: "onChange",
  });

  const sameContact = form.watch("sameContact");
  const watchedPostcode = form.watch("postcode");

  /* ===================== Debounced postcode auto-lookup ===================== */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const pc = (watchedPostcode || "").trim().toUpperCase();
    if (!pc) {
      setPcStatus(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!UK_PC_REGEX.test(pc)) {
        setPcStatus("notfound");
        form.setError("postcode", { message: "Invalid UK postcode" });
        return;
      }

      setPcStatus("loading");
      form.clearErrors("postcode");

      try {
        const addrId = await resolveFirstAddressId(pc);
        if (!addrId) {
          setPcStatus("notfound");
          form.setError("postcode", { message: "No addresses found for this postcode" });
          return;
        }

        const getRes = await gasCall({ action: "addressget", id: addrId });
        const raw = getRes.item || {};
        const addr = mapLoqateToUi(raw);

        if (addr.line1) form.setValue("addressLine1", addr.line1, { shouldValidate: true });
        if (addr.line2 && !form.getValues("addressLine2"))
          form.setValue("addressLine2", addr.line2, { shouldValidate: true });
        if (addr.town) form.setValue("town", addr.town, { shouldValidate: true });
        if (addr.county) form.setValue("county", addr.county, { shouldValidate: true });
        if (addr.postcode) form.setValue("postcode", addr.postcode, { shouldValidate: true });

        setPcStatus("ok");
      } catch (e: any) {
        setPcStatus("error");
        // const msg =
        //   e?.message || "Postcode service error. Please type address manually.";
        // form.setError("postcode", { message: msg });
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPostcode]);

  /* ===================== Extra safety on blur ===================== */
  const handlePostcodeBlur = async () => {
    const pc = (form.getValues("postcode") || "").trim().toUpperCase();
    if (!pc || !UK_PC_REGEX.test(pc)) return;
    if (pcStatus === "ok" || pcStatus === "notfound") return;

    try {
      setPcStatus("loading");
      const findRes = await gasCall({ action: "addressfind", query: pc, country: "GB" });
      const items: any[] = Array.isArray(findRes.items) ? findRes.items : [];
      if (!items.length) {
        setPcStatus("notfound");
        form.setError("postcode", { message: "No addresses found for this postcode" });
        return;
      }
      const id = items[0]?.Id || items[0]?.id;
      const getRes = await gasCall({ action: "addressget", id });
      const addr = mapLoqateToUi(getRes.item || {});
      if (addr.line1) form.setValue("addressLine1", addr.line1, { shouldValidate: true });
      if (addr.line2 && !form.getValues("addressLine2"))
        form.setValue("addressLine2", addr.line2, { shouldValidate: true });
      if (addr.town) form.setValue("town", addr.town, { shouldValidate: true });
      if (addr.county) form.setValue("county", addr.county, { shouldValidate: true });
      if (addr.postcode) form.setValue("postcode", addr.postcode, { shouldValidate: true });
      setPcStatus("ok");
    } catch (e: any) {
      setPcStatus("error");
      const msg =
        e?.message || "Postcode service error. Please type address manually.";
      form.setError("postcode", { message: msg });
    }
  };

  /* ===================== Submit ===================== */
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const label = TIME_SLOTS.find((t) => t.key === values.collectionTimeSlot)?.label ?? "";
    onNext({
      collectionDate: values.collectionDate,
      collectionTimeSlot: values.collectionTimeSlot,
      collectionTime: label,
      postcode: values.postcode.toUpperCase(),
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      town: values.town,
      county: values.county,
      sameContact: values.sameContact,
      collectionContactName: values.sameContact ? undefined : values.collectionContactName,
      collectionPhoneNumber: values.sameContact ? undefined : values.collectionPhoneNumber,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Collection Details</h2>
        <p className="text-muted-foreground">When and where should we collect from?</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Collection Date */}
            <FormField
              control={form.control}
              name="collectionDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Collection Date *
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < startOfToday()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Time Slot (24-hour) */}
            <FormField
              control={form.control}
              name="collectionTimeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Collection Time (24-hour) *
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time slot" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIME_SLOTS.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Address */}
          <FormField
            control={form.control}
            name="postcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Postcode *
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="SW1A 1AA"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value.toUpperCase());
                      setPcStatus("idle");
                    }}
                    onBlur={(e) => {
                      field.onBlur();
                      handlePostcodeBlur();
                    }}
                  />
                </FormControl>

                {pcStatus === "loading" && <FormDescription>Checking postcode…</FormDescription>}
                {pcStatus === "ok" && <FormDescription>Address auto-filled ✔</FormDescription>}
                {pcStatus === "notfound" && (
                  <FormDescription>Invalid postcode. Please check and try again.</FormDescription>
                )}

                {/* Optional soft banner on provider failure */}
                {pcStatus === "error" && (
                  <div className="mt-2 rounded-md border border-gray-300 bg-gray-100 p-3 text-sm text-gray-800">
                    <span className="font-medium">Address Finder Temporarily Unavailable</span>
                    <br />
                    Our address finder is temporarily busy. Please complete your details below.
                  </div>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1 *</FormLabel>
                <FormControl>
                  <Input placeholder="Street address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addressLine2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2 (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Apartment, suite, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="town"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Town/City *</FormLabel>
                  <FormControl>
                    <Input placeholder="London" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="county"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>County (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Greater London" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Same Contact Toggle */}
          <FormField
            control={form.control}
            name="sameContact"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-secondary/50">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Same contact as billing details</FormLabel>
                  <FormDescription>Use the same contact information from step 1</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Alternate Contact */}
          {!sameContact && (
            <div className="space-y-4 animate-fade-in">
              <FormField
                control={form.control}
                name="collectionContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Collection Contact Name *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="collectionPhoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Collection Phone Number *
                    </FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="07700 900123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1" size="lg">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity" size="lg">
              Continue
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default StepTwo;
