import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StepOne } from "@/components/booking-steps/StepOne";
import { StepTwo } from "@/components/booking-steps/StepTwo";
import { StepThree } from "@/components/booking-steps/StepThree";
import { SuccessScreen } from "@/components/booking-steps/SuccessScreen";
import { submitBookingToGoogleSheets } from "@/lib/sheets";
import { toast as sonner } from "@/components/ui/sonner";
export interface BookingFormData {
  // Step 1
  contactName: string;
  companyName: string;
  phoneNumber: string;
  email: string;

  // Step 2
  collectionDate: Date | undefined;
  collectionTime: string;
  postcode: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  sameContact: boolean;
  collectionContactName: string;
  collectionPhoneNumber: string;

  // Step 3
  notificationMethods: string[];
  jobDescription: string;
  specialInstructions: string;
  urgentJob: boolean;
}
const BookingForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BookingFormData>({
    contactName: "",
    companyName: "",
    phoneNumber: "",
    email: "",
    collectionDate: undefined,
    collectionTime: "",
    postcode: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    county: "",
    sameContact: true,
    collectionContactName: "",
    collectionPhoneNumber: "",
    notificationMethods: [],
    jobDescription: "",
    specialInstructions: "",
    urgentJob: false
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const totalSteps = 3;
  const progress = currentStep / totalSteps * 100;
  const handleNext = (data: Partial<BookingFormData>) => {
    setFormData({
      ...formData,
      ...data
    });
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  const handleSubmit = async (data: Partial<BookingFormData>) => {
    const finalData = {
      ...formData,
      ...data
    } as BookingFormData;
    setFormData(finalData);
    try {
      await submitBookingToGoogleSheets({
        contactName: finalData.contactName,
        companyName: finalData.companyName || undefined,
        phoneNumber: finalData.phoneNumber,
        email: finalData.email,
        collectionDate: finalData.collectionDate ? finalData.collectionDate.toISOString() : null,
        collectionTime: finalData.collectionTime,
        postcode: finalData.postcode,
        addressLine1: finalData.addressLine1,
        addressLine2: finalData.addressLine2,
        town: finalData.town,
        county: finalData.county,
        sameContact: finalData.sameContact,
        collectionContactName: finalData.collectionContactName,
        collectionPhoneNumber: finalData.collectionPhoneNumber,
        notificationMethods: finalData.notificationMethods,
        jobDescription: finalData.jobDescription,
        specialInstructions: finalData.specialInstructions || undefined,
        urgentJob: finalData.urgentJob
      });
      sonner.success("Booking saved to Google Sheets");
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      sonner.error("Failed to save booking. Please try again.");
    }
  };
  if (isSubmitted) {
    return <SuccessScreen formData={formData} />;
  }
  return <div className="min-h-screen bg-gradient-subtle py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Plus Vans Booking Confirmation</h1>
          <p className="text-muted-foreground">
            Complete the form below to confirm your booking
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm font-medium text-primary">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="animate-fade-in">
            {currentStep === 1 && <StepOne initialData={formData} onNext={handleNext} />}
            {currentStep === 2 && <StepTwo initialData={formData} onNext={handleNext} onBack={handleBack} />}
            {currentStep === 3 && <StepThree initialData={formData} onSubmit={handleSubmit} onBack={handleBack} />}
          </div>
        </Card>
      </div>
    </div>;
};
export default BookingForm;