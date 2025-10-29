import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StepOne } from "@/components/booking-steps/StepOne";
import { StepTwo } from "@/components/booking-steps/StepTwo";
import { StepThree } from "@/components/booking-steps/StepThree";
import { SuccessScreen } from "@/components/booking-steps/SuccessScreen";
import { submitBookingToGoogleSheets } from "@/lib/sheets";
import { toast as sonner } from "@/components/ui/sonner";

/** 🔧 helper: format JS Date to 'yyyy-MM-dd' for Apps Script */
const toYMD = (d?: Date | null) => {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/** SAME KEYS AS APPS SCRIPT EXPECTS */
export interface BookingFormData {
  // Step 1
  contactName: string;
  companyName: string;
  phoneNumber: string;
  email: string;

  // Step 2
  collectionDate: Date | undefined;         // we’ll convert to yyyy-MM-dd on submit
  collectionTime: string;                   // human label (legacy)
  collectionTimeSlot?: string;              // NEW: slot key (ANY, 6_9_AM, ...)
  postcode: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  sameContact: boolean;
  collectionContactName: string;
  collectionPhoneNumber: string;

  // Step 3
  notificationMethods: string[];            // ["Email","SMS","WhatsApp"]
  wasteTypes?: string[];                    // UI field
  wasteTypesSelected?: string[];            // server column name
  jobDescription: string;
  specialInstructions: string;
  urgentJob: boolean;
}

const SLOT_LABEL_BY_KEY: Record<string, string> = {
  ANY: "Any time",
  "6_9_AM": "6-9am + £29.00",
  "9_12_AM": "9-12am",
  "12_3_PM": "12-3pm",
  "3_6_PM": "3-6pm + £29.00",
  "6_9_PM": "6-9pm + £39.00",
  AFTER_9PM: "After 9pm minimum charge £179.00",
};

const BookingForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formData, setFormData] = useState<BookingFormData>({
    // step 1
    contactName: "",
    companyName: "",
    phoneNumber: "",
    email: "",
    // step 2
    collectionDate: undefined,
    collectionTime: "",
    collectionTimeSlot: "",                 // ← keep slot key here
    postcode: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    county: "",
    sameContact: true,
    collectionContactName: "",
    collectionPhoneNumber: "",
    // step 3
    notificationMethods: [],
    wasteTypes: [],                          // ← track waste
    wasteTypesSelected: [],                  // ← mirror for server column
    jobDescription: "",
    specialInstructions: "",
    urgentJob: false,
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = (data: Partial<BookingFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
      // ensure we keep both label + key in sync if step2 only sent one of them
      collectionTime:
        data.collectionTime ??
        (data.collectionTimeSlot ? SLOT_LABEL_BY_KEY[data.collectionTimeSlot] ?? prev.collectionTime : prev.collectionTime),
      collectionTimeSlot:
        data.collectionTimeSlot ??
        (data.collectionTime && !prev.collectionTimeSlot
          ? Object.entries(SLOT_LABEL_BY_KEY).find(([, lbl]) => lbl === data.collectionTime)?.[0] ?? prev.collectionTimeSlot
          : prev.collectionTimeSlot),
    }));
    if (currentStep < totalSteps) setCurrentStep((s) => s + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleSubmit = async (data: Partial<BookingFormData>) => {
    const merged: BookingFormData = {
      ...formData,
      ...data,
    };

    // ✅ make absolutely sure wasteTypes & wasteTypesSelected are both present
    const wasteTypes = Array.isArray(merged.wasteTypes) ? merged.wasteTypes : [];
    const wasteTypesSelected = Array.isArray(merged.wasteTypesSelected)
      ? merged.wasteTypesSelected
      : wasteTypes;

    // ✅ keep label + key consistent for server
    const slotKey = merged.collectionTimeSlot || "";
    const slotLabel =
      merged.collectionTime || (slotKey ? SLOT_LABEL_BY_KEY[slotKey] : "");

    // final payload to Apps Script
    const payload: Record<string, any> = {
      // Step 1
      contactName: merged.contactName,
      companyName: merged.companyName || undefined,
      phoneNumber: merged.phoneNumber,
      email: merged.email,

      // Step 2
      collectionDate: toYMD(merged.collectionDate),   // yyyy-MM-dd (tz-safe for Apps Script)
      collectionTimeSlot: slotKey,                    // server prefers this
      collectionTime: slotLabel,                      // legacy/human-facing
      postcode: merged.postcode,
      addressLine1: merged.addressLine1,
      addressLine2: merged.addressLine2,
      town: merged.town,
      county: merged.county,
      sameContact: merged.sameContact,
      collectionContactName: merged.collectionContactName,
      collectionPhoneNumber: merged.collectionPhoneNumber,

      // Step 3
      notificationMethods: merged.notificationMethods, // already normalized in StepThree
      wasteTypes,
      wasteTypesSelected,                               // 👈 sheet column name
      jobDescription: merged.jobDescription,
      specialInstructions: merged.specialInstructions || undefined,
      urgentJob: merged.urgentJob,
    };

    setFormData(merged);

    try {
      // sanity log in browser to verify payload contains wasteTypes & wasteTypesSelected
      console.log("POST →", payload);

      await submitBookingToGoogleSheets(payload);

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

  return (
    <div className="min-h-screen bg-gradient-subtle py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Plus Vans Booking Confirmation
          </h1>
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
            {currentStep === 1 && (
              <StepOne initialData={formData} onNext={handleNext} />
            )}
            {currentStep === 2 && (
              <StepTwo
                initialData={formData}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 3 && (
              <StepThree
                initialData={formData}
                onSubmit={handleSubmit}
                onBack={handleBack}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BookingForm;