-- Add new columns to LanSettings table for branding, pricing, and payment
ALTER TABLE lansettings
ADD AppTitle nvarchar(255) NULL,
    OrganizerName nvarchar(255) NULL,
    VenueName nvarchar(255) NULL,
    VenueAddress nvarchar(MAX) NULL,
    LogoPath nvarchar(500) NULL,
    LinksWebsite nvarchar(500) NULL,
    PricingStandardSeatPrice decimal(10,2) NULL,
    PricingPremiumSeatPrice decimal(10,2) NULL,
    PricingStandardSeatDimensions nvarchar(50) NULL,
    PricingPremiumSeatDimensions nvarchar(50) NULL,
    PricingStandardSeatLabel nvarchar(100) NULL,
    PricingPremiumSeatLabel nvarchar(100) NULL,
    PaymentMobilePayNumber nvarchar(50) NULL,
    PaymentBankAccount nvarchar(50) NULL,
    PaymentBankAccountHolder nvarchar(255) NULL,
    PaymentInstructions nvarchar(MAX) NULL,
    RegistrationEnabled bit CONSTRAINT DF_LanSettings_RegistrationEnabled DEFAULT 1,
    BookingEnabled bit CONSTRAINT DF_LanSettings_BookingEnabled DEFAULT 1,
    Announcement nvarchar(MAX) NULL;
GO

-- Create contacts table
CREATE TABLE contacts
(
    id nvarchar(36) NOT NULL,
    settings_id int NOT NULL,
    role nvarchar(50) NOT NULL,
    name nvarchar(255) NOT NULL,
    phone nvarchar(50) NULL,
    email nvarchar(255) NULL,
    notes nvarchar(MAX) NULL,
    display_order int CONSTRAINT DF_contacts_display_order DEFAULT 0,
    is_public bit CONSTRAINT DF_contacts_is_public DEFAULT 1,
    created_at datetime CONSTRAINT DF_contacts_created_at DEFAULT GETDATE(),
    updated_at datetime CONSTRAINT DF_contacts_updated_at DEFAULT GETDATE(),
    CONSTRAINT PK_contacts PRIMARY KEY (id),
    CONSTRAINT FK_contacts_settings FOREIGN KEY (settings_id) REFERENCES lansettings(id) ON DELETE CASCADE
);
GO

-- Create indexes for contacts table
CREATE NONCLUSTERED INDEX IX_contacts_settings_id ON contacts (settings_id);
GO

CREATE NONCLUSTERED INDEX IX_contacts_role ON contacts (role);
GO

CREATE NONCLUSTERED INDEX IX_contacts_display_order ON contacts (display_order);
GO



