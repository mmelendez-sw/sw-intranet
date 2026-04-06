import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { Navigate } from 'react-router-dom';
import * as exifr from 'exifr';
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

// Apple mandates WKWebView for every iOS browser (Safari, Edge, Chrome, etc.).
// WKWebView navigates popup windows to about:blank after a cross-origin
// redirect, causing acquireTokenPopup to fail. Detect any iOS browser so we
// can fall back to a redirect-based token flow instead.
const isIOS = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

// sessionStorage key used to persist form text fields across a token-refresh
// redirect so the user does not lose their work on iOS Edge.
const LEADGEN_RESTORE_KEY = 'leadgen_pending_restore';

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
  const hasSignedInAccount = instance.getAllAccounts().length > 0;
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [gpsFromAutoFill, setGpsFromAutoFill] = useState(false);
  const [gpsAutoSource, setGpsAutoSource] = useState<'exif' | 'browser' | null>(null);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [sessionRestored, setSessionRestored] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  if (!userInfo.isAuthenticated && !hasSignedInAccount) {
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

  useEffect(() => {
    if (submitStatus === 'success' || submitStatus === 'error' || submitStatus === 'sending') {
      requestAnimationFrame(() => {
        alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [submitStatus]);

  // On iOS Edge, a failed acquireTokenPopup triggers a full-page redirect to
  // refresh the token. When the page reloads, restore whatever text fields were
  // saved before the redirect so the user does not lose their work.
  useEffect(() => {
    const saved = sessionStorage.getItem(LEADGEN_RESTORE_KEY);
    if (!saved) return;
    sessionStorage.removeItem(LEADGEN_RESTORE_KEY);
    try {
      const parsed = JSON.parse(saved);
      setFormData(prev => ({ ...prev, ...parsed, photos: [] }));
      setSessionRestored(true);
    } catch {
      // Corrupted storage — silently ignore and let the user start fresh.
    }
  }, []);

  const getGeneratedPhotoName = (photo: File, index: number): string => {
    const userToken = toSafeToken(emailPrefix, 'unknown');
    const cityToken = toSafeToken(formData.city, '');
    const stateToken = toSafeToken(formData.state, '');
    const monthYear = getMonthYearToken();
    const extension = photo.name.includes('.') ? `.${photo.name.split('.').pop()}` : '.jpg';
    const locationPart = [cityToken, stateToken].filter(Boolean).join('_');
    const parts = [userToken, locationPart, monthYear, String(index + 1)].filter(Boolean);
    return `${parts.join('_')}${extension}`;
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
      setGpsAutoSource('browser');
      return true;
    } catch {
      return false;
    }
  };

  const tryExtractGpsFromPhoto = async (file: File): Promise<boolean> => {
    try {
      const gps = await exifr.gps(file);
      const latitude = typeof gps?.latitude === 'number' ? gps.latitude : null;
      const longitude = typeof gps?.longitude === 'number' ? gps.longitude : null;
      if (latitude === null || longitude === null) {
        return false;
      }

      setFormData(prev => ({
        ...prev,
        latitude: String(latitude),
        longitude: String(longitude),
      }));
      setGpsFromAutoFill(true);
      setGpsAutoSource('exif');
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

    let filledFromExif = false;
    for (const file of selected) {
      // Stop at the first photo that contains valid GPS metadata.
      // This mirrors mobile behavior where one good photo can seed coordinates.
      const extracted = await tryExtractGpsFromPhoto(file);
      if (extracted) {
        filledFromExif = true;
        break;
      }
    }

    if (!filledFromExif) {
      const filledFromBrowser = await tryAutofillFromBrowserLocation();
      if (!filledFromBrowser) {
        setGpsFromAutoFill(false);
        setGpsAutoSource(null);
      }
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
      // acquireTokenRedirect would navigate the mobile browser away from the
      // form entirely. Use acquireTokenPopup instead so the user stays on the
      // page and their form data is preserved. The popup is triggered from a
      // form-submit user gesture, which mobile browsers allow.
      try {
        tokenResponse = await instance.acquireTokenPopup({
          scopes: ['Mail.Send'],
          account: activeAccount,
        });
      } catch (popupError: any) {
        if (
          popupError.errorCode === 'popup_window_error' ||
          popupError.errorCode === 'empty_window_error'
        ) {
          // On any iOS browser (WKWebView), popups land on about:blank and can
          // never complete. Save the serializable form fields to sessionStorage
          // so the user's work is restored after the redirect, then kick off a
          // full-page token refresh redirect.
          if (isIOS()) {
            sessionStorage.setItem(LEADGEN_RESTORE_KEY, JSON.stringify({
              address: data.address,
              city: data.city,
              state: data.state,
              zipCode: data.zipCode,
              latitude: data.latitude,
              longitude: data.longitude,
              notes: data.notes,
              siteType: data.siteType,
            }));
            await instance.acquireTokenRedirect({
              scopes: ['Mail.Send'],
              account: activeAccount,
            });
            return; // Page navigates away — execution stops here.
          }
          throw new Error(
            'Your session has expired and a sign-in popup was blocked by the browser. ' +
            'Please tap the Login button in the header to re-authenticate, then try submitting again.'
          );
        }
        throw popupError;
      }
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
        ${data.latitude && data.longitude ? `
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Map</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">
            <a href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" target="_blank" style="color: #1a73e8;">
              View on Google Maps
            </a>
          </td>
        </tr>` : ''}
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
              address: 'EmployeeLeads@symphonyinfra.com',
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

    if (!hasLatLong) {
      if (!formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.zipCode.trim()) {
        setSubmitStatus('error');
        setErrorMessage('Please provide either coordinates or a full address (street, city, state, zip).');
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

        {/* PENDING LEGAL APPROVAL — uncomment once final disclaimer messaging is received
        <div className="lead-safety-disclaimer">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>Safety Disclaimer</strong>
            <p>
              Please do not take any photos, trespass, or perform any action that could put you in harm's way while
              participating in this activity. Your safety is the top priority — never put yourself at risk for a lead
              submission. Do not enter private property without permission, and always follow traffic laws and safe
              driving practices when scouting locations.
            </p>
          </div>
        </div>
        */}

        {submitStatus === 'success' && (
          <div ref={alertRef} className="lead-alert lead-alert-success lead-alert-spotlight">
            <i className="fa-solid fa-circle-check"></i>
            <div>
              <strong>Lead submitted successfully!</strong>
              <p>We are one step closer to our team goal, and you are one step closer to winning the contest.</p>
            </div>
          </div>
        )}

        {submitStatus === 'sending' && (
          <div ref={alertRef} className="lead-alert lead-alert-sending lead-alert-spotlight">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <div>
              <strong>Submitting your lead...</strong>
              <p>Please wait while we upload photos and send the submission email.</p>
            </div>
          </div>
        )}

        {submitStatus === 'error' && (
          <div ref={alertRef} className="lead-alert lead-alert-error lead-alert-spotlight">
            <i className="fa-solid fa-circle-exclamation"></i>
            <div>
              <strong>Failed to submit lead.</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {sessionRestored && (
          <div className="lead-alert lead-alert-sending lead-alert-spotlight">
            <i className="fa-solid fa-rotate"></i>
            <div>
              <strong>Session refreshed — your details have been restored.</strong>
              <p>Your text fields are pre-filled. Please re-attach your photos and submit again.</p>
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
                <label htmlFor="address">Address {!hasLatLong && <span className="required">*</span>}</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                  required={!hasLatLong}
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="city">City {!hasLatLong && <span className="required">*</span>}</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  required={!hasLatLong}
                />
              </div>
              <div className="lead-form-group">
                <label htmlFor="state">State {!hasLatLong && <span className="required">*</span>}</label>
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
                  required={!hasLatLong}
                >
                  <option value="">Select a state...</option>
                  {filteredStates.map(s => (
                    <option key={s.abbr} value={s.abbr}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="lead-form-group">
                <label htmlFor="zipCode">Zip Code {!hasLatLong && <span className="required">*</span>}</label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="e.g. 10601"
                  required={!hasLatLong}
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
                    setGpsAutoSource(null);
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
                    setGpsAutoSource(null);
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
                      ? (gpsAutoSource === 'exif'
                        ? 'Latitude/longitude auto-filled from photo EXIF GPS.'
                        : 'Latitude/longitude auto-filled from browser location.')
                      : 'Coordinates can auto-fill from photo EXIF GPS, then browser location fallback.'}
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
                setGpsAutoSource(null);
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
