# EmailJS Setup Guide for HomeschoolDone

## Quick Setup (5 minutes)

### 1. Create EmailJS Account
1. Go to https://www.emailjs.com/
2. Click "Sign Up Free" 
3. Create your account

### 2. Add Email Service
1. In EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the connection instructions
5. Test the connection
6. Copy the Service ID

### 3. Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this template:

**Subject:**
```
You've been invited to {{homeschool_name}} on HomeschoolDone
```

**Content:**
```
Hi {{to_name}},

{{from_name}} has invited you to join {{homeschool_name}} as a {{role}} on HomeschoolDone.

HomeschoolDone is a platform for tracking homeschool education progress and activities.

To accept this invitation, please:
1. Visit {{invite_url}}
2. Sign in with this email address: {{to_email}}
3. You'll automatically have access to {{homeschool_name}}

If you have any questions, please contact {{from_name}}.

Best regards,
The HomeschoolDone Team
```

4. Save the template
5. Copy the Template ID

### 4. Get Your Public Key
1. Go to "Account" → "General"
2. Copy your Public Key

### 5. Update the Code
Edit `/src/services/emailService.ts` and replace:
- `YOUR_SERVICE_ID` with your Service ID
- `YOUR_TEMPLATE_ID` with your Template ID  
- `YOUR_PUBLIC_KEY` with your Public Key

### 6. Create Student Template (Optional)
Create another template for student invitations with variables:
- `{{student_name}}`
- `{{parent_name}}`
- `{{homeschool_name}}`
- `{{invite_url}}`

## Free Tier Limits
- 200 emails per month
- 2 email templates
- Perfect for getting started!

## Security Note
The public key is safe to expose in client-side code. It only allows sending emails through your templates, not reading or accessing your email account.