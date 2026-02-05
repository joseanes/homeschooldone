# Email Implementation Guide for HomeschoolDone

## Current Status
The invitation system currently adds email addresses to the homeschool but doesn't send actual emails. Users must sign up manually with the invited email address.

## Options for Implementing Email Invitations

### Option 1: Firebase Functions with SendGrid/Mailgun
1. Set up Firebase Functions
2. Create a Cloud Function that triggers when an email is added to the invites
3. Use SendGrid or Mailgun API to send emails
4. Include a link to the app with invitation token

### Option 2: Firebase Extensions - Trigger Email
1. Install the official Firebase "Trigger Email" extension
2. Configure with SMTP settings (Gmail, SendGrid, etc.)
3. Write invitation data to a specific Firestore collection
4. Extension automatically sends emails

### Option 3: Client-side Email Service (Not Recommended)
1. Use EmailJS or similar service
2. Send emails directly from React app
3. Less secure as API keys are exposed

## Recommended Implementation (Option 2)

### Step 1: Install Firebase Extension
```bash
firebase ext:install firebase/firestore-send-email
```

### Step 2: Create Email Templates Collection
Create a collection `mail` in Firestore with documents like:
```javascript
{
  to: ['invited@example.com'],
  template: {
    name: 'invitation',
    data: {
      homeschoolName: 'Smith Homeschool',
      inviterName: 'John Smith',
      role: 'tutor',
      inviteLink: 'https://homeschooldone.com?invite=TOKEN'
    }
  }
}
```

### Step 3: Update InviteUser Component
```javascript
// Add to handleSubmit after adding email to homeschool
await addDoc(collection(db, 'mail'), {
  to: [emailToAdd],
  template: {
    name: 'invitation',
    data: {
      homeschoolName: homeschool.name,
      inviterName: currentUser.displayName || 'A HomeschoolDone user',
      role: role,
      inviteLink: `https://homeschooldone.com`
    }
  }
});
```

### Step 4: Configure Email Templates
In Firebase Extension settings, configure HTML templates for the invitation email.

## For Now
The system prevents duplicate invitations and shows a clear message that emails aren't sent yet. Users need to:
1. Share the email address with the person they want to invite
2. Tell them to sign up at homeschooldone.com with that exact email
3. They'll automatically have access once they sign in