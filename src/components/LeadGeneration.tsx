import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Navigate } from 'react-router-dom';
import { UserInfo } from '../types/user';
import '../../styles/lead-generation.css';

interface FormData {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
  notes: string;
  siteType: string;
  photos: File[];
}

const initialFormData: FormData = {
  address: '',
  city: '',
  state: '',
  zipCode: '',
  latitude: '',
  longitude: '',
  notes: '',
  siteType: 'Rooftop',
  photos: [],
};

const US_STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
];

const US_STATES_2 = [
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
];

const ALL_STATES = [...US_STATES, ...US_STATES_2];
const SITE_TYPES = [
  'Billboard',
  'DAS',
  'Datacenter',
  'Equipment Only',
  'Flagpole',
  'Guyed Tower',
  'Monopole',
  'Mountainside',
  'Rooftop',
  'Self Support / Lattice Tower',
  'Silo',
  'Small Cell Node',
  'Smokestack',
  'Stealth',
  'Steeple',
  'Water Tower',
  'Tower Land',
];

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

const toSafeToken = (value: string, fallback: string): string => {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return cleaned || fallback;
};

const getMonthYearToken = (): string => {
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[now.getMonth()];
  const year = String(now.getFullYear()).slice(-2);
  return `${month}${year}`;
};

interface LeadGenerationProps {
  userInfo: UserInfo;
}

const LeadGeneration: React.FC<LeadGenerationProps> = ({ userInfo }) => {
  const { instance } = useMsal();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [gpsFromAutoFill, setGpsFromAutoFill] = useState(false);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  if (!userInfo.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const tag = useMemo(() => generateTag(), []);
  const hasLatLong = Boolean(formData.latitude.trim() && formData.longitude.trim());
  const emailPrefix = useMemo(
    () => (userInfo.email || 'unknown').split('@')[0].trim() || 'unknown',
    [userInfo.email]
  );
  const filteredStates = useMemo(() => {
    const query = stateSearchQuery.trim().toLowerCase();
    if (!query) return ALL_STATES;
    return ALL_STATES.filter((s) => (
      s.abbr.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    ));
  }, [stateSearchQuery]);

  useEffect(() => {
    const urls = formData.photos.map((photo) => URL.createObjectURL(photo));
    setPhotoPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [formData.photos]);

  const getGeneratedPhotoName = (photo: File, index: number): string => {
    const userToken = toSafeToken(emailPrefix, 'unknown');
    const cityToken = toSafeToken(formData.city, 'unknowncity');
    const stateToken = toSafeToken(formData.state, 'unknownstate');
    const monthYear = getMonthYearToken();
    const extension = photo.name.includes('.') ? `.${photo.name.split('.').pop()}` : '.jpg';
    return `${userToken}_${cityToken}_${stateToken}_${monthYear}_${index + 1}${extension}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const tryAutofillFromBrowserLocation = async (): Promise<boolean> => {
    if (!('geolocation' in navigator)) {
      return false;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setFormData(prev => ({
        ...prev,
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      }));
      setGpsFromAutoFill(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleUseCurrentLocation = async () => {
    const filled = await tryAutofillFromBrowserLocation();
    if (!filled) {
      setErrorMessage('Could not access location. Please allow location access or enter coordinates manually.');
      setSubmitStatus('error');
    } else if (submitStatus === 'error') {
      setErrorMessage('');
      setSubmitStatus('idle');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...selected],
    }));

    const filled = await tryAutofillFromBrowserLocation();
    if (!filled) {
      setGpsFromAutoFill(false);
    }

    // Allow selecting the same file again after removal.
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
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
      <h2>New Lead Generation Submission</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px; font-family: Arial, sans-serif;">
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
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Photos</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${
            data.photos.length > 0 ? data.photos.map((p, index) => getGeneratedPhotoName(p, index)).join(', ') : 'No photos attached'
          }</td>
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

    const attachments = await Promise.all(data.photos.map(async (photo, index) => {
      const base64Content = await fileToBase64(photo);
      return {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: getGeneratedPhotoName(photo, index),
        contentType: photo.type,
        contentBytes: base64Content,
      };
    }));

    const subjectLocation = data.city.trim() && data.state.trim()
      ? `${data.city.trim()}, ${data.state.trim()}`
      : `${data.latitude.trim() || 'N/A'}, ${data.longitude.trim() || 'N/A'}`;
    const submitterName = (userInfo.name || userInfo.email || 'Unknown User').trim();

    const message: any = {
      message: {
        subject: `New Lead Submission - ${submitterName} - ${subjectLocation}`,
        body: {
          contentType: 'HTML',
          content: emailBody,
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'EmployeeLeadGeneration@symphonyinfra.com',
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
    if (!formData.notes.trim()) {
      setSubmitStatus('error');
      setErrorMessage('Please add notes about this lead before submitting.');
      return;
    }

    if (formData.photos.length === 0) {
      setSubmitStatus('error');
      setErrorMessage('Please attach at least one photo before submitting.');
      return;
    }

    if (!hasLatLong) {
      setSubmitStatus('error');
      setErrorMessage('Latitude and longitude are required. Use current location or enter them manually.');
      return;
    }

    if (!gpsFromAutoFill) {
      if (!formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.zipCode.trim()) {
        setSubmitStatus('error');
        setErrorMessage('Address, city, state, and zip code are required when GPS is entered manually.');
        return;
      }
    }

    setSubmitStatus('sending');
    setErrorMessage('');

    try {
      await sendEmailViaGraph(formData);
      setSubmitStatus('success');
      setFormData(initialFormData);
      setGpsFromAutoFill(false);
    } catch (err: any) {
      setSubmitStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred.');
    }
  };

  return (
    <div className="lead-generation-page">
      <div className="lead-generation-container">
        <div className="lead-generation-header">
          <h1>Submit Your Lead</h1>
          <p>Enter at least two leads per month for a chance to win our lead gen contest.</p>
          <p className="lead-signed-in">Signed in as {userInfo.email}</p>
        </div>

        {submitStatus === 'success' && (
          <div className="lead-alert lead-alert-success">
            <i className="fa-solid fa-circle-check"></i>
            <div>
              <strong>Lead submitted successfully!</strong>
              <p>We are one step closer to our team goal, and you are one step closer to winning the contest.</p>
            </div>
          </div>
        )}

        {submitStatus === 'sending' && (
          <div className="lead-alert lead-alert-sending">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <div>
              <strong>Submitting your lead...</strong>
              <p>Please wait while we upload photos and send the submission email.</p>
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
            <h2>Photos &amp; Notes</h2>
            <div className="lead-form-grid one-col">
              <div className="lead-form-group full-width">
                <label htmlFor="photos">Photos <span className="required">*</span></label>
                <div className="lead-photo-actions">
                  <button
                    type="button"
                    className="lead-reset-btn"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={submitStatus === 'sending'}
                  >
                    <i className="fa-solid fa-camera"></i> Take Photo
                  </button>
                  <button
                    type="button"
                    className="lead-reset-btn"
                    onClick={() => libraryInputRef.current?.click()}
                    disabled={submitStatus === 'sending'}
                  >
                    <i className="fa-solid fa-images"></i> Choose from Library
                  </button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="lead-file-input-hidden"
                />
                <input
                  ref={libraryInputRef}
                  type="file"
                  id="photos"
                  name="photos"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="lead-file-input-hidden"
                />
                {formData.photos.length > 0 && (
                  <div className="lead-photo-list">
                    {formData.photos.map((photo, index) => (
                      <div key={`${photo.name}-${index}`} className="lead-photo-item">
                        <div className="lead-photo-meta">
                          {photoPreviewUrls[index] && (
                            <img
                              src={photoPreviewUrls[index]}
                              alt={photo.name}
                              className="lead-photo-preview"
                            />
                          )}
                          <span>{getGeneratedPhotoName(photo, index)}</span>
                        </div>
                        <button
                          type="button"
                          className="lead-photo-remove"
                          onClick={() => removePhoto(index)}
                          disabled={submitStatus === 'sending'}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="lead-form-group full-width">
                <label htmlFor="notes">Notes <span className="required">*</span></label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Describe the lead, location, contact info, etc."
                  rows={5}
                  required
                />
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
                  required={!gpsFromAutoFill}
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="city">City {!gpsFromAutoFill && <span className="required">*</span>}</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  required={!gpsFromAutoFill}
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="state">State {!gpsFromAutoFill && <span className="required">*</span>}</label>
                <input
                  type="text"
                  className="lead-state-search"
                  placeholder="Search state by name or abbreviation..."
                  value={stateSearchQuery}
                  onChange={(e) => setStateSearchQuery(e.target.value)}
                />
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required={!gpsFromAutoFill}
                >
                  <option value="">Select a state...</option>
                  {filteredStates.map(s => (
                    <option key={s.abbr} value={s.abbr}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="lead-form-group">
                <label htmlFor="zipCode">Zip Code {!gpsFromAutoFill && <span className="required">*</span>}</label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="e.g. 10601"
                  required={!gpsFromAutoFill}
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="latitude">Latitude <span className="required">*</span></label>
                <input
                  type="text"
                  id="latitude"
                  name="latitude"
                  value={formData.latitude}
                  onChange={(e) => {
                    setGpsFromAutoFill(false);
                    handleChange(e);
                  }}
                  placeholder="e.g. 41.030976"
                  required
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="longitude">Longitude <span className="required">*</span></label>
                <input
                  type="text"
                  id="longitude"
                  name="longitude"
                  value={formData.longitude}
                  onChange={(e) => {
                    setGpsFromAutoFill(false);
                    handleChange(e);
                  }}
                  placeholder="e.g. -73.761618"
                  required
                />
              </div>
              <div className="lead-form-group full-width">
                <div className="lead-location-row">
                  <button
                    type="button"
                    className="lead-reset-btn"
                    onClick={handleUseCurrentLocation}
                    disabled={submitStatus === 'sending'}
                  >
                    <i className="fa-solid fa-location-crosshairs"></i> Use Current Location
                  </button>
                  <span className="lead-location-hint">
                    {gpsFromAutoFill
                      ? 'Latitude/longitude auto-filled from browser location.'
                      : 'Browser location helps prefill coordinates on mobile and web.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lead-form-section">
            <h2>Site Information</h2>
            <div className="lead-form-grid">
              <div className="lead-form-group">
                <label htmlFor="siteType">Site Type</label>
                <select
                  id="siteType"
                  name="siteType"
                  value={formData.siteType}
                  onChange={handleChange}
                >
                  {SITE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
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
                setGpsFromAutoFill(false);
                const fileInput = document.getElementById('photos') as HTMLInputElement;
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
