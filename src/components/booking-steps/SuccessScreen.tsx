import { BookingFormData } from "@/components/BookingForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, MapPin, Phone, Mail, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface SuccessScreenProps {
  formData: BookingFormData;
}

export const SuccessScreen = ({ formData }: SuccessScreenProps) => {
  const bookingRef = `BK-${Date.now().toString().slice(-8)}`;

  return (
    <div className="min-h-screen bg-gradient-subtle py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full animate-fade-in">
        <Card className="p-8 shadow-xl text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-success flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-success-foreground" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Booking Confirmed!
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Your booking has been successfully submitted
          </p>

          <div className="bg-secondary/50 rounded-lg p-4 mb-8">
            <p className="text-sm text-muted-foreground mb-1">Booking Reference</p>
            <p className="text-2xl font-mono font-bold text-primary">{bookingRef}</p>
          </div>

          <div className="space-y-4 text-left mb-8">
            <h3 className="font-semibold text-foreground mb-3">Booking Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Date & Time</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.collectionDate && format(formData.collectionDate, "PPP")} at {formData.collectionTime}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Location</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.addressLine1}{formData.addressLine2 && `, ${formData.addressLine2}`}, {formData.town}, {formData.postcode}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Contact</p>
                  <p className="text-sm text-muted-foreground">{formData.contactName}</p>
                  <p className="text-sm text-muted-foreground">{formData.phoneNumber}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.notificationMethods.join(", ")}
                  </p>
                </div>
              </div>
            </div>

            {formData.urgentJob && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
                <span className="text-destructive font-semibold text-sm">⚡ Urgent Job</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A confirmation {formData.email && "email and"} SMS has been sent to your contact details.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
                onClick={() => window.location.reload()}
              >
                Book Another Service
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.print()}
              >
                Print Confirmation
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
