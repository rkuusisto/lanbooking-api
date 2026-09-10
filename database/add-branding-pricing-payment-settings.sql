-- Add branding, location, pricing, payment and toggle columns to LanSettings table
-- Backs the /intra settings form's Branding/Location/Pricing/Payment tabs, which
-- previously had no matching columns and silently dropped these values on save.
ALTER TABLE [LanSettings]
ADD [RegistrationEnabled] BIT NULL,
    [BookingEnabled] BIT NULL,
    [Announcement] NVARCHAR(MAX) NULL,
    [AppTitle] NVARCHAR(255) NULL,
    [OrganizerName] NVARCHAR(255) NULL,
    [LogoPath] NVARCHAR(500) NULL,
    [LinksWebsite] NVARCHAR(500) NULL,
    [VenueName] NVARCHAR(255) NULL,
    [VenueAddress] NVARCHAR(MAX) NULL,
    [PricingStandardSeatPrice] DECIMAL(10, 2) NULL,
    [PricingPremiumSeatPrice] DECIMAL(10, 2) NULL,
    [PricingStandardSeatDimensions] NVARCHAR(50) NULL,
    [PricingPremiumSeatDimensions] NVARCHAR(50) NULL,
    [PricingStandardSeatLabel] NVARCHAR(100) NULL,
    [PricingPremiumSeatLabel] NVARCHAR(100) NULL,
    [PaymentMobilePayNumber] NVARCHAR(50) NULL,
    [PaymentBankAccount] NVARCHAR(50) NULL,
    [PaymentBankAccountHolder] NVARCHAR(255) NULL,
    [PaymentInstructions] NVARCHAR(MAX) NULL;

-- Set default values for existing records (default both toggles to enabled,
-- matching the frontend's own fallback defaults)
UPDATE [LanSettings]
SET [RegistrationEnabled] = 1
WHERE [RegistrationEnabled] IS NULL;

UPDATE [LanSettings]
SET [BookingEnabled] = 1
WHERE [BookingEnabled] IS NULL;
