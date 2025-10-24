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

const formSchema = z.object({
  contactName: z.string().min(2, "Contact name must be at least 2 characters"),
  companyName: z.string().optional(),
  phoneNumber: z.string().regex(/^(?:(?:\+44\s?|0)(?:\d\s?){9,10})$/, "Please enter a valid UK phone number"),
  email: z.string().email("Please enter a valid email"),
});

interface StepOneProps {
  initialData: BookingFormData;
  onNext: (data: Partial<BookingFormData>) => void;
}

export const StepOne = ({ initialData, onNext }: StepOneProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
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
                  <Input 
                    type="tel" 
                    placeholder="07700 900123" 
                    {...field} 
                  />
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
                  <Input 
                    type="email" 
                    placeholder="john@example.com" 
                    {...field} 
                  />
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
