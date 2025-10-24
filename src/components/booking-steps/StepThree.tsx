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
import { MessageSquare, FileText, Zap, ChevronLeft, Mail, Phone as PhoneIcon } from "lucide-react";

const formSchema = z.object({
  notificationMethods: z.array(z.string()).min(1, "Select at least one notification method"),
  jobDescription: z.string().min(10, "Job description must be at least 10 characters"),
  specialInstructions: z.string().optional(),
  urgentJob: z.boolean().default(false),
});

interface StepThreeProps {
  initialData: BookingFormData;
  onSubmit: (data: Partial<BookingFormData>) => void;
  onBack: () => void;
}

const notificationOptions = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquare,
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
  },
  {
    id: "sms",
    label: "SMS",
    icon: PhoneIcon,
  },
];

export const StepThree = ({ initialData, onSubmit, onBack }: StepThreeProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notificationMethods: initialData.notificationMethods,
      jobDescription: initialData.jobDescription,
      specialInstructions: initialData.specialInstructions,
      urgentJob: initialData.urgentJob,
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Notification Preferences & Details
        </h2>
        <p className="text-muted-foreground">
          How would you like to receive updates about your booking?
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="notificationMethods"
            render={() => (
              <FormItem>
                <FormLabel className="text-base">
                  Notification Methods *
                </FormLabel>
                <FormDescription>
                  Choose how you'd like to receive booking updates
                </FormDescription>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  {notificationOptions.map((option) => (
                    <FormField
                      key={option.id}
                      control={form.control}
                      name="notificationMethods"
                      render={({ field }) => {
                        const Icon = option.icon;
                        return (
                          <FormItem key={option.id}>
                            <FormControl>
                              <div className="relative">
                                <Checkbox
                                  checked={field.value?.includes(option.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, option.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== option.id
                                          )
                                        );
                                  }}
                                  className="peer sr-only"
                                  id={option.id}
                                />
                                <FormLabel
                                  htmlFor={option.id}
                                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                                >
                                  <Icon className="w-6 h-6 mb-2" />
                                  <span className="text-sm font-medium">{option.label}</span>
                                </FormLabel>
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

          <FormField
            control={form.control}
            name="jobDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Job Description *
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the job or service you need..."
                    className="resize-none"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="specialInstructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Special Instructions (Optional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any special requirements or notes..."
                    className="resize-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="urgentJob"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-destructive/5 border-destructive/20">
                <div className="space-y-0.5">
                  <FormLabel className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Urgent Job
                  </FormLabel>
                  <FormDescription>
                    Mark this job as urgent for priority handling
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
              size="lg"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-gradient-success hover:opacity-90 transition-opacity"
              size="lg"
            >
              Confirm Booking
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
