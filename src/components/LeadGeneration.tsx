import React, { useState, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/lead-generation.css';

interface FormData {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
  photo: File | null;
  notes: string;
  siteType: string;
}

const initialFormData: FormData = {
  name: '',
  address: '44 South Broadway',
  city: 'White Plains',
  state: 'NY',
  zipCode: '10601',
  latitude: '41.0282',
  longitude: '-73.7646',
  photo: null,
  notes: '',
  siteType: '',
};

const generateTag = (): string => {
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[now.getMonth()];
  const year = String(now.getFullYear()).slice(-2);
  return `LeadGen_${month}${year}`;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const LeadGeneration: React.FC = () => {
  const { instance } = useMsal();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const tag = useMemo(() => generateTag(), []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, photo: file }));
  };

  const sendEmailViaGraph = async (data: FormData) => {
    const accounts = instance.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error('User is not authenticated. Please log in and try again.');
    }

    const activeAccount = accounts[0];

    let tokenResponse;
    try {
      tokenResponse = await instance.acquireTokenSilent({
        scopes: ['Mail.Send'],
        account: activeAccount,
      });
    } catch {
      tokenResponse = await instance.acquireTokenPopup({
        scopes: ['Mail.Send'],
        account: activeAccount,
      });
    }

    if (!tokenResponse?.accessToken) {
      throw new Error('Failed to acquire access token for sending email.');
    }

    const emailBody = `
      <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 12px 20px; border-radius: 6px; margin-bottom: 16px; text-align: center;">
        <strong style="color: #dc2626; font-size: 18px; font-family: Arial, sans-serif;">⚠ TEST EMAIL — Do Not Action ⚠</strong>
      </div>
      <h2>New Lead Generation Submission</h2>
      <p style="font-family: Arial, sans-serif; color: #555; font-size: 13px;">Tag: <strong>${tag}</strong></p>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px; font-family: Arial, sans-serif;">
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; width: 180px;">Name</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Address</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.address}</td>
        </tr>
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">City</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.city}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">State</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.state}</td>
        </tr>
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Zip Code</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.zipCode}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Latitude</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.latitude || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Longitude</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.longitude || 'N/A'}</td>
        </tr>
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Site Type</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.siteType || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Photo</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.photo ? data.photo.name : 'No photo attached'}</td>
        </tr>
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Notes</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${data.notes || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Tag</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${tag}</td>
        </tr>
      </table>
      <br/>
      <p style="color: #666; font-size: 12px;">This email was sent from the Symphony Towers Infrastructure Intranet Lead Generation form.</p>
    `;

    const attachments: any[] = [];
    if (data.photo) {
      const base64Content = await fileToBase64(data.photo);
      attachments.push({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: data.photo.name,
        contentType: data.photo.type,
        contentBytes: base64Content,
      });
    }

    const message: any = {
      message: {
        subject: `TEST EMAIL - New Intranet Lead Submission - ${data.name} - ${data.city}, ${data.state}`,
        body: {
          contentType: 'HTML',
          content: emailBody,
        },
        toRecipients: [
          {
            emailAddress: {
              // address: 'symphony_tech@symphonyinfra.com',
              address: 'mmelendez@symphonyinfra.com',
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    if (attachments.length > 0) {
      message.message.attachments = attachments;
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResponse.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok && response.status !== 202) {
      const errorData = await response.json().catch(() => null);
      const detail = errorData?.error?.message || response.statusText;
      throw new Error(`Failed to send email: ${detail}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('sending');
    setErrorMessage('');

    try {
      await sendEmailViaGraph(formData);
      setSubmitStatus('success');
      setFormData(initialFormData);
    } catch (err: any) {
      setSubmitStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred.');
    }
  };

  return (
    <div className="lead-generation-page">
      <div className="lead-generation-container">
        <div className="lead-generation-header">
          <h1>Lead Generation</h1>
          <p>Submit a new lead by filling out the form below. An email will be sent to the team for follow-up.</p>
          <span className="lead-tag-badge">{tag}</span>
        </div>

        {submitStatus === 'success' && (
          <div className="lead-alert lead-alert-success">
            <i className="fa-solid fa-circle-check"></i>
            <div>
              <strong>Lead submitted successfully!</strong>
              <p>An email has been sent to the team. They will follow up shortly.</p>
            </div>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="lead-alert lead-alert-error">
            <i className="fa-solid fa-circle-exclamation"></i>
            <div>
              <strong>Failed to submit lead.</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <form className="lead-form" onSubmit={handleSubmit}>
          {/* Hidden tag field */}
          <input type="hidden" name="tag" value={tag} />

          <div className="lead-form-section">
            <h2>Site Information</h2>
            <div className="lead-form-grid">
              <div className="lead-form-group">
                <label htmlFor="name">Name <span className="required">*</span></label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Site or contact name"
                  required
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="siteType">Site Type <span className="required">*</span></label>
                <select
                  id="siteType"
                  name="siteType"
                  value={formData.siteType}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a type...</option>
                  <option value="Billboard">Billboard</option>
                  <option value="DAS">DAS</option>
                  <option value="Datacenter">Datacenter</option>
                  <option value="Equipment Only">Equipment Only</option>
                  <option value="Flagpole">Flagpole</option>
                  <option value="Guyed Tower">Guyed Tower</option>
                  <option value="Monopole">Monopole</option>
                  <option value="Mountainside">Mountainside</option>
                  <option value="Rooftop">Rooftop</option>
                  <option value="Self Support / Lattice Tower">Self Support / Lattice Tower</option>
                  <option value="Silo">Silo</option>
                  <option value="Small Cell Node">Small Cell Node</option>
                  <option value="Smokestack">Smokestack</option>
                  <option value="Stealth">Stealth</option>
                  <option value="Steeple">Steeple</option>
                  <option value="Water Tower">Water Tower</option>
                  <option value="Tower Land">Tower Land</option>
                </select>
              </div>
            </div>
          </div>

          <div className="lead-form-section">
            <h2>Location</h2>
            <div className="lead-form-grid">
              <div className="lead-form-group full-width">
                <label htmlFor="address">Address <span className="required">*</span></label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                  required
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="city">City <span className="required">*</span></label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  required
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="state">State <span className="required">*</span></label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="e.g. NY"
                  required
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="zipCode">Zip Code <span className="required">*</span></label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="e.g. 10601"
                  required
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="latitude">Latitude</label>
                <input
                  type="text"
                  id="latitude"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="e.g. 41.030976"
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="longitude">Longitude</label>
                <input
                  type="text"
                  id="longitude"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="e.g. -73.761618"
                />
              </div>
            </div>
          </div>

          <div className="lead-form-section">
            <h2>Photo &amp; Notes</h2>
            <div className="lead-form-grid">
              <div className="lead-form-group full-width">
                <label htmlFor="photo">Photo <span className="required">*</span></label>
                <input
                  type="file"
                  id="photo"
                  name="photo"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="lead-file-input"
                  required
                />
                {formData.photo && (
                  <span className="lead-file-name">
                    <i className="fa-solid fa-image"></i> {formData.photo.name}
                  </span>
                )}
              </div>
              <div className="lead-form-group full-width">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional information about this lead..."
                  rows={5}
                />
              </div>
            </div>
          </div>

          <div className="lead-form-actions">
            <button
              type="submit"
              className="lead-submit-btn"
              disabled={submitStatus === 'sending'}
            >
              {submitStatus === 'sending' ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Sending...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i> Submit Lead
                </>
              )}
            </button>
            <button
              type="button"
              className="lead-reset-btn"
              onClick={() => {
                setFormData(initialFormData);
                setSubmitStatus('idle');
                setErrorMessage('');
                const fileInput = document.getElementById('photo') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
              }}
            >
              <i className="fa-solid fa-rotate-left"></i> Reset Form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadGeneration;
