import React from "react";
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, MapPin, Clock, User, Phone, ChevronLeft } from "lucide-react";
import { format, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { BookingFormData } from "@/components/BookingForm";

/** ✅ Keep these in sync with Apps Script TIME_SLOTS */
const TIME_SLOTS = [
  { key: "ANY",       label: "Any time" },
  { key: "6_9_AM",    label: "6-9am" },
  { key: "9_12_AM",   label: "9-12am" },
  { key: "12_3_PM",   label: "12-3pm" },
  { key: "3_6_PM",    label: "3-6pm" },
  { key: "6_9_PM",    label: "6-9pm" },
  { key: "AFTER_9PM", label: "After 9pm" },
] as const;

const formSchema = z
  .object({
    collectionDate: z.date({ required_error: "Collection date is required" }),
    /** ✅ Use the slot KEY to match server (e.g. ANY, 6_9_AM, etc.) */
    collectionTimeSlot: z.string().min(1, "Please select a time slot"),
    postcode: z
      .string()
      .regex(/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i, "Please enter a valid UK postcode"),
    addressLine1: z.string().min(1, "Address line 1 is required"),
    addressLine2: z.string().optional(),
    town: z.string().min(1, "Town is required"),
    county: z.string().optional(),
    sameContact: z.boolean().default(true),
    collectionContactName: z.string().optional(),
    collectionPhoneNumber: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.sameContact) {
        return (
          !!data.collectionContactName &&
          data.collectionContactName.length >= 2 &&
          !!data.collectionPhoneNumber &&
          data.collectionPhoneNumber.replace(/\D/g, "").length >= 10
        );
      }
      return true;
    },
    {
      message:
        "Contact name and phone number are required when using different contact details",
      path: ["collectionContactName"],
    }
  );

interface StepTwoProps {
  initialData: BookingFormData;
  onNext: (data: Partial<BookingFormData>) => void;
  onBack: () => void;
}

export const StepTwo: React.FC<StepTwoProps> = ({ initialData, onNext, onBack }) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      collectionDate: initialData.collectionDate ?? startOfToday(),
      /** if older data had collectionTime (label), try to map back to a key */
      collectionTimeSlot:
        initialData.collectionTimeSlot ??
        ((): string => {
          const label = initialData.collectionTime ?? "";
          const hit = TIME_SLOTS.find(t => t.label === label);
          return hit?.key ?? "";
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
  });

  const sameContact = form.watch("sameContact");

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // mirror the label to collectionTime for backward compatibility with server code
    const label = TIME_SLOTS.find(t => t.key === values.collectionTimeSlot)?.label ?? "";
    onNext({
      collectionDate: values.collectionDate,
      collectionTimeSlot: values.collectionTimeSlot, // ✅ server prefers this
      collectionTime: label,                         // ✅ legacy/compat field
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
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
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

            {/* Time Slot (matches Apps Script TIME_SLOTS) */}
            <FormField
              control={form.control}
              name="collectionTimeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Collection Time *
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
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1 *</FormLabel>
                <FormControl><Input placeholder="Street address" {...field} /></FormControl>
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
                <FormControl><Input placeholder="Apartment, suite, etc." {...field} /></FormControl>
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
                  <FormControl><Input placeholder="London" {...field} /></FormControl>
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
                  <FormControl><Input placeholder="Greater London" {...field} /></FormControl>
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

          {/* Alternate Contact (when not same) */}
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
                    <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
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
                    <FormControl><Input type="tel" placeholder="07700 900123" {...field} /></FormControl>
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
